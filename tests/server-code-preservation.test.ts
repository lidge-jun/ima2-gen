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
  // Decoration reads the TOP-LEVEL code only. An earlier version walked the
  // cause chain, which made a SAFETY_REFUSAL wrapping a transport error come
  // out as errorClass NETWORK_FAILURE — the outer code is what describes the
  // failure, so an inner provider code must not hijack the classification.
  const providerCause = upstreamError("GROK_UPSTREAM_ERROR", 502);
  const decorated: Array<{ name: string; input: UpstreamErr; code: string; rawCode: string }> = [
    {
      name: "passthrough",
      input: upstreamError("MINIMAX_INSUFFICIENT_BALANCE", 402),
      code: "INVALID_REQUEST",
      rawCode: "MINIMAX_INSUFFICIENT_BALANCE",
    },
    {
      name: "empty-response",
      input: upstreamError("GROK_UPSTREAM_ERROR", 502, { eventCount: 1 }),
      code: "EMPTY_RESPONSE",
      rawCode: "GROK_UPSTREAM_ERROR",
    },
    { name: "fallback", input: providerCause, code: "UNKNOWN", rawCode: "GROK_UPSTREAM_ERROR" },
  ];

  for (const branch of decorated) {
    const normalized = normalizeGenerationFailure(branch.input);
    assert.equal(normalized.code, branch.code, branch.name);
    assert.equal(normalized.rawCode, branch.rawCode, branch.name);
    assert.ok(normalized.errorClass, branch.name);
  }

  // App-level outer codes stay undecorated even when a provider error is the
  // cause: safety and diagnostic branches must not borrow its class.
  const appLevel: Array<{ name: string; input: UpstreamErr; code: string }> = [
    { name: "safety", input: upstreamError("SAFETY_REFUSAL", 422, { cause: providerCause }), code: "SAFETY_REFUSAL" },
    { name: "diagnostic", input: upstreamError("RESPONSES_STREAM_ERROR", 502, { cause: providerCause }), code: "RESPONSES_STREAM_ERROR" },
  ];
  for (const branch of appLevel) {
    const normalized = normalizeGenerationFailure(branch.input);
    assert.equal(normalized.code, branch.code, branch.name);
    assertUndecorated(normalized);
  }

  for (const appCode of ["AUTH_CHATGPT_EXPIRED", "SAFETY_REFUSAL", "RESPONSES_STREAM_ERROR", "EMPTY_RESPONSE"]) {
    assertUndecorated(normalizeGenerationFailure(upstreamError(appCode, 422, appCode === "EMPTY_RESPONSE" ? { eventCount: 1 } : {})));
  }
});

test("status-dependent codes classify by the status the adapter attached", async () => {
  // GROK_VIDEO_REQUEST_FAILED covers 400/403/412 rejections and upstream 5xx
  // alike (lib/grokVideoShared.ts, lib/grokVideoAdapter.ts), so a single static
  // class would be wrong in half the cases.
  const { providerErrorClass } = await import("../lib/errors/providerMap.ts");
  assert.equal(providerErrorClass("GROK_VIDEO_REQUEST_FAILED", 400), "CAPABILITY_UNSUPPORTED");
  assert.equal(providerErrorClass("GROK_VIDEO_REQUEST_FAILED", 412), "CAPABILITY_UNSUPPORTED");
  assert.equal(providerErrorClass("GROK_VIDEO_REQUEST_FAILED", 502), "NETWORK_FAILURE");
  assert.equal(providerErrorClass("GROK_VIDEO_REQUEST_FAILED", 429), "RATE_LIMITED");
  assert.equal(providerErrorClass("ATLASCLOUD_UPLOAD_FAILED", 400), "CAPABILITY_UNSUPPORTED");
  assert.equal(providerErrorClass("ATLASCLOUD_UPLOAD_FAILED", 503), "NETWORK_FAILURE");
  // Codes with a single meaning ignore status.
  assert.equal(providerErrorClass("MINIMAX_INSUFFICIENT_BALANCE", 502), "BILLING_REQUIRED");
});

test("normalize passes the status through to status-dependent classification", () => {
  // Calling providerErrorClass directly cannot prove the pipeline forwards the
  // status; dropping the argument in decorateProviderFailure left the direct
  // assertions green. Drive the real normalize path for both ends of the range.
  const clientSide = normalizeGenerationFailure(upstreamError("GROK_VIDEO_REQUEST_FAILED", 412));
  assert.equal(clientSide.rawCode, "GROK_VIDEO_REQUEST_FAILED");
  assert.equal(clientSide.errorClass, "CAPABILITY_UNSUPPORTED");

  const serverSide = normalizeGenerationFailure(upstreamError("GROK_VIDEO_REQUEST_FAILED", 502));
  assert.equal(serverSide.rawCode, "GROK_VIDEO_REQUEST_FAILED");
  assert.equal(serverSide.errorClass, "NETWORK_FAILURE");
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
