import { constants, type BigIntStats } from "node:fs";
import { lstat, open, realpath, rmdir, unlink, type FileHandle } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { AGY_ARTIFACT_POLICY } from "../config.js";
import { agyError } from "./agyProcess.js";

type Identity = Readonly<{ dev: bigint; ino: bigint }>;
interface RootSnapshot {
  source: string;
  canonical: string;
  identity: Identity;
}
interface ArtifactSnapshot {
  candidate: string;
  canonicalPath: string;
  identity: Identity;
  parentIdentity: Identity;
  root: RootSnapshot;
  roots: readonly RootSnapshot[];
}
export interface AgyArtifactRead {
  readonly buffer: Buffer;
  readonly canonicalPath: string;
  readonly identity: Identity;
  readonly approvedRoots: readonly string[];
}

// Only an issued receipt authorizes cleanup; exposed metadata is not authority.
const receipts = new WeakMap<AgyArtifactRead, ArtifactSnapshot>();
const pathRejected = () => agyError("Agy artifact path was rejected", 502, "AGY_PATH_REJECTED");
const tooLarge = () => agyError("Agy artifact exceeds the size limit", 502, "AGY_ARTIFACT_TOO_LARGE");

function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) throw agyError("Generation canceled", 499, "GENERATION_CANCELED");
}

function canceled(error: unknown): boolean {
  return error instanceof Error && Reflect.get(error, "code") === "GENERATION_CANCELED"
    && Reflect.get(error, "status") === 499;
}

function contained(root: string, target: string): boolean {
  const part = relative(root, target);
  return part !== "" && part !== ".." && !part.startsWith(`..${sep}`) && !isAbsolute(part);
}

function identity(info: BigIntStats): Identity {
  // Filesystems without usable inode identity cannot satisfy this contract.
  if (info.ino <= 0n) throw pathRejected();
  return Object.freeze({ dev: info.dev, ino: info.ino });
}

function sameIdentity(info: BigIntStats, expected: Identity): boolean {
  return info.dev === expected.dev && info.ino === expected.ino;
}

async function approvedRoots(): Promise<RootSnapshot[]> {
  const roots: RootSnapshot[] = [];
  for (const source of [join(homedir(), ".gemini"), join(homedir(), ".cache"), tmpdir()]) {
    try {
      const canonical = await realpath(source);
      const info = await lstat(canonical, { bigint: true });
      if (!info.isDirectory()) throw pathRejected();
      roots.push({ source, canonical, identity: identity(info) });
    } catch (error) {
      if (error instanceof Error && Reflect.get(error, "code") === "ENOENT") continue;
      throw pathRejected();
    }
  }
  return roots;
}

async function validateRoot(root: RootSnapshot): Promise<void> {
  const current = await realpath(root.source);
  const info = await lstat(current, { bigint: true });
  if (current !== root.canonical || !info.isDirectory() || !sameIdentity(info, root.identity)) {
    throw pathRejected();
  }
}

async function inspectCandidate(candidate: string): Promise<ArtifactSnapshot> {
  if (!isAbsolute(candidate) || candidate.includes("\0")
    || (process.platform === "win32" && candidate.slice(2).includes(":"))) throw pathRejected();
  let info: BigIntStats;
  try { info = await lstat(candidate, { bigint: true }); }
  catch (error) {
    if (error instanceof Error && ["ENOENT", "ENOTDIR"].includes(String(Reflect.get(error, "code")))) {
      throw agyError("Agy artifact was not found", 502, "AGY_ARTIFACT_NOT_FOUND");
    }
    throw pathRejected();
  }
  try {
    if (info.isSymbolicLink() || !info.isFile()) throw pathRejected();
    const canonicalPath = await realpath(candidate);
    const roots = await approvedRoots();
    const root = roots.find((entry) => contained(entry.canonical, canonicalPath));
    if (!root) throw pathRejected();
    const parent = await lstat(dirname(canonicalPath), { bigint: true });
    if (!parent.isDirectory()) throw pathRejected();
    return { candidate, canonicalPath, roots, root, identity: identity(info), parentIdentity: identity(parent) };
  } catch { throw pathRejected(); }
}

async function validateMapping(snapshot: ArtifactSnapshot): Promise<void> {
  try {
    await validateRoot(snapshot.root);
    const candidateInfo = await lstat(snapshot.candidate, { bigint: true });
    const canonical = await realpath(snapshot.candidate);
    const canonicalInfo = await lstat(snapshot.canonicalPath, { bigint: true });
    if (!candidateInfo.isFile() || candidateInfo.isSymbolicLink()
      || !sameIdentity(candidateInfo, snapshot.identity) || canonical !== snapshot.canonicalPath
      || !canonicalInfo.isFile() || canonicalInfo.isSymbolicLink()
      || !sameIdentity(canonicalInfo, snapshot.identity)
      || !contained(snapshot.root.canonical, canonical)) throw pathRejected();
  } catch { throw pathRejected(); }
}

