import { formatErrorWithHint } from "./error-hints.js";

const isTty = process.stdout.isTTY && !process.env.NO_COLOR;

export const color = {
  dim:    (s) => (isTty ? `\x1b[2m${s}\x1b[0m` : s),
  bold:   (s) => (isTty ? `\x1b[1m${s}\x1b[0m` : s),
  red:    (s) => (isTty ? `\x1b[31m${s}\x1b[0m` : s),
  green:  (s) => (isTty ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s) => (isTty ? `\x1b[33m${s}\x1b[0m` : s),
  cyan:   (s) => (isTty ? `\x1b[36m${s}\x1b[0m` : s),
};

export function out(msg = "") { process.stdout.write(msg + "\n"); }
export function err(msg = "") { process.stderr.write(msg + "\n"); }

export function die(code, msg) {
  if (msg) err(color.red("✗ ") + msg);
  process.exit(code);
}

export function dieWithError(e) {
  die(exitCodeForError(e), formatErrorWithHint(e?.message || String(e), e?.code));
}

export function json(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

export function table(rows, columns) {
  if (rows.length === 0) return;
  const widths = columns.map((c) =>
    Math.max(c.label.length, ...rows.map((r) => {
      const v = c.format ? c.format(r[c.key], r) : r[c.key];
      return String(v ?? "").length;
    })),
  );
  const pad = (s, w) => String(s ?? "").padEnd(w);
  out(color.dim(columns.map((c, i) => pad(c.label, widths[i])).join("  ")));
  out(color.dim(widths.map((w) => "─".repeat(w)).join("  ")));
  for (const r of rows) {
    out(columns.map((c, i) => pad(c.format ? c.format(r[c.key], r) : r[c.key], widths[i])).join("  "));
  }
}

export function exitCodeForError(e) {
  if (e.code === "SERVER_UNREACHABLE") return 3;
  if (e.code === "APIKEY_DISABLED") return 4;
  if (e.code === "AUTH_CHATGPT_EXPIRED" || e.code === "OAUTH_UNAVAILABLE") return 4;
  if (e.code === "NETWORK_FAILED") return 6;
  if (e.code === "REF_TOO_LARGE" || e.code === "REF_NOT_BASE64") return 5;
  if (e.code === "SAFETY_REFUSAL") return 7;
  if (e.code === "MODERATION_REFUSED") return 7;
  if (e.name === "TimeoutError" || /abort/i.test(e.message || "")) return 8;
  if (e.status >= 500) return 6;
  if (e.status >= 400) return 5;
  return 1;
}
