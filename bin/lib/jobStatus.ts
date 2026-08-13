// CLI-side copy of the terminal-status vocabulary.
//
// bin/ is bundled and transpiled independently of lib/ (tests transpile
// bin/lib/*.ts into a temp dir), so mcpJob cannot reach across into
// lib/jobStatus.ts at runtime. The server-side module is the source of truth;
// tests/job-terminal-status-contract.test.ts asserts the two stay identical.

export const TERMINAL_SUCCESS = "done" as const;

const SUCCESS_SPELLINGS = new Set(["done", "completed", "complete"]);
const FAILURE_SPELLINGS = new Set(["error", "failed", "canceled", "cancelled"]);

export type JobTerminalStatus = "done" | "error" | "canceled" | "unknown";

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
