import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { lstat, mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

export type EmittedSnapshot = {
  root: string; sourceDigest: string; compilerVersion: string;
  files: readonly { sourcePath: string; sourceSha256: string; emittedPath: string; emittedSha256: string }[];
};
export const RUNTIME_GUARDS = ["appPolicy.mjs", "appFilePaths.mjs", "appFileDescriptors.mjs",
  "appFilesystemGuard.mjs", "appProcessGuard.mjs", "appNetworkGuard.mjs"] as const;
type SourceFile = { path: string; bytes: Buffer; sha256: string };
type Cache = { repoRoot: string; container: string; dev: number; ino: number; head: string; compilerIdentity: string;
  sourceDigest: string; snapshot: EmittedSnapshot };
let pending: Promise<Cache> | undefined;
let cache: Cache | undefined;
const run = promisify(execFile);
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const fail = (code: string): never => { throw new Error(code); };
const normalize = (path: string) => path.replaceAll("\\", "/");
const safeRelative = (path: string) => path.length > 0 && !isAbsolute(path) && !/[\\\\\x00-\x1f]/.test(path)
  && path.split("/").every((part) => part && part !== "." && part !== "..");

async function fileBytes(root: string, path: string): Promise<Buffer> {
  if (!safeRelative(path)) return fail("E2E_SOURCE_PATH");
  let absolute = root;
  for (const [index, part] of path.split("/").entries()) {
    absolute = join(absolute, part);
    const metadata = await lstat(absolute);
    if (metadata.isSymbolicLink() || (index === path.split("/").length - 1 ? !metadata.isFile() : !metadata.isDirectory())) return fail("E2E_SOURCE_FILE");
  }
  const before = await lstat(absolute), bytes = await readFile(absolute), after = await lstat(absolute);
  if (before.dev !== after.dev || before.ino !== after.ino || before.size !== bytes.length
    || after.size !== before.size || after.mtimeMs !== before.mtimeMs) return fail("E2E_SOURCE_CHANGED");
  return bytes;
}
export { fileBytes as readRuntimeFile };
async function git(root: string, args: string[]): Promise<string> {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_(?:DIR|WORK_TREE|COMMON_DIR|INDEX_FILE|CONFIG)/.test(key)));
  const result = await run("git", args, { cwd: root, env, encoding: "utf8", timeout: 10000, maxBuffer: 2 * 1024 * 1024 });
  return result.stdout;
}
async function sources(root: string): Promise<{ head: string; files: SourceFile[]; digest: string }> {
  const head = (await git(root, ["rev-parse", "HEAD"])).trim();
  if (!/^[a-f0-9]{40}$/.test(head) || await realpath((await git(root, ["rev-parse", "--show-toplevel"])).trim()) !== root) return fail("E2E_SOURCE_HEAD");
  const tracked = (await git(root, ["ls-files", "-z", "--cached"])).split("\0").filter(Boolean);
  const exact = new Set(["server.ts", "config.ts", "package.json", "package-lock.json", "tsconfig.json", "tsconfig.build.json", "tsconfig.bin.json",
    ...RUNTIME_GUARDS.map((name) => "ui/e2e/fixtures/" + name)]);
  const paths = tracked.filter((path) => exact.has(path) || /^(?:lib|routes|bin|types)\/.*\.ts$/.test(path));
  for (const path of exact) if (!paths.includes(path)) return fail("E2E_SOURCE_MISSING");
  const files: SourceFile[] = [];
  for (const path of paths.sort()) {
    if (/(?:^|\/)(?:\.env[^/]*|\.ima2|\.codex|\.grok|\.progrok|generated|auth\.json|config\.json|[^/]*\.(?:db|sqlite)[^/]*)(?:\/|$)/i.test(path)) return fail("E2E_SOURCE_FORBIDDEN");
    const bytes = await fileBytes(root, path); files.push({ path, bytes, sha256: hash(bytes) });
  }
  if ((await git(root, ["rev-parse", "HEAD"])).trim() !== head) return fail("E2E_SOURCE_CHANGED");
  return { head, files, digest: hash(JSON.stringify(files.map(({ path, sha256 }) => [path, sha256]))) };
}
async function compiler(root: string): Promise<{ path: string; version: string; identity: string }> {
  const require = createRequire(join(root, "package.json"));
  const manifest = require.resolve("typescript/package.json"), packageRoot = dirname(manifest);
  const version: unknown = JSON.parse(await readFile(manifest, "utf8")).version;
  if (typeof version !== "string") return fail("E2E_COMPILER_VERSION");
  const entries: Array<[string, string]> = [];
  for (const path of ["package.json", "bin/tsc", "lib/tsc.js", "lib/_tsc.js"]) {
    try { entries.push([path, hash(await fileBytes(packageRoot, path))]); }
    catch (error) { if (path === "lib/_tsc.js" && (error as NodeJS.ErrnoException).code === "ENOENT") continue; throw error; }
  }
  return { path: join(packageRoot, "bin/tsc"), version, identity: hash(JSON.stringify([process.version, entries])) };
}
async function put(root: string, path: string, bytes: Buffer): Promise<void> {
  const target = join(root, path); await mkdir(dirname(target), { recursive: true }); await writeFile(target, bytes, { flag: "wx" });
}
function normalizedOutput(path: string, bytes: Buffer): Buffer {
  return path === "bin/ima2.js" && !bytes.subarray(0, 2).equals(Buffer.from("#!"))
    ? Buffer.concat([Buffer.from("#!/usr/bin/env node\n"), bytes]) : bytes;
}
async function emit(tsc: string, stage: string, output: string): Promise<string[]> {
  const files = new Set<string>();
  for (const config of ["tsconfig.build.json", "tsconfig.bin.json"]) {
    const result = await run(process.execPath, [tsc, "-p", config, "--outDir", output, "--listEmittedFiles"], {
      cwd: stage, encoding: "utf8", timeout: 120000, killSignal: "SIGKILL", maxBuffer: 8 * 1024 * 1024,
    });
    for (const line of result.stdout.split(/\r?\n/)) {
      if (!line.startsWith("TSFILE: ")) continue;
      const path = normalize(relative(output, resolve(line.slice(8))));
      if (!safeRelative(path) || !path.endsWith(".js")) return fail("E2E_EMITTED_PATH");
      files.add(path);
    }
  }
  if (!files.has("server.js") || !files.has("bin/ima2.js")) return fail("E2E_EMITTED_ENTRY");
  return [...files].sort();
}
async function dispose(entry: Cache): Promise<void> {
  const current = await lstat(entry.container);
  if (current.isSymbolicLink() || !current.isDirectory() || current.dev !== entry.dev || current.ino !== entry.ino
    || await realpath(entry.container) !== entry.container) return fail("E2E_CACHE_OWNERSHIP");
  await rm(entry.container, { recursive: true, force: false });
}
async function build(root: string): Promise<Cache> {
  const input = await sources(root), tool = await compiler(root);
  const container = await realpath(await mkdtemp(join(tmpdir(), "ima2-emitted-cache-")));
  const metadata = await lstat(container);
  const state: Cache = { repoRoot: root, container, dev: metadata.dev, ino: metadata.ino, head: input.head,
    compilerIdentity: tool.identity, sourceDigest: input.digest,
    snapshot: { root: join(container, "runtime"), sourceDigest: input.digest, compilerVersion: tool.version, files: [] } };
  try {
    const stage = join(container, "source"), output = state.snapshot.root;
    await mkdir(stage); await mkdir(output);
    for (const file of input.files) await put(stage, file.path, file.bytes);
    const dependencies = await realpath(join(root, "node_modules"));
    await symlink(dependencies, join(stage, "node_modules"), "dir");
    const emitted = await emit(tool.path, stage, output);
    const manifest: EmittedSnapshot["files"][number][] = [];
    for (const path of emitted) {
      const sourcePath = path.slice(0, -3) + ".ts", source = input.files.find((file) => file.path === sourcePath);
      if (!source) return fail("E2E_EMITTED_SOURCE");
      const actual = normalizedOutput(path, await fileBytes(output, path));
      const expected = normalizedOutput(path, await fileBytes(root, path));
      if (!actual.equals(expected)) return fail("E2E_EMITTED_STALE");
      await writeFile(join(output, path), actual);
      manifest.push({ sourcePath, sourceSha256: source.sha256, emittedPath: path, emittedSha256: hash(actual) });
    }
    for (const path of ["package.json", ...RUNTIME_GUARDS.map((name) => "ui/e2e/fixtures/" + name)]) {
      const source = input.files.find((file) => file.path === path)!;
      const target = path === "package.json" ? path : path.split("/").at(-1)!;
      await put(output, target, source.bytes);
      manifest.push({ sourcePath: path, sourceSha256: source.sha256, emittedPath: target, emittedSha256: source.sha256 });
    }
    if ((await sources(root)).digest !== input.digest || (await sources(root)).head !== input.head
      || (await compiler(root)).identity !== tool.identity) return fail("E2E_SOURCE_CHANGED");
    state.snapshot = Object.freeze({ ...state.snapshot, files: Object.freeze(manifest.map((row) => Object.freeze(row))) });
    return state;
  } catch (error) { await dispose(state); throw error; }
}
async function verify(entry: Cache): Promise<void> {
  const input = await sources(entry.repoRoot), tool = await compiler(entry.repoRoot);
  if (input.head !== entry.head || input.digest !== entry.sourceDigest || tool.identity !== entry.compilerIdentity) return fail("E2E_CACHE_STALE");
  for (const file of entry.snapshot.files) {
    if (hash(await fileBytes(entry.snapshot.root, file.emittedPath)) !== file.emittedSha256) return fail("E2E_CACHE_TAMPER");
    if (file.emittedPath.endsWith(".js") && hash(normalizedOutput(file.emittedPath, await fileBytes(entry.repoRoot, file.emittedPath))) !== file.emittedSha256) return fail("E2E_EMITTED_STALE");
  }
}
export async function getVerifiedRuntimeBuild(repoRoot: string): Promise<EmittedSnapshot> {
  const root = await realpath(repoRoot);
  pending ??= build(root).then((entry) => { cache = entry; return entry; }).catch((error) => { pending = undefined; throw error; });
  const entry = await pending;
  if (entry.repoRoot !== root) return fail("E2E_CACHE_ROOT");
  await verify(entry); return entry.snapshot;
}
export async function disposeRuntimeBuildCache(): Promise<void> {
  if (pending) await pending;
  if (cache) await dispose(cache);
  cache = undefined; pending = undefined;
}
