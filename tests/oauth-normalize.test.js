import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOAuthParams } from "../lib/oauthNormalize.js";

test("oauth provider normalizes non-auto quality", () => {
  const out = normalizeOAuthParams({ provider: "oauth", quality: "medium" });
  assert.equal(out.quality, "auto");
  assert.equal(out.warnings.length, 1);
  assert.equal(out.warnings[0].code, "QUALITY_NORMALIZED");
  assert.equal(out.warnings[0].field, "quality");
  assert.equal(out.warnings[0].normalizedTo, "auto");
});

test("oauth provider passes auto through without warning", () => {
  const out = normalizeOAuthParams({ provider: "oauth", quality: "auto" });
  assert.equal(out.quality, "auto");
  assert.equal(out.warnings.length, 0);
});

test("provider=auto is treated as oauth (effective path is oauth)", () => {
  const out = normalizeOAuthParams({ provider: "auto", quality: "high" });
  assert.equal(out.quality, "auto");
  assert.equal(out.warnings.length, 1);
});

test("missing inputs default safely", () => {
  const out = normalizeOAuthParams({});
  assert.equal(out.quality, "auto");
  assert.equal(out.warnings.length, 0);
});

test("explicit non-oauth provider keeps quality (escape hatch for future)", () => {
  const out = normalizeOAuthParams({ provider: "api", quality: "high" });
  assert.equal(out.quality, "high");
  assert.equal(out.warnings.length, 0);
});
