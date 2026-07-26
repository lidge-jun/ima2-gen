#!/usr/bin/env node
// Dependency audit gate that distinguishes "we found a vulnerability" from
// "the registry failed to answer".
//
// `npm audit` exits 1 for both cases. That conflates a real security finding with a
// transient registry outage, so a bad five minutes upstream turns every push red and
// trains people to ignore the gate. Observed failure (2026-07-26, CI run 30191117813):
//
//   npm warn audit invalid json response body at
//     https://registry.npmjs.org/-/npm/v1/security/advisories/bulk
//     reason: Unexpected token '\x1f', "\x1f\x8b\b..." is not valid JSON
//   npm error audit endpoint returned an error
//
// The bulk advisories endpoint returned gzip bytes that npm failed to decode. Nothing
// about the dependency tree was actually checked.
//
// Contract:
//   - vulnerabilities at or above the threshold  -> exit 1 (the gate does its job)
//   - registry/transport failure                 -> retry, then warn and exit 0
//   - anything unrecognized                      -> exit 1 (fail closed)
//
// Usage: node scripts/audit-gate.mjs [--prefix <dir>] [--audit-level <level>] [--omit <dev>]

import { spawnSync } from "node:child_process";

const LEVELS = ["info", "low", "moderate", "high", "critical"];
const RETRIES = 3;
const RETRY_DELAY_MS = 3000;

/**
 * A tally is only trustworthy when every severity is a real, non-negative integer.
 *
 * `Number("garbage") || 0` and `Number(undefined) || 0` both collapse to 0, so a
 * malformed or truncated tally would read as "no vulnerabilities". Arrays pass a naive
 * `typeof === "object"` check and count as zero for the same reason. Reject all of it
 * rather than reporting a clean tree that was never actually measured.
 */
export function isCountableTally(tally) {
  if (!tally || typeof tally !== "object" || Array.isArray(tally)) return false;
  return LEVELS.every((level) => {
    const value = tally[level];
    return typeof value === "number" && Number.isInteger(value) && value >= 0;
  });
}

export function parseArgs(argv) {
  const args = { prefix: null, auditLevel: "high", omit: [] };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--prefix") args.prefix = argv[++i];
    else if (argv[i] === "--audit-level") args.auditLevel = argv[++i];
    else if (argv[i] === "--omit") args.omit.push(argv[++i]);
  }
  return args;
}

/**
 * A registry/transport failure never produces a vulnerability report. npm signals it
 * either with a bare `{ message }` payload or with unparseable output plus a non-zero
 * exit, so treat both as infrastructure rather than a finding.
 */
export function classifyAuditResult({ status, stdout, stderr }) {
  const raw = String(stdout ?? "").trim();
  const errText = String(stderr ?? "");

  let report = null;
  if (raw) {
    const start = raw.indexOf("{");
    if (start >= 0) {
      try {
        report = JSON.parse(raw.slice(start));
      } catch {
        report = null;
      }
    }
  }

  const looksLikeTransport =
    /audit endpoint returned an error|invalid json response body|ENOTFOUND|ETIMEDOUT|ECONNRESET|EAI_AGAIN|socket hang up|503 Service Unavailable|registry error/i
      .test(errText + raw);

  // Only a report we can actually COUNT is accepted. A payload whose tally is missing,
  // malformed, or non-numeric would silently count as zero and pass a critical finding,
  // so it falls through to `unknown` and fails closed.
  if (isCountableTally(report?.metadata?.vulnerabilities)) {
    return { kind: "report", report };
  }
  if (looksLikeTransport || (report && report.message && !report.metadata)) {
    return { kind: "infrastructure", detail: report?.message ?? errText.trim().split("\n")[0] ?? "" };
  }
  // A clean exit is NOT proof of a clean tree. If npm exited 0 without a parseable
  // tally, nothing was verified — inventing an empty report here would turn "we could
  // not check" into "everything is fine".
  void status;
  return { kind: "unknown", detail: errText.trim() || raw.slice(0, 400) };
}

/** Count findings at or above the threshold; below-threshold noise must not fail the gate. */
export function countAtOrAbove(report, auditLevel) {
  const floor = LEVELS.indexOf(auditLevel);
  if (floor < 0) throw new Error(`unknown audit level: ${auditLevel}`);
  const counts = report?.metadata?.vulnerabilities;
  // Refuse to answer rather than answering zero for a tally we cannot trust.
  if (!isCountableTally(counts)) throw new Error("audit report has no countable vulnerability tally");
  return LEVELS.slice(floor).reduce((total, level) => total + counts[level], 0);
}

function runAudit({ prefix, auditLevel, omit }) {
  const argv = ["audit", "--audit-level", auditLevel, "--json"];
  for (const value of omit) argv.push("--omit", value);
  if (prefix) argv.unshift("--prefix", prefix);
  return spawnSync("npm", argv, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const label = args.prefix ? `${args.prefix} dependencies` : "root production dependencies";

  let last = null;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    const result = runAudit(args);
    last = classifyAuditResult(result);

    if (last.kind === "report") {
      const found = countAtOrAbove(last.report, args.auditLevel);
      if (found > 0) {
        console.error(`audit gate: ${found} ${args.auditLevel}+ vulnerabilit${found === 1 ? "y" : "ies"} in ${label}`);
        console.error(String(result.stdout ?? "").slice(0, 8000));
        process.exit(1);
      }
      console.log(`audit gate: no ${args.auditLevel}+ vulnerabilities in ${label}`);
      return;
    }

    if (last.kind === "unknown") {
      console.error(`audit gate: unrecognized npm audit failure for ${label} — failing closed`);
      console.error(last.detail);
      process.exit(1);
    }

    if (attempt < RETRIES) {
      console.warn(`audit gate: registry error for ${label} (attempt ${attempt}/${RETRIES}), retrying...`);
      await sleep(RETRY_DELAY_MS);
    }
  }

  // Every attempt hit the registry, not the dependency tree. Report it loudly but do
  // not fail the build for an upstream outage we cannot act on.
  console.warn(`audit gate: SKIPPED for ${label} — npm registry did not return a usable advisory report`);
  console.warn(`audit gate: last registry error: ${last?.detail ?? "unknown"}`);
  console.warn("audit gate: dependencies were NOT verified in this run; re-run once the registry recovers");
}

// Only run when invoked directly, so the classifier stays unit-testable.
if (process.argv[1] && process.argv[1].endsWith("audit-gate.mjs")) {
  await main();
}
