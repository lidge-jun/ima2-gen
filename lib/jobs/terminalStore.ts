import { getDb } from "../db.js";

export interface TerminalJob {
  requestId: string;
  kind: string;
  status: string;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  phase: string;
  phaseAt: number;
  httpStatus?: number | undefined;
  errorCode?: string | undefined;
  prompt?: string | null;
  meta: Record<string, unknown>;
}

interface TerminalJobRow {
  request_id: string;
  kind: string;
  status: string;
  started_at: number;
  finished_at: number;
  phase?: string | null;
  phase_at?: number | null;
  http_status?: number | null;
  error_code?: string | null;
  meta?: string | null;
}

const COLUMNS = "request_id, kind, status, started_at, finished_at, phase, phase_at, http_status, error_code, meta";

function parseMeta(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "string" || !raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}

function fromRow(row: TerminalJobRow): TerminalJob {
  return {
    requestId: row.request_id, kind: row.kind, status: row.status,
    startedAt: Number(row.started_at), finishedAt: Number(row.finished_at),
    durationMs: Number(row.finished_at) - Number(row.started_at),
    phase: row.phase || "unknown", phaseAt: Number(row.phase_at || row.finished_at),
    httpStatus: row.http_status ?? undefined, errorCode: row.error_code ?? undefined,
    meta: parseMeta(row.meta),
  };
}

export function readTerminalJobs(cutoff: number): TerminalJob[] {
  const rows = getDb().prepare(`SELECT ${COLUMNS} FROM terminal_jobs WHERE finished_at > ?`)
    .all(cutoff) as TerminalJobRow[];
  return rows.map(fromRow);
}

export function readTerminalJob(requestId: string, cutoff: number): TerminalJob | null {
  const row = getDb().prepare(`SELECT ${COLUMNS} FROM terminal_jobs WHERE request_id = ? AND finished_at > ?`)
    .get(requestId, cutoff) as TerminalJobRow | undefined;
  return row ? fromRow(row) : null;
}

/** Throws on failure so the caller can include the write in its transaction. */
export function writeTerminalJob(job: TerminalJob): void {
  getDb().prepare(`INSERT OR REPLACE INTO terminal_jobs (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(job.requestId, job.kind, job.status, job.startedAt, job.finishedAt, job.phase,
      job.phaseAt, job.httpStatus ?? null, job.errorCode ?? null, JSON.stringify(job.meta ?? {}));
}

export function deleteTerminalJob(requestId: string): void {
  getDb().prepare("DELETE FROM terminal_jobs WHERE request_id = ?").run(requestId);
}

export function deleteExpiredTerminalJobs(cutoff: number): void {
  getDb().prepare("DELETE FROM terminal_jobs WHERE finished_at <= ?").run(cutoff);
}
