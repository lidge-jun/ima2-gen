import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join, sep } from "node:path";
import { RECEIPT_FILE, isReceiptPath, receiptError, sourceInputDigest } from "./uiBuildReceiptSchema.mjs";

const run = promisify(execFile);
export const SOURCE_DIRS = ["ui/src", "ui/public", "ui/dev", "ui/e2e"];
export const SOURCE_FILES = [
  "ui/index.html", "ui/package.json", "ui/package-lock.json", "ui/vite.config.ts",
  "ui/playwright.config.ts", "ui/tsconfig.json", "ui/tsconfig.app.json",
  "ui/tsconfig.node.json", "ui/tsconfig.e2e.json", "package.json", "package-lock.json",
  "tsconfig.json", "tsconfig.build.json", "tsconfig.bin.json", "scripts/fix-shebangs.mjs",
  "scripts/write-ui-build-receipt.mjs", "scripts/lib/uiBuildReceipt.mjs",
  "scripts/lib/uiBuildReceipt.d.mts", "scripts/lib/uiBuildReceiptSchema.mjs",
  "scripts/lib/uiBuildReceiptFiles.mjs", "scripts/lib/uiBuildReceiptTransaction.mjs",
  "lib/presetCompiler.ts", "lib/presetCompiler.js", "lib/videoMotionPresets.ts",
  "lib/videoMotionPresets.js", "presets/camera-motion.json", "presets/style.json", "presets/lighting.json",
];
const SWITCHES = ["VITE_SOURCEMAP", "VITE_IMA2_DEV", "VITE_IMA2_NODE_MODE", "VITE_IMA2_CARD_NEWS", "VITE_IMA2_AGENT_MODE"];
export const FIXTURE_API_TARGET = "http://127.0.0.1:1";
const DOTENV_NAMES = [".env", ".env.local", ".env.production", ".env.production.local"];
const SECRET_NAME = /^(?:\.env(?:\..*)?|auth\.json|config\.json|\.ima2|\.codex|\.grok|\.progrok|\.git|.*\.(?:db|sqlite)(?:[.-].*)?)$/i;
const SOURCE_ARTIFACT = /^(?:node_modules|dist|test-results|playwright-report|.*\.tsbuildinfo)$/;

