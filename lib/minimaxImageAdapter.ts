// lib/minimaxImageAdapter.ts — MiniMax image-generation adapter.
//
// Calls the MiniMax /v1/image_generation endpoint directly with a Bearer API
// key. Supports text-to-image and image-to-image: when reference images are
// attached they are mapped to the `subject_reference` array (character subject
// type, data URL or public URL). Responses are returned as `url` or `base64`;
// both shapes are parsed into a single base64 payload for the shared pipeline.
//
// Region selects the global (.io) or China (.minimaxi.com) OpenAI-compatible
// base URL. The endpoint, models, request fields, output formats, and response
// fields follow the MiniMax image-generation API reference.

import type { RuntimeContext } from "./runtimeContext.js";
import { detectImageMimeFromB64 } from "./refs.js";
import { logEvent } from "./logger.js";

export const MINIMAX_TEXT_TO_IMAGE_MODEL = "image-01";
export const MINIMAX_IMAGE_TO_IMAGE_MODEL = "image-01-live";

const MINIMAX_TIMEOUT_MS = 120_000;

// Aspect ratios accepted by the MiniMax image-generation API.
const VALID_ASPECT_RATIOS = new Set([
  "1:1", "16:9", "4:3", "3:2", "2:3", "3:4", "9:16", "21:9",
]);

type MinimaxReference = {
  b64: string;
  declaredMime?: string | null;
  detectedMime?: string | null;
};

type MinimaxGenerateOptions = {
  model?: string;
  size?: string;
  signal?: AbortSignal;
  requestId?: string;
  references?: MinimaxReference[];
};

type MinimaxImageResult = {
  b64: string;
  revisedPrompt?: string | null;
  usage: Record<string, number> | null;
  webSearchCalls: number;
  mime?: string;
  providerUrl?: string | null;
};

function minimaxError(message: string, status: number, code: string): Error {
  const err = new Error(message) as Error & { status?: number; code?: string; isOperational?: boolean };
  err.status = status;
  err.code = code;
  err.isOperational = true;
  return err;
}

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function resolveBaseUrl(ctx: RuntimeContext): string {
  const cfg = ctx.config.minimaxProvider;
  return cfg.region === "cn_zh" ? cfg.cnBaseUrl : cfg.globalBaseUrl;
}

// MiniMax accepts a WxH size string; map it to the closest supported
// aspect_ratio when it is not already one. "auto" / unset leaves the choice to
// the API default (1:1).
function sizeToAspectRatio(size?: string): string | null {
  if (!size || size === "auto") return null;
  if (VALID_ASPECT_RATIOS.has(size)) return size;
  const match = size.match(/^(\d+)x(\d+)$/);
  if (!match) return null;
  const ratio = Number(match[1]) / Number(match[2]);
  const table: Array<[string, number]> = [
    ["1:1", 1], ["16:9", 16 / 9], ["4:3", 4 / 3], ["3:2", 3 / 2],
    ["2:3", 2 / 3], ["3:4", 3 / 4], ["9:16", 9 / 16], ["21:9", 21 / 9],
  ];
  let best = "1:1";
  let bestDist = Infinity;
  for (const [label, val] of table) {
    const dist = Math.abs(ratio - val);
    if (dist < bestDist) { bestDist = dist; best = label; }
  }
  return best;
}

function refToDataUrl(ref: MinimaxReference): string {
  const mime = ref.detectedMime || ref.declaredMime || detectImageMimeFromB64(ref.b64) || "image/png";
  return `data:${mime};base64,${ref.b64}`;
}

