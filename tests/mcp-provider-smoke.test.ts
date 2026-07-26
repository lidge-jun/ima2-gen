import { test } from "node:test";
import assert from "node:assert/strict";

// WP10 Tier 1 boundary marker + Tier 2 entry point, per
// devlog/_plan/260715_subscription-mcp-providers/090_verification_rollout.md.
//
// Everything below the opt-in flag spends real money: live OAuth, real `tools/call`, real
// image/video generation. It stays skipped unless the user has explicitly approved the
// cost for this run.

const LIVE = process.env.IMA2_MCP_LIVE_SMOKE === "1";
const SKIP_REASON = "requires IMA2_MCP_LIVE_SMOKE=1 and explicit user cost approval";

test("provider smoke stays opt-in by default", () => {
  // The guard itself is the Tier 1 assertion: a default `npm test` must never be able to
  // bill the user. If this ever passes without the flag, the gate has been removed.
  if (!LIVE) {
    assert.equal(process.env.IMA2_MCP_LIVE_SMOKE, undefined);
    return;
  }
  assert.equal(process.env.IMA2_MCP_LIVE_SMOKE, "1");
});

test("live provider tools/call", { skip: LIVE ? false : SKIP_REASON }, async () => {
  // Tier 2 protocol (090 § Billing gate), to be filled in only under approval:
  //   1. record the starting credit balance per provider
  //   2. one minimal image call, then one minimal video call
  //   3. ingest the result and assert the sidecar records provider/model
  //   4. record the closing balance and the actual delta
  //   5. persist sanitized evidence — never tokens or account ids
  assert.fail("Tier 2 live smoke is not implemented; run it only under explicit approval");
});

test("mixed pipeline: GPT image -> MCP video", { skip: LIVE ? false : SKIP_REASON }, async () => {
  // 090 requires exactly one mixed-pipeline run as Tier 2 evidence.
  assert.fail("Tier 2 mixed pipeline is not implemented; run it only under explicit approval");
});
