import type { RuntimeContext } from "./runtimeContext.js";
import { detectImageMimeFromB64 } from "./refs.js";
import { logEvent } from "./logger.js";
import { deriveReferenceLimit } from "./providers/derive.js";

const ATLAS_BASE_URL = "https://api.atlascloud.ai/api/v1";
export const ATLASCLOUD_TEXT_TO_IMAGE_MODEL = "openai/gpt-image-2/text-to-image";
export const ATLASCLOUD_EDIT_MODEL = "openai/gpt-image-2/edit";

type AtlasReference = {
  b64: string;
  declaredMime?: string | null;
  detectedMime?: string | null;
};

type AtlasGenerateOptions = {
  model?: string;
  size?: string;
  quality?: string;
  outputFormat?: "jpeg" | "png";
  references?: AtlasReference[];
  signal?: AbortSignal;
  requestId?: string;
};

type AtlasImageResult = {
  b64: string;
  revisedPrompt?: string | null;
  usage: Record<string, number> | null;
  webSearchCalls: number;
  mime?: string;
  providerUrl?: string | null;
};

function atlasCloudError(message: string, status: number, code: string): Error {
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

function firstString(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstString(item);
      if (found) return found;
    }
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return firstString(obj.url)
      || firstString(obj.image)
      || firstString(obj.image_url)
      || firstString(obj.download_url)
      || firstString(obj.b64_json)
      || firstString(obj.base64)
      || firstString(obj.data);
  }
  return null;
}

function normalizeStatus(value: unknown): string {
  return String(value || "").toLowerCase();
}

async function uploadReference(apiKey: string, ref: AtlasReference, index: number, signal?: AbortSignal): Promise<string> {
  const mime = ref.detectedMime || ref.declaredMime || detectImageMimeFromB64(ref.b64) || "image/png";
  const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
  const bytes = Buffer.from(ref.b64, "base64");
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const form = new FormData();
  form.append("file", new Blob([arrayBuffer], { type: mime }), `reference-${index}.${ext}`);

  const res = await fetch(`${ATLAS_BASE_URL}/model/uploadMedia`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal,
  });
  const json = await readJson(res);
  if (!res.ok) {
    throw atlasCloudError(`Atlas Cloud media upload failed (${res.status})`, res.status, "ATLASCLOUD_UPLOAD_FAILED");
  }
  const url = firstString(json?.data) || firstString(json);
  if (!url || !url.startsWith("http")) {
    throw atlasCloudError("Atlas Cloud media upload did not return a URL", 502, "ATLASCLOUD_UPLOAD_NO_URL");
  }
  return url;
}

function predictionIdFrom(json: any): string | null {
  return firstString(json?.data?.id)
    || firstString(json?.data?.request_id)
    || firstString(json?.id)
    || firstString(json?.request_id);
}

