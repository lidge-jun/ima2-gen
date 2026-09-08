// Provider-aware composer reference caps (mirrors server hard limits).
import { test } from "node:test";
import assert from "node:assert/strict";
import { effectiveReferenceLimit, GROK_FAMILY_IMAGE_REF_LIMIT, GROK_VIDEO_REF_LIMIT, MINIMAX_IMAGE_REF_LIMIT } from "../ui/src/lib/referenceLimits.ts";

const base = { serverLimit: 5, videoModelSelected: false, mcpProvider: null };

test("grok-family image providers cap at the server's edit limit", () => {
  // grok/grok-api moved to 5 when xAI raised multi-image editing from 3; agy and
  // gemini-api are Google lanes whose own cap is still 3, so they are asserted
  // against their own manifest entry rather than a shared number.
  for (const provider of ["grok", "grok-api"] as const) {
    assert.equal(effectiveReferenceLimit({ ...base, provider }), GROK_FAMILY_IMAGE_REF_LIMIT);
  }
  assert.equal(GROK_FAMILY_IMAGE_REF_LIMIT, 5);
  for (const provider of ["agy", "gemini-api"] as const) {
    assert.equal(effectiveReferenceLimit({ ...base, provider }), 3);
  }
});

test("gpt providers keep the server capability limit", () => {
  assert.equal(effectiveReferenceLimit({ ...base, provider: "oauth" }), 5);
  assert.equal(effectiveReferenceLimit({ ...base, provider: "api" }), 5);
});

test("grok video mode allows ref2v up to min(server, 14)", () => {
  assert.equal(effectiveReferenceLimit({ ...base, provider: "grok", videoModelSelected: true }), 5);
  assert.equal(effectiveReferenceLimit({ ...base, provider: "grok", videoModelSelected: true, serverLimit: 20 }), GROK_VIDEO_REF_LIMIT);
  assert.equal(GROK_VIDEO_REF_LIMIT, 14);
});

test("MCP lane caps at the 3-reference tool contract (temp uploads enabled)", () => {
  assert.equal(effectiveReferenceLimit({ ...base, provider: "oauth", mcpProvider: "runway" }), 3);
});

test("the effective limit never exceeds the server limit", () => {
  assert.equal(effectiveReferenceLimit({ ...base, provider: "grok", serverLimit: 2 }), 2);
});

test("minimax caps at a single subject reference", () => {
  // The adapter rejects a second reference with MINIMAX_REF_TOO_MANY, so the
  // tray has to stop the user at attach time rather than at generate time.
  assert.equal(effectiveReferenceLimit({ ...base, provider: "minimax" }), MINIMAX_IMAGE_REF_LIMIT);
  // A lower server capability still wins.
  assert.equal(effectiveReferenceLimit({ ...base, provider: "minimax", serverLimit: 0 }), 0);
});

test("atlascloud caps at its 10-reference lane limit", () => {
  // lib/generatePipeline.ts rejects >10 with a 400. The tray previously derived
  // limited lanes by matching Grok's value of 3, which silently skipped Atlas
  // and let a high server capability through unchecked.
  assert.equal(effectiveReferenceLimit({ ...base, provider: "atlascloud", serverLimit: 25 }), 10);
  // The server capability still wins when it is the tighter bound.
  assert.equal(effectiveReferenceLimit({ ...base, provider: "atlascloud", serverLimit: 4 }), 4);
});
