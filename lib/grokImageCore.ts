import type { RouteRuntimeContext } from "./runtimeContext.js";
import { mapSizeToGrokImageParams } from "./grokSizeMapper.js";
import { detectImageMimeFromB64 } from "./refs.js";
import { getGrokProxyUrl } from "./grokRuntime.js";
import { grokFetchWithRetry } from "./grokUpstreamRetry.js";
import { DEFAULT_GROK_PLANNER_MODEL } from "../config.js";

export interface GrokImageResponse {
  data: Array<{
    b64_json?: string;
    url?: string;
    mime_type?: string;
    revised_prompt?: string;
  }>;
  usage?: { cost_in_usd_ticks?: number };
}

export interface GrokChatResponse {
  choices?: Array<{
    message?: {
      tool_calls?: Array<{
        type?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
}

export interface GrokResponsesResponse {
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
}

export interface GrokGenerateResult {
  b64: string;
  providerUrl?: string;
  revisedPrompt?: string;
  usage: Record<string, number> | null;
  webSearchCalls: number;
  mime?: string;
}

export interface GrokImagePlan {
  prompt: string;
  model: string;
  webSearchCalls: number;
}

export interface GrokSearchResult {
  summary: string;
}

export interface GrokReferenceImage {
  b64: string;
  url?: string;
  declaredMime?: string | null;
  detectedMime?: string | null;
}

export function getGrokEndpoint(ctx: RouteRuntimeContext, path = "/v1/images/generations", directApiKey?: string): { url: string; headers: Record<string, string> } {
  if (directApiKey) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return {
      url: `https://api.x.ai${normalizedPath}`,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${directApiKey}` },
    };
  }
  return {
    url: getGrokProxyUrl(ctx, path),
    headers: { "Content-Type": "application/json", Authorization: "Bearer dummy" },
  };
}

export function getGrokTimeout(ctx: RouteRuntimeContext): number {
  return (ctx.config as any).grokProvider?.generationTimeoutMs || 300_000;
}

export function grokError(message: string, status: number, code: string): Error {
  const err: any = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

export function grokStageError(stage: "search" | "planner", message: string, status: number): Error {
  const prefix = stage === "search" ? "GROK_SEARCH" : "GROK_PLANNER";
  if (status === 429) return grokError(`${stage} rate limited: ${message}`, 429, "GROK_RATE_LIMITED");
  if (status === 401 || status === 403) return grokError(`${stage} auth failed: ${message}`, 502, "GROK_AUTH_FAILED");
  if (status >= 500) return grokError(`${stage} upstream error: ${message}`, 502, "GROK_UPSTREAM_ERROR");
  return grokError(`Grok ${stage} bad request: ${message}`, status, `${prefix}_BAD_REQUEST`);
}

export function getPlannerConfig(ctx: RouteRuntimeContext): { model: string; timeoutMs: number } {
  const grokCfg = (ctx.config as any).grokProvider || {};
  return {
    model: grokCfg.plannerModel || DEFAULT_GROK_PLANNER_MODEL,
    timeoutMs: grokCfg.plannerTimeoutMs || 300_000,
  };
}

export function withTimeoutSignal(signal: AbortSignal | undefined, timeoutMs: number) {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
  const combinedSignal = signal ? AbortSignal.any([signal, timeoutController.signal]) : timeoutController.signal;
  return { combinedSignal, timer };
}

export function imagePayload(model: string, prompt: string, size: string | undefined): Record<string, unknown> {
  return { model, prompt, n: 1, response_format: "url", ...mapSizeToGrokImageParams(size) };
}

export function referenceImageUrl(ref: GrokReferenceImage): string {
  if (ref.url) return ref.url;
  const inputMime = ref.declaredMime || ref.detectedMime || detectImageMimeFromB64(ref.b64) || "image/png";
  return ref.b64.startsWith("data:") ? ref.b64 : `data:${inputMime};base64,${ref.b64}`;
}

export function imageEditPayload(
  model: string,
  prompt: string,
  references: GrokReferenceImage[],
  size: string | undefined,
): Record<string, unknown> {
  const sourceImages = references.map((ref) => ({ type: "image_url", url: referenceImageUrl(ref) }));
  return { model, prompt, n: 1, response_format: "url", ...(sourceImages.length === 1 ? { image: sourceImages[0] } : { images: sourceImages }), ...mapSizeToGrokImageParams(size) };
}

export function extractResponsesText(response: GrokResponsesResponse): string {
  const chunks: string[] = [];
  for (const item of response.output || []) {
    if (item.type !== "message") continue;
    for (const content of item.content || []) {
      if (typeof content.text === "string" && content.text.trim()) chunks.push(content.text.trim());
    }
  }
  return chunks.join("\n\n").trim();
}

const MAX_IMAGE_DOWNLOAD_BYTES = 50 * 1024 * 1024;

export async function downloadGrokImageUrl(
  url: string,
  signal?: AbortSignal,
  timeoutMs = 30_000,
): Promise<{ buffer: Buffer; b64: string; mime: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw grokError("Image download URL must be HTTP(S)", 502, "GROK_IMAGE_DOWNLOAD_FAILED");
    }
    // Safe to replay: downloading a finished artifact creates nothing upstream.
    const res = await grokFetchWithRetry(
      () => fetch(url, { signal: combined }),
      { signal: combined, label: "image-download" },
    );
    if (!res.ok) throw grokError(`Image download failed: HTTP ${res.status}`, 502, "GROK_IMAGE_DOWNLOAD_FAILED");
    const contentLength = Number(res.headers.get("content-length") || "0");
    if (contentLength > MAX_IMAGE_DOWNLOAD_BYTES) {
      throw grokError("Image download exceeds 50MB limit", 502, "GROK_IMAGE_DOWNLOAD_FAILED");
    }
    if (!res.body) throw grokError("Image download had no response body", 502, "GROK_IMAGE_DOWNLOAD_FAILED");
    const chunks: Buffer[] = [];
    let total = 0;
    const reader = res.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_IMAGE_DOWNLOAD_BYTES) {
        await reader.cancel("download size limit exceeded").catch(() => {});
        controller.abort();
        throw grokError("Image download exceeds 50MB limit", 502, "GROK_IMAGE_DOWNLOAD_FAILED");
      }
      chunks.push(Buffer.from(value));
    }
    const buffer = Buffer.concat(chunks, total);
    clearTimeout(timer);
    if (buffer.length === 0) throw grokError("Image download was empty", 502, "GROK_IMAGE_DOWNLOAD_FAILED");
    const mime = res.headers.get("content-type")?.split(";")[0]?.trim()
      || detectImageMimeFromB64(buffer.toString("base64"))
      || "image/png";
    return { buffer, b64: buffer.toString("base64"), mime };
  } catch (e: any) {
    clearTimeout(timer);
    if (e.name === "AbortError") {
      if (signal?.aborted) throw grokError("Generation canceled", 499, "GENERATION_CANCELED");
      throw grokError("Image download timed out", 504, "GROK_IMAGE_TIMEOUT");
    }
    if (e.code && e.status) throw e;
    throw grokError(`Image download failed: ${e.message}`, 502, "GROK_IMAGE_DOWNLOAD_FAILED");
  }
}

/**
 * NOT wrapped in grokFetchWithRetry on purpose: a reset or 5xx here may follow an image the
 * origin already generated and billed, and no idempotency key exists to deduplicate it.
 * Retrying would charge twice.
 * See devlog/_plan/260812_navrail_grok_autotag/020_grok_upstream_retry.md.
 */
export async function postGrokImages(
  ctx: RouteRuntimeContext,
  payload: Record<string, unknown>,
  signal?: AbortSignal,
  path = "/v1/images/generations",
  directApiKey?: string,
): Promise<GrokImageResponse> {
  const { url, headers } = getGrokEndpoint(ctx, path, directApiKey);
  const timeoutMs = getGrokTimeout(ctx);

  const { combinedSignal, timer } = withTimeoutSignal(signal, timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: combinedSignal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let parsed: any;
      try { parsed = JSON.parse(text); } catch { /* ignore */ }
      const msg = parsed?.error || text || `HTTP ${res.status}`;

      if (res.status === 429) throw grokError(`Grok rate limited: ${msg}`, 429, "GROK_RATE_LIMITED");
      if (res.status === 401 || res.status === 403) throw grokError(`Grok auth failed: ${msg}`, 502, "GROK_AUTH_FAILED");
      if (res.status >= 500) throw grokError(`Grok upstream error: ${msg}`, 502, "GROK_UPSTREAM_ERROR");
      throw grokError(`Grok bad request: ${msg}`, res.status, "GROK_BAD_REQUEST");
    }

    return await res.json() as GrokImageResponse;
  } catch (e: any) {
    clearTimeout(timer);
    if (e.name === "AbortError") {
      if (signal?.aborted) throw grokError("Generation canceled", 499, "GENERATION_CANCELED");
      throw grokError("Grok image generation timed out", 504, "GENERATION_TIMEOUT");
    }
    if (e.code && e.status) throw e;
    throw grokError(`Grok request failed: ${e.message}`, 502, "GROK_NETWORK_FAILED");
  }
}
