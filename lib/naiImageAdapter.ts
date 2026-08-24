// lib/naiImageAdapter.ts — NovelAI image-generation adapter.
//
// Calls POST {baseUrl}/ai/generate-image with a Bearer token. NovelAI answers
// with a ZIP archive containing the PNG rather than JSON, so the response path
// differs from every other lane: extract, then hand the shared pipeline the
// same { b64, mime } shape it already understands.
//
// Model ids, the V5 parameter names (straight_alpha / ucPresetId /
// qualityPresetId), and the sampler-gated fields are documented in
// devlog/_plan/260824_novelai_provider_lane/001_nai_api_surface.md.
import type { RuntimeContext } from "./runtimeContext.js";
import { detectImageMimeFromB64 } from "./refs.js";
import { logEvent } from "./logger.js";
import { extractFirstZipEntry, looksLikeZip } from "./naiZip.js";

export const NAI_DEFAULT_IMAGE_MODEL = "nai-diffusion-5-full";

const NAI_TIMEOUT_MS = 180_000;

/** Accepted by the V5 endpoint; the reference client offers exactly these. */
export const NAI_SAMPLERS = [
  "k_euler",
  "k_euler_ancestral",
  "k_dpmpp_2s_ancestral",
  "k_dpmpp_2m",
  "k_dpmpp_sde",
  "k_dpmpp_2m_sde",
  "ddim_v3",
] as const;

export const NAI_NOISE_SCHEDULES = ["native", "karras", "exponential", "polyexponential"] as const;

/** V5 replaces V4's numeric ucPreset with these string ids. */
export const NAI_UC_PRESET_IDS = ["heavy", "light", "furryFocus", "humanFocus", "none"] as const;

/** V5-only. */
export const NAI_QUALITY_PRESET_IDS = ["standard", "light", "none"] as const;

const DEFAULT_WIDTH = 832;
const DEFAULT_HEIGHT = 1216;

type NaiGenerateOptions = {
  model?: string | undefined;
  size?: string | undefined;
  signal?: AbortSignal | undefined;
  requestId?: string | undefined;
  negativePrompt?: string | undefined;
  steps?: number | undefined;
  scale?: number | undefined;
  sampler?: string | undefined;
  noiseSchedule?: string | undefined;
  seed?: number | undefined;
  /** V5 native alpha. Prompt tags like "transparent background" pair with it. */
  straightAlpha?: boolean | undefined;
  ucPresetId?: string | undefined;
  qualityPresetId?: string | undefined;
};

type NaiImageResult = {
  b64: string;
  revisedPrompt: string | null;
  usage: Record<string, number> | null;
  webSearchCalls: number;
  mime: string;
  providerUrl: string | null;
  /** Model actually sent upstream. */
  effectiveModel: string;
};

function naiError(message: string, status: number, code: string): Error {
  const err = new Error(message) as Error & { status?: number; code?: string; isOperational?: boolean };
  err.status = status;
  err.code = code;
  err.isOperational = true;
  return err;
}

/** NovelAI sizes are WxH strings; anything else falls back to the portrait default. */
function parseSize(size?: string): { width: number; height: number } {
  if (!size || size === "auto") return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  const match = size.match(/^(\d+)x(\d+)$/);
  if (!match) return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  return { width: Number(match[1]), height: Number(match[2]) };
}

/**
 * Errors arrive as JSON while success arrives as binary, so the body is read
 * defensively rather than assuming one shape.
 */
function describeError(raw: string): string {
  if (!raw) return "no response body";
  try {
    const parsed = JSON.parse(raw) as { message?: unknown; error?: unknown; statusCode?: unknown };
    const detail = parsed.message ?? parsed.error;
    if (typeof detail === "string" && detail) return detail;
  } catch {
    // Not JSON; fall through to the raw text.
  }
  return raw.slice(0, 200);
}

