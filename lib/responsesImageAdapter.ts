import { setJobPhase } from "./inflight.js";
import { logEvent } from "./logger.js";
import { classifyUpstreamError, classifyUpstreamErrorCode } from "./errorClassify.js";
import { compressReferenceB64ForOAuth } from "./referenceImageCompress.js";
import { detectImageMimeFromB64 } from "./refs.js";
import {
  AUTO_PROMPT_FIDELITY_SUFFIX,
  DIRECT_PROMPT_FIDELITY_SUFFIX,
  EDIT_DEVELOPER_PROMPT,
  EDIT_NO_SEARCH_DEVELOPER_PROMPT,
  GENERATE_DEVELOPER_PROMPT,
  GENERATE_NO_SEARCH_DEVELOPER_PROMPT,
  buildEditTextPrompt,
  buildMultimodeSequencePrompt,
  buildUserTextPrompt,
  waitForOAuthReady,
} from "./oauthProxy.js";

function makeError(message, { status = 500, code = "RESPONSES_IMAGE_ERROR", cause, ...rest }: any = {}) {
  const err: any = new Error(message);
  err.status = status;
  err.code = code;
  if (cause) err.cause = cause;
  Object.assign(err, rest);
  return err;
}

function parseOpenAIErrorBody(text) {
  try {
    const parsed = JSON.parse(text);
    const error = parsed?.error || {};
    return {
      message: typeof error.message === "string" && error.message ? error.message : "OpenAI request failed",
      code: typeof error.code === "string" ? error.code : null,
      type: typeof error.type === "string" ? error.type : null,
      param: typeof error.param === "string" ? error.param : null,
    };
  } catch {
    return null;
  }
}

function normalizedCode(upstream) {
  const byCode = classifyUpstreamErrorCode(upstream?.code);
  if (byCode !== "UNKNOWN") return byCode;
  const byType = classifyUpstreamErrorCode(upstream?.type);
  if (byType !== "UNKNOWN") return byType;
  const byMessage = classifyUpstreamError(upstream?.message);
  return byMessage !== "UNKNOWN" ? byMessage : "RESPONSES_IMAGE_ERROR";
}

function safeUpstreamClientMessage(upstream, status) {
  const code = normalizedCode(upstream);
  if (code === "AUTH_API_KEY_INVALID") return "API key is invalid or unavailable.";
  if (code === "MODERATION_REFUSED") return "OpenAI refused the image request for safety reasons.";
  if (code === "INVALID_REQUEST") return "OpenAI rejected the image request parameters.";
  if (status === 401 || status === 403) return "OpenAI authentication failed.";
  if (status === 429) return "OpenAI rate limited the image request.";
  return "OpenAI rejected the image request.";
}

