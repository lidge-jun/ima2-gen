import { logEvent } from "../logger.js";
import { classifyUpstreamError, classifyUpstreamErrorCode } from "../errorClassify.js";

export function makeOAuthError(
  message,
  {
    status,
    code = "OAUTH_UPSTREAM_ERROR",
    upstreamBodyChars,
    upstreamCode,
    upstreamType,
    upstreamParam,
    eventType,
    eventCount,
    cause,
  }: any = {},
) {
  const err: any = new Error(message);
  err.code = code;
  if (status) err.status = status;
  if (typeof upstreamBodyChars === "number") err.upstreamBodyChars = upstreamBodyChars;
  if (upstreamCode) err.upstreamCode = upstreamCode;
  if (upstreamType) err.upstreamType = upstreamType;
  if (upstreamParam) err.upstreamParam = upstreamParam;
  if (eventType) err.eventType = eventType;
  if (typeof eventCount === "number") err.eventCount = eventCount;
  if (cause) err.cause = cause;
  return err;
}

export function parseOpenAIErrorBody(text) {
  try {
    const parsed = JSON.parse(text);
    const error = parsed?.error;
    if (!error || typeof error !== "object") return null;
    const message = typeof error.message === "string" ? error.message : "";
    if (!message) return null;
    return {
      message,
      code: typeof error.code === "string" ? error.code : null,
      type: typeof error.type === "string" ? error.type : null,
      param: typeof error.param === "string" ? error.param : null,
    };
  } catch {
    return null;
  }
}

export function normalizedOAuthCode(upstreamError) {
  const byCode = classifyUpstreamErrorCode(upstreamError?.code);
  if (byCode !== "UNKNOWN") return byCode;
  const byType = classifyUpstreamErrorCode(upstreamError?.type);
  if (byType !== "UNKNOWN") return byType;
  const byMessage = classifyUpstreamError(upstreamError?.message);
  if (byMessage !== "UNKNOWN") return byMessage;
  return "OAUTH_UPSTREAM_ERROR";
}

export function throwOAuthHttpError(res, text, { requestId, scope, fallbackMessage }) {
  const upstream = parseOpenAIErrorBody(text);
  const isClientError = res.status >= 400 && res.status < 500;
  if (isClientError && upstream?.message) {
    logEvent(scope || "oauth", "upstream_client_error", {
      requestId,
      status: res.status,
      code: upstream.code,
      type: upstream.type,
      param: upstream.param,
      errorChars: text.length,
    });
    throw makeOAuthError(upstream.message, {
      status: res.status,
      code: normalizedOAuthCode(upstream),
      upstreamBodyChars: text.length,
      upstreamCode: upstream.code,
      upstreamType: upstream.type,
      upstreamParam: upstream.param,
    });
  }
  throw makeOAuthError(fallbackMessage, {
    status: res.status,
    upstreamBodyChars: text.length,
  });
}

export function isAbortError(err) {
  return err?.name === "AbortError" || err?.code === "ABORT_ERR";
}

export function throwOAuthTimeoutError(err, { timeoutMs, requestId, scope }) {
  throw makeOAuthError("OAuth image generation timed out", {
    code: "OAUTH_IMAGE_TIMEOUT",
    status: 504,
    cause: err,
    eventType: `${scope || "oauth"}.timeout`,
  });
}