export async function generateViaNai(
  prompt: string,
  ctx: RuntimeContext,
  options: NaiGenerateOptions = {},
): Promise<NaiImageResult> {
  const apiKey = ctx.naiApiKey;
  if (!apiKey) {
    throw naiError("NovelAI API token not configured", 401, "NAI_API_KEY_MISSING");
  }

  const cfg = ctx.config.naiProvider;
  const model = options.model || cfg.defaultImageModel || NAI_DEFAULT_IMAGE_MODEL;
  const { width, height } = parseSize(options.size);
  const sampler = options.sampler || cfg.defaultSampler;
  const negativePrompt = options.negativePrompt ?? "";

  const parameters: Record<string, unknown> = {
    params_version: 3,
    width,
    height,
    scale: options.scale ?? cfg.defaultScale,
    sampler,
    steps: options.steps ?? cfg.defaultSteps,
    // Kept at 1: NovelAI's Opus free tier only covers single-image requests.
    n_samples: 1,
    ucPresetId: options.ucPresetId ?? "heavy",
    qualityPresetId: options.qualityPresetId ?? "standard",
    autoSmea: false,
    dynamic_thresholding: false,
    controlnet_strength: 1,
    legacy: false,
    legacy_v3_extend: false,
    legacy_uc: false,
    add_original_image: true,
    cfg_rescale: 0,
    noise_schedule: options.noiseSchedule || cfg.defaultNoiseSchedule,
    use_coords: false,
    normalize_reference_strength_multiple: true,
    inpaintImg2ImgStrength: 1,
    negative_prompt: negativePrompt,
    straight_alpha: options.straightAlpha === true,
    characterPrompts: [],
    v4_prompt: {
      caption: { base_caption: prompt, char_captions: [] },
      use_coords: false,
      use_order: true,
    },
    v4_negative_prompt: {
      caption: { base_caption: negativePrompt, char_captions: [] },
      legacy_uc: false,
    },
  };
  if (typeof options.seed === "number" && Number.isFinite(options.seed)) {
    parameters.seed = options.seed;
  }
  // Only this sampler carries the ancestral-noise switches, matching the
  // reference client; sending them unconditionally is not the documented shape.
  if (sampler === "k_euler_ancestral") {
    parameters.deliberate_euler_ancestral_bug = false;
    parameters.prefer_brownian = true;
  }

  const url = `${cfg.baseUrl.replace(/\/$/, "")}/ai/generate-image`;

  logEvent("nai", "generate:start", {
    requestId: options.requestId,
    model,
    width,
    height,
    straightAlpha: options.straightAlpha === true,
  });

  const timeoutSignal = AbortSignal.timeout(cfg.generationTimeoutMs || NAI_TIMEOUT_MS);
  const combinedSignal = options.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: prompt, model, action: "generate", parameters }),
    signal: combinedSignal,
  });

  // 201 is what the OpenAPI documents; working clients observe 200. Accept both.
  if (res.status !== 200 && res.status !== 201) {
    const detail = describeError(await res.text().catch(() => ""));
    if (res.status === 401) {
      throw naiError(`NovelAI rejected the token: ${detail}`, 401, "NAI_AUTH_FAILED");
    }
    if (res.status === 402) {
      throw naiError(
        `NovelAI requires an active subscription: ${detail}`,
        402,
        "NAI_SUBSCRIPTION_REQUIRED",
      );
    }
    if (res.status === 429) {
      throw naiError(`NovelAI rate limited: ${detail}`, 429, "NAI_RATE_LIMITED");
    }
    if (res.status === 400 || res.status === 409) {
      throw naiError(`NovelAI rejected the request: ${detail}`, res.status, "NAI_BAD_REQUEST");
    }
    throw naiError(`NovelAI generation failed (${res.status}): ${detail}`, 502, "NAI_UPSTREAM_ERROR");
  }

  const raw = Buffer.from(await res.arrayBuffer());
  if (raw.length === 0) {
    throw naiError("NovelAI returned an empty response", 502, "NAI_EMPTY_IMAGE");
  }
  // Branch on the container first: handing a JSON or msgpack body to the ZIP
  // parser can only ever report NAI_ZIP_INVALID, which hides the real cause.
  if (!looksLikeZip(raw)) {
    const contentType = res.headers.get("content-type") ?? "unknown";
    throw naiError(
      `NovelAI returned a non-ZIP body (content-type: ${contentType})`,
      502,
      "NAI_RESPONSE_NOT_ZIP",
    );
  }

  const png = extractFirstZipEntry(raw);
  const b64 = png.toString("base64");
  // Magic bytes are authoritative: downstream storage falls back to PNG for an
  // unknown MIME, so a mislabeled payload would be saved as a broken image.
  const detected = detectImageMimeFromB64(b64);
  if (detected !== "image/png") {
    throw naiError("NovelAI returned a non-PNG payload", 502, "NAI_IMAGE_INVALID");
  }

  logEvent("nai", "generate:done", { requestId: options.requestId, model, bytes: png.length });

  return {
    b64,
    revisedPrompt: null,
    usage: null,
    webSearchCalls: 0,
    mime: "image/png",
    providerUrl: null,
    effectiveModel: model,
  };
}
