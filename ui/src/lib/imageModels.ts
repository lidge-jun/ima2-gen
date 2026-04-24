import type { ImageModel, UnsupportedImageModel } from "../types";

export const DEFAULT_IMAGE_MODEL: ImageModel = "gpt-5.4-mini";
export const IMAGE_MODEL_STORAGE_KEY = "ima2.imageModel";

export const IMAGE_MODEL_OPTIONS: Array<{
  value: ImageModel;
  shortLabel: string;
  fullLabelKey: string;
}> = [
  { value: "gpt-5.4-mini", shortLabel: "5.4m", fullLabelKey: "settings.imageModel.gpt54Mini" },
  { value: "gpt-5.4", shortLabel: "5.4", fullLabelKey: "settings.imageModel.gpt54" },
  { value: "gpt-5.5", shortLabel: "5.5", fullLabelKey: "settings.imageModel.gpt55" },
];

export const UNSUPPORTED_IMAGE_MODELS: Array<{
  value: UnsupportedImageModel;
  fullLabelKey: string;
}> = [
  { value: "gpt-5.3-codex-spark", fullLabelKey: "settings.imageModel.gpt53CodexSpark" },
];

export function isImageModel(value: unknown): value is ImageModel {
  return IMAGE_MODEL_OPTIONS.some((option) => option.value === value);
}

export function getImageModelShortLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return IMAGE_MODEL_OPTIONS.find((option) => option.value === value)?.shortLabel ?? value;
}
