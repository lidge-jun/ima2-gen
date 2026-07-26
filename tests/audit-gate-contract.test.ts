import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyAuditResult, countAtOrAbove, parseArgs } from "../scripts/audit-gate.mjs";

// WP-A: `npm audit` exits 1 both when it finds a vulnerability and when the registry
// fails to answer. Conflating those turns an upstream outage into a red build and
// trains people to ignore the gate. These tests pin the distinction.

const REGISTRY_FAILURE = {
  status: 1,
  stdout: JSON.stringify({
    message: "invalid json response body at https://registry.npmjs.org/-/npm/v1/security/advisories/bulk reason: Unexpected token",
    error: { summary: "", detail: "" },
  }),
  stderr: "npm error audit endpoint returned an error",
};

const CLEAN_REPORT = {
  status: 0,
  stdout: JSON.stringify({
    metadata: { vulnerabilities: { info: 0, low: 2, moderate: 1, high: 0, critical: 0 } },
  }),
  stderr: "",
};

const VULNERABLE_REPORT = {
  status: 1,
  stdout: JSON.stringify({
    metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 2, critical: 1 } },
    vulnerabilities: { "some-pkg": { severity: "high" } },
  }),
  stderr: "",
};

test("a registry transport failure is not a vulnerability finding", () => {
  // The exact shape observed in CI run 30191117813: the bulk advisories endpoint
  // returned gzip bytes npm could not decode, so nothing was actually audited.
  assert.equal(classifyAuditResult(REGISTRY_FAILURE).kind, "infrastructure");
});

test("common network failures are also classified as infrastructure", () => {
  for (const stderr of [
    "npm error code ENOTFOUND",
    "npm error network ETIMEDOUT",
    "npm error socket hang up",
    "npm error 503 Service Unavailable",
  ]) {
    assert.equal(
      classifyAuditResult({ status: 1, stdout: "", stderr }).kind,
      "infrastructure",
      `${stderr} should be infrastructure`,
    );
  }
});

test("a real advisory report is classified as a report even when npm exits 1", () => {
  const result = classifyAuditResult(VULNERABLE_REPORT);
  assert.equal(result.kind, "report");
  assert.equal(countAtOrAbove(result.report, "high"), 3, "2 high + 1 critical must be counted");
});

test("findings below the threshold do not trip the gate", () => {
  const result = classifyAuditResult(CLEAN_REPORT);
  assert.equal(result.kind, "report");
  assert.equal(countAtOrAbove(result.report, "high"), 0, "low/moderate must not fail a high gate");
  assert.equal(countAtOrAbove(result.report, "low"), 3, "the same report is non-zero at a lower gate");
});

test("an unrecognized failure fails closed rather than passing silently", () => {
  // Silence here would be the worst outcome: a broken gate that always reports success.
  const result = classifyAuditResult({ status: 1, stdout: "totally unexpected", stderr: "boom" });
  assert.equal(result.kind, "unknown");
});

test("threshold arithmetic covers every severity at or above the level", () => {
  const report = { metadata: { vulnerabilities: { info: 1, low: 1, moderate: 1, high: 1, critical: 1 } } };
  assert.equal(countAtOrAbove(report, "critical"), 1);
  assert.equal(countAtOrAbove(report, "high"), 2);
  assert.equal(countAtOrAbove(report, "moderate"), 3);
  assert.equal(countAtOrAbove(report, "info"), 5);
  assert.throws(() => countAtOrAbove(report, "nonsense"));
});

test("argument parsing supports the ui prefix and omit flags the CI uses", () => {
  const args = parseArgs(["--prefix", "ui", "--audit-level", "high", "--omit", "dev"]);
  assert.equal(args.prefix, "ui");
  assert.equal(args.auditLevel, "high");
  assert.deepEqual(args.omit, ["dev"]);

  const defaults = parseArgs([]);
  assert.equal(defaults.prefix, null);
  assert.equal(defaults.auditLevel, "high", "the gate must default to the strict level");
});