async function submitGeneration(apiKey: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
  const res = await fetch(`${ATLAS_BASE_URL}/model/generateImage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
  const json = await readJson(res);
  if (!res.ok) {
    throw atlasCloudError(`Atlas Cloud image generation failed (${res.status})`, res.status, "ATLASCLOUD_GENERATE_FAILED");
  }
  const id = predictionIdFrom(json);
  if (!id) {
    throw atlasCloudError("Atlas Cloud image generation did not return a prediction id", 502, "ATLASCLOUD_NO_PREDICTION_ID");
  }
  return id;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw atlasCloudError("Generation canceled", 499, "GENERATION_CANCELED");
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(atlasCloudError("Generation canceled", 499, "GENERATION_CANCELED"));
    }, { once: true });
  });
}

async function fetchPrediction(apiKey: string, id: string, signal?: AbortSignal): Promise<any> {
  const headers = { Authorization: `Bearer ${apiKey}`, Accept: "application/json" };
  const primary = await fetch(`${ATLAS_BASE_URL}/model/result/${encodeURIComponent(id)}`, { headers, signal });
  if (primary.status !== 404) return readJson(primary);
  const fallback = await fetch(`${ATLAS_BASE_URL}/model/prediction/${encodeURIComponent(id)}`, { headers, signal });
  return readJson(fallback);
}

async function pollOutputUrl(apiKey: string, id: string, signal?: AbortSignal): Promise<string> {
  const deadline = Date.now() + 180_000;
  let lastStatus = "starting";
  while (Date.now() < deadline) {
    const json = await fetchPrediction(apiKey, id, signal);
    const data = json?.data || json;
    lastStatus = normalizeStatus(data?.status || json?.status);
    if (lastStatus === "failed" || lastStatus === "error" || lastStatus === "canceled") {
      throw atlasCloudError(`Atlas Cloud generation failed: ${data?.error || data?.message || lastStatus}`, 502, "ATLASCLOUD_GENERATION_FAILED");
    }
    const output = firstString(data?.outputs) || firstString(data?.output) || firstString(data?.result);
    if ((lastStatus === "completed" || lastStatus === "succeeded" || lastStatus === "success") && output) {
      return output;
    }
    await sleep(3000, signal);
  }
  throw atlasCloudError(`Atlas Cloud generation timed out (last status: ${lastStatus})`, 504, "GENERATION_TIMEOUT");
}

async function downloadOutput(output: string, signal?: AbortSignal): Promise<{ b64: string; mime?: string; url?: string | null }> {
  const dataUri = output.match(/^data:([^;]+);base64,(.+)$/);
  if (dataUri) return { b64: dataUri[2], mime: dataUri[1], url: null };
  if (/^[A-Za-z0-9+/=]+$/.test(output) && output.length > 100) {
    return { b64: output, mime: "image/png", url: null };
  }
  const res = await fetch(output, { signal });
  if (!res.ok) {
    throw atlasCloudError(`Atlas Cloud output download failed (${res.status})`, 502, "ATLASCLOUD_OUTPUT_DOWNLOAD_FAILED");
  }
  const mime = res.headers.get("content-type") || undefined;
  const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
  return { b64, mime, url: output };
}

export async function generateViaAtlasCloud(
  prompt: string,
  ctx: RuntimeContext,
  options: AtlasGenerateOptions = {},
): Promise<AtlasImageResult> {
  const apiKey = ctx.atlasCloudApiKey;
  if (!apiKey) {
    throw atlasCloudError("Atlas Cloud API key not configured", 401, "ATLASCLOUD_API_KEY_MISSING");
  }
  const references = options.references?.filter((ref) => ref.b64) || [];
  if (references.length > deriveReferenceLimit("atlascloud", "edit")!) {
    throw atlasCloudError(`Atlas Cloud image editing supports up to ${deriveReferenceLimit("atlascloud", "edit")} reference images`, 400, "ATLASCLOUD_REF_TOO_MANY");
  }
  const model = references.length > 0 ? ATLASCLOUD_EDIT_MODEL : (options.model || ATLASCLOUD_TEXT_TO_IMAGE_MODEL);
  const imageUrls = references.length
    ? await Promise.all(references.map((ref, index) => uploadReference(apiKey, ref, index, options.signal)))
    : [];
  const body: Record<string, unknown> = {
    model,
    prompt,
    size: options.size || "1024x1024",
    quality: options.quality || "medium",
    output_format: options.outputFormat || "jpeg",
    enable_base64_output: false,
    enable_sync_mode: false,
  };
  if (imageUrls.length) body.images = imageUrls;

  logEvent("atlascloud", "generate:start", {
    requestId: options.requestId,
    model,
    size: body.size,
    refs: imageUrls.length,
  });
  const predictionId = await submitGeneration(apiKey, body, options.signal);
  const output = await pollOutputUrl(apiKey, predictionId, options.signal);
  const downloaded = await downloadOutput(output, options.signal);
  logEvent("atlascloud", "generate:done", {
    requestId: options.requestId,
    model,
    predictionId,
    bytes: Buffer.byteLength(downloaded.b64, "base64"),
  });
  return {
    b64: downloaded.b64,
    revisedPrompt: null,
    usage: null,
    webSearchCalls: 0,
    mime: downloaded.mime,
    providerUrl: downloaded.url,
  };
}
