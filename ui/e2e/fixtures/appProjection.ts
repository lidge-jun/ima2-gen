import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { lstat, mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { verifyUiBuildReceipt, inventoryUiOutputs, type FileDigest } from "../../../scripts/lib/uiBuildReceipt.mjs";
import { requireAppHome } from "./appOwnership";
import { getVerifiedRuntimeBuild, readRuntimeFile } from "./appRuntimeBuild";

export type Projection = { root: string; policyPath: string; guardPath: string; entryPath: string; dispose(): Promise<void> };
type OwnedProjection = {
  container: string; dev: number; ino: number; rootDev: number; rootIno: number;
  repoRoot: string; buildDir: string; dependencies: string;
  manifest: FileDigest[]; uiOutputs: FileDigest[]; disposed: boolean;
};
const issued = new WeakMap<Projection, OwnedProjection>();
const run = promisify(execFile);
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const fail = (): never => { throw new Error("E2E_PROJECTION_INVALID"); };
async function put(root: string, path: string, bytes: Buffer, manifest: FileDigest[]): Promise<void> {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes, { flag: "wx" });
  manifest.push({ path, bytes: bytes.length, sha256: hash(bytes) });
}
async function runtimeAssets(repoRoot: string): Promise<string[]> {
  const result = await run("git", ["ls-files", "-z", "--cached", "--", "assets/card-news/templates",
    "assets/mcp-snapshots/higgsfield.sanitized.json", "assets/mcp-snapshots/runway.sanitized.json"], {
    cwd: repoRoot, encoding: "utf8", timeout: 10000, maxBuffer: 1024 * 1024,
  });
  const paths = result.stdout.split("\0").filter(Boolean);
  if (!paths.includes("assets/mcp-snapshots/higgsfield.sanitized.json")
    || !paths.includes("assets/mcp-snapshots/runway.sanitized.json")) return fail();
  return paths;
}

export async function verifyAppProjection(projection: Projection): Promise<void> {
  const state = issued.get(projection);
  if (!state || state.disposed) return fail();
  const metadata = await lstat(projection.root);
  if (!metadata.isDirectory() || metadata.isSymbolicLink() || metadata.dev !== state.rootDev
    || metadata.ino !== state.rootIno || await realpath(projection.root) !== projection.root) return fail();
  const link = join(projection.root, "node_modules");
  if (!(await lstat(link)).isSymbolicLink() || await realpath(link) !== state.dependencies) return fail();
  for (const file of state.manifest) {
    const bytes = await readRuntimeFile(projection.root, file.path);
    if (bytes.length !== file.bytes || hash(bytes) !== file.sha256) return fail();
  }
  const actualUi = await inventoryUiOutputs(join(projection.root, "ui/dist"));
  if (JSON.stringify(actualUi) !== JSON.stringify(state.uiOutputs)) return fail();
  try { await lstat(join(projection.root, "ui/dist/.ima2-ui-build-receipt.json")); return fail(); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  await verifyUiBuildReceipt({ repoRoot: state.repoRoot, distDir: state.buildDir, requireGitHead: true });
  await getVerifiedRuntimeBuild(state.repoRoot);
}
export async function createAppProjection(options: { repoRoot: string; home: string; buildDir: string }): Promise<Projection> {
  await requireAppHome(options.home);
  const repoRoot = await realpath(options.repoRoot), buildDir = await realpath(options.buildDir);
  const { receipt } = await verifyUiBuildReceipt({ repoRoot, distDir: buildDir, requireGitHead: true });
  const runtime = await getVerifiedRuntimeBuild(repoRoot);
  const container = await realpath(await mkdtemp(join(tmpdir(), "ima2-projection-")));
  const containerIdentity = await lstat(container);
  const root = join(container, "runtime");
  await mkdir(root);
  const rootIdentity = await lstat(root);
  const dependencies = await realpath(join(repoRoot, "node_modules"));
  const state: OwnedProjection = { container, dev: containerIdentity.dev, ino: containerIdentity.ino,
    rootDev: rootIdentity.dev, rootIno: rootIdentity.ino, repoRoot, buildDir, dependencies,
    manifest: [], uiOutputs: receipt.outputs, disposed: false };
  const projection: Projection = { root, policyPath: join(root, "fixture-policy.json"),
    guardPath: join(root, "appNetworkGuard.mjs"), entryPath: join(root, "server.js"),
    async dispose() {
      if (state.disposed) return;
      const current = await lstat(container);
      if (!current.isDirectory() || current.isSymbolicLink() || current.dev !== state.dev
        || current.ino !== state.ino || await realpath(container) !== container) return fail();
      await rm(container, { recursive: true, force: false }); state.disposed = true;
    },
  };
  issued.set(projection, state);
  try {
    for (const file of runtime.files) {
      const bytes = await readRuntimeFile(runtime.root, file.emittedPath);
      if (hash(bytes) !== file.emittedSha256) return fail();
      await put(root, file.emittedPath, bytes, state.manifest);
    }
    for (const path of await runtimeAssets(repoRoot)) await put(root, path, await readRuntimeFile(repoRoot, path), state.manifest);
    for (const file of receipt.outputs) {
      const bytes = await readRuntimeFile(buildDir, file.path);
      if (bytes.length !== file.bytes || hash(bytes) !== file.sha256) return fail();
      await put(root, "ui/dist/" + file.path, bytes, state.manifest);
    }
    await symlink(dependencies, join(root, "node_modules"), "dir");
    await put(root, "fixture-policy.json", Buffer.from(JSON.stringify({
      version: 1, root, home: options.home, dependencyRoots: [dependencies],
    })), state.manifest);
    await verifyAppProjection(projection);
    return Object.freeze(projection);
  } catch (error) {
    try { await projection.dispose(); }
    catch (cleanup) { throw new AggregateError([error, cleanup], "E2E_PROJECTION_AND_CLEANUP"); }
    throw error;
  }
}
