import { setJobPhase } from "../inflight.js";
import { logEvent } from "../logger.js";
import { compressReferenceB64ForOAuth } from "../referenceImageCompress.js";
import { safeReferenceDiagnostics } from "../refs.js";
import type { RouteRuntimeContext } from "../runtimeContext.js";
import { throwOAuthHttpError, throwOAuthTimeoutError } from "./errors.js";
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
} from "./prompts.js";
import { normalizeReferenceForOAuth } from "./references.js";
import type { OAuthReferenceRef } from "./references.js";
import {
  buildImageTools,
  createOAuthGenerationTimeout,
  fetchOAuth,
  getOAuthUrl,
  resolveReasoningEffort,
  resolveWebSearchEnabled,
  summarizeEventTypes,
  waitForOAuthReady,
} from "./runtime.js";
import { readImageStream, readMultimodeImageStream } from "./streams.js";
import { config } from "../../config.js";

const RESEARCH_SUFFIX = config.oauth.researchSuffix;

export async function generateViaOAuth(
  prompt: string,
  quality: string,
  size: string,
  moderation: string = "low",
  references: OAuthReferenceRef[] = [],
  requestId: string | null = null,
  mode: string = "auto",
  ctx: RouteRuntimeContext = {},
  options: any = {},
) {
  await waitForOAuthReady(ctx);
  const oauthUrl = getOAuthUrl(ctx);
  const model = options.model || ctx.config?.imageModels?.default || "gpt-5.4-mini";
  const webSearchEnabled = resolveWebSearchEnabled(options);
  const tools = buildImageTools(webSearchEnabled, {
    quality,
    size,
    moderation,
    ...(options.partialImages ? { partial_images: options.partialImages } : {}),
  });

  const textPrompt = buildUserTextPrompt(prompt, mode, { webSearchEnabled });
  const referenceInputs = references.map(normalizeReferenceForOAuth);
  const referenceDiagnostics = safeReferenceDiagnostics(referenceInputs);
  const referenceMismatchCount = referenceDiagnostics.filter((ref) => ref.warnings.includes("mime_mismatch")).length;
  const userContent = referenceInputs.length
    ? [
        ...referenceInputs.map(({ b64, requestMime }) => ({
          type: "input_image",
          image_url: `data:${requestMime};base64,${b64}`,
        })),
        { type: "input_text", text: textPrompt },
      ]
    : textPrompt;

  if (referenceInputs.length > 0) {
    logEvent("oauth", "reference_diagnostics", {
      requestId,
      refsCount: referenceInputs.length,
      referenceMismatchCount,
      refDetectedMimes: [...new Set(referenceDiagnostics.map((ref) => ref.detectedMime).filter(Boolean))].join(","),
      refDeclaredMimes: [...new Set(referenceDiagnostics.map((ref) => ref.declaredMime).filter(Boolean))].join(","),
    });
  }

  const reasoningEffort = resolveReasoningEffort(ctx, options);
  const developerPrompt = webSearchEnabled ? GENERATE_DEVELOPER_PROMPT : GENERATE_NO_SEARCH_DEVELOPER_PROMPT;
  const timeout = createOAuthGenerationTimeout(ctx, requestId, "oauth");
  try {
    const res = await fetchOAuth(`${oauthUrl}/v1/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      signal: timeout.signal,
      body: JSON.stringify({
        model,
        input: [
          { role: "developer", content: developerPrompt },
          { role: "user", content: userContent },
        ],
        tools,
        tool_choice: "required",
        reasoning: { effort: reasoningEffort },
        stream: true,
      }),
    }, { requestId, scope: "oauth" });

    logEvent("oauth", "response", {
      requestId,
      model,
      status: res.status,
      contentType: res.headers.get("content-type"),
    });

    if (!res.ok) {
      const text = await res.text();
      logEvent("oauth", "error_response", { requestId, status: res.status, errorChars: text.length });
      throwOAuthHttpError(res, text, {
        requestId,
        scope: "oauth",
        fallbackMessage: `OAuth proxy returned ${res.status}`,
      });
    }

    if (requestId) setJobPhase(requestId, "streaming");

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream")) {
      logEvent("oauth", "json_response", { requestId });
      const json: any = await res.json();
      for (const item of json.output || []) {
        if (item.type === "image_generation_call" && item.result) {
          logEvent("oauth", "image", { requestId, imageChars: item.result.length });
          const revisedPrompt = typeof item.revised_prompt === "string" ? item.revised_prompt : null;
          return { b64: item.result, usage: json.usage, webSearchCalls: 0, revisedPrompt };
        }
      }
      logEvent("oauth", "json_no_image", { requestId, outputCount: (json.output || []).length });
      throw new Error("No image data in response (non-stream mode)");
    }

    const { imageB64, usage, webSearchCalls, revisedPrompt, eventCount, eventTypes } = await readImageStream(res, {
      requestId,
      scope: "oauth",
      onPartialImage: options.onPartialImage,
    });
    logEvent("oauth", "stream_end", {
      requestId,
      events: eventCount,
      hasImage: !!imageB64,
      ...summarizeEventTypes(eventTypes),
    });

    if (!imageB64) {
      logEvent("oauth", "retry_json", {
        requestId,
        retryKind: "prompt_only",
        referencesDroppedOnRetry: referenceInputs.length > 0,
        developerPromptDroppedOnRetry: true,
      });
      const retryRes = await fetchOAuth(`${oauthUrl}/v1/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: timeout.signal,
        body: JSON.stringify({
          model,
          input: [{ role: "user", content: buildUserTextPrompt(prompt, mode, { webSearchEnabled }) }],
          tools: [{ type: "image_generation", quality, size, moderation }],
          tool_choice: "required",
          reasoning: { effort: reasoningEffort },
          stream: false,
        }),
      }, { requestId, scope: "oauth" });

      if (retryRes.ok) {
        const json: any = await retryRes.json();
        for (const item of json.output || []) {
          if (item.type === "image_generation_call" && item.result) {
            logEvent("oauth", "retry_image", {
              requestId,
              imageChars: item.result.length,
              retryKind: "prompt_only",
              referencesDroppedOnRetry: referenceInputs.length > 0,
            });
            const retryRevised = typeof item.revised_prompt === "string" ? item.revised_prompt : null;
            return {
              b64: item.result,
              usage: json.usage,
              webSearchCalls,
              revisedPrompt: retryRevised,
              retryKind: "prompt_only",
              referencesDroppedOnRetry: referenceInputs.length > 0,
              developerPromptDroppedOnRetry: true,
              initialEventCount: eventCount,
            };
          }
        }
      } else {
        const text = await retryRes.text();
        logEvent("oauth", "retry_error_response", { requestId, status: retryRes.status, errorChars: text.length });
        throwOAuthHttpError(retryRes, text, {
          requestId,
          scope: "oauth",
          fallbackMessage: `OAuth proxy returned ${retryRes.status}`,
        });
      }

      const emptyErr: any = new Error("No image data received from OAuth proxy (parsed " + eventCount + " events)");
      emptyErr.eventCount = eventCount;
      emptyErr.eventTypes = eventTypes;
      emptyErr.size = size;
      emptyErr.quality = quality;
      emptyErr.model = model;
      emptyErr.refsCount = referenceInputs.length;
      emptyErr.inputImageCount = referenceInputs.length;
      emptyErr.referenceDiagnostics = referenceDiagnostics;
      emptyErr.referenceMismatchCount = referenceMismatchCount;
      emptyErr.retryKind = "prompt_only";
      emptyErr.referencesDroppedOnRetry = referenceInputs.length > 0;
      emptyErr.developerPromptDroppedOnRetry = true;
      throw emptyErr;
    }

    return { b64: imageB64, usage, webSearchCalls, revisedPrompt };
  } catch (err) {
    if (timeout.isTimeoutError(err)) {
      throwOAuthTimeoutError(err, { timeoutMs: timeout.timeoutMs, requestId, scope: "oauth" });
    }
    throw err;
  } finally {
    timeout.clear();
  }
}

