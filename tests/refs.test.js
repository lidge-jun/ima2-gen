// REF_* validator codes — every failure path returns a stable code so the UI
// can route each one to a specific toast (Phase 1.2, upstream 9f9fe53).

import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAndNormalizeRefs, MAX_REF_COUNT, MAX_REF_B64_BYTES } from "../lib/refs.js";

const VALID_B64 = "aGVsbG8="; // "hello"

test("REF_NOT_ARRAY when references is not an array", () => {
  const r = validateAndNormalizeRefs("nope");
  assert.equal(r.code, "REF_NOT_ARRAY");
  assert.match(r.error, /must be an array/);
});

test("REF_NOT_ARRAY for null (defensive — should not happen if caller defaults to [])", () => {
  const r = validateAndNormalizeRefs(null);
  assert.equal(r.code, "REF_NOT_ARRAY");
});

test("REF_TOO_MANY when over maxCount (default 5)", () => {
  const refs = Array(MAX_REF_COUNT + 1).fill(VALID_B64);
  const r = validateAndNormalizeRefs(refs);
  assert.equal(r.code, "REF_TOO_MANY");
  assert.match(r.error, new RegExp(`exceed ${MAX_REF_COUNT} items`));
});

test("REF_TOO_MANY honors explicit maxCount option", () => {
  const r = validateAndNormalizeRefs([VALID_B64, VALID_B64], { maxCount: 1 });
  assert.equal(r.code, "REF_TOO_MANY");
  assert.match(r.error, /exceed 1 items/);
});

test("REF_NOT_STRING when an element is not a string", () => {
  const r = validateAndNormalizeRefs([123]);
  assert.equal(r.code, "REF_NOT_STRING");
  assert.match(r.error, /references\[0\]/);
});

test("REF_EMPTY when an element is empty after stripping data: prefix", () => {
  const empty = validateAndNormalizeRefs([""]);
  assert.equal(empty.code, "REF_EMPTY");

  const prefixOnly = validateAndNormalizeRefs(["data:image/png;base64,"]);
  assert.equal(prefixOnly.code, "REF_EMPTY");
});

test("REF_TOO_LARGE when an element exceeds maxB64Bytes", () => {
  const big = "A".repeat(100);
  const r = validateAndNormalizeRefs([big], { maxB64Bytes: 50 });
  assert.equal(r.code, "REF_TOO_LARGE");
  assert.match(r.error, /exceeds 50 bytes/);
});

test("REF_NOT_BASE64 when an element has invalid characters", () => {
  const r = validateAndNormalizeRefs(["not valid !!!"]);
  assert.equal(r.code, "REF_NOT_BASE64");
});

test("happy path: empty array passes through with refs=[]", () => {
  const r = validateAndNormalizeRefs([]);
  assert.deepEqual(r.refs, []);
  assert.equal(r.error, undefined);
});

test("happy path: data: prefix is stripped and normalized b64 returned", () => {
  const r = validateAndNormalizeRefs([`data:image/png;base64,${VALID_B64}`]);
  assert.deepEqual(r.refs, [VALID_B64]);
});

test("happy path: bare base64 entries pass through unchanged", () => {
  const r = validateAndNormalizeRefs([VALID_B64, VALID_B64]);
  assert.deepEqual(r.refs, [VALID_B64, VALID_B64]);
});

test("MAX_REF_B64_BYTES constant matches our 7 MB encoded cap (~5.2 MB decoded)", () => {
  assert.equal(MAX_REF_B64_BYTES, 7 * 1024 * 1024);
});
