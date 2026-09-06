import test from "node:test";
import assert from "node:assert/strict";
import {
  errorCodeFrom,
  isNonRetryableGenerationError,
  normalizeGenerationFailure,
  statusForErrorCode,
} from "../lib/generationErrors.ts";

test("missing direct Grok image key is a non-retryable 401 passthrough", () => {
  const err = Object.assign(new Error("Grok API key is required for grok-api image generation"), {
    code: "GROK_API_KEY_MISSING", status: 401,
  });
  assert.equal(statusForErrorCode(err.code), 401);
  assert.equal(errorCodeFrom(err), "GROK_API_KEY_MISSING");
  assert.equal(isNonRetryableGenerationError(err), true);
  const normalized = normalizeGenerationFailure(err);
  assert.equal(normalized.code, "GROK_API_KEY_MISSING");
  assert.equal(normalized.status, 401);
  assert.equal(normalized.message, err.message);
  assert.equal(normalizeGenerationFailure({ code: err.code, message: err.message }).status, 401);
});

test("upstream 4xx validation errors normalize to INVALID_REQUEST", () => {
  const err: Error & {
    status?: number; code?: string;
    upstreamCode?: string; upstreamType?: string; upstreamParam?: string;
    eventCount?: number; size?: string; quality?: string; model?: string;
    referenceMismatchCount?: number; referenceDiagnostics?: unknown;
    retryKind?: string; referencesDroppedOnRetry?: boolean;
  } = new Error("Invalid size '512x512'. Requested resolution is below the current minimum pixel budget.");
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
  const err: Error & {
    status?: number; code?: string;
    upstreamCode?: string; upstreamType?: string; upstreamParam?: string;
    eventCount?: number; size?: string; quality?: string; model?: string;
    referenceMismatchCount?: number; referenceDiagnostics?: unknown;
    retryKind?: string; referencesDroppedOnRetry?: boolean;
  } = new Error("moderation refused");
  err.status = 422;
  err.code = "MODERATION_REFUSED";

  assert.equal(isNonRetryableGenerationError(err), false);
  const normalized = normalizeGenerationFailure(err);
  assert.equal(normalized.code, "SAFETY_REFUSAL");
  assert.equal(normalized.status, 422);
});

test("OAUTH_UPSTREAM_ERROR is passthrough, not SAFETY_REFUSAL", () => {
  const err: Error & {
    status?: number; code?: string;
    upstreamCode?: string; upstreamType?: string; upstreamParam?: string;
    eventCount?: number; size?: string; quality?: string; model?: string;
    referenceMismatchCount?: number; referenceDiagnostics?: unknown;
    retryKind?: string; referencesDroppedOnRetry?: boolean;
  } = new Error("OAuth proxy returned 502");
  err.status = 502;
  err.code = "OAUTH_UPSTREAM_ERROR";

  const normalized = normalizeGenerationFailure(err);
  assert.equal(normalized.code, "OAUTH_UPSTREAM_ERROR");
  assert.equal(normalized.status, 502);
});

test("OAuth image timeout is passthrough and non-retryable", () => {
  const err: Error & {
    status?: number; code?: string;
    upstreamCode?: string; upstreamType?: string; upstreamParam?: string;
    eventCount?: number; size?: string; quality?: string; model?: string;
    referenceMismatchCount?: number; referenceDiagnostics?: unknown;
    retryKind?: string; referencesDroppedOnRetry?: boolean;
  } = new Error("OAuth image generation timed out");
  err.status = 504;
  err.code = "OAUTH_IMAGE_TIMEOUT";

  assert.equal(errorCodeFrom(err), "OAUTH_IMAGE_TIMEOUT");
  assert.equal(isNonRetryableGenerationError(err), true);

  const normalized = normalizeGenerationFailure(err);
  assert.equal(normalized.code, "OAUTH_IMAGE_TIMEOUT");
  assert.equal(normalized.status, 504);
  assert.equal(normalized.message, err.message);
});

