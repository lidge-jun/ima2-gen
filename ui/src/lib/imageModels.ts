import type { ImageModel, OpenAIImageModel, GeminiImageModel, AtlasCloudImageModel, MinimaxImageModel, Provider, UnsupportedImageModel, VideoModel } from "../types";
import { PROVIDER_MODELS } from "../generated/providers";

export const DEFAULT_IMAGE_MODEL: ImageModel = "gpt-5.6-luna";
export const IMAGE_MODEL_STORAGE_KEY = "ima2.imageModel";

export const IMAGE_MODEL_OPTIONS: Array<{
  value: ImageModel;
  shortLabel: string;
  fullLabelKey: string;
  providerHint?: Provider;
}> = [
  { value: "gpt-5.6-luna", shortLabel: "5.6l", fullLabelKey: "settings.imageModel.gpt56Luna" },
  { value: "gpt-5.6-terra", shortLabel: "5.6t", fullLabelKey: "settings.imageModel.gpt56Terra" },
  { value: "gpt-5.6-sol", shortLabel: "5.6s", fullLabelKey: "settings.imageModel.gpt56Sol" },
  { value: "gpt-5.5", shortLabel: "5.5", fullLabelKey: "settings.imageModel.gpt55" },
  { value: "gpt-5.4", shortLabel: "5.4", fullLabelKey: "settings.imageModel.gpt54" },
  { value: "gpt-5.4-mini", shortLabel: "5.4m", fullLabelKey: "settings.imageModel.gpt54Mini" },
  { value: "grok-imagine-image-2.0", shortLabel: "grok2", fullLabelKey: "settings.imageModel.grokImagine20" },
  { value: "grok-imagine-image-quality", shortLabel: "grok+", fullLabelKey: "settings.imageModel.grokImagineQuality" },
  { value: "grok-imagine-image", shortLabel: "grok", fullLabelKey: "settings.imageModel.grokImagine" },
  { value: "nano-banana-2", shortLabel: "nb2 agy", fullLabelKey: "settings.imageModel.nanoBanana2", providerHint: "agy" },
  { value: "nano-banana-2", shortLabel: "nb2 api", fullLabelKey: "settings.imageModel.nanoBanana2Api", providerHint: "gemini-api" },
  { value: "nano-banana-pro", shortLabel: "nbp api", fullLabelKey: "settings.imageModel.nanoBananaPro", providerHint: "gemini-api" },
  { value: "openai/gpt-image-2/text-to-image", shortLabel: "atlas", fullLabelKey: "settings.imageModel.atlasCloudGptImage2", providerHint: "atlascloud" },
  { value: "openai/gpt-image-2/edit", shortLabel: "atlas edit", fullLabelKey: "settings.imageModel.atlasCloudGptImage2Edit", providerHint: "atlascloud" },
  { value: "image-01", shortLabel: "minimax", fullLabelKey: "settings.imageModel.minimaxImage01", providerHint: "minimax" },
  { value: "image-01-live", shortLabel: "minimax live", fullLabelKey: "settings.imageModel.minimaxImage01Live", providerHint: "minimax" },
];

const GEMINI_MODEL_VALUES = new Set<string>(PROVIDER_MODELS["gemini-api"].image);
const ATLASCLOUD_MODEL_VALUES = new Set<string>(PROVIDER_MODELS.atlascloud.image);
const MINIMAX_MODEL_VALUES = new Set<string>(PROVIDER_MODELS.minimax.image);

export const OPENAI_IMAGE_MODEL_OPTIONS = IMAGE_MODEL_OPTIONS.filter(
  (option): option is { value: OpenAIImageModel; shortLabel: string; fullLabelKey: string } =>
    !option.value.startsWith("grok-")
    && !GEMINI_MODEL_VALUES.has(option.value)
    && !ATLASCLOUD_MODEL_VALUES.has(option.value)
    && !MINIMAX_MODEL_VALUES.has(option.value),
);

export const GROK_IMAGE_MODEL_OPTIONS = IMAGE_MODEL_OPTIONS.filter((option) =>
  option.value.startsWith("grok-"),
);

export const GEMINI_IMAGE_MODEL_OPTIONS = IMAGE_MODEL_OPTIONS.filter(
  (option): option is { value: GeminiImageModel; shortLabel: string; fullLabelKey: string; providerHint?: Provider } =>
    GEMINI_MODEL_VALUES.has(option.value),
);

export const ATLASCLOUD_IMAGE_MODEL_OPTIONS = IMAGE_MODEL_OPTIONS.filter(
  (option): option is { value: AtlasCloudImageModel; shortLabel: string; fullLabelKey: string; providerHint?: Provider } =>
    ATLASCLOUD_MODEL_VALUES.has(option.value),
);

