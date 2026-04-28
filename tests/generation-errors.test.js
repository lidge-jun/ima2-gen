import test from "node:test";
import assert from "node:assert/strict";
import {
  errorCodeFrom,
  isNonRetryableGenerationError,
  normalizeGenerationFailure,
} from "../lib/generationErrors.ts";

test("upstream 4xx validation errors normalize to INVALID_REQUEST", () => {
  const err = new Error("Invalid size '512x512'. Requested resolution is below the current minimum pixel budget.");
  err.status = 400;
  err.code = "OAUTH_UPSTREAM_ERROR";
  err.upstreamCode = "invalid_value";
  err.upstreamType = "invalid_request_error";
  err.upstreamParam = "tools[0].size";

  assert.equal(errorCodeFrom(err), "INVALID_REQUEST");
  assert.equal(isNonRetryableGenerationError(err), true);

  const normalized = normalizeGenerationFailure(err);
  assert.equal(normalized.code, "INVALID_REQUEST");
  assert.equal(normalized.status, 400);
  assert.equal(normalized.message, err.message);
  assert.equal(normalized.upstreamCode, "invalid_value");
});

test("explicit safety refusals remain safety refusals", () => {
  const err = new Error("moderation refused");
  err.status = 422;
  err.code = "MODERATION_REFUSED";

  assert.equal(isNonRetryableGenerationError(err), false);
  const normalized = normalizeGenerationFailure(err);
  assert.equal(normalized.code, "SAFETY_REFUSAL");
  assert.equal(normalized.status, 422);
});

test("OAUTH_UPSTREAM_ERROR is passthrough, not SAFETY_REFUSAL", () => {
  const err = new Error("OAuth proxy returned 502");
  err.status = 502;
  err.code = "OAUTH_UPSTREAM_ERROR";

  const normalized = normalizeGenerationFailure(err);
  assert.equal(normalized.code, "OAUTH_UPSTREAM_ERROR");
  assert.equal(normalized.status, 502);
});

test("empty response with metadata maps to EMPTY_RESPONSE", () => {
  const err = new Error("No image data received");
  err.eventCount = 3;
  err.size = "3840x2160";
  err.quality = "medium";
  err.model = "gpt-5.4-mini";

  const normalized = normalizeGenerationFailure(err);
  assert.equal(normalized.code, "EMPTY_RESPONSE");
  assert.equal(normalized.status, 422);
  assert.match(normalized.message, /3840x2160/);
  assert.match(normalized.message, /gpt-5.4-mini/);
  assert.equal(normalized.diagnosticReason, "experimental_4k_empty_response");
  assert.equal(normalized.eventCount, 3);
});

test("empty response with reference mismatch preserves diagnostic metadata", () => {
  const err = new Error("No image data received");
  err.eventCount = 2;
  err.size = "2048x1152";
  err.referenceMismatchCount = 1;
  err.referenceDiagnostics = [{
    index: 0,
    declaredMime: "image/png",
    detectedMime: "image/jpeg",
    b64Chars: 100,
    approxBytes: 75,
    source: "dataUrl",
    warnings: ["mime_mismatch"],
  }];
  err.retryKind = "prompt_only";
  err.referencesDroppedOnRetry = true;

  const normalized = normalizeGenerationFailure(err);
  assert.equal(normalized.code, "EMPTY_RESPONSE");
  assert.equal(normalized.diagnosticReason, "reference_mime_mismatch_candidate");
  assert.equal(normalized.referencesDroppedOnRetry, true);
  assert.equal(normalized.referenceDiagnostics[0].b64, undefined);
});

test("unrecognized errors map to UNKNOWN, not SAFETY_REFUSAL", () => {
  const err = new Error("something went wrong");
  err.status = 500;
  err.code = "SOME_RANDOM_CODE";

  const normalized = normalizeGenerationFailure(err);
  assert.equal(normalized.code, "UNKNOWN");
  assert.equal(normalized.status, 500);
});
