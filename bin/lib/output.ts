import { formatErrorWithHint } from "./error-hints.js";

const isTty = process.stdout.isTTY && !process.env.NO_COLOR;

export const color = {
  dim:    (s: unknown) => (isTty ? `\x1b[2m${s}\x1b[0m` : String(s)),
  bold:   (s: unknown) => (isTty ? `\x1b[1m${s}\x1b[0m` : String(s)),
  red:    (s: unknown) => (isTty ? `\x1b[31m${s}\x1b[0m` : String(s)),
  green:  (s: unknown) => (isTty ? `\x1b[32m${s}\x1b[0m` : String(s)),
  yellow: (s: unknown) => (isTty ? `\x1b[33m${s}\x1b[0m` : String(s)),
  cyan:   (s: unknown) => (isTty ? `\x1b[36m${s}\x1b[0m` : String(s)),
};

export function out(msg = "") { process.stdout.write(msg + "\n"); }
export function err(msg = "") { process.stderr.write(msg + "\n"); }

export function die(code: number, msg?: string): never {
  if (msg) err(color.red("✗ ") + msg);
  process.exit(code);
}

export interface ErrorLike {
  message?: string;
  code?: string | null;
  status?: number;
  name?: string;
}

export function dieWithError(e: unknown): never {
  const err = e as ErrorLike;
  return die(exitCodeForError(e), formatErrorWithHint(err?.message || String(e), err?.code));
}

export function json(obj: unknown) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

export interface TableColumn<R = Record<string, unknown>> {
  key: string;
  label: string;
  format?: (value: unknown, row: R) => unknown;
}

export function table<R extends Record<string, unknown>>(rows: R[], columns: TableColumn<R>[]): void {
  if (rows.length === 0) return;
  const widths = columns.map((c) =>
    Math.max(c.label.length, ...rows.map((r) => {
      const v = c.format ? c.format(r[c.key], r) : r[c.key];
      return String(v ?? "").length;
    })),
  );
  const pad = (s: unknown, w: number) => String(s ?? "").padEnd(w);
  out(color.dim(columns.map((c, i) => pad(c.label, widths[i])).join("  ")));
  out(color.dim(widths.map((w) => "─".repeat(w)).join("  ")));
  for (const r of rows) {
    out(columns.map((c, i) => pad(c.format ? c.format(r[c.key], r) : r[c.key], widths[i])).join("  "));
  }
}

export function exitCodeForError(e: unknown): number {
  const err = e as ErrorLike;
  if (err?.code === "SERVER_UNREACHABLE") return 3;
  if (err?.code === "APIKEY_DISABLED") return 4;
  if (err?.code === "AUTH_CHATGPT_EXPIRED" || err?.code === "OAUTH_UNAVAILABLE") return 4;
  if (err?.code === "NETWORK_FAILED") return 6;
  if (err?.code === "REF_TOO_LARGE" || err?.code === "REF_NOT_BASE64") return 5;
  if (err?.code === "SAFETY_REFUSAL") return 7;
  if (err?.code === "MODERATION_REFUSED") return 7;
  if (err?.name === "TimeoutError" || /abort/i.test(err?.message || "")) return 8;
  if ((err?.status ?? 0) >= 500) return 6;
  if ((err?.status ?? 0) >= 400) return 5;
  return 1;
}
