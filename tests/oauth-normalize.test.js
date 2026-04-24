import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOAuthParams, VALID_IMAGE_QUALITIES } from "../lib/oauthNormalize.js";

test("oauth provider preserves every supported quality", () => {
  for (const quality of VALID_IMAGE_QUALITIES) {
    const out = normalizeOAuthParams({ provider: "oauth", quality });
    assert.equal(out.quality, quality);
    assert.deepEqual(out.warnings, []);
  }
});

test("provider=auto preserves every supported explicit quality", () => {
  for (const quality of VALID_IMAGE_QUALITIES) {
    const out = normalizeOAuthParams({ provider: "auto", quality });
    assert.equal(out.quality, quality);
    assert.deepEqual(out.warnings, []);
  }
});

test("missing inputs default safely", () => {
  const out = normalizeOAuthParams({});
  assert.equal(out.quality, "medium");
  assert.deepEqual(out.warnings, []);
});

test("invalid quality defaults to medium with an explicit warning", () => {
  const out = normalizeOAuthParams({ provider: "oauth", quality: "ultra" });
  assert.equal(out.quality, "medium");
  assert.deepEqual(out.warnings, [
    {
      code: "QUALITY_DEFAULTED",
      field: "quality",
      normalizedTo: "medium",
      reason: "invalid-quality",
    },
  ]);
});

test("quality auto is not an exposed app option and defaults to medium", () => {
  const out = normalizeOAuthParams({ provider: "oauth", quality: "auto" });
  assert.equal(out.quality, "medium");
  assert.equal(out.warnings[0].code, "QUALITY_DEFAULTED");
  assert.equal(out.warnings[0].normalizedTo, "medium");
});

test("explicit non-oauth provider also uses the same validated quality contract", () => {
  const out = normalizeOAuthParams({ provider: "api", quality: "high" });
  assert.equal(out.quality, "high");
  assert.deepEqual(out.warnings, []);
});
