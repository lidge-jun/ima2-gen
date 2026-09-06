import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "yaml";
import { assertPagesPublication, parsePagesInputs } from "../scripts/pages-publication-gate.mjs";

const SHA = "a".repeat(40);
type Input = Parameters<typeof assertPagesPublication>[0];
function fixture(): Input {
  return { version: "3.14.0", sha: SHA, sourceVersion: "3.14.0", headSha: SHA, tagSha: SHA,
    registry: { exact: { version: "3.14.0", gitHead: SHA, dist: { integrity: "sha512-fixture", tarball: "https://registry.npmjs.org/ima2-gen/-/ima2-gen-3.14.0.tgz" } }, latest: { version: "3.14.0", gitHead: SHA } },
    installationReport: { schemaVersion: 1, mode: "installation", version: "3.14.0",
      checks: [{ code: "NODE_RUNTIME_OK", kind: "pass", message: "Supported Node" }], summary: { passed: 1, failed: 0, warned: 0, exitCode: 0 } } };
}

test("Pages accepts only compatible source, tag, registry and real installation report fields", () => {
  assert.deepEqual(assertPagesPublication(fixture()), { version: "3.14.0", sourceSha: SHA, installationMode: "installation", installationPassed: true, integrity: "sha512-fixture" });
  const extra = fixture();
  extra.installationReport.checks.unshift({ code: "EXTRA_INFO", kind: "info", message: "Safe information" });
  assert.equal(assertPagesPublication(extra).installationPassed, true);
});

test("Pages rejects incompatible or forged boundary inputs without a live publication", () => {
  const changes: ((value: Input) => void)[] = [
    (value) => { value.registry.latest.version = "3.13.1"; },
    (value) => { value.registry.exact.gitHead = "b".repeat(40); },
    (value) => { value.registry.latest.gitHead = "b".repeat(40); },
    (value) => { value.tagSha = "b".repeat(40); },
    (value) => { value.headSha = "b".repeat(40); },
    (value) => { value.sourceVersion = "3.13.1"; },
    (value) => { delete value.registry.exact.dist; },
    (value) => { value.registry.exact.dist.integrity = ""; },
    (value) => { value.registry.exact.dist.tarball = null; },
    (value) => { value.installationReport.mode = "standard"; },
    (value) => { value.installationReport.checks = []; },
    (value) => { value.installationReport.summary.passed = 2; },
    (value) => { value.installationReport.summary.warned = 1; },
    (value) => { value.installationReport.checks.push({ code: "INSTALL_NATIVE_FAILED", kind: "fail", message: "Failed dependency" }); },
    (value) => { value.installationReport.checks[0].code = "UNRELATED_PASS"; },
    (value) => { value.installationReport = "Doctor banner\n{}"; },
    (value) => { value.installationReport = "{}\n{}"; },
  ];
  for (const change of changes) { const value = fixture(); change(value); assert.throws(() => assertPagesPublication(value)); }
  for (const releaseVersion of ["3.14.0-preview.1", "03.14.0", null, [], undefined]) {
    assert.throws(() => parsePagesInputs({ releaseVersion, releaseSha: SHA }));
  }
  for (const releaseSha of ["main", "abcdef0", SHA.toUpperCase(), null, []]) {
    assert.throws(() => parsePagesInputs({ releaseVersion: "3.14.0", releaseSha }));
  }
});

type Step = { name?: string; uses?: string; run?: string; if?: unknown; "continue-on-error"?: unknown; with?: Record<string, unknown> };
type Workflow = { on: { push?: unknown; release?: unknown; workflow_dispatch: { inputs: Record<string, { required: boolean; type: string }> } }; jobs: { build: { defaults?: unknown; steps: Step[] }; deploy: { needs: string } } };
const workflow = (): Workflow => parse(readFileSync(".github/workflows/pages.yml", "utf8"));
function assertPagesWorkflow(value: Workflow) {
  assert.equal(value.on.push, undefined); assert.equal(value.on.release, undefined);
  for (const name of ["release_sha", "release_version"]) {
    assert.equal(value.on.workflow_dispatch.inputs[name].required, true);
    assert.equal(value.on.workflow_dispatch.inputs[name].type, "string");
  }
  const steps = value.jobs.build.steps;
  assert.equal(value.jobs.build.defaults, undefined);
  assert.equal(steps.filter((step) => step.uses?.startsWith("actions/checkout@")).length, 1);
  assert.equal(steps.find((step) => step.uses?.startsWith("actions/checkout@"))!.with?.ref, "${{ inputs.release_sha }}");
  const commandIndex = (command: string) => steps.findIndex((step) => step.run?.split("\n").some((line) => line.trim().startsWith(command)));
  const indices = [commandIndex("node scripts/pages-publication-gate.mjs validate-inputs"),
    commandIndex("node scripts/release-contract.mjs finalize-check"), commandIndex('npm install --prefix "$PAGES_INSTALL_ROOT"'),
    commandIndex('node "$PAGES_INSTALL_ROOT/node_modules/ima2-gen/bin/ima2.js" doctor --installation --json'),
    commandIndex("node scripts/pages-publication-gate.mjs verify --report"), commandIndex("npm --prefix site ci"), commandIndex("npm --prefix site run build"),
    steps.findIndex((step) => step.uses?.startsWith("actions/upload-pages-artifact@"))];
  assert.ok(indices.every((index, position) => index >= 0 && (position === 0 || index > indices[position - 1])), "all compatibility steps must precede site upload");
  for (const index of indices) {
    assert.equal(steps[index].if, undefined);
    assert.ok(steps[index]["continue-on-error"] === undefined || steps[index]["continue-on-error"] === false);
  }
  assert.match(steps[indices[3]].run!, /cd "\$PAGES_INSTALL_ROOT"/);
  assert.equal(value.jobs.deploy.needs, "build");
}

test("actual Pages workflow publishes only after exact-release compatibility checks", () => assertPagesWorkflow(workflow()));
test("Pages workflow rejects bypasses but tolerates label changes", () => {
  const base = workflow(); assertPagesWorkflow(base);
  const changes: ((value: Workflow) => void)[] = [
    (value) => { value.on.push = { branches: ["main"] }; },
    (value) => { value.jobs.build.steps[0].with!.ref = "main"; },
    (value) => { const steps = value.jobs.build.steps; steps.unshift(...steps.splice(steps.findIndex((step) => step.uses?.startsWith("actions/upload-pages-artifact@")), 1)); },
    (value) => { value.jobs.build.steps = value.jobs.build.steps.filter((step) => !step.run?.includes("doctor --installation --json")); },
    (value) => { value.jobs.build.steps.find((step) => step.run?.includes("verify --report"))!["continue-on-error"] = true; },
    (value) => { value.jobs.build.steps.find((step) => step.run?.includes("finalize-check"))!.if = "false"; },
  ];
  for (const change of changes) { const value = structuredClone(base); change(value); assert.throws(() => assertPagesWorkflow(value)); }
  for (const step of base.jobs.build.steps) step.name = "Different label";
  assertPagesWorkflow(base);
});
