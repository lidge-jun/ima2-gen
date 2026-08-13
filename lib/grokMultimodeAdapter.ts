import { errInfo } from "./errInfo.js";
import {
  imageEditPayload,
  imagePayload,
  planGrokImage,
  postGrokImages,
  grokError,
  downloadGrokImageUrl,
  type GrokReferenceImage,
} from "./grokImageAdapter.js";
import { logEvent } from "./logger.js";
import type { RouteRuntimeContext } from "./runtimeContext.js";

export interface GrokMultimodeResult {
  images: Array<{ b64: string; revisedPrompt?: string; mime?: string; providerUrl?: string }>;
  usage: Record<string, number> | null;
  webSearchCalls: number;
  extraIgnored: number;
  error?: unknown;
}

export async function generateMultimodeViaGrok(
  prompt: string,
  ctx: RouteRuntimeContext,
  options: {
    model?: string;
    maxImages?: number;
    size?: string;
    signal?: AbortSignal;
    requestId?: string;
    references?: GrokReferenceImage[];
    directApiKey?: string;
    onFinalImage?: (image: { b64: string; revisedPrompt?: string; mime?: string }, index: number) => void | Promise<void>;
  } = {},
): Promise<GrokMultimodeResult> {
  const model = options.model || (ctx.config as any).grokProvider?.defaultImageModel || "grok-imagine-image-quality";
  const maxGeneratedImages = Math.max(
    1,
    Math.trunc(Number((ctx.config as any).limits?.maxGeneratedImages) || 24),
  );
  const maxImages = Math.min(
    maxGeneratedImages,
    Math.max(1, Math.trunc(Number(options.maxImages) || 4)),
  );
  const references = options.references || [];
  const images: Array<{ b64: string; revisedPrompt?: string; mime?: string; providerUrl?: string }> = [];
  let totalCost = 0;
  let totalWebSearchCalls = 0;
  let lastError: unknown;

  logEvent("grok", "multimode:start", { requestId: options.requestId, model, maxImages, refs: references.length });

  for (let i = 0; i < maxImages; i++) {
    if (options.signal?.aborted) throw grokError("Generation canceled", 499, "GENERATION_CANCELED");

    const indexedPrompt = maxImages > 1 ? `[Image ${i + 1} of ${maxImages}] ${prompt}` : prompt;
    const plan = await planGrokImage(indexedPrompt, ctx, {
      model,
      size: options.size,
      signal: options.signal,
      requestId: options.requestId,
      references,
      directApiKey: options.directApiKey,
    });
    totalWebSearchCalls += plan.webSearchCalls;
    const endpoint = references.length > 0 ? "/v1/images/edits" : "/v1/images/generations";
    const payload = references.length > 0
      ? imageEditPayload(model, plan.prompt, references, options.size)
      : imagePayload(model, plan.prompt, options.size);

    try {
      logEvent("grok", "multimode:item-start", {
        requestId: options.requestId,
        index: i,
        endpoint,
        refs: references.length,
        promptChars: plan.prompt.length,
      });
      const result = await postGrokImages(ctx, payload, options.signal, endpoint, options.directApiKey);
      const imgUrl = result.data?.[0]?.url;
      if (imgUrl) {
        const dl = await downloadGrokImageUrl(imgUrl, options.signal);
        const img = { b64: dl.b64, mime: dl.mime, revisedPrompt: plan.prompt, providerUrl: imgUrl };
        images.push(img);
        if (result.usage?.cost_in_usd_ticks) totalCost += result.usage.cost_in_usd_ticks;
        await options.onFinalImage?.(img, i);
      }
    } catch (e: any) {
      if (e.code === "GENERATION_CANCELED") throw e;
      logEvent("grok", "multimode:item-error", { requestId: options.requestId, index: i, error: errInfo(e) });
      lastError = e;
    }
  }

  logEvent("grok", "multimode:done", { requestId: options.requestId, model, returned: images.length, requested: maxImages, refs: references.length });

  const usage = totalCost > 0 ? { grok_cost_usd_ticks: totalCost } : null;
  return { images, usage, webSearchCalls: totalWebSearchCalls, extraIgnored: 0, ...(lastError ? { error: lastError } : {}) };
}