export async function generateMultimodeViaOAuth(
  prompt: string,
  quality: string,
  size: string,
  moderation: string = "low",
  references: OAuthReferenceRef[] = [],
  requestId: string | null = null,
  mode: string = "auto",
  ctx: RouteRuntimeContext = {},
  options: any = {},
) {
  await waitForOAuthReady(ctx);
  const oauthUrl = getOAuthUrl(ctx);
  const model = options.model || ctx.config?.imageModels?.default || "gpt-5.4-mini";
  const maxImages = Math.min(8, Math.max(1, Math.trunc(Number(options.maxImages) || 1)));
  const webSearchEnabled = resolveWebSearchEnabled(options);
  const tools = buildImageTools(webSearchEnabled, {
    quality,
    size,
    moderation,
    ...(options.partialImages ? { partial_images: options.partialImages } : {}),
  });
  const referenceInputs = references.map(normalizeReferenceForOAuth);
  const userText = buildMultimodeSequencePrompt(
    mode === "direct"
      ? `${prompt}${DIRECT_PROMPT_FIDELITY_SUFFIX}`
      : `${prompt}${webSearchEnabled ? RESEARCH_SUFFIX : ""}${AUTO_PROMPT_FIDELITY_SUFFIX}`,
    maxImages,
    { webSearchEnabled },
  );
  const userContent = referenceInputs.length
    ? [
        ...referenceInputs.map(({ b64, requestMime }) => ({
          type: "input_image",
          image_url: `data:${requestMime};base64,${b64}`,
        })),
        { type: "input_text", text: userText },
      ]
    : userText;

  logEvent("oauth-multimode", "request", {
    requestId,
    model,
    refsCount: referenceInputs.length,
    maxImages,
    promptChars: typeof prompt === "string" ? prompt.length : 0,
    webSearchEnabled,
  });

  const reasoningEffort = resolveReasoningEffort(ctx, options);
  const developerPrompt = webSearchEnabled ? MULTIMODE_DEVELOPER_PROMPT : MULTIMODE_NO_SEARCH_DEVELOPER_PROMPT;
  const timeout = createOAuthGenerationTimeout(ctx, requestId, "oauth-multimode");
  try {
    const res = await fetchOAuth(`${oauthUrl}/v1/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      signal: options.signal || timeout.signal,
      body: JSON.stringify({
        model,
        input: [
          { role: "developer", content: `${developerPrompt}\n\nN = ${maxImages}.` },
          { role: "user", content: userContent },
        ],
        tools,
        tool_choice: "required",
        reasoning: { effort: reasoningEffort },
        stream: true,
      }),
    }, { requestId, scope: "oauth-multimode" });

    logEvent("oauth-multimode", "response", {
      requestId,
      model,
      status: res.status,
      contentType: res.headers.get("content-type"),
    });

    if (!res.ok) {
      const text = await res.text();
      logEvent("oauth-multimode", "error_response", { requestId, status: res.status, errorChars: text.length });
      throwOAuthHttpError(res, text, {
        requestId,
        scope: "oauth-multimode",
        fallbackMessage: `OAuth proxy returned ${res.status}`,
      });
    }

    if (requestId) setJobPhase(requestId, "streaming");
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream")) {
      const json: any = await res.json();
      const images: Array<{ b64: any; revisedPrompt: any }> = [];
      for (const item of json.output || []) {
        if (item.type === "image_generation_call" && item.result && images.length < maxImages) {
          images.push({
            b64: item.result,
            revisedPrompt: typeof item.revised_prompt === "string" ? item.revised_prompt : null,
          });
        }
      }
      return {
        images,
        usage: json.usage || null,
        webSearchCalls: 0,
        eventCount: 0,
        eventTypes: {},
        extraIgnored: 0,
      };
    }

    const result = await readMultimodeImageStream(res, {
      requestId,
      maxImages,
      scope: "oauth-multimode",
      onPartialImage: options.onPartialImage,
    });
    logEvent("oauth-multimode", "stream_end", {
      requestId,
      events: result.eventCount,
      imageCount: result.images.length,
      extraIgnored: result.extraIgnored,
      ...summarizeEventTypes(result.eventTypes),
    });
    return result;
  } catch (err) {
    if (timeout.isTimeoutError(err)) {
      throwOAuthTimeoutError(err, { timeoutMs: timeout.timeoutMs, requestId, scope: "oauth-multimode" });
    }
    throw err;
  } finally {
    timeout.clear();
  }
}

export async function editViaOAuth(prompt: string, imageB64: string, quality: string, size: string, moderation: string = "low", mode: string = "auto", ctx: RouteRuntimeContext = {}, requestId: string | null = null, options: any = {}) {
  await waitForOAuthReady(ctx);
  const maskPresent = typeof options.mask === "string" && options.mask.length > 0;
  if (maskPresent && !ctx.config?.oauth?.maskedEditEnabled) {
    logEvent("oauth-edit", "mask_unsupported", { requestId, maskPresent: true });
    const err: any = new Error("Masked edit is not supported by the current OAuth image provider");
    err.status = 400;
    err.code = "EDIT_MASK_NOT_SUPPORTED";
    throw err;
  }
  if (maskPresent) {
    // TODO(#31): enable upstream mask payload after STEP-0 verification
    logEvent("oauth-edit", "mask_unsupported", { requestId, maskPresent: true });
    const err: any = new Error("Masked edit is not supported by the current OAuth image provider");
    err.status = 400;
    err.code = "EDIT_MASK_NOT_SUPPORTED";
    throw err;
  }
  const oauthUrl = getOAuthUrl(ctx);
  const model = options.model || ctx.config?.imageModels?.default || "gpt-5.4-mini";
  const webSearchEnabled = resolveWebSearchEnabled(options);
  const textPrompt = buildEditTextPrompt(prompt, mode, { webSearchEnabled });
  const imageForRequest = await compressReferenceB64ForOAuth(imageB64, {
    maxB64Bytes: ctx.config?.limits?.maxRefB64Bytes,
    force: true,
  });
  const references = Array.isArray(options.references) ? options.references : [];
  const referenceImagesForRequest = await Promise.all(
    references.map((ref: OAuthReferenceRef) =>
      compressReferenceB64ForOAuth(typeof ref === "string" ? ref : ref?.b64, {
        maxB64Bytes: ctx.config?.limits?.maxRefB64Bytes,
        force: true,
      }),
    ),
  );
  const referenceContent = referenceImagesForRequest.map(({ b64 }) => ({
    type: "input_image",
    image_url: `data:image/jpeg;base64,${b64}`,
  }));
  const tools = buildImageTools(webSearchEnabled, { quality, size, moderation });

  logEvent("oauth-edit", "request", {
    requestId,
    model,
    refsCount: references.length,
    inputImageCount: 1 + references.length,
    parentImagePresent: true,
    webSearchEnabled,
    inputImageCompressed: imageForRequest.compressed,
    inputImageChars: imageForRequest.inputBytes,
    inputImageRequestChars: imageForRequest.outputBytes,
  });

  const reasoningEffort = resolveReasoningEffort(ctx, options);
  const developerPrompt = webSearchEnabled ? EDIT_DEVELOPER_PROMPT : EDIT_NO_SEARCH_DEVELOPER_PROMPT;
  const timeout = createOAuthGenerationTimeout(ctx, requestId, "oauth-edit");
  try {
    const res = await fetchOAuth(`${oauthUrl}/v1/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      signal: timeout.signal,
      body: JSON.stringify({
        model,
        input: [
          { role: "developer", content: developerPrompt },
          {
            role: "user",
            content: [
              { type: "input_image", image_url: `data:image/jpeg;base64,${imageForRequest.b64}` },
              ...referenceContent,
              { type: "input_text", text: textPrompt },
            ],
          },
        ],
        tools,
        tool_choice: "required",
        reasoning: { effort: reasoningEffort },
        stream: true,
      }),
    }, { requestId, scope: "oauth-edit" });

    logEvent("oauth-edit", "response", {
      requestId,
      model,
      status: res.status,
      contentType: res.headers.get("content-type"),
    });

    if (!res.ok) {
      const text = await res.text();
      logEvent("oauth-edit", "error_response", { requestId, status: res.status, errorChars: text.length });
      throwOAuthHttpError(res, text, {
        requestId,
        scope: "oauth-edit",
        fallbackMessage: `OAuth edit returned ${res.status}`,
      });
    }

    if (requestId) setJobPhase(requestId, "streaming");

    const { imageB64: resultB64, usage, revisedPrompt, webSearchCalls, eventCount, eventTypes } = await readImageStream(res, {
      scope: "oauth-edit",
      requestId,
    });
    logEvent("oauth-edit", "stream_end", {
      requestId,
      events: eventCount,
      hasImage: !!resultB64,
      ...summarizeEventTypes(eventTypes),
    });
    if (resultB64) return { b64: resultB64, usage, revisedPrompt, webSearchCalls };
    const emptyErr: any = new Error("No image data received from OAuth edit");
    emptyErr.eventCount = eventCount;
    emptyErr.eventTypes = eventTypes;
    emptyErr.size = size;
    emptyErr.quality = quality;
    emptyErr.model = model;
    emptyErr.refsCount = references.length;
    emptyErr.inputImageCount = 1 + references.length;
    emptyErr.parentImagePresent = true;
    throw emptyErr;
  } catch (err) {
    if (timeout.isTimeoutError(err)) {
      throwOAuthTimeoutError(err, { timeoutMs: timeout.timeoutMs, requestId, scope: "oauth-edit" });
    }
    throw err;
  } finally {
    timeout.clear();
  }
}