async function getEndpoint(ctx, provider, scope) {
  if (provider === "api") {
    if (!ctx?.apiKey) {
      throw makeError("API key is required for API provider image generation", {
        status: 401,
        code: "API_KEY_REQUIRED",
      });
    }
    return {
      url: "https://api.openai.com/v1/responses",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${ctx.apiKey}`,
      },
    };
  }
  await waitForOAuthReady(ctx);
  const port = ctx?.config?.oauth?.proxyPort || 10531;
  return {
    url: `${ctx?.oauthUrl || `http://127.0.0.1:${port}`}/v1/responses`,
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
  };
}

function tools(webSearchEnabled, imageOptions) {
  return [
    ...(webSearchEnabled ? [{ type: "web_search" }] : []),
    { type: "image_generation", ...imageOptions },
  ];
}

function normalizeRef(ref) {
  const b64 = typeof ref === "string" ? ref : ref?.b64;
  const detectedMime = typeof ref === "object" && ref?.detectedMime
    ? ref.detectedMime
    : detectImageMimeFromB64(b64);
  const declaredMime = typeof ref === "object" ? ref?.declaredMime : null;
  const mime = ["image/png", "image/jpeg", "image/webp"].includes(detectedMime)
    ? detectedMime
    : ["image/png", "image/jpeg", "image/webp"].includes(declaredMime)
      ? declaredMime
      : "image/png";
  return { type: "input_image", image_url: `data:${mime};base64,${b64}` };
}

function extractSseData(block) {
  let eventData = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("data: ")) eventData += line.slice(6);
  }
  return eventData;
}

function extractPartialImage(data) {
  if (typeof data?.type !== "string" || !data.type.includes("partial")) return null;
  const item = data.item || {};
  const b64 = data.partial_image || data.image || data.result || item.partial_image || item.image || item.result;
  if (typeof b64 !== "string" || b64.length === 0) return null;
  const index = Number.isFinite(data.index) ? data.index : Number.isFinite(item.index) ? item.index : null;
  return { b64, index };
}

async function parseStream(res, { requestId, scope, maxImages = 1, onPartialImage = null }: any = {}) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const images = [];
  const eventTypes = {};
  let buffer = "";
  let usage = null;
  let webSearchCalls = 0;
  let eventCount = 0;
  let extraIgnored = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const eventData = extractSseData(block);
      if (!eventData || eventData === "[DONE]") continue;
      let data;
      try { data = JSON.parse(eventData); } catch { continue; }
      eventCount++;
      eventTypes[data.type || "_unknown"] = (eventTypes[data.type || "_unknown"] || 0) + 1;
      const partial = extractPartialImage(data);
      if (partial && typeof onPartialImage === "function") onPartialImage(partial);
      if (data.type === "response.output_item.done" && data.item?.type === "image_generation_call") {
        if (data.item.result && images.length < maxImages) {
          images.push({
            b64: data.item.result,
            revisedPrompt: typeof data.item.revised_prompt === "string" ? data.item.revised_prompt : null,
          });
          if (requestId) setJobPhase(requestId, "decoding");
        } else if (data.item.result) extraIgnored++;
      }
      if (data.type === "response.output_item.done" && data.item?.type === "web_search_call") webSearchCalls++;
      if (data.type === "response.completed") {
        usage = data.response?.usage || null;
        const wsNum = data.response?.tool_usage?.web_search?.num_requests;
        if (typeof wsNum === "number" && wsNum > webSearchCalls) webSearchCalls = wsNum;
      }
      if (data.type === "error") {
        throw makeError("Responses stream returned an error", {
          code: data.error?.code || "RESPONSES_STREAM_ERROR",
          eventCount,
          eventType: data.type,
        });
      }
    }
  }
  logEvent(scope, "stream_end", { requestId, events: eventCount, imageCount: images.length });
  return { images, usage, webSearchCalls, eventCount, eventTypes, extraIgnored };
}

async function parseJson(res, maxImages) {
  const json: any = await res.json();
  const images = [];
  let webSearchCalls = 0;
  for (const item of json.output || []) {
    if (item.type === "image_generation_call" && item.result && images.length < maxImages) {
      images.push({
        b64: item.result,
        revisedPrompt: typeof item.revised_prompt === "string" ? item.revised_prompt : null,
      });
    }
    if (item.type === "web_search_call") webSearchCalls++;
  }
  return { images, usage: json.usage || null, webSearchCalls, eventCount: 0, eventTypes: {}, extraIgnored: 0 };
}

async function postResponses({ ctx, provider, scope, payload, requestId, maxImages = 1, onPartialImage = null }) {
  const { url, headers } = await getEndpoint(ctx, provider, scope);
  const timeoutMs = ctx?.config?.oauth?.generationTimeoutMs || 400 * 1000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      signal: controller.signal,
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
      ? await parseStream(res, { requestId, scope, maxImages, onPartialImage })
      : await parseJson(res, maxImages);
  } catch (err) {
    if (err?.name === "AbortError") {
      throw makeError("Responses image generation timed out", { status: 504, code: "RESPONSES_IMAGE_TIMEOUT", cause: err });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function generateViaResponses(provider, prompt, quality, size, moderation = "low", references = [], requestId = null, mode = "auto", ctx: any = {}, options: any = {}) {
  const webSearchEnabled = options.webSearchEnabled !== false && options.searchMode !== "off";
  const referenceInputs = references.map(normalizeRef);
  const userContent = referenceInputs.length
    ? [...referenceInputs, { type: "input_text", text: buildUserTextPrompt(prompt, mode, { webSearchEnabled }) }]
    : buildUserTextPrompt(prompt, mode, { webSearchEnabled });
  const result = await postResponses({
    ctx,
    provider,
    scope: provider === "api" ? "api-generate" : "oauth",
    requestId,
    maxImages: 1,
    onPartialImage: options.onPartialImage,
    payload: {
      model: options.model || ctx.config?.imageModels?.default || "gpt-5.4-mini",
      input: [
        { role: "developer", content: webSearchEnabled ? GENERATE_DEVELOPER_PROMPT : GENERATE_NO_SEARCH_DEVELOPER_PROMPT },
        { role: "user", content: userContent },
      ],
      tools: tools(webSearchEnabled, { quality, size, moderation, ...(options.partialImages ? { partial_images: options.partialImages } : {}) }),
      tool_choice: "required",
      reasoning: { effort: options.reasoningEffort || "low" },
      stream: true,
    },
  });
  const image = result.images[0];
  if (!image?.b64) throw makeError("No image data received from Responses API", { code: "EMPTY_RESPONSE", eventCount: result.eventCount });
  return { b64: image.b64, usage: result.usage, webSearchCalls: result.webSearchCalls, revisedPrompt: image.revisedPrompt };
}

export async function generateMultimodeViaResponses(provider, prompt, quality, size, moderation = "low", references = [], requestId = null, mode = "auto", ctx: any = {}, options: any = {}) {
  const maxImages = Math.min(8, Math.max(1, Math.trunc(Number(options.maxImages) || 1)));
  const webSearchEnabled = options.webSearchEnabled !== false && options.searchMode !== "off";
  const userText = buildMultimodeSequencePrompt(
    mode === "direct"
      ? `${prompt}${DIRECT_PROMPT_FIDELITY_SUFFIX}`
      : `${prompt}${webSearchEnabled ? "" : ""}${AUTO_PROMPT_FIDELITY_SUFFIX}`,
    maxImages,
    { webSearchEnabled },
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
    onPartialImage: options.onPartialImage,
    payload: {
      model: options.model || ctx.config?.imageModels?.default || "gpt-5.4-mini",
      input: [
        { role: "developer", content: `Create up to ${maxImages} separate image_generation_call outputs. Do not create a collage, grid, contact sheet, storyboard sheet, or multi-panel single image.` },
        { role: "user", content: userContent },
      ],
      tools: tools(webSearchEnabled, { quality, size, moderation, ...(options.partialImages ? { partial_images: options.partialImages } : {}) }),
      tool_choice: "required",
      reasoning: { effort: options.reasoningEffort || "low" },
      stream: true,
    },
  });
}

export async function editViaResponses(provider, prompt, imageB64, quality, size, moderation = "low", mode = "auto", ctx: any = {}, requestId = null, options: any = {}) {
  const webSearchEnabled = options.webSearchEnabled !== false && options.searchMode !== "off";
  const imageForRequest = await compressReferenceB64ForOAuth(imageB64, {
    maxB64Bytes: ctx.config?.limits?.maxRefB64Bytes,
    force: true,
  });
  const referenceImages = await Promise.all((Array.isArray(options.references) ? options.references : []).map((ref) =>
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
    { type: "input_text", text: buildEditTextPrompt(prompt, mode, { webSearchEnabled }) },
  ];
  const result = await postResponses({
    ctx,
    provider,
    scope: provider === "api" ? "api-edit" : "oauth-edit",
    requestId,
    maxImages: 1,
    payload: {
      model: options.model || ctx.config?.imageModels?.default || "gpt-5.4-mini",
      input: [
        { role: "developer", content: webSearchEnabled ? EDIT_DEVELOPER_PROMPT : EDIT_NO_SEARCH_DEVELOPER_PROMPT },
        { role: "user", content: userContent },
      ],
      tools: tools(webSearchEnabled, { quality, size, moderation }),
      tool_choice: "required",
      reasoning: { effort: options.reasoningEffort || "low" },
      stream: true,
    },
  });
  const image = result.images[0];
  if (!image?.b64) throw makeError("No image data received from Responses edit", { code: "EMPTY_RESPONSE", eventCount: result.eventCount });
  return { b64: image.b64, usage: result.usage, revisedPrompt: image.revisedPrompt, webSearchCalls: result.webSearchCalls };
}
