import assert from "node:assert/strict";
import test from "node:test";
import {
  errorCodeFrom,
  isNonRetryableGenerationError,
  normalizeGenerationFailure,
  type UpstreamErr,
} from "../lib/generationErrors.ts";

function upstreamError(code: string, status: number, extras: UpstreamErr = {}): UpstreamErr {
  return { message: `${code} test failure`, code, status, ...extras };
}

function assertDecoration(
  normalized: Error & { code?: string; rawCode?: string; errorClass?: string },
  expected: { code: string; rawCode: string; errorClass: string },
): void {
  assert.equal(normalized.code, expected.code);
  assert.equal(normalized.rawCode, expected.rawCode);
  assert.equal(normalized.errorClass, expected.errorClass);
}

function assertUndecorated(normalized: Error & { rawCode?: string; errorClass?: string }): void {
  assert.equal(normalized.rawCode, undefined);
  assert.equal(normalized.errorClass, undefined);
}

test("402 MiniMax balance failure preserves INVALID_REQUEST and adds decoration", () => {
  const original = upstreamError("MINIMAX_INSUFFICIENT_BALANCE", 402);
  assert.equal(errorCodeFrom(original), "INVALID_REQUEST");
  assertDecoration(normalizeGenerationFailure(original), {
    code: "INVALID_REQUEST",
    rawCode: "MINIMAX_INSUFFICIENT_BALANCE",
    errorClass: "BILLING_REQUIRED",
  });
});

test("502 Grok upstream failure preserves UNKNOWN and adds decoration", () => {
  const original = upstreamError("GROK_UPSTREAM_ERROR", 502);
  assert.equal(errorCodeFrom(original), "GROK_UPSTREAM_ERROR");
  assertDecoration(normalizeGenerationFailure(original), {
    code: "UNKNOWN",
    rawCode: "GROK_UPSTREAM_ERROR",
    errorClass: "NETWORK_FAILURE",
  });
});

test("all five normalize return branches apply provider-only decoration", () => {
  const providerCause = upstreamError("GROK_UPSTREAM_ERROR", 502);
  const cases: Array<{ name: string; input: UpstreamErr; code: string }> = [
    { name: "passthrough", input: upstreamError("MINIMAX_INSUFFICIENT_BALANCE", 402), code: "INVALID_REQUEST" },
    { name: "safety", input: upstreamError("SAFETY_REFUSAL", 422, { cause: providerCause }), code: "SAFETY_REFUSAL" },
    { name: "diagnostic", input: upstreamError("RESPONSES_STREAM_ERROR", 502, { cause: providerCause }), code: "RESPONSES_STREAM_ERROR" },
    { name: "empty-response", input: upstreamError("GROK_UPSTREAM_ERROR", 502, { eventCount: 1 }), code: "EMPTY_RESPONSE" },
    { name: "fallback", input: providerCause, code: "UNKNOWN" },
  ];

  for (const branch of cases) {
    const normalized = normalizeGenerationFailure(branch.input);
    assert.equal(normalized.code, branch.code, branch.name);
    assert.equal(normalized.rawCode, branch.name === "passthrough" ? "MINIMAX_INSUFFICIENT_BALANCE" : "GROK_UPSTREAM_ERROR", branch.name);
    assert.ok(normalized.errorClass, branch.name);
  }

  for (const appCode of ["AUTH_CHATGPT_EXPIRED", "SAFETY_REFUSAL", "RESPONSES_STREAM_ERROR", "EMPTY_RESPONSE"]) {
    assertUndecorated(normalizeGenerationFailure(upstreamError(appCode, 422, appCode === "EMPTY_RESPONSE" ? { eventCount: 1 } : {})));
  }
});

test("provider retry decisions remain unchanged", () => {
  for (const status of [400, 402, 429]) {
    assert.equal(isNonRetryableGenerationError(upstreamError("MINIMAX_BAD_REQUEST", status)), true, String(status));
  }
  assert.equal(isNonRetryableGenerationError(upstreamError("GROK_UPSTREAM_ERROR", 502)), false);
});

test("provider bad-request codes keep INVALID_REQUEST semantics", () => {
  for (const code of [
    "MINIMAX_BAD_REQUEST",
    "MINIMAX_REF_TOO_MANY",
    "GEMINI_API_BAD_REQUEST",
    "GROK_BAD_REQUEST",
  ]) {
    const original = upstreamError(code, 400);
    assert.equal(errorCodeFrom(original), "INVALID_REQUEST", code);
    const normalized = normalizeGenerationFailure(original);
    assert.equal(normalized.code, "INVALID_REQUEST", code);
    assert.equal(normalized.rawCode, code, code);
  }
});
