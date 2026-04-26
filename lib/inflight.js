// SQLite-backed inflight job registry.
// Tracks generation requests that are currently running on the server so
// clients can reconcile optimistic UI state after a reload, across tabs, OR
// after the server itself restarts.
//
// Why durable: a restarted process cannot continue the original upstream
// fetch, but keeping the job metadata on disk lets the UI re-discover the
// requestId, surface "the previous run did not complete" to the user, and
// eventually prune stale work without losing the recovery breadcrumb. The
// active fetch is gone after restart — purgeStaleJobs() handles those
// after the configured TTL.

import { getDb } from "./db.js";
import { logEvent } from "./logger.js";

// 10 min covers the longest legitimate generation including reasoning + 8
// safety retries. Override via env for tests / very large prompts.
const STALE_TTL_MS = Number(process.env.IMA2_INFLIGHT_TTL_MS) || 10 * 60 * 1000;

function nowMs() {
  return Date.now();
}

function clampPositiveInt(value, min = 1, fallback = 1) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= min ? n : fallback;
}

function stringOrNull(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseMeta(raw) {
  if (typeof raw !== "string" || !raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function rowToJob(row) {
  if (!row) return null;
  const meta = parseMeta(row.meta);
  return {
    requestId: row.request_id,
    kind: row.kind,
    prompt: row.prompt || "",
    meta,
    owner: row.owner ?? null,
    startedAt: Number(row.started_at),
    phase: row.phase || "queued",
    phaseAt: Number(row.phase_at || row.started_at),
    attempt: Number(row.attempt) || 1,
    maxAttempts: Number(row.max_attempts) || 1,
  };
}

export function startJob({ requestId, kind, prompt, meta = {}, maxAttempts = 1, owner = null }) {
  if (!requestId) return;
  const max = clampPositiveInt(maxAttempts, 1, 1);
  const startedAt = nowMs();
  const normalizedPrompt = typeof prompt === "string" ? prompt.slice(0, 500) : "";
  const normalizedMeta = meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {};
  getDb()
    .prepare(`
      INSERT OR REPLACE INTO inflight (
        request_id, kind, prompt, meta,
        session_id, parent_node_id, client_node_id, owner,
        attempt, max_attempts,
        started_at, phase, phase_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      requestId,
      kind,
      normalizedPrompt,
      JSON.stringify(normalizedMeta),
      stringOrNull(normalizedMeta.sessionId),
      stringOrNull(normalizedMeta.parentNodeId),
      stringOrNull(normalizedMeta.clientNodeId),
      stringOrNull(owner),
      1,
      max,
      startedAt,
      "queued",
      startedAt,
    );
  logEvent("inflight", "start", {
    requestId,
    kind,
    sessionId: normalizedMeta.sessionId || null,
    parentNodeId: normalizedMeta.parentNodeId || null,
    clientNodeId: normalizedMeta.clientNodeId || null,
    promptChars: typeof prompt === "string" ? prompt.length : 0,
    maxAttempts: max,
  });
}

export function getJob(requestId) {
  if (!requestId) return null;
  const row = getDb()
    .prepare("SELECT * FROM inflight WHERE request_id = ?")
    .get(requestId);
  return rowToJob(row);
}

export function setJobPhase(requestId, phase) {
  if (!requestId) return;
  const res = getDb()
    .prepare("UPDATE inflight SET phase = ?, phase_at = ? WHERE request_id = ?")
    .run(phase, nowMs(), requestId);
  if (res.changes > 0) {
    logEvent("inflight", "phase", { requestId, phase });
  }
}

export function setJobAttempt(requestId, attempt) {
  if (!requestId) return;
  const job = getJob(requestId);
  if (!job) return;
  const next = Math.min(clampPositiveInt(attempt, 1, 1), job.maxAttempts);
  const t = nowMs();
  // Reset phase to queued — between-attempt grace state, same as the old
  // in-memory contract (covered by tests/inflight-attempt.test.js).
  getDb()
    .prepare(
      "UPDATE inflight SET attempt = ?, phase = 'queued', phase_at = ? WHERE request_id = ?",
    )
    .run(next, t, requestId);
  logEvent("inflight", "attempt", { requestId, kind: job.kind, attempt: next, maxAttempts: job.maxAttempts });
}

export function finishJob(requestId, options = {}) {
  if (!requestId) return;
  const job = getJob(requestId);
  const res = getDb()
    .prepare("DELETE FROM inflight WHERE request_id = ?")
    .run(requestId);
  if (res.changes > 0 && job) {
    logEvent("inflight", "finish", {
      requestId,
      kind: job.kind,
      status: options.canceled ? "canceled" : options.status || "completed",
      durationMs: nowMs() - job.startedAt,
      httpStatus: options.httpStatus,
      errorCode: options.errorCode,
    });
  }
}

export function listJobs(filters = {}) {
  purgeStaleJobs();
  const { kind, sessionId, owner = null } = filters;
  const clauses = [];
  const params = [];
  if (kind) {
    clauses.push("kind = ?");
    params.push(kind);
  }
  if (sessionId) {
    clauses.push("session_id = ?");
    params.push(sessionId);
  }
  if (owner) {
    clauses.push("owner = ?");
    params.push(owner);
  }
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  return getDb()
    .prepare(`SELECT * FROM inflight${where} ORDER BY started_at ASC`)
    .all(...params)
    .map(rowToJob);
}

// Drop entries older than STALE_TTL_MS. Called once at server startup
// (post-restart cleanup of jobs whose fetches died with the old process)
// and lazily from listJobs to keep the active set bounded.
export function purgeStaleJobs(now = nowMs()) {
  const cutoff = now - STALE_TTL_MS;
  const stale = getDb()
    .prepare("SELECT request_id, kind FROM inflight WHERE started_at < ?")
    .all(cutoff);
  if (stale.length === 0) return 0;
  const deleted = getDb()
    .prepare("DELETE FROM inflight WHERE started_at < ?")
    .run(cutoff).changes;
  logEvent("inflight", "purge_stale", { count: deleted, cutoffAgeMs: STALE_TTL_MS });
  return deleted;
}

export function _resetForTests() {
  try {
    getDb().prepare("DELETE FROM inflight").run();
  } catch {
    // db not yet initialised in some test contexts
  }
}
