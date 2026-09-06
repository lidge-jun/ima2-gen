import { logEvent } from "./logger.js";
import { classifyUpstreamError, classifyUpstreamErrorCode } from "./errorClassify.js";
import { errInfo } from "./errInfo.js";
import { setJobPhase } from "./inflight.js";
import type { RouteRuntimeContext } from "./runtimeContext.js";
import {
  parseJson,
  parseStream,
  safeDiagnosticLabel,
  type FinalImageHandler,
  type ParsedResponsesResult,
} from "./responsesParse.js";
import { waitForOAuthReady } from "./oauthProxy.js";

interface MakeErrorOptions {
  status?: number | undefined;
  code?: string | undefined;
  cause?: unknown | undefined;
  [key: string]: unknown;
}

interface ResponsesError extends Error {
  status: number;
  code: string;
  cause?: unknown | undefined;
  [key: string]: unknown;
}

const RESPONSES_ERROR_MARKER = "ima2ResponsesError";

function makeError(message: string, { status = 500, code = "RESPONSES_IMAGE_ERROR", cause, ...rest }: MakeErrorOptions = {}): ResponsesError {
  const err = new Error(message) as ResponsesError;
  err.status = status;
  err.code = code;
  if (cause) err.cause = cause;
  Object.assign(err, rest);
  Object.defineProperty(err, RESPONSES_ERROR_MARKER, { value: true });
  return err;
}

interface UpstreamError {
  message: string;
  code: string | null;
  type: string | null;
  param: string | null;
}

function parseOpenAIErrorBody(text: string): UpstreamError | null {
  try {
    const parsed = JSON.parse(text);
    const error = parsed?.error || {};
    return {
      message: typeof error.message === "string" && error.message ? error.message : "OpenAI request failed",
      code: safeDiagnosticLabel(error.code),
      type: safeDiagnosticLabel(error.type),
      param: safeDiagnosticLabel(error.param),
    };
  } catch {
    return null;
  }
}

function normalizedCode(upstream: UpstreamError | null | undefined) {
  const byCode = classifyUpstreamErrorCode(upstream?.code);
  if (byCode !== "UNKNOWN") return byCode;
  const byType = classifyUpstreamErrorCode(upstream?.type);
  if (byType !== "UNKNOWN") return byType;
  const byMessage = classifyUpstreamError(upstream?.message);
  return byMessage !== "UNKNOWN" ? byMessage : "RESPONSES_IMAGE_ERROR";
}

function safeUpstreamClientMessage(upstream: UpstreamError | null | undefined, status: number) {
  const code = normalizedCode(upstream);
  if (code === "AUTH_API_KEY_INVALID") return "API key is invalid or unavailable.";
  if (code === "MODERATION_REFUSED") return "OpenAI refused the image request for safety reasons.";
  if (code === "INVALID_REQUEST") {
    return upstream?.param
      ? "OpenAI rejected the image request parameters."
      : "OpenAI rejected the image request.";
  }
  if (status === 401 || status === 403) return "OpenAI authentication failed.";
  if (status === 429) return "OpenAI rate limited the image request.";
  return "OpenAI rejected the image request.";
}

function safeBaseUrl(value: string) {
  try {
    const parsed = new URL(value);
    parsed.username = "";
    parsed.password = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return value.replace(/\/$/, "");
  }
}

function apiAuthorizationHeader(apiKey: string | undefined) {
  const key = typeof apiKey === "string" ? apiKey.trim() : "";
  if (!key) {
    throw makeError("API key is required for API provider image generation", {
      status: 401,
      code: "API_KEY_REQUIRED",
    });
  }
  if (/[\u0000-\u001f\u007f]/.test(key)) {
    throw makeError("API key contains invalid characters.", {
      status: 401,
      code: "AUTH_API_KEY_INVALID",
    });
  }
  return `Bearer ${key}`;
}

function isKnownResponsesError(value: unknown) {
  return Boolean(
    value &&
    typeof value === "object" &&
    (value as { ima2ResponsesError?: unknown | undefined }).ima2ResponsesError === true,
  );
}

async function getEndpoint(ctx: RouteRuntimeContext, provider: string | undefined, _scope: string) {
  if (provider === "api") {
    return {
      url: "https://api.openai.com/v1/responses",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: apiAuthorizationHeader(ctx.apiKey),
      },
    };
  }
  await waitForOAuthReady(ctx);
  const port = ctx?.config?.oauth?.proxyPort || 10531;
  return {
    url: `${safeBaseUrl(ctx?.oauthUrl || `http://127.0.0.1:${port}`)}/v1/responses`,
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
  };
}

export interface PostResponsesArgs {
  ctx: RouteRuntimeContext;
  provider: string | undefined;
  scope: string;
  payload: unknown;
  requestId?: string | null | undefined;
  maxImages?: number | undefined;
  signal?: AbortSignal | null | undefined;
  onPartialImage?: ((partial: { b64: string | undefined; index: number | null | undefined }) => void) | null;
  onFinalImage?: FinalImageHandler | null | undefined;
}

function combineAbortSignals(signals: AbortSignal[]): AbortSignal {
  const only = signals[0];
  if (signals.length === 1 && only) return only;
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
}

export async function postResponses({
  ctx,
  provider,
  scope,
  payload,
  requestId,
  maxImages = 1,
  signal = null,
  onPartialImage = null,
  onFinalImage = null,
}: PostResponsesArgs): Promise<ParsedResponsesResult> {
  const { url, headers } = await getEndpoint(ctx, provider, scope);
  const timeoutMs = ctx?.config?.oauth?.generationTimeoutMs || 400 * 1000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const fetchSignal = signal
    ? combineAbortSignals([controller.signal, signal])
    : controller.signal;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: headers as Record<string, string>,
      signal: fetchSignal,
      body: JSON.stringify(payload),
    });
    logEvent(scope, "response", { requestId, provider, status: res.status, contentType: res.headers.get("content-type") });
    if (!res.ok) {
      const text = await res.text();
      const upstream = parseOpenAIErrorBody(text);
      if (res.status >= 400 && res.status < 500 && upstream?.message) {
        throw makeError(safeUpstreamClientMessage(upstream, res.status), {
          status: res.status,
          code: normalizedCode(upstream),
          upstreamBodyChars: text.length,
          upstreamCode: upstream.code,
          upstreamType: upstream.type,
          upstreamParam: upstream.param,
          upstreamMessageRedacted: true,
        });
      }
      throw makeError(`${provider === "api" ? "OpenAI API" : "OAuth proxy"} returned ${res.status}`, {
        status: res.status,
        upstreamBodyChars: text.length,
      });
    }
    if (requestId) setJobPhase(requestId, "streaming");
    const contentType = res.headers.get("content-type") || "";
    return contentType.includes("text/event-stream")
      ? await parseStream(res, { requestId, scope, maxImages, onPartialImage, onFinalImage })
      : await parseJson(res, maxImages);
  } catch (e) {
    const err = errInfo(e);
    if (err.name === "AbortError") {
      if (signal?.aborted) {
        throw makeError("Generation canceled", {
          status: 499,
          code: "GENERATION_CANCELED",
          cause: err.raw,
        });
      }
      throw makeError("Responses image generation timed out", { status: 504, code: "RESPONSES_IMAGE_TIMEOUT", cause: err.raw });
    }
    if (isKnownResponsesError(err.raw)) throw err.raw;
    throw makeError("Responses request failed before receiving a response", {
      status: 502,
      code: "NETWORK_FAILED",
      errorName: err.name,
      upstreamMessageRedacted: true,
    });
  } finally {
    clearTimeout(timer);
  }
}
