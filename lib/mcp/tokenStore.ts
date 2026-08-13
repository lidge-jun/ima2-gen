import {
  chmodSync,
  linkSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";

export interface McpTokenBinding {
  provider: string;
  endpoint: string;
  redirectOrigin: string;
  updatedAt: string;
}

export interface McpCurrentBinding {
  provider: string;
  endpoint: string;
  redirectOrigin: string;
  /** Historical endpoint accepted only for one-time legacy-record migration. */
  legacyEndpoint?: string | undefined;
}

export interface McpTokenRecord {
  schemaVersion?: 1 | undefined;
  revision?: number | undefined;
  binding?: McpTokenBinding | undefined;
  clientInformation?: Record<string, unknown> | undefined;
  tokens?: Record<string, unknown> | undefined;
  codeVerifier?: string | undefined;
  /** Legacy callback origin, migrated after the next successful credential save. */
  origin?: string | undefined;
  tombstone?: true | undefined;
}

export type McpCredentialScope = "all" | "client" | "tokens" | "verifier" | "discovery";
export type McpTokenInspectionState = "missing" | "corrupt" | "pending-only" | "usable" | "binding-mismatch";

export interface McpTokenInspection {
  state: McpTokenInspectionState;
  revision: number | null;
  legacy: boolean;
}

export interface McpTokenMutation {
  record: McpTokenRecord;
  revision: number;
}

interface LockOwner { pid: number; nonce: string }
interface RawRead { kind: "missing" | "corrupt" | "record"; record?: McpTokenRecord }

const PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export class McpTokenRevisionStaleError extends Error {
  constructor() { super("MCP_TOKEN_REVISION_STALE"); this.name = "McpTokenRevisionStaleError"; }
}

export class McpTokenStoreBusyError extends Error {
  constructor() { super("MCP_TOKEN_STORE_BUSY"); this.name = "McpTokenStoreBusyError"; }
}

function recordPath(tokenDir: string, provider: string): string {
  if (!PROVIDER_ID_PATTERN.test(provider)) throw new Error(`MCP_PROVIDER_ID_INVALID:${provider}`);
  return join(tokenDir, `${provider}.json`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isBinding(value: unknown): value is McpTokenBinding {
  if (!isObject(value)) return false;
  return typeof value.provider === "string"
    && typeof value.endpoint === "string"
    && typeof value.redirectOrigin === "string"
    && typeof value.updatedAt === "string";
}

function isTokenBundle(value: unknown): value is Record<string, unknown> {
  return isObject(value)
    && typeof value.access_token === "string"
    && value.access_token.trim().length > 0;
}

function isRecord(value: unknown): value is McpTokenRecord {
  if (!isObject(value)) return false;
  if (value.schemaVersion !== undefined && value.schemaVersion !== 1) return false;
  if (value.schemaVersion === 1 && (!Number.isSafeInteger(value.revision) || Number(value.revision) < 0)) return false;
  if (value.binding !== undefined && !isBinding(value.binding)) return false;
  if (value.clientInformation !== undefined && !isObject(value.clientInformation)) return false;
  if (value.tokens !== undefined && !isTokenBundle(value.tokens)) return false;
  if (value.codeVerifier !== undefined && typeof value.codeVerifier !== "string") return false;
  if (value.origin !== undefined && typeof value.origin !== "string") return false;
  return value.tombstone === undefined || value.tombstone === true;
}

function readRaw(tokenDir: string, provider: string): RawRead {
  try {
    const parsed: unknown = JSON.parse(readFileSync(recordPath(tokenDir, provider), "utf8"));
    return isRecord(parsed) ? { kind: "record", record: parsed } : { kind: "corrupt" };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { kind: "missing" };
    if (error instanceof SyntaxError) return { kind: "corrupt" };
    if (String((error as Error).message).startsWith("MCP_PROVIDER_ID_INVALID")) throw error;
    return { kind: "corrupt" };
  }
}

function revisionOf(record: McpTokenRecord): number {
  return record.schemaVersion === 1 ? record.revision ?? 0 : 0;
}

export function normalizeCurrentBinding(binding: McpCurrentBinding): McpCurrentBinding {
  return {
    provider: binding.provider,
    endpoint: new URL(binding.endpoint).toString(),
    redirectOrigin: new URL(binding.redirectOrigin).origin,
    ...(binding.legacyEndpoint ? { legacyEndpoint: new URL(binding.legacyEndpoint).toString() } : {}),
  };
}

export function tokenBindingMatches(record: McpTokenRecord, currentInput: McpCurrentBinding): boolean {
  const current = normalizeCurrentBinding(currentInput);
  if (record.binding) {
    try {
      return record.binding.provider === current.provider
        && new URL(record.binding.endpoint).toString() === current.endpoint
        && new URL(record.binding.redirectOrigin).origin === current.redirectOrigin;
    } catch { return false; }
  }
  if (!record.origin) {
    return !record.clientInformation && !record.tokens && !record.codeVerifier && !record.tombstone;
  }
  try {
    return Boolean(current.legacyEndpoint)
      && current.legacyEndpoint === current.endpoint
      && new URL(record.origin).origin === current.redirectOrigin;
  } catch { return false; }
}

export function makeTokenBinding(current: McpCurrentBinding): McpTokenBinding {
  const normalized = normalizeCurrentBinding(current);
  return {
    provider: normalized.provider,
    endpoint: normalized.endpoint,
    redirectOrigin: normalized.redirectOrigin,
    updatedAt: new Date().toISOString(),
  };
}

export function readTokenRecord(tokenDir: string, provider: string): McpTokenRecord | null {
  const raw = readRaw(tokenDir, provider);
  return raw.kind === "record" ? raw.record ?? null : null;
}

export function inspectTokenRecord(
  tokenDir: string,
  provider: string,
  current: McpCurrentBinding,
): McpTokenInspection {
  const raw = readRaw(tokenDir, provider);
  if (raw.kind === "missing") return { state: "missing", revision: null, legacy: false };
  if (raw.kind === "corrupt") return { state: "corrupt", revision: null, legacy: false };
  const record = raw.record ?? {};
  const revision = revisionOf(record);
  const legacy = record.schemaVersion !== 1;
  if (!tokenBindingMatches(record, current)) return { state: "binding-mismatch", revision, legacy };
  return { state: record.tokens && !record.tombstone ? "usable" : "pending-only", revision, legacy };
}

function parseLockOwner(path: string): LockOwner | null {
  try {
    const value: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!isObject(value) || !Number.isSafeInteger(value.pid) || Number(value.pid) <= 0) return null;
    if (typeof value.nonce !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(value.nonce)) return null;
    return { pid: Number(value.pid), nonce: value.nonce };
  } catch { return null; }
}

function processIsDead(pid: number): boolean {
  try { process.kill(pid, 0); return false; }
  catch (error) { return (error as NodeJS.ErrnoException).code === "ESRCH"; }
}

function recoverDeadLock(lockPath: string): boolean {
  const observed = parseLockOwner(lockPath);
  if (!observed || !processIsDead(observed.pid)) return false;
  const claim = `${lockPath}.recover-${observed.nonce}`;
  try {
    linkSync(lockPath, claim);
  } catch { return false; }
  try {
    const current = parseLockOwner(lockPath);
    const claimed = parseLockOwner(claim);
    const lockStat = statSync(lockPath);
    const claimStat = statSync(claim);
    if (!current || !claimed || current.pid !== observed.pid || current.nonce !== observed.nonce) return false;
    if (claimed.pid !== observed.pid || claimed.nonce !== observed.nonce) return false;
    if (lockStat.dev !== claimStat.dev || lockStat.ino !== claimStat.ino || !processIsDead(observed.pid)) return false;
    rmSync(lockPath);
    return true;
  } finally {
    rmSync(claim, { force: true });
  }
}

function acquireLock(tokenDir: string, provider: string): { path: string; owner: LockOwner } {
  const target = recordPath(tokenDir, provider);
  mkdirSync(tokenDir, { recursive: true, mode: 0o700 });
  const path = `${target}.lock`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const owner = { pid: process.pid, nonce: randomBytes(18).toString("base64url") };
    const ownerPath = `${path}-owner-${owner.nonce}`;
    try {
      writeFileSync(ownerPath, JSON.stringify(owner), { flag: "wx", mode: 0o600 });
      linkSync(ownerPath, path);
      rmSync(ownerPath, { force: true });
      return { path, owner };
    } catch (error) {
      rmSync(ownerPath, { force: true });
      if ((error as NodeJS.ErrnoException).code !== "EEXIST" || attempt > 0 || !recoverDeadLock(path)) {
        throw new McpTokenStoreBusyError();
      }
    }
  }
  throw new McpTokenStoreBusyError();
}

function releaseLock(lock: { path: string; owner: LockOwner }): void {
  const current = parseLockOwner(lock.path);
  if (current?.pid === lock.owner.pid && current.nonce === lock.owner.nonce) rmSync(lock.path, { force: true });
}

function withLock<T>(tokenDir: string, provider: string, operation: () => T): T {
  const lock = acquireLock(tokenDir, provider);
  try { return operation(); } finally { releaseLock(lock); }
}

function writeAtomic(tokenDir: string, provider: string, record: McpTokenRecord): void {
  const target = recordPath(tokenDir, provider);
  const tmp = `${target}.tmp-${process.pid}-${randomBytes(8).toString("hex")}`;
  try {
    writeFileSync(tmp, JSON.stringify(record, null, 2), { mode: 0o600 });
    renameSync(tmp, target);
    chmodSync(target, 0o600);
  } finally {
    rmSync(tmp, { force: true });
  }
}

export function writeTokenRecord(tokenDir: string, provider: string, record: McpTokenRecord): void {
  withLock(tokenDir, provider, () => writeAtomic(tokenDir, provider, record));
}

export function updateTokenRecord(
  tokenDir: string,
  provider: string,
  expectedRevision: number | null,
  update: (record: McpTokenRecord) => McpTokenRecord,
): McpTokenMutation {
  return withLock(tokenDir, provider, () => {
    const raw = readRaw(tokenDir, provider);
    if (raw.kind === "corrupt") throw new Error("MCP_TOKEN_RECORD_CORRUPT");
    const current = raw.record ?? {};
    const actualRevision = raw.kind === "missing" ? null : revisionOf(current);
    if (actualRevision !== expectedRevision) throw new McpTokenRevisionStaleError();
    const revision = (actualRevision ?? 0) + 1;
    const next = { ...update({ ...current }), schemaVersion: 1 as const, revision };
    writeAtomic(tokenDir, provider, next);
    return { record: next, revision };
  });
}

export function invalidateTokenRecord(
  tokenDir: string,
  provider: string,
  scope: McpCredentialScope,
  expectedRevision?: number | null,
): McpTokenMutation {
  const existing = readRaw(tokenDir, provider);
  const expected = expectedRevision === undefined
    ? (existing.kind === "record" ? revisionOf(existing.record ?? {}) : null)
    : expectedRevision;
  if (scope === "discovery") {
    const record = existing.record ?? {};
    return { record, revision: revisionOf(record) };
  }
  return updateTokenRecord(tokenDir, provider, expected, (record) => {
    if (scope === "all") return { binding: record.binding, tombstone: true };
    const next = { ...record };
    if (scope === "client") { delete next.clientInformation; delete next.tokens; }
    if (scope === "tokens") delete next.tokens;
    if (scope === "verifier") delete next.codeVerifier;
    delete next.tombstone;
    return next;
  });
}

export function tombstoneTokenRecord(
  tokenDir: string,
  provider: string,
  current?: McpCurrentBinding,
): McpTokenMutation {
  return withLock(tokenDir, provider, () => {
    const raw = readRaw(tokenDir, provider);
    const revision = (raw.kind === "record" ? revisionOf(raw.record ?? {}) : 0) + 1;
    const binding = current ? makeTokenBinding(current) : raw.record?.binding;
    const next: McpTokenRecord = { schemaVersion: 1, revision, ...(binding ? { binding } : {}), tombstone: true };
    writeAtomic(tokenDir, provider, next);
    return { record: next, revision };
  });
}

export function deleteTokenRecord(tokenDir: string, provider: string): void {
  try { rmSync(recordPath(tokenDir, provider)); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
