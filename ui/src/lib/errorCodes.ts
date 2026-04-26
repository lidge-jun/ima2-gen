// 0.09.8 — ImaErrorCode registry + classifier.
// Mirrors lib/errorClassify.js on the server. Frontend uses this to map
// server error codes (or raw strings) to i18n keys + surface (toast vs card).

export type ImaErrorCode =
  | "REF_TOO_LARGE"
  | "REF_NOT_BASE64"
  | "REF_EMPTY"
  | "REF_TOO_MANY"
  | "MODERATION_REFUSED"
  | "SAFETY_REFUSAL"
  | "UPSTREAM_5XX"
  | "AUTH_CHATGPT_EXPIRED"
  | "AUTH_API_KEY_INVALID"
  | "NETWORK_FAILED"
  | "OAUTH_UNAVAILABLE"
  | "INVALID_REQUEST"
  | "INVALID_MODERATION"
  | "APIKEY_DISABLED"
  | "DB_ERROR"
  | "UNKNOWN";

export type ErrorSurface = "toast" | "card";

export type ErrorSpec = {
  surface: ErrorSurface;
  /** i18n key for a short toast line (surface=toast). */
  toastKey?: string;
  /**
   * i18n key root for ErrorCard. Full keys are <cardKey>.title / .body / .cta.
   * CTA key is optional (card shows close-only when missing).
   */
  cardKey?: string;
  /** Optional action type the ErrorCard renders as a button. */
  cta?: "reauth" | "reload" | "retry" | "dismiss";
};

export const errorCodes: Record<ImaErrorCode, ErrorSpec> = {
  REF_TOO_LARGE: { surface: "toast", toastKey: "toast.refTooLarge" },
  REF_NOT_BASE64: { surface: "toast", toastKey: "toast.refNotBase64" },
  REF_EMPTY: { surface: "toast", toastKey: "toast.refEmpty" },
  REF_TOO_MANY: { surface: "toast", toastKey: "toast.refLimitExceeded" },
  MODERATION_REFUSED: { surface: "card", cardKey: "errorCard.moderationRefused", cta: "dismiss" },
  SAFETY_REFUSAL: { surface: "card", cardKey: "errorCard.moderationRefused", cta: "dismiss" },
  UPSTREAM_5XX: { surface: "card", cardKey: "errorCard.upstream5xx", cta: "retry" },
  AUTH_CHATGPT_EXPIRED: { surface: "card", cardKey: "errorCard.authChatgptExpired", cta: "reauth" },
  AUTH_API_KEY_INVALID: { surface: "card", cardKey: "errorCard.authApiKeyInvalid", cta: "dismiss" },
  NETWORK_FAILED: { surface: "card", cardKey: "errorCard.networkFailed", cta: "reload" },
  OAUTH_UNAVAILABLE: { surface: "card", cardKey: "errorCard.oauthUnavailable", cta: "reload" },
  INVALID_REQUEST: { surface: "card", cardKey: "errorCard.invalidRequest", cta: "dismiss" },
  INVALID_MODERATION: { surface: "toast", toastKey: "toast.generateFailed" },
  APIKEY_DISABLED: { surface: "card", cardKey: "errorCard.apikeyDisabled", cta: "dismiss" },
  DB_ERROR: { surface: "toast", toastKey: "toast.generateFailed" },
  UNKNOWN: { surface: "toast", toastKey: "toast.generateFailed" },
};

/**
 * Pattern-match a raw error message into an ImaErrorCode. Mirrors the server
 * classifier so the UI can fall back gracefully when the server omitted a code.
 */
export function classifyError(message: string): ImaErrorCode {
  const s = (message || "").toLowerCase();
  if (!s) return "UNKNOWN";
  if (s.includes("moderation_blocked") || s.includes("moderation refused")) {
    return "MODERATION_REFUSED";
  }
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
  if (
    s.includes("invalid_request_error") ||
    s.includes("invalid_value") ||
    s.includes("invalid size") ||
    s.includes("invalid request") ||
    s.includes("requested resolution") ||
    s.includes("minimum pixel budget") ||
    s.includes("unsupported value")
  ) {
    return "INVALID_REQUEST";
  }
  if (s.includes("an error occurred while processing") || /\b5\d\d\b/.test(s)) {
    return "UPSTREAM_5XX";
  }
  return "UNKNOWN";
}

/** Resolve the spec for an arbitrary error-like value. */
export function resolveErrorSpec(err: unknown): { code: ImaErrorCode; spec: ErrorSpec; message: string } {
  const e = err as (Error & { code?: string; message?: string }) | undefined;
  const rawMessage = typeof e?.message === "string" ? e.message : String(err ?? "");
  const rawCode = typeof e?.code === "string" ? e.code : "";
  const code = (rawCode && rawCode in errorCodes ? (rawCode as ImaErrorCode) : classifyError(rawMessage));
  const spec = errorCodes[code] ?? errorCodes.UNKNOWN;
  return { code, spec, message: rawMessage };
}
