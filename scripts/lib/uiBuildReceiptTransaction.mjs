import { watch } from "node:fs";
import { lstat, mkdir, readFile, rename, rmdir, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { RECEIPT_FILE, assertUiReceiptBinding, parseUiBuildReceipt, receiptError } from "./uiBuildReceiptSchema.mjs";
import { canonicalDirectory, inventoryUiOutputs, readUiSourceSnapshot, sourceWatchTargets } from "./uiBuildReceiptFiles.mjs";

const transactions = new WeakMap();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const exactHeadRequired = () => process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";

async function pathsFor(repoRoot, create = false) {
  const root = await canonicalDirectory(repoRoot);
  let cursor = root;
  for (const part of ["ui", "node_modules", ".cache", "ima2-ui-build"]) {
    cursor = join(cursor, part);
    if (create && (part === ".cache" || part === "ima2-ui-build")) {
      try { await mkdir(cursor); } catch (error) { if (error.code !== "EEXIST") throw error; }
    }
    await canonicalDirectory(cursor);
  }
  return { root, cache: cursor, active: join(cursor, "active"), receipt: join(root, "ui", "dist", RECEIPT_FILE) };
}

async function unlinkRegular(path) {
  try {
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw receiptError("UI_RECEIPT_PATH");
    await unlink(path);
  } catch (error) { if (error.code !== "ENOENT") throw error; }
}

function installWatchers(state) {
  for (const target of sourceWatchTargets(state.root)) {
    const watcher = watch(target.path, { recursive: target.recursive }, (_event, filename) => {
      if (filename == null || target.names === null || target.names.has(String(filename))) state.changed = true;
    });
    state.watchers.push(watcher);
    watcher.on("error", () => { state.changed = true; });
  }
}

async function assertOwnedLock(state) {
  const current = await lstat(state.active, { bigint: true });
  if (!current.isDirectory() || current.isSymbolicLink() || current.dev !== state.identity.dev
    || current.ino !== state.identity.ino) throw receiptError("UI_RECEIPT_TRANSACTION");
  if (state.inputWritten) {
    const input = JSON.parse(await readFile(join(state.active, "input.json"), "utf8"));
    if (input.schemaVersion !== 1 || input.nonce !== state.nonce || !same(input.source, state.source)) {
      throw receiptError("UI_RECEIPT_TRANSACTION");
    }
  }
}

async function release(state, keepReceipt) {
  for (const watcher of state.watchers.splice(0)) watcher.close();
  await assertOwnedLock(state);
  if (!keepReceipt && state.published) await unlinkRegular(state.receipt);
  for (const name of ["receipt.tmp", "input.tmp", "input.json"]) await unlinkRegular(join(state.active, name));
  await rmdir(state.active);
  state.released = true;
}

export async function beginUiBuild(repoRoot) {
  let state;
  try {
    const paths = await pathsFor(repoRoot, true);
    try { await mkdir(paths.active); }
    catch (error) { if (error.code === "EEXIST") throw receiptError("UI_RECEIPT_BUSY"); throw error; }
    state = { ...paths, nonce: randomUUID(), identity: await lstat(paths.active, { bigint: true }),
      source: null, watchers: [], changed: false, inputWritten: false, published: false, finished: false, released: false };
    installWatchers(state);
    state.source = await readUiSourceSnapshot(state.root);
    if (state.changed) throw receiptError("UI_RECEIPT_BUILD_CHANGED");
    if (exactHeadRequired() && !state.source.headSha) throw receiptError("UI_RECEIPT_HEAD");
    const input = JSON.stringify({ schemaVersion: 1, nonce: state.nonce, source: state.source });
    await writeFile(join(state.active, "input.tmp"), input, { flag: "wx", mode: 0o600 });
    await rename(join(state.active, "input.tmp"), join(state.active, "input.json")); state.inputWritten = true;
    // A competing begin was rejected before this invalidation, so it cannot steal a receipt.
    const dist = join(state.root, "ui", "dist");
    const distExists = await lstat(dist).then(() => true, (error) => {
      if (error.code === "ENOENT") return false;
      throw error;
    });
    if (distExists) { await canonicalDirectory(dist); await unlinkRegular(state.receipt); }
    const transaction = Object.freeze({ nonce: state.nonce, source: structuredClone(state.source) });
    transactions.set(transaction, state);
    return transaction;
  } catch (error) {
    if (state) {
      try { await release(state, false); }
      catch { throw receiptError("UI_RECEIPT_CLEANUP"); }
    }
    throw error?.code?.startsWith("UI_RECEIPT_") ? error : receiptError("UI_RECEIPT_IO");
  }
}

async function stateFor(repoRoot, transaction) {
  const state = transactions.get(transaction);
  if (!state || state.released || state.finished || state.root !== await canonicalDirectory(repoRoot)
    || transaction.nonce !== state.nonce || !same(transaction.source, state.source)) {
    throw receiptError("UI_RECEIPT_TRANSACTION");
  }
  await assertOwnedLock(state);
  return state;
}

async function currentSource(state) {
  const current = await readUiSourceSnapshot(state.root);
  if (state.changed || !same(current, state.source)) throw receiptError("UI_RECEIPT_BUILD_CHANGED");
  return current;
}

export async function finishUiBuild(repoRoot, transaction) {
  const state = await stateFor(repoRoot, transaction);
  try {
    await currentSource(state);
    const dist = join(state.root, "ui", "dist");
    await canonicalDirectory(dist);
    const outputs = await inventoryUiOutputs(dist);
    await currentSource(state);
    const receipt = parseUiBuildReceipt({ schemaVersion: 1, ...state.source, outputs });
    const temporary = join(state.active, "receipt.tmp");
    await writeFile(temporary, JSON.stringify(receipt) + "\n", { flag: "wx", mode: 0o600 });
    await assertOwnedLock(state);
    await rename(temporary, state.receipt); state.published = true;
    const published = parseUiBuildReceipt(JSON.parse(await readFile(state.receipt, "utf8")));
    assertUiReceiptBinding(published, await currentSource(state), await inventoryUiOutputs(dist), exactHeadRequired());
    await currentSource(state);
    state.finished = true;
    return published;
  } catch (error) {
    if (state.published) { await unlinkRegular(state.receipt); state.published = false; }
    throw error?.code?.startsWith("UI_RECEIPT_") ? error : receiptError("UI_RECEIPT_IO");
  }
}

export async function abortUiBuild(repoRoot, transaction) {
  const state = transactions.get(transaction);
  if (!state) throw receiptError("UI_RECEIPT_TRANSACTION");
  if (state.released) return;
  if (state.root !== await canonicalDirectory(repoRoot) || transaction.nonce !== state.nonce) throw receiptError("UI_RECEIPT_CLEANUP");
  try { await release(state, state.finished); }
  catch { throw receiptError("UI_RECEIPT_CLEANUP"); }
}

export async function verifyUiBuildReceipt({ repoRoot, distDir, requireGitHead }) {
  try {
    const root = await canonicalDirectory(repoRoot);
    const active = join(root, "ui", "node_modules", ".cache", "ima2-ui-build", "active");
    try { await lstat(active); throw receiptError("UI_RECEIPT_BUSY"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    const dist = await canonicalDirectory(distDir), path = join(dist, RECEIPT_FILE);
    let text;
    try {
      const metadata = await lstat(path);
      if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 8 * 1024 * 1024) throw receiptError("UI_RECEIPT_SCHEMA");
      text = await readFile(path, "utf8");
    } catch (error) { if (error.code === "ENOENT") throw receiptError("UI_RECEIPT_MISSING"); throw error; }
    let receipt;
    try { receipt = parseUiBuildReceipt(JSON.parse(text)); }
    catch { throw receiptError("UI_RECEIPT_SCHEMA"); }
    const current = await readUiSourceSnapshot(root);
    const binding = assertUiReceiptBinding(receipt, current, await inventoryUiOutputs(dist), requireGitHead || exactHeadRequired());
    try { await lstat(active); throw receiptError("UI_RECEIPT_BUSY"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    return { receipt, binding };
  } catch (error) { throw error?.code?.startsWith("UI_RECEIPT_") ? error : receiptError("UI_RECEIPT_IO"); }
}
