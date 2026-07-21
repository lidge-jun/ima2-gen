const FALLBACK_IMAGE_MODEL = "gpt-5.4-mini";
const VALID_IMAGE_MODELS = new Set(["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]);
const UNSUPPORTED_IMAGE_MODELS = new Set(["gpt-5.3-codex-spark"]);
const FALLBACK_REASONING_EFFORT = "none";
const VALID_REASONING_EFFORTS = new Set(["none", "low", "medium", "high", "xhigh", "max"]);
const GROK_FALLBACK_IMAGE_MODEL = "grok-imagine-image";
const VALID_GROK_IMAGE_MODELS = new Set(["grok-imagine-image", "grok-imagine-image-quality"]);
const GEMINI_API_FALLBACK_IMAGE_MODEL = "nano-banana-2";
const VALID_GEMINI_API_MODELS = new Set(["nano-banana-2", "nano-banana-pro"]);
const ATLASCLOUD_FALLBACK_IMAGE_MODEL = "openai/gpt-image-2/text-to-image";
const VALID_ATLASCLOUD_IMAGE_MODELS = new Set([
    "openai/gpt-image-2/text-to-image",
    "openai/gpt-image-2/edit",
]);
export function normalizeReasoningEffort(ctx, rawEffort) {
    const configured = ctx?.config?.imageModels;
    const fallback = configured?.reasoningEffort ?? FALLBACK_REASONING_EFFORT;
    const valid = configured?.validReasoningEfforts ?? VALID_REASONING_EFFORTS;
    if (typeof rawEffort !== "string" || rawEffort.length === 0) {
        return { effort: valid.has(fallback) ? fallback : FALLBACK_REASONING_EFFORT };
    }
    if (!valid.has(rawEffort)) {
        return {
            error: "reasoningEffort must be one of: none, low, medium, high, xhigh, max",
            code: "INVALID_REASONING_EFFORT",
            status: 400,
        };
    }
    return { effort: rawEffort };
}
export function normalizeImageModel(ctx, rawModel) {
    const configured = ctx?.config?.imageModels;
    const fallback = configured?.default ?? FALLBACK_IMAGE_MODEL;
    const valid = configured?.valid ?? VALID_IMAGE_MODELS;
    const unsupported = configured?.unsupported ?? UNSUPPORTED_IMAGE_MODELS;
    if (typeof rawModel !== "string" || rawModel.length === 0) {
        return { model: valid.has(fallback) ? fallback : FALLBACK_IMAGE_MODEL };
    }
    if (unsupported.has(rawModel)) {
        return {
            error: "model is listed by OAuth but does not support image_generation: gpt-5.3-codex-spark",
            code: "IMAGE_MODEL_UNSUPPORTED",
            status: 400,
        };
    }
    if (!valid.has(rawModel)) {
        return {
            error: "model must be one of: gpt-5.5, gpt-5.4, gpt-5.4-mini, gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna",
            code: "INVALID_IMAGE_MODEL",
            status: 400,
        };
    }
    return { model: rawModel };
}
export function normalizeGrokImageModel(rawModel) {
    if (typeof rawModel !== "string" || rawModel.length === 0) {
        return { model: GROK_FALLBACK_IMAGE_MODEL };
    }
    if (!VALID_GROK_IMAGE_MODELS.has(rawModel)) {
        return {
            error: `Grok image model must be one of: ${[...VALID_GROK_IMAGE_MODELS].join(", ")}`,
            code: "INVALID_GROK_IMAGE_MODEL",
            status: 400,
        };
    }
    return { model: rawModel };
}
export function normalizeGeminiApiModel(rawModel) {
    if (typeof rawModel !== "string" || rawModel.length === 0) {
        return { model: GEMINI_API_FALLBACK_IMAGE_MODEL };
    }
    if (!VALID_GEMINI_API_MODELS.has(rawModel)) {
        return {
            error: `Gemini API image model must be one of: ${[...VALID_GEMINI_API_MODELS].join(", ")}`,
            code: "INVALID_GEMINI_API_IMAGE_MODEL",
            status: 400,
        };
    }
    return { model: rawModel };
}
export function normalizeAtlasCloudImageModel(rawModel) {
    if (typeof rawModel !== "string" || rawModel.length === 0) {
        return { model: ATLASCLOUD_FALLBACK_IMAGE_MODEL };
    }
    if (!VALID_ATLASCLOUD_IMAGE_MODELS.has(rawModel)) {
        return {
            error: `Atlas Cloud image model must be one of: ${[...VALID_ATLASCLOUD_IMAGE_MODELS].join(", ")}`,
            code: "INVALID_ATLASCLOUD_IMAGE_MODEL",
            status: 400,
        };
    }
    return { model: rawModel };
}
// ── Grok video (T2V/I2V) ─────────────────────────────────────────────────
// Video is a separate generation kind, not an image model. Keep it out of the
// image model unions/helpers above so `grok-` image classification is unaffected.
export const GROK_VIDEO_MODEL_BASE = "grok-imagine-video";
export const GROK_VIDEO_MODEL_15 = "grok-imagine-video-1.5";
export const GROK_VIDEO_MODEL_15_PREVIEW_ALIAS = "grok-imagine-video-1.5-preview";
const GROK_FALLBACK_VIDEO_MODEL = GROK_VIDEO_MODEL_BASE;
export const VALID_GROK_VIDEO_MODELS = new Set([
    GROK_VIDEO_MODEL_BASE,
    GROK_VIDEO_MODEL_15,
    GROK_VIDEO_MODEL_15_PREVIEW_ALIAS,
]);
export const VALID_VIDEO_RESOLUTIONS = new Set(["480p", "720p", "1080p"]);
export const VALID_VIDEO_ASPECT_RATIOS = new Set([
    "1:1",
    "16:9",
    "9:16",
    "4:3",
    "3:4",
    "3:2",
    "2:3",
    "auto",
]);
export const MIN_VIDEO_DURATION = 1;
export const MAX_VIDEO_DURATION = 15;
// reference-to-video (xAI): up to 7 reference images, max 10s duration.
export const MAX_REF2V_REFERENCES = 7;
export const MAX_REF2V_DURATION = 10;
// Mode is derived purely from the number of attached reference images.
export function deriveVideoMode(refCount) {
    if (refCount >= 2)
        return "reference-to-video";
    if (refCount === 1)
        return "image-to-video";
    return "text-to-video";
}
// Clamp duration to the reference-to-video ceiling; other modes keep their value.
export function clampVideoDuration(duration, mode) {
    return mode === "reference-to-video" ? Math.min(duration, MAX_REF2V_DURATION) : duration;
}
export function isGrokVideoModel(value) {
    return typeof value === "string" && VALID_GROK_VIDEO_MODELS.has(value);
}
export function normalizeGrokVideoModel(rawModel) {
    if (typeof rawModel !== "string" || rawModel.length === 0) {
        return { model: GROK_FALLBACK_VIDEO_MODEL };
    }
    if (!VALID_GROK_VIDEO_MODELS.has(rawModel)) {
        return {
            error: `Grok video model must be one of: ${[...VALID_GROK_VIDEO_MODELS].join(", ")}`,
            code: "INVALID_GROK_VIDEO_MODEL",
            status: 400,
        };
    }
    return { model: rawModel === GROK_VIDEO_MODEL_15_PREVIEW_ALIAS ? GROK_VIDEO_MODEL_15 : rawModel };
}
export function normalizeVideoResolution(raw) {
    if (raw === undefined || raw === null || raw === "")
        return { resolution: "480p" };
    if (typeof raw !== "string" || !VALID_VIDEO_RESOLUTIONS.has(raw)) {
        return {
            error: `resolution must be one of: ${[...VALID_VIDEO_RESOLUTIONS].join(", ")}`,
            code: "INVALID_VIDEO_RESOLUTION",
            status: 400,
        };
    }
    return { resolution: raw };
}
export function usesGrokVideo15TextCanvasShim(model, mode) {
    const canonicalModel = model === GROK_VIDEO_MODEL_15_PREVIEW_ALIAS ? GROK_VIDEO_MODEL_15 : model;
    return canonicalModel === GROK_VIDEO_MODEL_15 && mode === "text-to-video";
}
export function validateVideoResolutionForRequest(model, resolution, mode, options = {}) {
    if (resolution !== "1080p")
        return { ok: true };
    const canonicalModel = model === GROK_VIDEO_MODEL_15_PREVIEW_ALIAS ? GROK_VIDEO_MODEL_15 : model;
    if (canonicalModel === GROK_VIDEO_MODEL_15 && mode === "image-to-video") {
        return { ok: true };
    }
    if (options.allowTextCanvasShim && usesGrokVideo15TextCanvasShim(canonicalModel, mode)) {
        return { ok: true };
    }
    return {
        error: "1080p video resolution requires grok-imagine-video-1.5 text-to-video with the canvas shim or image-to-video",
        code: "INVALID_VIDEO_RESOLUTION",
        status: 400,
    };
}
export function normalizeVideoAspectRatio(raw) {
    if (raw === undefined || raw === null || raw === "")
        return { aspectRatio: "auto" };
    if (typeof raw !== "string" || !VALID_VIDEO_ASPECT_RATIOS.has(raw)) {
        return {
            error: `aspectRatio must be one of: ${[...VALID_VIDEO_ASPECT_RATIOS].join(", ")}`,
            code: "INVALID_VIDEO_ASPECT_RATIO",
            status: 400,
        };
    }
    return { aspectRatio: raw };
}
export function normalizeVideoDuration(raw) {
    if (raw === undefined || raw === null || raw === "")
        return { duration: 5 };
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isInteger(n) || n < MIN_VIDEO_DURATION || n > MAX_VIDEO_DURATION) {
        return {
            error: `duration must be an integer between ${MIN_VIDEO_DURATION} and ${MAX_VIDEO_DURATION} seconds`,
            code: "INVALID_VIDEO_DURATION",
            status: 400,
        };
    }
    return { duration: n };
}
