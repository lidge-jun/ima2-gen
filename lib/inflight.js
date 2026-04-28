import { config } from "../config.js";
import { getDb } from "./db.js";
import { logEvent } from "./logger.js";
// SQLite-backed inflight job registry.
// Tracks generation requests that are currently running on the server so clients
// can reconcile optimistic UI state after a reload or across tabs.
//
// A restarted process cannot continue the original upstream fetch, but keeping
// metadata durable lets the UI reconcile requestIds and eventually prune stale
// work without losing the recovery breadcrumb.
const terminalJobs = new Map(); // requestId -> terminal snapshot, active-only API stays default
// Phases: "queued" → "streaming" (upstream connection open, waiting for image)
//                 → "decoding" (b64 received, writing to disk)
export function startJob({ requestId, kind, prompt, meta = {} }) {
    if (!requestId)
        return;
    const startedAt = Date.now();
    const normalizedPrompt = typeof prompt === "string" ? prompt.slice(0, 500) : "";
    const normalizedMeta = normalizeMeta(meta);
    getDb()
        .prepare(`
      INSERT OR REPLACE INTO inflight (
        request_id,
        kind,
        prompt,
        meta,
        session_id,
        parent_node_id,
        client_node_id,
        started_at,
        phase,
        phase_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
        .run(requestId, kind, normalizedPrompt, JSON.stringify(normalizedMeta), stringOrNull(normalizedMeta.sessionId), stringOrNull(normalizedMeta.parentNodeId), stringOrNull(normalizedMeta.clientNodeId), startedAt, "queued", startedAt);
    terminalJobs.delete(requestId);
    logEvent("inflight", "start", {
        requestId,
        kind,
        sessionId: normalizedMeta.sessionId || null,
        parentNodeId: normalizedMeta.parentNodeId || null,
        clientNodeId: normalizedMeta.clientNodeId || null,
        promptChars: typeof prompt === "string" ? prompt.length : 0,
    });
}
export function setJobPhase(requestId, phase) {
    if (!requestId)
        return;
    const j = getJob(requestId);
    if (!j)
        return;
    getDb()
        .prepare("UPDATE inflight SET phase = ?, phase_at = ? WHERE request_id = ?")
        .run(phase, Date.now(), requestId);
    logEvent("inflight", "phase", { requestId, kind: j.kind, phase });
}
export function finishJob(requestId, options = {}) {
    if (!requestId)
        return;
    const j = getJob(requestId);
    if (j) {
        const finishedAt = Date.now();
        const status = options.canceled ? "canceled" : options.status || "completed";
        terminalJobs.set(requestId, {
            requestId,
            kind: j.kind,
            status,
            startedAt: j.startedAt,
            finishedAt,
            durationMs: finishedAt - j.startedAt,
            phase: j.phase,
            phaseAt: j.phaseAt,
            httpStatus: options.httpStatus,
            errorCode: options.errorCode,
            meta: {
                ...j.meta,
                ...(options.meta || {}),
            },
        });
        logEvent("inflight", "finish", {
            requestId,
            kind: j.kind,
            status,
            durationMs: finishedAt - j.startedAt,
            httpStatus: options.httpStatus,
            errorCode: options.errorCode,
        });
    }
    getDb().prepare("DELETE FROM inflight WHERE request_id = ?").run(requestId);
    reapTerminalJobs();
}
function reapTerminalJobs() {
    const now = Date.now();
    for (const [id, j] of terminalJobs) {
        if (now - j.finishedAt > config.inflight.terminalTtlMs)
            terminalJobs.delete(id);
    }
}
export function listJobs(filters = {}) {
    purgeStaleJobs();
    const { kind, sessionId } = filters;
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
    const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
    return getDb()
        .prepare(`SELECT * FROM inflight${where} ORDER BY started_at ASC`)
        .all(...params)
        .map(rowToJob);
}
export function listTerminalJobs(filters = {}) {
    reapTerminalJobs();
    const { kind, sessionId } = filters;
    return Array.from(terminalJobs.values())
        .filter((j) => {
        if (kind && j.kind !== kind)
            return false;
        if (sessionId && j.meta?.sessionId !== sessionId)
            return false;
        return true;
    })
        .sort((a, b) => b.finishedAt - a.finishedAt);
}
export function _resetForTests() {
    getDb().prepare("DELETE FROM inflight").run();
    terminalJobs.clear();
}
export function purgeStaleJobs(now = Date.now()) {
    getDb()
        .prepare("DELETE FROM inflight WHERE started_at < ?")
        .run(now - config.inflight.ttlMs);
}
function getJob(requestId) {
    const row = getDb()
        .prepare("SELECT * FROM inflight WHERE request_id = ?")
        .get(requestId);
    return row ? rowToJob(row) : null;
}
function rowToJob(row) {
    const meta = normalizeMeta(parseMeta(row.meta));
    const sessionId = stringOrNull(row.session_id) ?? stringOrNull(meta.sessionId);
    const parentNodeId = stringOrNull(row.parent_node_id) ?? stringOrNull(meta.parentNodeId);
    const clientNodeId = stringOrNull(row.client_node_id) ?? stringOrNull(meta.clientNodeId);
    return {
        requestId: row.request_id,
        kind: row.kind,
        prompt: row.prompt || "",
        meta: {
            ...meta,
            ...(sessionId ? { sessionId } : {}),
            ...(parentNodeId ? { parentNodeId } : {}),
            ...(clientNodeId ? { clientNodeId } : {}),
        },
        startedAt: Number(row.started_at),
        phase: row.phase || "queued",
        phaseAt: Number(row.phase_at || row.started_at),
    };
}
function parseMeta(raw) {
    if (typeof raw !== "string" || !raw)
        return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? parsed
            : {};
    }
    catch {
        return {};
    }
}
function normalizeMeta(meta) {
    return meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {};
}
function stringOrNull(value) {
    return typeof value === "string" && value.length > 0 ? value : null;
}
