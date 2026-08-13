import type { normalizeComposerInsertedPrompts } from "./composerSnapshot.js";

export function normalizeMaxImages(value: unknown, maxGeneratedImages = 24): number {
  const max = Math.max(1, Math.trunc(Number(maxGeneratedImages) || 24));
  return Math.min(max, Math.max(1, Math.trunc(Number(value) || 1)));
}

export function sequenceStatus(returned: number, requested: number): "empty" | "partial" | "complete" {
  if (returned <= 0) return "empty";
  if (returned < requested) return "partial";
  return "complete";
}

export interface MultimodeImage {
  b64: string;
  revisedPrompt?: string | null | undefined;
  mime?: string | null | undefined;
  providerUrl?: string | undefined;
}

export type MultimodeRouteItem = {
  image: string;
  filename: string;
  providerUrl?: string;
  revisedPrompt: string | null;
  sequenceId: string;
  sequenceIndex: number;
  sequenceTotalRequested: number;
  sequenceTotalReturned: number;
  sequenceStatus: ReturnType<typeof sequenceStatus>;
};

export interface MultimodeRouteState {
  maxImages: number;
  sequenceId: string;
  startTime: number;
  activeProvider: string;
  quality: string;
  effectiveSize: string;
  moderation: string;
  imageModel: string | null;
  webSearchEnabled: boolean;
  promptMode: "auto" | "direct";
  qualityWarnings: unknown[];
  composerPrompt: string | null;
  composerInsertedPrompts: ReturnType<typeof normalizeComposerInsertedPrompts>;
}
