import { classifyUpstreamError, classifyUpstreamErrorCode } from "./errorClassify.js";

const PASSTHROUGH_CODES = new Set([
  "OAUTH_UNAVAILABLE",
  "NETWORK_FAILED",
  "AUTH_CHATGPT_EXPIRED",
  "AUTH_API_KEY_INVALID",
  "UPSTREAM_5XX",
  "OAUTH_IMAGE_TIMEOUT",
  "API_KEY_REQUIRED",
  "INVALID_REQUEST",
  "OAUTH_UPSTREAM_ERROR",
]);

const SAFETY_CODES = new Set(["SAFETY_REFUSAL", "MODERATION_REFUSED", "moderation_blocked"]);

function has4kSize(size) {
  if (typeof size !== "string") return false;
  const [w, h] = size.split("x").map((part) => Number(part));
  return Number.isFinite(w) && Number.isFinite(h) && Math.max(w, h) >= 3840;
}

function diagnosticReasonFrom(err) {
  if (typeof err?.diagnosticReason === "string" && err.diagnosticReason) return err.diagnosticReason;
  if (Number(err?.referenceMismatchCount) > 0) return "reference_mime_mismatch_candidate";
  if (has4kSize(err?.size)) return "experimental_4k_empty_response";
  return null;
}

export function errorCodeFrom(err) {
  if (!err) return "UNKNOWN";
  const upstreamCode = classifyUpstreamErrorCode(err.upstreamCode);
  if (upstreamCode !== "UNKNOWN") return upstreamCode;
  const upstreamType = classifyUpstreamErrorCode(err.upstreamType);
  if (upstreamType !== "UNKNOWN") return upstreamType;
  // Known app-level codes pass through directly (before message heuristic)
  if (PASSTHROUGH_CODES.has(err.code) || SAFETY_CODES.has(err.code)) return err.code;
  const rawCode = classifyUpstreamErrorCode(err.code);
  if (rawCode !== "UNKNOWN") return rawCode;
  const direct = classifyUpstreamError(err.message);
  if (direct !== "UNKNOWN") return direct;
  const status = Number(err.status);
  if (Number.isFinite(status) && status >= 400 && status < 500 && !SAFETY_CODES.has(err.code)) {
    return "INVALID_REQUEST";
  }
  if (typeof err.code === "string" && err.code) return err.code;
  if (err.cause) return errorCodeFrom(err.cause);
  return "UNKNOWN";
}

export function isNonRetryableGenerationError(err) {
  const code = errorCodeFrom(err);
  if (SAFETY_CODES.has(code)) return false;
  const status = Number(err?.status);
  return code === "INVALID_REQUEST" || code === "OAUTH_IMAGE_TIMEOUT" || (Number.isFinite(status) && status >= 400 && status < 500);
}

export function statusForErrorCode(code, fallback = 500) {
  if (code === "OAUTH_UNAVAILABLE" || code === "NETWORK_FAILED") return 503;
  if (code === "AUTH_CHATGPT_EXPIRED" || code === "AUTH_API_KEY_INVALID") return 401;
  if (code === "API_KEY_REQUIRED") return 401;
  if (code === "UPSTREAM_5XX") return 502;
  if (code === "OAUTH_IMAGE_TIMEOUT") return 504;
  if (code === "INVALID_REQUEST") return 400;
  if (code === "SAFETY_REFUSAL" || code === "MODERATION_REFUSED" || code === "moderation_blocked") return 422;
  return fallback;
}

export function normalizeGenerationFailure(lastErr, options: any = {}) {
  const code = errorCodeFrom(lastErr);
  if (PASSTHROUGH_CODES.has(code)) {
    const err: any = new Error(lastErr?.message || options.proxyMessage || "OAuth proxy/network failure");
    err.code = code;
    err.status = lastErr?.status || statusForErrorCode(code);
    err.cause = lastErr;
    if (lastErr?.upstreamCode) err.upstreamCode = lastErr.upstreamCode;
    if (lastErr?.upstreamType) err.upstreamType = lastErr.upstreamType;
    if (lastErr?.upstreamParam) err.upstreamParam = lastErr.upstreamParam;
    if (lastErr?.eventType) err.eventType = lastErr.eventType;
    if (typeof lastErr?.eventCount === "number") err.eventCount = lastErr.eventCount;
    return err;
  }
  if (SAFETY_CODES.has(code)) {
    const err: any = new Error(options.safetyMessage || lastErr?.message || "Content generation refused after retries");
    err.code = "SAFETY_REFUSAL";
    err.status = 422;
    err.cause = lastErr;
    return err;
  }
  // Empty response with metadata → likely a technical limitation (unsupported size/quality/model)
  if (typeof lastErr?.eventCount === "number") {
    const meta = [];
    if (lastErr.size) meta.push(`size=${lastErr.size}`);
    if (lastErr.quality) meta.push(`quality=${lastErr.quality}`);
    if (lastErr.model) meta.push(`model=${lastErr.model}`);
    const msg = meta.length
      ? `No image data returned. This may be an unsupported ${meta.join(", ")} combination. Try a different size or model.`
      : "No image data returned from the image backend. Try a different size, quality, or prompt.";
    const err: any = new Error(msg);
    err.code = "EMPTY_RESPONSE";
    err.status = 422;
    err.cause = lastErr;
    if (lastErr.size) err.size = lastErr.size;
    if (lastErr.quality) err.quality = lastErr.quality;
    if (lastErr.model) err.model = lastErr.model;
    if (typeof lastErr.eventCount === "number") err.eventCount = lastErr.eventCount;
    if (lastErr.eventTypes) err.eventTypes = lastErr.eventTypes;
    if (typeof lastErr.refsCount === "number") err.refsCount = lastErr.refsCount;
    if (typeof lastErr.inputImageCount === "number") err.inputImageCount = lastErr.inputImageCount;
    if (Array.isArray(lastErr.referenceDiagnostics)) err.referenceDiagnostics = lastErr.referenceDiagnostics;
    if (typeof lastErr.referenceMismatchCount === "number") err.referenceMismatchCount = lastErr.referenceMismatchCount;
    if (lastErr.retryKind) err.retryKind = lastErr.retryKind;
    if (typeof lastErr.referencesDroppedOnRetry === "boolean") err.referencesDroppedOnRetry = lastErr.referencesDroppedOnRetry;
    if (typeof lastErr.developerPromptDroppedOnRetry === "boolean") err.developerPromptDroppedOnRetry = lastErr.developerPromptDroppedOnRetry;
    const diagnosticReason = diagnosticReasonFrom(lastErr);
    if (diagnosticReason) err.diagnosticReason = diagnosticReason;
    return err;
  }
  // Unrecognized errors → UNKNOWN (do not pretend they are safety refusals)
  const err: any = new Error(lastErr?.message || options.proxyMessage || "Image generation failed");
  err.code = "UNKNOWN";
  err.status = lastErr?.status || 500;
  err.cause = lastErr;
  return err;
}
