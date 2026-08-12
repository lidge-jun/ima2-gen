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
//   - an advisory listed in audit-exceptions.json -> excluded, but only while the entry
//     is well-formed and unexpired (see loadExceptions)
//
// Usage: node scripts/audit-gate.mjs [--prefix <dir>] [--audit-level <level>] [--omit <dev>]

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LEVELS = ["info", "low", "moderate", "high", "critical"];
const RETRIES = 3;
const RETRY_DELAY_MS = 3000;
const EXCEPTIONS_PATH = join(dirname(fileURLToPath(import.meta.url)), "audit-exceptions.json");

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
 * Validates one exception entry. Every field is mandatory on purpose:
 *
 * - `ghsa` pins the exception to a single advisory, so a NEW advisory on the same
 *   package still fails the gate.
 * - `expires` forces the decision to be revisited. An expired entry is not an error,
 *   it simply stops excluding — the gate goes red again and someone must look.
 * - `reason` and `evidence` exist because "we accepted this risk" is only defensible
 *   when the reasoning is written down next to the exception.
 *
 * A malformed entry is rejected rather than ignored: a typo must never silently widen
 * the exception set.
 */
export function validateException(entry, now = new Date()) {
  const problems = [];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return ["entry is not an object"];
  for (const field of ["ghsa", "package", "scope", "reason", "evidence", "expires"]) {
    if (typeof entry[field] !== "string" || !entry[field].trim()) problems.push(`${field} is required`);
  }
  if (typeof entry.ghsa === "string" && entry.ghsa.trim() && !/^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/.test(entry.ghsa)) {
    problems.push(`ghsa "${entry.ghsa}" is not a GHSA id`);
  }
  if (typeof entry.expires === "string" && entry.expires.trim()) {
    const at = Date.parse(entry.expires);
    if (!Number.isFinite(at)) problems.push(`expires "${entry.expires}" is not a date`);
    else if (at <= now.getTime()) problems.push(`expired on ${entry.expires}`);
  }
  return problems;
}

/**
 * Reads the exception list. A missing file means "no exceptions" — the common case.
 * Unreadable or malformed content throws: the gate must never treat a broken exception
 * file as an empty one, because that reads as "nothing is excluded" only by luck.
 */
export function loadExceptions(raw, now = new Date()) {
  if (raw === null) return { active: [], skipped: [] };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`audit-exceptions.json is not valid JSON: ${error.message}`);
  }
  if (!Array.isArray(parsed?.exceptions)) throw new Error("audit-exceptions.json must have an `exceptions` array");
  const active = [];
  const skipped = [];
  for (const entry of parsed.exceptions) {
    const problems = validateException(entry, now);
    if (problems.length) skipped.push({ entry, problems });
    else active.push(entry);
  }
  return { active, skipped };
}

