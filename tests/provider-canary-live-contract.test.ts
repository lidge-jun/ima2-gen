import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { LIVE_LANES, PRE_RELEASE_LANES, lanesForTier, describeShape, redact } from "../scripts/provider-canary-live.mjs";

/**
 * The live canary spends money. typecheck does not read workflow YAML and no
 * other gate observes this file, so these assertions are the only thing
 * standing between an edit and an unnoticed billing trigger (#152).
 */
const workflow = readFileSync(new URL("../.github/workflows/provider-canary-live.yml", import.meta.url), "utf8");

test("live canary is dispatch-only: no schedule, no pull_request, no push", () => {
  const trigger = workflow.match(/\non:\n([\s\S]*?)\npermissions:/);
  assert.ok(trigger, "could not locate the on: block");
  const block = trigger[1];
  assert.ok(block.includes("workflow_dispatch"), "live canary must be dispatchable");
  assert.ok(!block.includes("schedule"), "a scheduled live canary would charge without anyone asking");
  assert.ok(!block.includes("pull_request"), "#152: a canary failure must never block a contributor's PR");
  assert.ok(!/\bpush:/.test(block), "a push-triggered live canary would charge on every merge");
});

test("live canary sits behind the provider-canary-live environment", () => {
  assert.match(workflow, /environment: provider-canary-live/);
});

test("live canary refuses to run without the exact budget acknowledgment", () => {
  assert.match(workflow, /budget_ack/, "the dispatch must ask for a spend acknowledgment");
  assert.match(
    workflow,
    /if \[ "\$BUDGET_ACK" != "I approve provider canary spend" \]; then/,
    "the acknowledgment must be compared exactly, before any lane is probed",
  );
  const ackIndex = workflow.indexOf("Verify spend acknowledgment");
  const probeIndex = workflow.indexOf("provider-canary-live.mjs");
  assert.ok(ackIndex > -1 && probeIndex > -1);
  assert.ok(ackIndex < probeIndex, "the acknowledgment step must precede the probe step");
});

test("the release path does not depend on the paid canary", () => {
  // Wiring a paid job into release.yml before a budget exists would stall every
  // release behind spend nobody approved (#152, devlog 020).
  const release = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
  assert.ok(!release.includes("provider-canary-live"), "release.yml must not call the paid canary yet");
  const publish = readFileSync(new URL("../.github/workflows/publish.yml", import.meta.url), "utf8");
  assert.ok(!publish.includes("provider-canary-live"), "publish.yml must not call the paid canary yet");
});

test("the no-cost canary stays free: it is never given a generation endpoint", () => {
  const free = readFileSync(new URL("../scripts/provider-canary.mjs", import.meta.url), "utf8");
  for (const marker of ["images/generations", "images/edits", "image_generation", "generateContent"]) {
    assert.ok(!free.includes(marker), `provider-canary.mjs must not call ${marker}: the daily tier is the free one`);
  }
});

test("tiers resolve to real lanes", () => {
  const weekly = lanesForTier("weekly");
  assert.deepEqual(weekly, Object.keys(LIVE_LANES));
  assert.ok(weekly.length >= 5, "weekly should cover every credentialed lane");
  const preRelease = lanesForTier("pre-release");
  assert.deepEqual(preRelease, PRE_RELEASE_LANES);
  assert.equal(preRelease.length, 2, "#152 says pre-release uses two representative providers");
  for (const lane of preRelease) {
    assert.ok(LIVE_LANES[lane], `pre-release names unknown lane ${lane}`);
    assert.equal(typeof LIVE_LANES[lane].edit, "function", `${lane} needs an edit probe for the pre-release tier`);
  }
  assert.throws(() => lanesForTier("daily"), /unknown tier/);
});

test("every lane declares its credential env and a generate probe", () => {
  for (const [name, lane] of Object.entries(LIVE_LANES) as Array<[string, { env: string; generate: unknown }]>) {
    assert.match(lane.env, /^CANARY_[A-Z_]+$/, `${name} must read a CANARY_* credential`);
    assert.equal(typeof lane.generate, "function", `${name} needs a generate probe`);
  }
});

test("lane ids exist in the provider registry", () => {
  const registry = readFileSync(new URL("../lib/providers/registry.ts", import.meta.url), "utf8");
  for (const lane of Object.keys(LIVE_LANES)) {
    assert.ok(
      registry.includes(`id: "${lane}"`),
      `live canary probes lane "${lane}" which is not in lib/providers/registry.ts`,
    );
  }
});

test("describeShape records structure, never payload bytes", () => {
  // #152: 결과 이미지는 장기 저장하지 않는다. The shape summary is what gets
  // logged, so it must not carry the base64 through.
  const huge = "A".repeat(50_000);
  const shape = describeShape({ created: 1, data: [{ b64_json: huge }] });
  assert.ok(!shape.includes(huge.slice(0, 200)), "shape summary leaked payload bytes");
  assert.equal(shape, "object{created,data} data[1]");
  assert.equal(describeShape(null), "empty");
  assert.equal(describeShape([1, 2, 3]), "array[3]");
});

test("redact strips credentials from failure messages", () => {
  assert.ok(!redact("failed with sk-abc123DEF456").includes("abc123DEF456"));
  assert.ok(!redact("failed with xai-secretvalue99").includes("secretvalue99"));
  assert.ok(!redact("https://x.test/v1?api_key=hunter2token").includes("hunter2token"));
});