test("empty response with metadata maps to EMPTY_RESPONSE", () => {
  const err: Error & {
    status?: number; code?: string;
    upstreamCode?: string; upstreamType?: string; upstreamParam?: string;
    eventCount?: number; size?: string; quality?: string; model?: string;
    referenceMismatchCount?: number; referenceDiagnostics?: unknown;
    retryKind?: string; referencesDroppedOnRetry?: boolean;
  } = new Error("No image data received");
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

test("empty response preserves sanitized Responses diagnostics", () => {
  const err: any = new Error("No image data received");
  err.eventCount = 4;
  err.eventTypes = { "response.output_item.done": 2, "response.completed": 1 };
  err.webSearchCalls = 1;
  err.toolTypes = ["web_search", "image_generation"];
  err.toolChoiceKind = "required";
  err.responseDiagnostics = {
    eventTypes: err.eventTypes,
    streamStats: {
      chunkCount: 2,
      bytesRead: 250,
      maxChunkBytes: 200,
      parseSkipCount: 0,
      finalBufferChars: 0,
      sawDoneSentinel: false,
      sawResponseCompleted: true,
    },
    outputItemSummary: [{
      eventType: "response.output_item.done",
      itemType: "web_search_call",
      status: "completed",
      hasResult: false,
      resultChars: 0,
      revisedPromptChars: 0,
      hasError: false,
      errorCode: null,
      errorType: null,
      errorParam: null,
    }],
    imageCallSeen: false,
    imageCallCompleted: false,
    imageCallFailed: false,
    imageResultCount: 0,
    webSearchCallSeen: true,
    messageOutputSeen: true,
    outputTextChars: 42,
  };

  const normalized = normalizeGenerationFailure(err);
  assert.equal(normalized.code, "WEB_SEARCH_ONLY_RESPONSE");
  assert.equal(normalized.diagnosticReason, "web_search_only_response");
  assert.deepEqual(normalized.eventTypes, err.eventTypes);
  assert.equal(normalized.webSearchCalls, 1);
  assert.equal(normalized.responseDiagnostics.outputItemSummary[0].resultChars, 0);
  assert.deepEqual(normalized.toolTypes, ["web_search", "image_generation"]);
  assert.equal(normalized.toolChoiceKind, "required");
});

test("Responses diagnostic codes normalize without collapsing to INVALID_REQUEST", () => {
  for (const code of [
    "STREAM_PARSE_FAILED",
    "IMAGE_TOOL_NOT_CALLED",
    "IMAGE_TOOL_FAILED",
    "IMAGE_TOOL_COMPLETED_WITHOUT_RESULT",
    "RESPONSES_STREAM_ERROR",
  ]) {
    const err: any = new Error("classified no-image response");
    err.code = code;
    err.status = code === "RESPONSES_STREAM_ERROR" ? 502 : 422;
    err.eventCount = 1;
    err.responseDiagnostics = {
      eventTypes: {},
      streamStats: {
        chunkCount: 1,
        bytesRead: 10,
        maxChunkBytes: 10,
        parseSkipCount: 0,
        finalBufferChars: 0,
        sawDoneSentinel: false,
        sawResponseCompleted: true,
      },
      outputItemSummary: [],
      imageCallSeen: false,
      imageCallCompleted: false,
      imageCallFailed: false,
      imageResultCount: 0,
      webSearchCallSeen: false,
      messageOutputSeen: false,
      outputTextChars: 0,
    };

    const normalized = normalizeGenerationFailure(err);
    assert.equal(normalized.code, code);
    assert.equal(normalized.status, err.status);
    assert.notEqual(normalized.code, "INVALID_REQUEST");
    assert.ok(normalized.diagnosticReason);
  }
});

test("Responses stream diagnostic code beats upstream event code classification", () => {
  const err: any = new Error("Responses stream returned an error");
  err.code = "RESPONSES_STREAM_ERROR";
  err.status = 502;
  err.upstreamCode = "invalid_value";
  err.eventType = "error";
  err.eventCount = 1;

  const normalized = normalizeGenerationFailure(err);
  assert.equal(normalized.code, "RESPONSES_STREAM_ERROR");
  assert.equal(normalized.status, 502);
  assert.equal(normalized.upstreamCode, "invalid_value");
  assert.equal(normalized.eventType, "error");
  assert.notEqual(normalized.code, "INVALID_REQUEST");
});

test("explicit generic EMPTY_RESPONSE with status 422 preserves empty metadata", () => {
  const err: any = new Error("No image data received");
  err.code = "EMPTY_RESPONSE";
  err.status = 422;
  err.eventCount = 1;
  err.eventTypes = { "response.completed": 1 };
  err.responseDiagnostics = {
    eventTypes: err.eventTypes,
    streamStats: {
      chunkCount: 1,
      bytesRead: 60,
      maxChunkBytes: 60,
      parseSkipCount: 0,
      finalBufferChars: 0,
      sawDoneSentinel: false,
      sawResponseCompleted: true,
    },
    outputItemSummary: [],
    imageCallSeen: false,
    imageCallCompleted: false,
    imageCallFailed: false,
    imageResultCount: 0,
    webSearchCallSeen: false,
    messageOutputSeen: false,
    outputTextChars: 0,
  };

  const normalized = normalizeGenerationFailure(err);
  assert.equal(normalized.code, "EMPTY_RESPONSE");
  assert.equal(normalized.status, 422);
  assert.equal(normalized.eventCount, 1);
  assert.deepEqual(normalized.eventTypes, err.eventTypes);
  assert.notEqual(normalized.code, "INVALID_REQUEST");
});

test("empty response with reference mismatch preserves diagnostic metadata", () => {
  const err: Error & {
    status?: number; code?: string;
    upstreamCode?: string; upstreamType?: string; upstreamParam?: string;
    eventCount?: number; size?: string; quality?: string; model?: string;
    referenceMismatchCount?: number; referenceDiagnostics?: unknown;
    retryKind?: string; referencesDroppedOnRetry?: boolean;
  } = new Error("No image data received");
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
  const err: Error & {
    status?: number; code?: string;
    upstreamCode?: string; upstreamType?: string; upstreamParam?: string;
    eventCount?: number; size?: string; quality?: string; model?: string;
    referenceMismatchCount?: number; referenceDiagnostics?: unknown;
    retryKind?: string; referencesDroppedOnRetry?: boolean;
  } = new Error("something went wrong");
  err.status = 500;
  err.code = "SOME_RANDOM_CODE";

  const normalized = normalizeGenerationFailure(err);
  assert.equal(normalized.code, "UNKNOWN");
  assert.equal(normalized.status, 500);
});
