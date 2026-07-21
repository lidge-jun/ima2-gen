import type { Provider, Quality, SizePreset, Format, Moderation, ImageModel, Count } from "../types";
import type { ReasoningEffort } from "../lib/reasoning";
import { DEFAULT_IMAGE_MODEL, isGrokImageModel, isGeminiImageModel, isAtlasCloudImageModel, normalizeVideoModelValue } from "../lib/imageModels";
import { parseRequestedCustomSide } from "../lib/size";
import { getEffectiveVideoSourceCount } from "../lib/videoSourceCount";
import {
  saveImageModel,
  saveReasoningEffort,
  saveWebSearchEnabled,
  saveVideoDefaults,
  saveGenerationDefaultsPatch,
  normalizeCount,
} from "./storePersistence";
import type { StoreSet, StoreGet } from "./storeTypes";

export function setProviderImpl(provider: Provider, set: StoreSet, get: StoreGet): void {
  saveGenerationDefaultsPatch({ provider });
  const currentModel = get().imageModel;
  const supportsVideo = provider === "grok" || provider === "grok-api";
  if (!supportsVideo && get().videoModelSelected) {
    set({ videoModelSelected: false });
    saveVideoDefaults({ model: false });
  }
  if ((provider === "grok" || provider === "grok-api") && !isGrokImageModel(currentModel)) {
    const grokModel = "grok-imagine-image";
    saveImageModel(grokModel);
    set({ provider, imageModel: grokModel });
  } else if ((provider === "agy" || provider === "gemini-api") && !isGeminiImageModel(currentModel)) {
    const geminiModel = provider === "gemini-api" ? "nano-banana-pro" : "nano-banana-2";
    saveImageModel(geminiModel);
    set({ provider, imageModel: geminiModel });
  } else if (provider === "atlascloud" && !isAtlasCloudImageModel(currentModel)) {
    const atlasModel = "openai/gpt-image-2/text-to-image";
    saveImageModel(atlasModel);
    set({ provider, imageModel: atlasModel });
  } else if (provider !== "grok" && provider !== "grok-api" && provider !== "agy" && provider !== "gemini-api" && provider !== "atlascloud" && (isGrokImageModel(currentModel) || isGeminiImageModel(currentModel) || isAtlasCloudImageModel(currentModel))) {
    set({ provider, imageModel: DEFAULT_IMAGE_MODEL });
    saveImageModel(DEFAULT_IMAGE_MODEL);
  } else {
    set({ provider });
  }
}

export function setQualityImpl(quality: Quality, set: StoreSet): void {
  saveGenerationDefaultsPatch({ quality });
  set({ quality });
}

export function setSizePresetImpl(sizePreset: SizePreset, set: StoreSet): void {
  saveGenerationDefaultsPatch({ sizePreset });
  set({ sizePreset });
}

export function setCustomSizeImpl(w: number, h: number, set: StoreSet, get: StoreGet): void {
  const customW = parseRequestedCustomSide(w, get().customW);
  const customH = parseRequestedCustomSide(h, get().customH);
  saveGenerationDefaultsPatch({ customW, customH });
  set({ customW, customH });
}

export function setGrokAspectRatioImpl(grokAspectRatio: string, set: StoreSet): void {
  saveGenerationDefaultsPatch({ grokAspectRatio } as any);
  set({ grokAspectRatio });
}

export function setGrokResolutionImpl(grokResolution: "1k" | "2k", set: StoreSet): void {
  saveGenerationDefaultsPatch({ grokResolution } as any);
  set({ grokResolution });
}

export function setFormatImpl(format: Format, set: StoreSet): void {
  saveGenerationDefaultsPatch({ format });
  set({ format });
}

export function setModerationImpl(moderation: Moderation, set: StoreSet): void {
  saveGenerationDefaultsPatch({ moderation });
  set({ moderation });
}

export function setImageModelImpl(imageModel: ImageModel, set: StoreSet, get: StoreGet): void {
  saveImageModel(imageModel);
  set({ videoModelSelected: false });
  saveVideoDefaults({ model: false });
  if (isGrokImageModel(imageModel)) {
    saveGenerationDefaultsPatch({ provider: "grok" });
    set({ provider: "grok", imageModel });
    return;
  }
  if (isGeminiImageModel(imageModel)) {
    const current = get().provider;
    if (current !== "agy" && current !== "gemini-api") {
      saveGenerationDefaultsPatch({ provider: "agy" });
      set({ provider: "agy", imageModel });
    } else {
      set({ imageModel });
    }
    return;
  }
  if (isAtlasCloudImageModel(imageModel)) {
    saveGenerationDefaultsPatch({ provider: "atlascloud" });
    set({ provider: "atlascloud", imageModel });
    return;
  }
  if (get().provider === "grok" || get().provider === "agy" || get().provider === "gemini-api" || get().provider === "atlascloud") {
    saveGenerationDefaultsPatch({ provider: "oauth" });
    set({ provider: "oauth", imageModel });
    return;
  }
  set({ imageModel });
}

export function selectVideoModelImpl(model: string | undefined, set: StoreSet, get: StoreGet): void {
  const m = normalizeVideoModelValue(model) || "grok-imagine-video";
  set({ videoModelSelected: m });
  saveVideoDefaults({ model: m });
  if (get().provider !== "grok") get().setProvider("grok");
}

export function activeVideoRefCountImpl(get: StoreGet): number {
  return getEffectiveVideoSourceCount(get());
}

export function setReasoningEffortImpl(reasoningEffort: ReasoningEffort, set: StoreSet): void {
  saveReasoningEffort(reasoningEffort);
  set({ reasoningEffort });
}

export function setWebSearchEnabledImpl(webSearchEnabled: boolean, set: StoreSet): void {
  saveWebSearchEnabled(webSearchEnabled);
  set({ webSearchEnabled });
}

export function setCountImpl(count: Count, set: StoreSet): void {
  const next = normalizeCount(count);
  saveGenerationDefaultsPatch({ count: next });
  set({ count: next });
}

export function setMultimodeImpl(enabled: boolean, set: StoreSet, get: StoreGet): void {
  if (enabled && get().uiMode !== "classic") return;
  saveGenerationDefaultsPatch({ multimode: enabled });
  const s = get();
  set({
    multimode: enabled,
    multimodeSequences: enabled ? s.multimodeSequences : {},
    multimodePreviewFlightId: enabled ? s.multimodePreviewFlightId : null,
  });
}

export function setMultimodeMaxImagesImpl(count: Count, set: StoreSet): void {
  const next = normalizeCount(count);
  saveGenerationDefaultsPatch({ multimodeMaxImages: next });
  set({ multimodeMaxImages: next });
}

export function setPromptModeImpl(promptMode: "auto" | "direct", set: StoreSet): void {
  saveGenerationDefaultsPatch({ promptMode });
  set({ promptMode });
}

export function setPromptImpl(prompt: string, set: StoreSet): void {
  saveGenerationDefaultsPatch({ prompt });
  set({ prompt });
}

export function getResolvedSizeImpl(get: StoreGet): string {
  const { provider, sizePreset, customW, customH, grokAspectRatio, grokResolution } = get();
  if (provider === "grok" || provider === "grok-api") {
    return `grok:${grokAspectRatio}:${grokResolution}`;
  }
  return sizePreset === "custom" ? `${customW}x${customH}` : sizePreset;
}