function readExceptionsFile(path = EXCEPTIONS_PATH) {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

/**
 * Splits findings at or above the threshold into excluded and remaining.
 *
 * Matching is per advisory AND per scope, walking `via` for the GHSA url that npm
 * reports. A package that is only vulnerable *through* an excluded advisory (npm lists
 * the parent separately with a string `via`) is excluded with it; anything else counts.
 */
export function partitionFindings(report, auditLevel, exceptions, scope) {
  const floor = LEVELS.indexOf(auditLevel);
  if (floor < 0) throw new Error(`unknown audit level: ${auditLevel}`);
  const atOrAbove = new Set(LEVELS.slice(floor));
  const scoped = exceptions.filter((entry) => entry.scope === scope);
  const allowed = new Set(scoped.map((entry) => entry.ghsa));
  const vulns = report?.vulnerabilities;
  if (!vulns || typeof vulns !== "object") throw new Error("audit report has no per-advisory detail to match exceptions against");

  const excludedNames = new Set();
  const remaining = [];
  // Two passes: settle direct advisory matches first, then packages that are only
  // vulnerable through an already-excluded dependency.
  for (const [name, vuln] of Object.entries(vulns)) {
    if (!atOrAbove.has(vuln?.severity)) continue;
    const ids = (Array.isArray(vuln.via) ? vuln.via : [])
      .filter((via) => via && typeof via === "object" && typeof via.url === "string")
      .map((via) => via.url.split("/").pop());
    if (ids.length > 0 && ids.every((id) => allowed.has(id))) excludedNames.add(name);
  }
  for (const [name, vuln] of Object.entries(vulns)) {
    if (!atOrAbove.has(vuln?.severity) || excludedNames.has(name)) continue;
    const via = Array.isArray(vuln.via) ? vuln.via : [];
    const parents = via.filter((entry) => typeof entry === "string");
    if (via.length > 0 && parents.length === via.length && parents.every((parent) => excludedNames.has(parent))) {
      excludedNames.add(name);
      continue;
    }
    remaining.push(name);
  }
  return { excluded: [...excludedNames], remaining };
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

  // Tests substitute a stub through IMA2_AUDIT_NPM. Injecting an explicit script keeps
  // the e2e checks OS-independent: a shell-script `npm` on PATH is not executable on
  // Windows, and `npm.cmd` shims differ per runner.
  const stub = process.env.IMA2_AUDIT_NPM;
  if (stub) {
    return spawnSync(process.execPath, [stub, ...argv], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  }
  return spawnSync("npm", argv, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    shell: process.platform === "win32", // npm is a .cmd shim on Windows
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const label = args.prefix ? `${args.prefix} dependencies` : "root production dependencies";
  const scope = args.prefix ?? "root";

  let exceptions;
  try {
    exceptions = loadExceptions(readExceptionsFile());
  } catch (error) {
    console.error(`audit gate: ${error.message} — failing closed`);
    process.exit(1);
  }
  for (const { entry, problems } of exceptions.skipped) {
    console.warn(`audit gate: ignoring exception ${entry?.ghsa ?? "(unnamed)"} — ${problems.join("; ")}`);
  }

  let last = null;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    const result = runAudit(args);
    last = classifyAuditResult(result);

    if (last.kind === "report") {
      const found = countAtOrAbove(last.report, args.auditLevel);
      if (found === 0) {
        console.log(`audit gate: no ${args.auditLevel}+ vulnerabilities in ${label}`);
        return;
      }
      const scopedExceptions = exceptions.active.filter((item) => item.scope === scope);
      if (scopedExceptions.length === 0) {
        // No exception could apply, so the tally alone decides. Keeping this path free of
        // per-advisory parsing means the exception feature cannot change the answer for
        // scopes that do not use it.
        console.error(`audit gate: ${found} ${args.auditLevel}+ vulnerabilit${found === 1 ? "y" : "ies"} in ${label}`);
        console.error(String(result.stdout ?? "").slice(0, 8000));
        process.exit(1);
      }
      let split;
      try {
        split = partitionFindings(last.report, args.auditLevel, scopedExceptions, scope);
      } catch (error) {
        console.error(`audit gate: ${error.message} — failing closed`);
        process.exit(1);
      }
      for (const entry of scopedExceptions) {
        console.warn(`audit gate: ${entry.ghsa} (${entry.package}) excluded until ${entry.expires} — ${entry.reason}`);
      }
      if (split.excluded.length > 0) {
        console.warn(`audit gate: excluded advisories cover ${split.excluded.join(", ")} in ${label}`);
      }
      if (split.remaining.length > 0) {
        const count = split.remaining.length;
        console.error(`audit gate: ${count} ${args.auditLevel}+ vulnerabilit${count === 1 ? "y" : "ies"} in ${label}: ${split.remaining.join(", ")}`);
        console.error(String(result.stdout ?? "").slice(0, 8000));
        process.exit(1);
      }
      console.log(`audit gate: no unexcepted ${args.auditLevel}+ vulnerabilities in ${label} (${split.excluded.length} excluded)`);
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
