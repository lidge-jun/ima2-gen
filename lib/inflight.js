import { config } from "../config.js";
import { logEvent } from "./logger.js";

// In-memory inflight job registry.
// Tracks generation requests that are currently running on the server so clients
// can reconcile optimistic UI state after a reload or across tabs.
//
// This is intentionally process-local: if the server restarts, inflight jobs
// are lost (which is correct — the fetch they came from is already gone).

const jobs = new Map(); // requestId -> { requestId, kind, prompt, meta, startedAt, phase, phaseAt }
const terminalJobs = new Map(); // requestId -> terminal snapshot, active-only API stays default

// Phases: "queued" → "streaming" (upstream connection open, waiting for image)
//                 → "decoding" (b64 received, writing to disk)
export function startJob({ requestId, kind, prompt, meta = {} }) {
  if (!requestId) return;
  const startedAt = Date.now();
  jobs.set(requestId, {
    requestId,
    kind,
    prompt: typeof prompt === "string" ? prompt.slice(0, 500) : "",
    meta,
    startedAt,
    phase: "queued",
    phaseAt: startedAt,
  });
  terminalJobs.delete(requestId);
  logEvent("inflight", "start", {
    requestId,
    kind,
    sessionId: meta?.sessionId || null,
    parentNodeId: meta?.parentNodeId || null,
    clientNodeId: meta?.clientNodeId || null,
    promptChars: typeof prompt === "string" ? prompt.length : 0,
  });
}

export function setJobPhase(requestId, phase) {
  if (!requestId) return;
  const j = jobs.get(requestId);
  if (!j) return;
  j.phase = phase;
  j.phaseAt = Date.now();
  logEvent("inflight", "phase", { requestId, kind: j.kind, phase });
}

export function finishJob(requestId, options = {}) {
  if (!requestId) return;
  const j = jobs.get(requestId);
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
  jobs.delete(requestId);
  reapTerminalJobs();
}

function reapTerminalJobs() {
  const now = Date.now();
  for (const [id, j] of terminalJobs) {
    if (now - j.finishedAt > config.inflight.terminalTtlMs) terminalJobs.delete(id);
  }
}

export function listJobs(filters = {}) {
  // Stale reaping: > TTL is almost certainly a crashed fetch.
  const now = Date.now();
  for (const [id, j] of jobs) {
    if (now - j.startedAt > config.inflight.ttlMs) jobs.delete(id);
  }
  const { kind, sessionId } = filters;
  return Array.from(jobs.values())
    .filter((j) => {
      if (kind && j.kind !== kind) return false;
      if (sessionId && j.meta?.sessionId !== sessionId) return false;
      return true;
    })
    .sort((a, b) => a.startedAt - b.startedAt);
}

export function listTerminalJobs(filters = {}) {
  reapTerminalJobs();
  const { kind, sessionId } = filters;
  return Array.from(terminalJobs.values())
    .filter((j) => {
      if (kind && j.kind !== kind) return false;
      if (sessionId && j.meta?.sessionId !== sessionId) return false;
      return true;
    })
    .sort((a, b) => b.finishedAt - a.finishedAt);
}

export function _resetForTests() {
  jobs.clear();
  terminalJobs.clear();
}