export async function generateViaMinimax(
  prompt: string,
  ctx: RuntimeContext,
  options: MinimaxGenerateOptions = {},
): Promise<MinimaxImageResult> {
  const apiKey = ctx.minimaxApiKey;
  if (!apiKey) {
    throw minimaxError("MiniMax API key not configured", 401, "MINIMAX_API_KEY_MISSING");
  }
  const references = (options.references || []).filter((ref) => ref.b64);
  if (references.length > 1) {
    throw minimaxError("MiniMax image-to-image supports up to 1 subject reference", 400, "MINIMAX_REF_TOO_MANY");
  }
  // image-01-live is the live/image-to-image variant; image-01 is text-to-image.
  const model = references.length > 0
    ? (options.model === "image-01" ? MINIMAX_IMAGE_TO_IMAGE_MODEL : (options.model || MINIMAX_IMAGE_TO_IMAGE_MODEL))
    : (options.model || MINIMAX_TEXT_TO_IMAGE_MODEL);
  const baseUrl = resolveBaseUrl(ctx);
  const url = `${baseUrl.replace(/\/$/, "")}/image_generation`;

  const body: Record<string, unknown> = {
    model,
    prompt,
    response_format: "url",
  };
  const aspectRatio = sizeToAspectRatio(options.size);
  if (aspectRatio) body.aspect_ratio = aspectRatio;

  if (references.length > 0) {
    body.subject_reference = references.map((ref) => ({
      type: "character",
      image_file: refToDataUrl(ref),
    }));
  }

  logEvent("minimax", "generate:start", {
    requestId: options.requestId,
    model,
    aspectRatio: aspectRatio ?? null,
    refs: references.length,
  });

  const timeoutSignal = AbortSignal.timeout(ctx.config.minimaxProvider.generationTimeoutMs || MINIMAX_TIMEOUT_MS);
  const combinedSignal = options.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: combinedSignal,
    });

    const json = await readJson(res);
    const statusCode = json?.base_resp?.status_code;
    const statusMsg = json?.base_resp?.status_msg;

    if (!res.ok || (typeof statusCode === "number" && statusCode !== 0)) {
      const detail = statusMsg || JSON.stringify(json).slice(0, 200);
      if (res.status === 429 || statusCode === 1002) {
        throw minimaxError(`MiniMax rate limited: ${detail}`, 429, "MINIMAX_RATE_LIMITED");
      }
      if (res.status === 401 || statusCode === 1004 || statusCode === 2049) {
        throw minimaxError(`MiniMax authentication failed: ${detail}`, 401, "MINIMAX_AUTH_FAILED");
      }
      if (statusCode === 1008) {
        throw minimaxError(`MiniMax insufficient balance: ${detail}`, 402, "MINIMAX_INSUFFICIENT_BALANCE");
      }
      if (statusCode === 1026) {
        throw minimaxError(`MiniMax sensitive content detected: ${detail}`, 400, "MINIMAX_SAFETY_BLOCKED");
      }
      if (res.status === 400 || res.status === 403 || statusCode === 2013) {
        throw minimaxError(`MiniMax bad request: ${detail}`, res.status || 400, "MINIMAX_BAD_REQUEST");
      }
      throw minimaxError(`MiniMax image generation failed (${res.status}): ${detail}`, 502, "MINIMAX_UPSTREAM_ERROR");
    }

    const data = json?.data || {};
    const imageUrls: string[] = Array.isArray(data.image_urls) ? data.image_urls : [];
    const imageBase64: string[] = Array.isArray(data.image_base64) ? data.image_base64 : [];
    const successCount = json?.metadata?.success_count;
    const failedCount = json?.metadata?.failed_count;

    let b64: string | null = null;
    let mime = "image/png";
    let providerUrl: string | null = null;

    if (imageBase64.length > 0) {
      b64 = imageBase64[0];
      mime = detectImageMimeFromB64(b64) || "image/png";
    } else if (imageUrls.length > 0) {
      providerUrl = imageUrls[0];
      const downloadRes = await fetch(providerUrl, { signal: combinedSignal });
      if (!downloadRes.ok) {
        throw minimaxError(`MiniMax image download failed (${downloadRes.status})`, 502, "MINIMAX_IMAGE_DOWNLOAD_FAILED");
      }
      mime = downloadRes.headers.get("content-type") || "image/png";
      b64 = Buffer.from(await downloadRes.arrayBuffer()).toString("base64");
    }

    if (!b64) {
      if (typeof failedCount === "number" && failedCount > 0 && (typeof successCount !== "number" || successCount === 0)) {
        throw minimaxError("MiniMax image generation blocked by content safety", 400, "MINIMAX_SAFETY_BLOCKED");
      }
      throw minimaxError("MiniMax image generation did not return an image", 502, "MINIMAX_NO_IMAGE");
    }

    logEvent("minimax", "generate:done", {
      requestId: options.requestId,
      model,
      b64Len: b64.length,
      mime,
      successCount: successCount ?? null,
      failedCount: failedCount ?? null,
    });

    return {
      b64,
      revisedPrompt: null,
      usage: null,
      webSearchCalls: 0,
      mime,
      providerUrl,
    };
  } catch (e: any) {
    if (e.name === "AbortError") {
      if (options.signal?.aborted) {
        throw minimaxError("Generation canceled", 499, "GENERATION_CANCELED");
      }
      throw minimaxError("MiniMax image generation timed out", 504, "GENERATION_TIMEOUT");
    }
    if (e.code && e.status) throw e;
    throw minimaxError(`MiniMax request failed: ${e.message}`, 502, "MINIMAX_NETWORK_FAILED");
  }
}
