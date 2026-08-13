import { logEvent } from "./logger.js";
import { classifyUpstreamError, classifyUpstreamErrorCode } from "./errorClassify.js";
import { compressReferenceB64ForOAuth } from "./referenceImageCompress.js";
import { detectImageMimeFromB64 } from "./refs.js";
import { errInfo } from "./errInfo.js";
import { setJobPhase } from "./inflight.js";
import { type RouteRuntimeContext, requireRuntimeContext } from "./runtimeContext.js";
import {
  parseJson,
  parseStream,
  safeDiagnosticLabel,
  type FinalImageHandler,
} from "./responsesParse.js";
import {
  imageToolChoice,
  imageToolChoiceKind,
  tools,
  toolTypes,
} from "./responsesTools.js";
import { emptyResponseError } from "./responsesErrors.js";
import { retryPromptOnlyJsonImage } from "./responsesFallback.js";
import {
  AUTO_PROMPT_FIDELITY_SUFFIX,
  DIRECT_PROMPT_FIDELITY_SUFFIX,
  EDIT_DEVELOPER_PROMPT,
  EDIT_NO_SEARCH_DEVELOPER_PROMPT,
  GENERATE_DEVELOPER_PROMPT,
  GENERATE_NO_SEARCH_DEVELOPER_PROMPT,
  MULTIMODE_DEVELOPER_PROMPT,
  MULTIMODE_NO_SEARCH_DEVELOPER_PROMPT,
  buildEditTextPrompt,
  buildMultimodeSequencePrompt,
  buildUserTextPrompt,
  waitForOAuthReady,
} from "./oauthProxy.js";

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

type ReferenceRef = string | { b64?: string | undefined; detectedMime?: string | null; declaredMime?: string | null };

function normalizeRef(ref: ReferenceRef) {
  const b64 = typeof ref === "string" ? ref : ref?.b64;
  const detectedMime = typeof ref === "object" && ref?.detectedMime
    ? ref.detectedMime
    : detectImageMimeFromB64(b64);
  const declaredMime = typeof ref === "object" ? ref?.declaredMime : null;
  const mime = ["image/png", "image/jpeg", "image/webp"].includes(detectedMime as string)
    ? detectedMime
    : ["image/png", "image/jpeg", "image/webp"].includes(declaredMime as string)
      ? declaredMime
      : "image/png";
  return { type: "input_image", image_url: `data:${mime};base64,${b64}` };
}

