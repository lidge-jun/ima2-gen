/**
 * Idempotency keys for generation requests (#151).
 *
 * A retried POST - a flaky network, an impatient double click, an agent that
 * resends - currently starts a second paid generation. With a key, the second
 * request replays the first one's outcome instead.
 *
 * The key is bound to a fingerprint of the request body, so reusing a key with
 * different content is rejected rather than silently answered with someone
 * else's image.
 *
 * There is no boot-time sweep of unfinished keys. The server starts on another
 * port when one is taken (lib/runtimePorts.ts) while sharing the same database,
 * so "this process is starting" says nothing about whether another process is
 * still working on that key. TTL expiry is the honest cleanup.
 */
import { createHash } from "node:crypto";

import { getDb } from "../db.js";
import { logError } from "../logger.js";

export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const KEY_PATTERN = /^[A-Za-z0-9_.:-]{1,255}$/;

/** Fields that identify or route a request rather than shape its result. */
const FINGERPRINT_EXCLUDED = new Set(["requestId", "async", "idempotencyKey", "clientNodeId"]);

export interface IdempotencyRecord {
  key: string;
  requestId: string;
  kind: string;
  fingerprint: string;
  createdAt: number;
  terminalStatus: string | null;
  terminalPayload: Record<string, unknown> | null;
}

export class IdempotencyKeyInvalid extends Error {}
export class IdempotencyFingerprintConflict extends Error {}

/**
 * Reads the key from the header or the body.
 *
 * The header wins when both are present, and a mismatch is an error rather than
 * a silent choice: a client that disagrees with itself has a bug, and guessing
 * which half is right would hide it.
 */
export function readIdempotencyKey(headerValue: unknown, bodyValue: unknown): string | null {
  const header = typeof headerValue === "string" ? headerValue.trim() : null;
  const body = typeof bodyValue === "string" ? bodyValue.trim() : null;
  if (header && body && header !== body) {
    throw new IdempotencyKeyInvalid("Idempotency-Key header and body idempotencyKey disagree");
  }
  const key = header || body;
  if (!key) return null;
  if (!KEY_PATTERN.test(key)) {
    throw new IdempotencyKeyInvalid("Idempotency-Key must be 1-255 chars of [A-Za-z0-9_.:-]");
  }
  return key;
}

/**
 * Hashes everything in the body except the excluded fields.
 *
 * A blacklist rather than a whitelist: a new option that changes the output -
 * and this pipeline gains them regularly - is covered the day it is added,
 * instead of silently falling outside the fingerprint until someone remembers.
 */
export function fingerprintRequest(body: unknown): string {
  const source = body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
  const stable: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    if (FINGERPRINT_EXCLUDED.has(key)) continue;
    stable[key] = source[key];
  }
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

function rowToRecord(row: Record<string, unknown>): IdempotencyRecord {
  let payload: Record<string, unknown> | null = null;
  if (typeof row.terminal_payload === "string" && row.terminal_payload) {
    try {
      const parsed: unknown = JSON.parse(row.terminal_payload);
      payload = parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      payload = null;
    }
  }
  return {
    key: String(row.key),
    requestId: String(row.request_id),
    kind: String(row.kind),
    fingerprint: String(row.fingerprint),
    createdAt: Number(row.created_at),
    terminalStatus: typeof row.terminal_status === "string" ? row.terminal_status : null,
    terminalPayload: payload,
  };
}

export function purgeExpiredIdempotencyKeys(now = Date.now()): void {
  try {
    getDb().prepare("DELETE FROM idempotency_keys WHERE created_at <= ?").run(now - IDEMPOTENCY_TTL_MS);
  } catch (err: unknown) {
    logError("idempotency", "purge:error", err);
  }
}

export function lookupIdempotencyKey(key: string, now = Date.now()): IdempotencyRecord | null {
  const row = getDb()
    .prepare("SELECT * FROM idempotency_keys WHERE key = ?")
    .get(key) as Record<string, unknown> | undefined;
  if (!row) return null;
  const record = rowToRecord(row);
  if (now - record.createdAt > IDEMPOTENCY_TTL_MS) {
    getDb().prepare("DELETE FROM idempotency_keys WHERE key = ?").run(key);
    return null;
  }
  return record;
}

export type ClaimResult =
  | { outcome: "claimed" }
  | { outcome: "duplicate"; record: IdempotencyRecord };

/**
 * Claims a key for this request, or reports the request that already holds it.
 *
 * The INSERT is the arbiter. Two simultaneous first requests both see an empty
 * lookup, so deciding on the read would let both through; letting the primary
 * key reject the loser is what makes this safe under concurrency.
 */
export function claimIdempotencyKey(
  key: string,
  requestId: string,
  kind: string,
  fingerprint: string,
  now = Date.now(),
): ClaimResult {
  const existing = lookupIdempotencyKey(key, now);
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      throw new IdempotencyFingerprintConflict("Idempotency-Key was already used for a different request");
    }
    return { outcome: "duplicate", record: existing };
  }
  try {
    getDb()
      .prepare("INSERT INTO idempotency_keys (key, request_id, kind, fingerprint, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(key, requestId, kind, fingerprint, now);
    return { outcome: "claimed" };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code !== "SQLITE_CONSTRAINT_PRIMARYKEY" && code !== "SQLITE_CONSTRAINT_UNIQUE" && code !== "SQLITE_CONSTRAINT") {
      throw err;
    }
    // Lost the race. The winner's row is authoritative.
    const record = lookupIdempotencyKey(key, now);
    if (!record) throw err;
    if (record.fingerprint !== fingerprint) {
      throw new IdempotencyFingerprintConflict("Idempotency-Key was already used for a different request");
    }
    return { outcome: "duplicate", record };
  }
}

/**
 * Records how a request ended, for later replays.
 *
 * Called from both the success and failure paths rather than from an event
 * subscriber, because synchronous generation is the default and never publishes
 * a done event (lib/generatePipeline.ts).
 */
export function completeIdempotencyKey(
  key: string | null | undefined,
  status: string,
  payload: Record<string, unknown>,
): void {
  if (!key) return;
  try {
    getDb()
      .prepare("UPDATE idempotency_keys SET terminal_status = ?, terminal_payload = ? WHERE key = ?")
      .run(status, JSON.stringify(payload), key);
  } catch (err: unknown) {
    logError("idempotency", "complete:error", err);
  }
}

export function _resetForTests(): void {
  getDb().prepare("DELETE FROM idempotency_keys").run();
}
