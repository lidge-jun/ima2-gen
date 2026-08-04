// Provider-aware composer reference caps (mirrors server hard limits).
import { test } from "node:test";
import assert from "node:assert/strict";
import { effectiveReferenceLimit, GROK_FAMILY_IMAGE_REF_LIMIT, GROK_VIDEO_REF_LIMIT, MINIMAX_IMAGE_REF_LIMIT } from "../ui/src/lib/referenceLimits.ts";

const base = { serverLimit: 5, videoModelSelected: false, mcpProvider: null };

test("grok-family image providers cap at the server's 3-ref edit limit", () => {
  for (const provider of ["grok", "grok-api", "agy", "gemini-api"] as const) {
    assert.equal(effectiveReferenceLimit({ ...base, provider }), GROK_FAMILY_IMAGE_REF_LIMIT);
  }
});

test("gpt providers keep the server capability limit", () => {
  assert.equal(effectiveReferenceLimit({ ...base, provider: "oauth" }), 5);
  assert.equal(effectiveReferenceLimit({ ...base, provider: "api" }), 5);
});

test("grok video mode allows ref2v up to min(server, 7)", () => {
  assert.equal(effectiveReferenceLimit({ ...base, provider: "grok", videoModelSelected: true }), 5);
  assert.equal(effectiveReferenceLimit({ ...base, provider: "grok", videoModelSelected: true, serverLimit: 12 }), GROK_VIDEO_REF_LIMIT);
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
