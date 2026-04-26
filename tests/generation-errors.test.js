import test from "node:test";
import assert from "node:assert/strict";
import {
  errorCodeFrom,
  isNonRetryableGenerationError,
  normalizeGenerationFailure,
} from "../lib/generationErrors.js";

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