export async function canonicalDirectory(path) {
  try {
    const metadata = await lstat(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw receiptError("UI_RECEIPT_PATH");
    return await realpath(path);
  } catch (error) { throw error?.code?.startsWith("UI_RECEIPT_") ? error : receiptError("UI_RECEIPT_PATH"); }
}

export function readBuildOptions(env = process.env) {
  const allowed = new Set([...SWITCHES, "VITE_IMA2_API_TARGET"]);
  if (Object.keys(env).some((key) => key.startsWith("VITE_") && !allowed.has(key))
    || SWITCHES.some((key) => env[key] !== undefined && env[key] !== "0" && env[key] !== "1")
    || (env.VITE_IMA2_API_TARGET !== undefined && env.VITE_IMA2_API_TARGET !== FIXTURE_API_TARGET)) {
    throw receiptError("UI_RECEIPT_OPTIONS");
  }
  return { mode: "production", sourcemap: env.VITE_SOURCEMAP === "1", devUi: env.VITE_IMA2_DEV === "1",
    nodeMode: env.VITE_IMA2_NODE_MODE !== "0", cardNews: env.VITE_IMA2_CARD_NEWS !== "0",
    agentMode: env.VITE_IMA2_AGENT_MODE !== "0" };
}

export function fixtureCompilerEnvironment(env = process.env) {
  readBuildOptions(env);
  const names = ["PATH", "SystemRoot", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT", "LANG", "LC_ALL", "TMPDIR", "TMP", "TEMP", ...SWITCHES];
  const child = Object.fromEntries(names.flatMap((key) => env[key] === undefined ? [] : [[key, env[key]]]));
  return { ...child, NODE_ENV: "production", VITE_IMA2_API_TARGET: FIXTURE_API_TARGET, IMA2_UI_RECEIPT_BUILD: "1" };
}

async function rejectDotenv(root) {
  for (const directory of [root, join(root, "ui")]) for (const name of DOTENV_NAMES) {
    try { await lstat(join(directory, name)); }
    catch (error) { if (error.code === "ENOENT") continue; throw receiptError("UI_RECEIPT_PATH"); }
    throw receiptError("UI_RECEIPT_ENV");
  }
}

async function checkedPath(root, relativePath, directory = false) {
  if (!isReceiptPath(relativePath)) throw receiptError("UI_RECEIPT_PATH");
  const parts = relativePath.split("/");
  let path = root;
  try {
    for (const [index, part] of parts.entries()) {
      path = join(path, part);
      const metadata = await lstat(path);
      const last = index === parts.length - 1;
      if (metadata.isSymbolicLink() || (!(last && !directory) && !metadata.isDirectory())
        || (last && !directory && !metadata.isFile())) throw receiptError("UI_RECEIPT_PATH");
    }
    return path;
  } catch (error) { throw error?.code?.startsWith("UI_RECEIPT_") ? error : receiptError("UI_RECEIPT_PATH"); }
}

async function digestFile(root, path) {
  let handle;
  try {
    const absolute = await checkedPath(root, path);
    const expected = await lstat(absolute, { bigint: true });
    handle = await open(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.dev !== expected.dev || before.ino !== expected.ino
      || before.size > BigInt(Number.MAX_SAFE_INTEGER)) throw receiptError("UI_RECEIPT_PATH");
    const hash = createHash("sha256"), chunk = Buffer.alloc(64 * 1024);
    let bytes = 0;
    while (true) {
      const next = await handle.read(chunk, 0, chunk.length, null);
      if (!next.bytesRead) break;
      bytes += next.bytesRead;
      if (BigInt(bytes) > before.size) throw receiptError("UI_RECEIPT_BUILD_CHANGED");
      hash.update(chunk.subarray(0, next.bytesRead));
    }
    const after = await handle.stat({ bigint: true });
    const pathAfter = await lstat(absolute, { bigint: true });
    if (BigInt(bytes) !== before.size || after.size !== before.size || after.mtimeNs !== before.mtimeNs
      || pathAfter.ino !== before.ino || pathAfter.dev !== before.dev || pathAfter.isSymbolicLink()) {
      throw receiptError("UI_RECEIPT_BUILD_CHANGED");
    }
    return { path, bytes, sha256: hash.digest("hex") };
  } catch (error) { throw error?.code?.startsWith("UI_RECEIPT_") ? error : receiptError("UI_RECEIPT_IO"); }
  finally { await handle?.close(); }
}

async function walk(root, relativeDir, output, source) {
  const directory = relativeDir ? await checkedPath(root, relativeDir, true) : root;
  const names = await readdir(directory);
  for (const name of names.sort()) {
    const path = relativeDir ? `${relativeDir}/${name}` : name;
    if (!source && path === RECEIPT_FILE) continue;
    if (!isReceiptPath(path) || (source && (SECRET_NAME.test(name) || SOURCE_ARTIFACT.test(name)))) {
      throw receiptError("UI_RECEIPT_PATH");
    }
    const metadata = await lstat(join(root, path));
    if (metadata.isSymbolicLink()) throw receiptError("UI_RECEIPT_PATH");
    if (metadata.isDirectory()) await walk(root, path, output, source);
    else if (metadata.isFile()) output.push(path);
    else throw receiptError("UI_RECEIPT_PATH");
  }
}

async function digestPaths(root, paths) {
  const sorted = [...paths].sort();
  if (new Set(sorted.map((path) => path.toLowerCase())).size !== sorted.length) throw receiptError("UI_RECEIPT_PATH");
  const files = [];
  for (const path of sorted) files.push(await digestFile(root, path));
  return files;
}

export async function inventoryUiSourceInputs(repoRoot) {
  try {
    const root = await canonicalDirectory(repoRoot);
    await rejectDotenv(root);
    const paths = [...SOURCE_FILES];
    for (const directory of SOURCE_DIRS) await walk(root, directory, paths, true);
    return await digestPaths(root, paths);
  } catch (error) { throw error?.code?.startsWith("UI_RECEIPT_") ? error : receiptError("UI_RECEIPT_SOURCE"); }
}

export async function inventoryUiOutputs(distDir) {
  try {
    const root = await canonicalDirectory(distDir), paths = [];
    await walk(root, "", paths, false);
    const files = await digestPaths(root, paths);
    if (!files.some((file) => file.path === "index.html" && file.bytes > 0)) throw receiptError("UI_RECEIPT_OUTPUT");
    return files;
  } catch (error) { throw error?.code?.startsWith("UI_RECEIPT_") ? error : receiptError("UI_RECEIPT_OUTPUT"); }
}

async function readHead(root) {
  try {
    let metadata;
    try { metadata = await lstat(join(root, ".git")); }
    catch (error) { if (error.code === "ENOENT") return null; throw error; }
    if (metadata.isSymbolicLink() || (!metadata.isFile() && !metadata.isDirectory())) throw receiptError("UI_RECEIPT_HEAD");
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_(?:DIR|WORK_TREE|COMMON_DIR|INDEX_FILE|CONFIG)/.test(key)));
    const options = { cwd: root, encoding: "utf8", timeout: 10_000, maxBuffer: 4096, env };
    const top = (await run("git", ["rev-parse", "--show-toplevel"], options)).stdout.trim();
    if (await realpath(top) !== root) throw receiptError("UI_RECEIPT_HEAD");
    const head = (await run("git", ["rev-parse", "HEAD"], options)).stdout.trim();
    if (!/^[a-f0-9]{40}$/.test(head)) throw receiptError("UI_RECEIPT_HEAD");
    return head;
  } catch { throw receiptError("UI_RECEIPT_HEAD"); }
}

export async function readUiSourceSnapshot(repoRoot) {
  const root = await canonicalDirectory(repoRoot);
  const buildOptions = readBuildOptions(), headSha = await readHead(root);
  const files = await inventoryUiSourceInputs(root);
  if (await readHead(root) !== headSha) throw receiptError("UI_RECEIPT_BUILD_CHANGED");
  return { headSha, sourceInputDigest: sourceInputDigest(files, buildOptions), buildOptions };
}

export function sourceWatchTargets(root) {
  const parents = new Map();
  for (const path of [...SOURCE_FILES, ...DOTENV_NAMES, ...DOTENV_NAMES.map((name) => `ui/${name}`)]) {
    const absolute = join(root, path), parent = dirname(absolute);
    const names = parents.get(parent) ?? new Set();
    names.add(absolute.slice(parent.length + sep.length)); parents.set(parent, names);
  }
  return [...SOURCE_DIRS.map((path) => ({ path: join(root, path), recursive: true, names: null })),
    ...[...parents].map(([path, names]) => ({ path, recursive: false, names }))];
}
