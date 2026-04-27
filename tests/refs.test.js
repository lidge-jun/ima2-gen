// REF_* validator codes — every failure path returns a stable code so the UI
// can route each one to a specific toast (Phase 1.2, upstream 9f9fe53).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateAndNormalizeRefs,
  detectImageMimeFromB64,
  MAX_REF_COUNT,
  MAX_REF_B64_BYTES,
} from "../lib/refs.js";

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

test("detectImageMimeFromB64 sniffs common image signatures", () => {
  // PNG: 89 50 4E 47
  assert.equal(
    detectImageMimeFromB64(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]).toString("base64")),
    "image/png",
  );
  // JPEG: FF D8 FF
  assert.equal(
    detectImageMimeFromB64(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString("base64")),
    "image/jpeg",
  );
  // WEBP: RIFF....WEBP
  assert.equal(
    detectImageMimeFromB64(Buffer.from("RIFF\x00\x00\x00\x00WEBP", "binary").toString("base64")),
    "image/webp",
  );
});

test("detectImageMimeFromB64 returns null on unknown payloads", () => {
  // 'hello' is 4-byte ASCII — no image header
  assert.equal(detectImageMimeFromB64(VALID_B64), null);
  assert.equal(detectImageMimeFromB64(""), null);
  assert.equal(detectImageMimeFromB64(null), null);
  assert.equal(detectImageMimeFromB64(undefined), null);
});

test("validateAndNormalizeRefs returns refDetails with declared/detected MIME", () => {
  const jpegB64 = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64");
  const r = validateAndNormalizeRefs([`data:image/jpeg;base64,${jpegB64}`]);
  assert.equal(r.error, undefined);
  assert.deepEqual(r.refs, [jpegB64]);
  assert.equal(r.refDetails[0].declaredMime, "image/jpeg");
  assert.equal(r.refDetails[0].detectedMime, "image/jpeg");
  assert.equal(r.refDetails[0].source, "dataUrl");
  assert.deepEqual(r.refDetails[0].warnings, []);
});

test("validateAndNormalizeRefs flags mime_mismatch when label and body disagree", () => {
  // Body is JPEG but data URL declares image/png — common UI bug we want to detect.
  const jpegB64 = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64");
  const r = validateAndNormalizeRefs([`data:image/png;base64,${jpegB64}`]);
  assert.equal(r.refDetails[0].declaredMime, "image/png");
  assert.equal(r.refDetails[0].detectedMime, "image/jpeg");
  assert.deepEqual(r.refDetails[0].warnings, ["mime_mismatch"]);
});

test("validateAndNormalizeRefs marks bare base64 source as rawBase64", () => {
  const pngB64 = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64");
  const r = validateAndNormalizeRefs([pngB64]);
  assert.equal(r.refDetails[0].declaredMime, null);
  assert.equal(r.refDetails[0].detectedMime, "image/png");
  assert.equal(r.refDetails[0].source, "rawBase64");
  assert.deepEqual(r.refDetails[0].warnings, []);
});
