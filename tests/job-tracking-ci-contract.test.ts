import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { test } from "node:test";
import { parseDocument } from "yaml";
import { assertActionPinned } from "./_actionPins.mjs";

interface Step {
  name?: string;
  uses?: string;
  if?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
  run?: string;
}

const workflowSource = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const document = parseDocument(workflowSource);
assert.deepEqual(document.errors, []);
const workflow = document.toJS() as { jobs: { e2e: { steps: Step[] } } };
const steps = workflow.jobs.e2e.steps;
const sourceExpression = "${{ github.event.inputs.sha || github.sha }}";

function verifyContract(candidate: Step[]): void {
  const checkout = candidate.find(step => step.uses?.startsWith("actions/checkout@"));
  assert.equal(checkout?.with?.ref, sourceExpression);
  assert.equal(checkout?.with?.["fetch-depth"], 0);
  assert.equal(checkout?.with?.["persist-credentials"], false);
  const guard = candidate.find(step => step.name === "Verify E2E source SHA");
  assert.equal(guard?.env?.WP07_EXPECTED_SHA, sourceExpression);
  assert.ok(guard?.run);
  const install = candidate.findIndex(step => step.name === "Install root deps");
  assert.ok(candidate.indexOf(guard) > candidate.indexOf(checkout!));
  assert.ok(candidate.indexOf(guard) < install);
  assert.ok(candidate.some(step => step.run === "npm --prefix ui run test:e2e -- --reporter=line"));
  const upload = candidate.find(step => step.with?.name === "wp07-job-tracking-evidence");
  assert.equal(upload?.if, "always()");
  assertActionPinned(`jobs:\n  tracking:\n    steps:\n      - uses: ${upload?.uses}`, "actions/upload-artifact", "tracking upload");
  assert.deepEqual(String(upload?.with?.path).trim().split("\n"), [
    "ui/test-results/**/wp07-*.png", "ui/test-results/**/wp07-*.json",
  ]);
  assert.equal(upload?.with?.["if-no-files-found"], "error");
}

test("canonical E2E job checks the requested source and retains native tracking evidence", () => {
  verifyContract(steps);
});

test("E2E contract rejects missing provenance and evidence controls", () => {
  for (const target of ["checkout", "guard", "upload", "mutable-action", "wrong-action"] as const) {
    const changed = structuredClone(steps);
    if (target === "checkout") delete changed.find(s => s.uses?.startsWith("actions/checkout@"))!.with!.ref;
    if (target === "guard") changed.splice(changed.findIndex(s => s.name === "Verify E2E source SHA"), 1);
    if (target === "upload") changed.find(s => s.with?.name === "wp07-job-tracking-evidence")!.with!.path = "ui/test-results/**/wrong.png";
    if (target === "mutable-action") changed.find(s => s.with?.name === "wp07-job-tracking-evidence")!.uses = "actions/upload-artifact@main";
    if (target === "wrong-action") changed.find(s => s.with?.name === "wp07-job-tracking-evidence")!.uses = `attacker/action@${"a".repeat(40)}`;
    assert.throws(() => verifyContract(changed), undefined, target);
  }
});

test("actual inline SHA guard accepts exact HEAD and rejects malformed, absent or different SHA", () => {
  const command = steps.find(step => step.name === "Verify E2E source SHA")?.run ?? "";
  const match = command.trim().match(/^node --input-type=module -e '([\s\S]*)'$/);
  assert.ok(match, "execute the workflow's actual Node program, not a test replica");
  const actual = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const wrong = (actual[0] === "0" ? "1" : "0") + actual.slice(1);
  for (const wanted of [actual, wrong, "bad-sha", "", undefined]) {
    const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot };
    if (wanted !== undefined) env.WP07_EXPECTED_SHA = wanted;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", match[1]!], { env, encoding: "utf8" });
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(result.status, wanted === actual ? 0 : 1);
  }
});
