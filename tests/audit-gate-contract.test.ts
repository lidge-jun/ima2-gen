import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classifyAuditResult, countAtOrAbove, isCountableTally, parseArgs } from "../scripts/audit-gate.mjs";

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

test("a report without a countable tally is not accepted as clean", () => {
  // `vulnerabilities` without `metadata.vulnerabilities` would count as zero and let a
  // critical finding through. It must fail closed instead.
  const result = classifyAuditResult({
    status: 1,
    stdout: JSON.stringify({ vulnerabilities: { "bad-pkg": { severity: "critical" } } }),
    stderr: "",
  });
  assert.equal(result.kind, "unknown", "an uncountable report must not pass the gate");
});

test("a clean exit without a parseable report is not treated as a clean tree", () => {
  // npm exiting 0 with no usable output means nothing was verified. Calling that
  // "no vulnerabilities" turns "could not check" into "everything is fine".
  assert.equal(classifyAuditResult({ status: 0, stdout: "", stderr: "" }).kind, "unknown");
  assert.equal(classifyAuditResult({ status: 0, stdout: "not json", stderr: "" }).kind, "unknown");
});

test("a malformed tally is refused instead of counting as zero", () => {
  // Verified against npm 11.18.0: a real report always fills every severity plus
  // `total` (`{"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}`), so
  // requiring all five never rejects a genuine report.
  // `Number("garbage") || 0` collapses to 0, so a corrupted tally would read as a clean
  // tree. Every severity must be a real non-negative integer or the gate refuses to answer.
  const malformed: unknown[] = [
    { info: 0, low: 0, moderate: 0, high: "garbage", critical: 0 },
    { info: 0, low: 0, moderate: 0, high: -2, critical: 0 },
    { info: 0, low: 0, moderate: 0, high: 1.5, critical: 0 },
    { info: 0, low: 0, moderate: 0, critical: 0 }, // `high` missing entirely
    [],
    null,
    "nope",
  ];
  for (const tally of malformed) {
    assert.equal(isCountableTally(tally), false, `${JSON.stringify(tally)} must not be countable`);
    assert.equal(
      classifyAuditResult({ status: 1, stdout: JSON.stringify({ metadata: { vulnerabilities: tally } }), stderr: "" }).kind,
      "unknown",
      `${JSON.stringify(tally)} must fail closed`,
    );
    assert.throws(
      () => countAtOrAbove({ metadata: { vulnerabilities: tally } }, "high"),
      /countable/,
      `${JSON.stringify(tally)} must not be silently counted`,
    );
  }

  // A well-formed tally still works.
  assert.equal(isCountableTally({ info: 0, low: 1, moderate: 0, high: 2, critical: 0 }), true);
  // npm's own extra `total` key must not break acceptance.
  assert.equal(isCountableTally({ info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 }), true);
});

// --- end-to-end exit-status checks -------------------------------------------------
// The classifier being right is not enough: the gate must actually exit non-zero. These
// run the real script against a stub `npm` on PATH.

function runGateWithStubNpm(stub: string): { status: number | null; stdout: string; stderr: string } {
  const dir = mkdtempSync(join(tmpdir(), "ima2-audit-gate-"));
  try {
    const npmPath = join(dir, "npm");
    writeFileSync(npmPath, stub, { mode: 0o755 });
    chmodSync(npmPath, 0o755);
    const result = spawnSync(
      process.execPath,
      ["scripts/audit-gate.mjs", "--audit-level", "high"],
      { encoding: "utf8", env: { ...process.env, PATH: `${dir}:${process.env.PATH ?? ""}` } },
    );
    return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const stubFor = (payload: unknown, exitCode: number) =>
  `#!/bin/sh\ncat <<'JSON'\n${JSON.stringify(payload)}\nJSON\nexit ${exitCode}\n`;

test("the gate exits non-zero when the report contains high findings", () => {
  const result = runGateWithStubNpm(
    stubFor({ metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 2, critical: 0 } } }, 1),
  );
  assert.equal(result.status, 1, "a high finding must fail the build");
  assert.match(result.stderr, /2 high\+ vulnerabilit/);
});

test("the gate exits zero for a clean report", () => {
  const result = runGateWithStubNpm(
    stubFor({ metadata: { vulnerabilities: { info: 0, low: 3, moderate: 1, high: 0, critical: 0 } } }, 0),
  );
  assert.equal(result.status, 0, "below-threshold findings must not fail the build");
  assert.match(result.stdout, /no high\+ vulnerabilities/);
});

test("the gate exits non-zero when it cannot read a tally", () => {
  const result = runGateWithStubNpm(stubFor({ vulnerabilities: { pkg: { severity: "critical" } } }, 1));
  assert.equal(result.status, 1, "an uncountable report must fail closed");
});

test("the gate exits non-zero for a malformed severity tally", () => {
  const result = runGateWithStubNpm(
    stubFor({ metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: "3", critical: 0 } } }, 1),
  );
  assert.equal(result.status, 1, "a string severity count must not read as zero");
});

test("the gate survives a registry outage without failing the build", () => {
  const stub = `#!/bin/sh\necho 'npm error audit endpoint returned an error' >&2\nexit 1\n`;
  const result = runGateWithStubNpm(stub);
  assert.equal(result.status, 0, "an upstream outage must not turn every push red");
  assert.match(result.stderr + result.stdout, /SKIPPED/);
  assert.match(result.stderr + result.stdout, /NOT verified/, "the skip must be stated loudly");
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
