import { classifyUpstreamError } from "./errorClassify.js";

const PASSTHROUGH_CODES = new Set([
  "OAUTH_UNAVAILABLE",
  "NETWORK_FAILED",
  "AUTH_CHATGPT_EXPIRED",
  "AUTH_API_KEY_INVALID",
  "UPSTREAM_5XX",
]);

const SAFETY_CODES = new Set(["SAFETY_REFUSAL", "MODERATION_REFUSED", "moderation_blocked"]);

export function errorCodeFrom(err) {
  if (!err) return "UNKNOWN";
  if (typeof err.code === "string" && err.code) return err.code;
  const direct = classifyUpstreamError(err.message);
  if (direct !== "UNKNOWN") return direct;
  if (err.cause) return errorCodeFrom(err.cause);
  return "UNKNOWN";
}

export function statusForErrorCode(code, fallback = 500) {
  if (code === "OAUTH_UNAVAILABLE" || code === "NETWORK_FAILED") return 503;
  if (code === "AUTH_CHATGPT_EXPIRED" || code === "AUTH_API_KEY_INVALID") return 401;
  if (code === "UPSTREAM_5XX") return 502;
  if (code === "SAFETY_REFUSAL" || code === "MODERATION_REFUSED" || code === "moderation_blocked") return 422;
  return fallback;
}

export function normalizeGenerationFailure(lastErr, options = {}) {
  const code = errorCodeFrom(lastErr);
  if (PASSTHROUGH_CODES.has(code)) {
    const err = new Error(lastErr?.message || options.proxyMessage || "OAuth proxy/network failure");
    err.code = code;
    err.status = lastErr?.status || statusForErrorCode(code);
    err.cause = lastErr;
    return err;
  }
  if (SAFETY_CODES.has(code)) {
    const err = new Error(options.safetyMessage || lastErr?.message || "Content generation refused after retries");
    err.code = "SAFETY_REFUSAL";
    err.status = 422;
    err.cause = lastErr;
    return err;
  }
  const err = new Error(options.safetyMessage || "Content generation refused after retries");
  err.code = "SAFETY_REFUSAL";
  err.status = 422;
  err.cause = lastErr;
  return err;
}
