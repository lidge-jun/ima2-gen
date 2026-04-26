// 0.09.8 — upstream error classifier.
// Pattern-match upstream OpenAI / OAuth / network errors into stable ImaErrorCode
// values so the UI can surface localized, actionable messages with CTAs.

/** @typedef {"REF_TOO_LARGE"|"REF_NOT_BASE64"|"REF_EMPTY"|"REF_TOO_MANY"|"MODERATION_REFUSED"|"UPSTREAM_5XX"|"AUTH_CHATGPT_EXPIRED"|"AUTH_API_KEY_INVALID"|"NETWORK_FAILED"|"OAUTH_UNAVAILABLE"|"INVALID_MODERATION"|"APIKEY_DISABLED"|"SAFETY_REFUSAL"|"DB_ERROR"|"UNKNOWN"} ImaErrorCode */

/**
 * Classify an upstream error message into an ImaErrorCode.
 * Order matters: auth session expiry must beat generic "token" matches,
 * and moderation must beat generic 5xx.
 * @param {string | undefined | null} msg
 * @returns {ImaErrorCode}
 */
export function classifyUpstreamError(msg) {
  const s = String(msg || "").toLowerCase();
  if (!s) return "UNKNOWN";

  if (s.includes("moderation_blocked") || s.includes("moderation refused")) {
    return "MODERATION_REFUSED";
  }

  // ChatGPT sign-in session expiry must precede the generic api-key checks
  // so it is not misclassified when messages contain both "token" and "api".
  if (
    s.includes("token is expired") ||
    s.includes("sign in again") ||
    (s.includes("access token") && s.includes("expired")) ||
    (s.includes("token") && s.includes("expired") && !s.includes("api key"))
  ) {
    return "AUTH_CHATGPT_EXPIRED";
  }

  if (
    s.includes("incorrect api key") ||
    s.includes("invalid authentication") ||
    s.includes("exceeded your current quota") ||
    s.includes("incorrect organization")
  ) {
    return "AUTH_API_KEY_INVALID";
  }

  if (
    s.includes("failed to fetch") ||
    s.includes("econnrefused") ||
    s.includes("econnreset") ||
    s.includes("enotfound") ||
    s.includes("etimedout") ||
    s.includes("network error")
  ) {
    return "NETWORK_FAILED";
  }

  if (s.includes("oauth") && (s.includes("not running") || s.includes("unavailable") || s.includes("not ready"))) {
    return "OAUTH_UNAVAILABLE";
  }

  if (s.includes("an error occurred while processing") || /\b5\d\d\b/.test(s)) {
    return "UPSTREAM_5XX";
  }

  return "UNKNOWN";
}