interface PostResponsesArgs {
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

async function postResponses({
  ctx,
  provider,
  scope,
  payload,
  requestId,
  maxImages = 1,
  signal = null,
  onPartialImage = null,
  onFinalImage = null,
}: PostResponsesArgs) {
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

interface GenerateOptions {
  webSearchEnabled?: boolean | undefined;
  searchMode?: string | undefined;
  onPartialImage?: ((partial: { b64: string | undefined; index: number | null | undefined }) => void) | null;
  onFinalImage?: FinalImageHandler | null | undefined;
  model?: string | undefined;
  partialImages?: number | undefined;
  reasoningEffort?: string | undefined;
  maxImages?: number | undefined;
  references?: ReferenceRef[] | undefined;
  mask?: string | undefined;
  signal?: AbortSignal | null | undefined;
  forceImageToolChoice?: boolean | undefined;
  allowPromptOnlyOAuthFallback?: boolean | undefined;
}

export async function generateViaResponses(provider: string | undefined, prompt: string | undefined, quality: string | undefined, size: string | undefined, moderation: string = "low", references: ReferenceRef[] = [], requestId: string | null = null, mode: string = "auto", ctxRaw: RouteRuntimeContext = {}, options: GenerateOptions = {}) {
  const ctx = requireRuntimeContext(ctxRaw);
  const model = options.model || ctx.config?.imageModels?.default || "gpt-5.6-luna";
  const webSearchEnabled = options.webSearchEnabled !== false && options.searchMode !== "off";
  const requestTools = tools(webSearchEnabled, { quality, size, moderation, ...(options.partialImages ? { partial_images: options.partialImages } : {}) });
  const toolChoice = imageToolChoice(options.forceImageToolChoice ?? ctx.config?.oauth?.forceImageToolChoice !== false);
  const toolChoiceKind = imageToolChoiceKind(toolChoice);
  const referenceInputs = references.map(normalizeRef);
  const userContent = referenceInputs.length
    ? [...referenceInputs, { type: "input_text", text: buildUserTextPrompt(prompt, mode, { webSearchEnabled, size }) }]
    : buildUserTextPrompt(prompt, mode, { webSearchEnabled, size });
  const result = await postResponses({
    ctx,
    provider,
    scope: provider === "api" ? "api-generate" : "oauth",
    requestId,
    maxImages: 1,
    ...(options.signal !== undefined ? { signal: options.signal } : {}),
    ...(options.onPartialImage !== undefined ? { onPartialImage: options.onPartialImage } : {}),
    ...(options.onFinalImage !== undefined ? { onFinalImage: options.onFinalImage } : {}),
    payload: {
      model,
      input: [
        { role: "developer", content: webSearchEnabled ? GENERATE_DEVELOPER_PROMPT : GENERATE_NO_SEARCH_DEVELOPER_PROMPT },
        { role: "user", content: userContent },
      ],
      tools: requestTools,
      tool_choice: toolChoice,
      reasoning: { effort: options.reasoningEffort || "low" },
      stream: true,
    },
  });
  const image = result.images[0];
  if (!image?.b64) {
    if (options.allowPromptOnlyOAuthFallback === true) {
      const fallback = await retryPromptOnlyJsonImage({
        postResponses,
        ctx,
        provider,
        prompt,
        mode,
        model,
        quality,
        size,
        moderation,
        requestId,
        ...(options.signal !== undefined ? { signal: options.signal } : {}),
        initial: result,
        referenceInputs,
        webSearchDroppedOnRetry: webSearchEnabled,
        ...(options.reasoningEffort !== undefined ? { reasoningEffort: options.reasoningEffort } : {}),
      });
      if (fallback) return fallback;
    }
    throw emptyResponseError("No image data received from Responses API", result, {
      provider,
      model,
      quality,
      size,
      moderation,
      webSearchEnabled,
      refsCount: referenceInputs.length,
      inputImageCount: referenceInputs.length,
      promptChars: typeof prompt === "string" ? prompt.length : 0,
      toolTypes: toolTypes(requestTools),
      toolChoiceKind,
    });
  }
  return { b64: image.b64, usage: result.usage, webSearchCalls: result.webSearchCalls, revisedPrompt: image.revisedPrompt, text: result.text };
}

export async function generateMultimodeViaResponses(provider: string | undefined, prompt: string | undefined, quality: string | undefined, size: string | undefined, moderation: string = "low", references: ReferenceRef[] = [], requestId: string | null = null, mode: string = "auto", ctxRaw: RouteRuntimeContext = {}, options: GenerateOptions = {}) {
  const ctx = requireRuntimeContext(ctxRaw);
  const maxGeneratedImages = Math.max(
    1,
    Math.trunc(Number(ctx.config.limits.maxGeneratedImages) || 24),
  );
  const maxImages = Math.min(
    maxGeneratedImages,
    Math.max(1, Math.trunc(Number(options.maxImages) || 1)),
  );
  const model = options.model || ctx.config?.imageModels?.default || "gpt-5.6-luna";
  const webSearchEnabled = options.webSearchEnabled !== false && options.searchMode !== "off";
  const requestTools = tools(webSearchEnabled, { quality, size, moderation, ...(options.partialImages ? { partial_images: options.partialImages } : {}) });
  const userText = buildMultimodeSequencePrompt(
    mode === "direct"
      ? `${prompt}${DIRECT_PROMPT_FIDELITY_SUFFIX}`
      : `${prompt}${webSearchEnabled ? "" : ""}${AUTO_PROMPT_FIDELITY_SUFFIX}`,
    maxImages,
    { webSearchEnabled, size },
  );
  const referenceInputs = references.map(normalizeRef);
  const userContent = referenceInputs.length
    ? [...referenceInputs, { type: "input_text", text: userText }]
    : userText;
  return await postResponses({
    ctx,
    provider,
    scope: provider === "api" ? "api-multimode" : "oauth-multimode",
    requestId,
    maxImages,
    ...(options.signal !== undefined ? { signal: options.signal } : {}),
    ...(options.onPartialImage !== undefined ? { onPartialImage: options.onPartialImage } : {}),
    ...(options.onFinalImage !== undefined ? { onFinalImage: options.onFinalImage } : {}),
    payload: {
      model,
      input: [
        { role: "developer", content: webSearchEnabled ? MULTIMODE_DEVELOPER_PROMPT : MULTIMODE_NO_SEARCH_DEVELOPER_PROMPT },
        { role: "user", content: userContent },
      ],
      tools: requestTools,
      tool_choice: "required",
      reasoning: { effort: options.reasoningEffort || "low" },
      stream: true,
    },
  });
}

export async function editViaResponses(provider: string | undefined, prompt: string | undefined, imageB64: string | undefined, quality: string | undefined, size: string | undefined, moderation: string = "low", mode: string = "auto", ctxRaw: RouteRuntimeContext = {}, requestId: string | null = null, options: GenerateOptions = {}) {
  const ctx = requireRuntimeContext(ctxRaw);
  const model = options.model || ctx.config?.imageModels?.default || "gpt-5.6-luna";
  const webSearchEnabled = options.webSearchEnabled !== false && options.searchMode !== "off";
  const requestTools = tools(webSearchEnabled, { quality, size, moderation });
  const toolChoice = imageToolChoice(options.forceImageToolChoice ?? ctx.config?.oauth?.forceImageToolChoice !== false);
  const toolChoiceKind = imageToolChoiceKind(toolChoice);
  const imageForRequest = await compressReferenceB64ForOAuth(imageB64, {
    maxB64Bytes: ctx.config?.limits?.maxRefB64Bytes,
    force: true,
  });
  const referenceImages = await Promise.all((Array.isArray(options.references) ? options.references : []).map((ref: ReferenceRef) =>
    compressReferenceB64ForOAuth(typeof ref === "string" ? ref : ref?.b64, {
      maxB64Bytes: ctx.config?.limits?.maxRefB64Bytes,
      force: true,
    }),
  ));
  const maskContent = typeof options.mask === "string" && options.mask.length > 0
    ? [
        { type: "input_image", image_url: `data:image/png;base64,${options.mask}` },
        { type: "input_text", text: "The previous image is an edit mask guide. Use it as prompt guidance for where the edit should apply; it is not a visible final image element." },
      ]
    : [];
  const userContent = [
    { type: "input_image", image_url: `data:image/jpeg;base64,${imageForRequest.b64}` },
    ...referenceImages.map(({ b64 }) => ({ type: "input_image", image_url: `data:image/jpeg;base64,${b64}` })),
    ...maskContent,
    { type: "input_text", text: buildEditTextPrompt(prompt, mode, { webSearchEnabled, size }) },
  ];
  const result = await postResponses({
    ctx,
    provider,
    scope: provider === "api" ? "api-edit" : "oauth-edit",
    requestId,
    maxImages: 1,
    signal: options.signal,
    payload: {
      model,
      input: [
        { role: "developer", content: webSearchEnabled ? EDIT_DEVELOPER_PROMPT : EDIT_NO_SEARCH_DEVELOPER_PROMPT },
        { role: "user", content: userContent },
      ],
      tools: requestTools,
      tool_choice: toolChoice,
      reasoning: { effort: options.reasoningEffort || "low" },
      stream: true,
    },
  });
  const image = result.images[0];
  if (!image?.b64) {
    throw emptyResponseError("No image data received from Responses edit", result, {
      provider,
      model,
      quality,
      size,
      moderation,
      webSearchEnabled,
      refsCount: referenceImages.length,
      inputImageCount: 1 + referenceImages.length + (maskContent.length ? 1 : 0),
      promptChars: typeof prompt === "string" ? prompt.length : 0,
      toolTypes: toolTypes(requestTools),
      toolChoiceKind,
    });
  }
  return { b64: image.b64, usage: result.usage, revisedPrompt: image.revisedPrompt, webSearchCalls: result.webSearchCalls };
}
