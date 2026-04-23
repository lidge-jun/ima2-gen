// tests/refs-size.test.js — 0.09.7 validator returns { error, code } for all 6 paths.

import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAndNormalizeRefs } from "../lib/refs.js";

const VALID_B64 = "aGVsbG8=";

test("REF_NOT_ARRAY when references is not an array", () => {
  const r = validateAndNormalizeRefs("nope");
  assert.equal(r.code, "REF_NOT_ARRAY");
  assert.match(r.error, /must be an array/);
});

test("REF_TOO_MANY when over maxCount", () => {
  const refs = Array(6).fill(VALID_B64);
  const r = validateAndNormalizeRefs(refs, { maxCount: 5 });
  assert.equal(r.code, "REF_TOO_MANY");
});

test("REF_NOT_STRING when element is non-string", () => {
  const r = validateAndNormalizeRefs([123]);
  assert.equal(r.code, "REF_NOT_STRING");
});

test("REF_EMPTY when element is empty", () => {
  const r = validateAndNormalizeRefs([""]);
  assert.equal(r.code, "REF_EMPTY");
});

test("REF_TOO_LARGE when element exceeds maxB64Bytes", () => {
  const big = "A".repeat(100);
  const r = validateAndNormalizeRefs([big], { maxB64Bytes: 50 });
  assert.equal(r.code, "REF_TOO_LARGE");
  assert.match(r.error, /exceeds 50 bytes/);
});

test("REF_NOT_BASE64 when element has invalid chars", () => {
  const r = validateAndNormalizeRefs(["not valid !!!"]);
  assert.equal(r.code, "REF_NOT_BASE64");
});

test("valid references strip data URL prefix and return normalized b64", () => {
  const r = validateAndNormalizeRefs([`data:image/png;base64,${VALID_B64}`]);
  assert.deepEqual(r.refs, [VALID_B64]);
  assert.equal(r.error, undefined);
});

test("valid references without prefix pass through", () => {
  const r = validateAndNormalizeRefs([VALID_B64, VALID_B64]);
  assert.deepEqual(r.refs, [VALID_B64, VALID_B64]);
});