export const MINIMAX_IMAGE_MODEL_OPTIONS = IMAGE_MODEL_OPTIONS.filter(
  (option): option is { value: MinimaxImageModel; shortLabel: string; fullLabelKey: string; providerHint?: Provider } =>
    MINIMAX_MODEL_VALUES.has(option.value),
);

export const UNSUPPORTED_IMAGE_MODELS: Array<{
  value: UnsupportedImageModel;
  fullLabelKey: string;
}> = [
  { value: "gpt-5.3-codex-spark", fullLabelKey: "settings.imageModel.gpt53CodexSpark" },
];

export function isImageModel(value: unknown): value is ImageModel {
  return IMAGE_MODEL_OPTIONS.some((option) => option.value === value);
}

export function isGrokImageModel(value: unknown): boolean {
  return typeof value === "string" && value.startsWith("grok-");
}

export function isGeminiImageModel(value: unknown): boolean {
  return typeof value === "string" && GEMINI_MODEL_VALUES.has(value);
}

export function isAtlasCloudImageModel(value: unknown): boolean {
  return typeof value === "string" && ATLASCLOUD_MODEL_VALUES.has(value);
}

export function isMinimaxImageModel(value: unknown): boolean {
  return typeof value === "string" && MINIMAX_MODEL_VALUES.has(value);
}

export function getImageModelOptionsForProvider(provider: Provider) {
  if (provider === "grok" || provider === "grok-api") return GROK_IMAGE_MODEL_OPTIONS;
  if (provider === "agy" || provider === "gemini-api") return GEMINI_IMAGE_MODEL_OPTIONS;
  if (provider === "atlascloud") return ATLASCLOUD_IMAGE_MODEL_OPTIONS;
  if (provider === "minimax") return MINIMAX_IMAGE_MODEL_OPTIONS;
  return OPENAI_IMAGE_MODEL_OPTIONS;
}

export function getImageModelShortLabel(value: string | null | undefined, provider?: string | null): string | null {
  if (!value) return null;
  if (GEMINI_MODEL_VALUES.has(value)) {
    const suffix = provider === "gemini-api" ? "gemini-api" : provider === "agy" ? "agy" : provider || "agy";
    return `${value} ${suffix}`;
  }
  if (ATLASCLOUD_MODEL_VALUES.has(value)) return provider === "atlascloud" ? "gpt-image-2 atlas" : value;
  if (MINIMAX_MODEL_VALUES.has(value)) return provider === "minimax" ? `${value} minimax` : value;
  return IMAGE_MODEL_OPTIONS.find((option) => option.value === value)?.shortLabel ?? value;
}

// ── Grok video model (separate kind from image models) ───────────────────
export const GROK_VIDEO_MODEL_BASE = "grok-imagine-video";
export const GROK_VIDEO_MODEL_15 = "grok-imagine-video-1.5";
export const GROK_VIDEO_MODEL_15_PREVIEW_ALIAS = "grok-imagine-video-1.5-preview";

export const VIDEO_MODEL_OPTIONS: Array<{ value: VideoModel; shortLabel: string; fullLabelKey: string }> = [
  { value: GROK_VIDEO_MODEL_BASE, shortLabel: "grokv", fullLabelKey: "settings.videoModel.grokImagine" },
  { value: GROK_VIDEO_MODEL_15, shortLabel: "grokv1.5", fullLabelKey: "settings.videoModel.grokImagine15" },
];

export function isVideoModelValue(v: unknown): v is VideoModel {
  return v === GROK_VIDEO_MODEL_BASE || v === GROK_VIDEO_MODEL_15 || v === GROK_VIDEO_MODEL_15_PREVIEW_ALIAS;
}

export function normalizeVideoModelValue(v: unknown): VideoModel | false {
  if (!isVideoModelValue(v)) return false;
  return v === GROK_VIDEO_MODEL_15_PREVIEW_ALIAS ? GROK_VIDEO_MODEL_15 : v;
}

// Tray attachments are references at any count, matching what the composer sends and
// what the server derives from the slot. A first frame comes from a node/continuity
// chain instead, not from the reference tray.
export function deriveVideoModeUI(refCount: number): "text-to-video" | "image-to-video" | "reference-to-video" {
  if (refCount >= 1) return "reference-to-video";
  return "text-to-video";
}

export function supportsVideoResolutionUI(model: string | false, resolution: string, mode: string): boolean {
  if (resolution !== "1080p") return true;
  return model === GROK_VIDEO_MODEL_15 && (mode === "text-to-video" || mode === "image-to-video");
}