async function openChecked(candidate: string): Promise<{ handle: FileHandle; snapshot: ArtifactSnapshot; size: bigint }> {
  const snapshot = await inspectCandidate(candidate);
  let handle: FileHandle | undefined;
  try {
    const flags = constants.O_RDONLY | (process.platform === "win32" ? 0 : constants.O_NOFOLLOW | constants.O_NONBLOCK);
    handle = await open(snapshot.canonicalPath, flags);
    const info = await handle.stat({ bigint: true });
    if (!info.isFile() || !sameIdentity(info, snapshot.identity)) throw pathRejected();
    await validateMapping(snapshot);
    return { handle, snapshot, size: info.size };
  } catch (error) {
    if (handle) await handle.close().catch(() => {}); // Preserve the failed trust check.
    // No descriptor receipt exists until every trust check above succeeds.
    if (error instanceof Error && Reflect.get(error, "code") === "EIO") throw error;
    throw pathRejected();
  }
}

async function readBytes(handle: FileHandle, signal?: AbortSignal): Promise<Buffer> {
  const { maxBytes, chunkBytes } = AGY_ARTIFACT_POLICY;
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      abortIfNeeded(signal);
      const block = Buffer.allocUnsafe(Math.min(chunkBytes, maxBytes - total));
      let filled = 0;
      while (filled < block.length) {
        const { bytesRead } = await handle.read(block, filled, block.length - filled, total);
        abortIfNeeded(signal);
        if (bytesRead === 0) {
          if (filled) chunks.push(block.subarray(0, filled));
          return Buffer.concat(chunks, total);
        }
        filled += bytesRead;
        total += bytesRead;
      }
      chunks.push(block);
    }
    const { bytesRead } = await handle.read(Buffer.allocUnsafe(1), 0, 1, total);
    abortIfNeeded(signal);
    if (bytesRead) throw tooLarge();
    return Buffer.concat(chunks, total);
  } catch (error) { throw error; }
  finally { chunks.length = 0; }
}

async function cleanupSnapshot(snapshot: ArtifactSnapshot): Promise<void> {
  try {
    await validateMapping(snapshot);
    const parent = dirname(snapshot.canonicalPath);
    const info = await lstat(parent, { bigint: true });
    if (!info.isDirectory() || !sameIdentity(info, snapshot.parentIdentity)) return;
    await unlink(snapshot.canonicalPath);
    if (snapshot.roots.some((root) => root.canonical === parent)) return;
    await validateRoot(snapshot.root);
    const currentParent = await realpath(parent);
    const currentInfo = await lstat(parent, { bigint: true });
    if (currentParent !== parent || !contained(snapshot.root.canonical, parent)
      || !currentInfo.isDirectory() || !sameIdentity(currentInfo, snapshot.parentIdentity)) return;
    // A concurrent sibling makes this fail ENOTEMPTY; never recursively sweep it.
    await rmdir(parent);
  } catch { /* Best effort: policy rejection or replacement grants no further deletion. */ }
}

export async function cleanupAgyArtifact(receipt: AgyArtifactRead): Promise<void> {
  const snapshot = receipts.get(receipt);
  if (!snapshot) return;
  receipts.delete(receipt);
  await cleanupSnapshot(snapshot);
}

/** Static/detected path confinement, not an atomic sandbox against same-user races. */
export async function readAgyArtifact(candidate: string, signal?: AbortSignal): Promise<AgyArtifactRead> {
  abortIfNeeded(signal);
  let opened: Awaited<ReturnType<typeof openChecked>> | undefined;
  let buffer: Buffer | undefined;
  let failure: unknown;
  let failed = false;
  try {
    opened = await openChecked(candidate);
    if (opened.size > BigInt(AGY_ARTIFACT_POLICY.maxBytes)) throw tooLarge();
    abortIfNeeded(signal);
    buffer = await readBytes(opened.handle, signal);
    await validateMapping(opened.snapshot);
  } catch (error) { failure = error; failed = true; }
  finally {
    if (opened) {
      try { await opened.handle.close(); }
      catch (error) { if (!failed) { failure = error; failed = true; } }
    }
  }
  if (failed) {
    if (opened && canceled(failure)) await cleanupSnapshot(opened.snapshot);
    throw failure;
  }
  // The successful path necessarily acquired both; no external receipt exists yet.
  if (!opened || !buffer) throw pathRejected();
  try {
    abortIfNeeded(signal);
    await validateMapping(opened.snapshot);
    abortIfNeeded(signal);
  } catch (error) {
    if (canceled(error)) await cleanupSnapshot(opened.snapshot);
    throw error;
  }
  const receipt = Object.freeze({ buffer, canonicalPath: opened.snapshot.canonicalPath,
    identity: opened.snapshot.identity, approvedRoots: Object.freeze(opened.snapshot.roots.map((root) => root.canonical)) });
  receipts.set(receipt, opened.snapshot);
  return receipt;
}
