// Terminal job status vocabulary.
//
// Three spellings of success reach the inflight snapshot today: "done"
// (lib/mcp/commitMediaResult.ts), "completed" (finishJob's default and the
// generation pipelines), and "complete" (agent turns / sprite rows in their own
// tables). Nothing typed or tested that boundary, so a new MCP route calling
// finishJob(requestId) without a status would silently break CLI recovery,
// which today only accepts "done".
//
// This module normalizes on the READ side. finishJob's signature stays as-is on
// purpose: five pipelines pass a `let finishStatus = "completed"` variable that
// TypeScript infers as `string`, so narrowing the parameter would break them
// (roadmap 050, "options.status를 좁히지 않는 이유"). Compiler-flag hardening is
// phase 085's job.

export const TERMINAL_SUCCESS = "done" as const;

const SUCCESS_SPELLINGS = new Set(["done", "completed", "complete"]);
const FAILURE_SPELLINGS = new Set(["error", "failed", "canceled", "cancelled"]);

export type JobTerminalStatus = "done" | "error" | "canceled" | "unknown";

/**
 * Collapses the success spellings to "done" and the failure spellings to their
 * canonical form. Anything unrecognized becomes "unknown" so callers can refuse
 * it instead of treating it as success.
 */
export function normalizeTerminalStatus(status: unknown): JobTerminalStatus {
  const raw = typeof status === "string" ? status.trim().toLowerCase() : "";
  if (SUCCESS_SPELLINGS.has(raw)) return "done";
  if (raw === "canceled" || raw === "cancelled") return "canceled";
  if (FAILURE_SPELLINGS.has(raw)) return "error";
  return "unknown";
}

export function isTerminalSuccess(status: unknown): boolean {
  return normalizeTerminalStatus(status) === "done";
}
