// What the composer can accept depends on the mode the user is in, and the rules are
// not obvious: audio only reaches grok-imagine-video-1.5, video only reaches
// grok-imagine-video, and neither reaches the image lanes at all.
//
// This module exists because three surfaces (PromptComposer, Canvas, ImageNode) each
// filtered dropped files with their own `type.startsWith("image/")` check. Every one of
// them dropped a non-image silently, so a user who dragged an mp3 saw nothing happen and
// had no way to tell a rejection from a broken drag.
//
// devlog/_plan/260908_xai_imagine_spec_resync/030_wp35_gui_inputs.md

export type DropRejection =
  | "not-media"
  | "audio-needs-video-model"
  | "audio-needs-15"
  | "video-needs-base"
  | "video-single-only";

export interface SortedDrop {
  images: File[];
  audios: File[];
  videos: File[];
  rejected: Array<{ file: File; reason: DropRejection }>;
}

export interface DropContext {
  /** The selected video model id, or false when this is an image lane. */
  videoModelSelected: string | false;
}

const VIDEO_MODEL_BASE = "grok-imagine-video";
const VIDEO_MODEL_15 = "grok-imagine-video-1.5";
const VIDEO_15_ALIASES = new Set([
  VIDEO_MODEL_15,
  "grok-imagine-video-1.5-preview",
  "grok-imagine-video-1.5-2026-05-30",
]);

function isAudio(file: File): boolean {
  return file.type.startsWith("audio/");
}

function isVideo(file: File): boolean {
  // A .mp4 with an empty type happens on some platforms, and refusing it as "not media"
  // would be a worse answer than trying it: the route validates the real thing anyway.
  return file.type.startsWith("video/") || /\.mp4$/i.test(file.name);
}

/**
 * Sorts dropped files into the buckets the current mode can consume, and records a
 * reason for every file left out.
 *
 * The rejection reasons are a union rather than free text so the i18n files are forced
 * to carry a message for each one; a missing translation is then a type error instead of
 * a key string shown to the user.
 */
export function sortDroppedByKind(files: File[], context: DropContext): SortedDrop {
  const sorted: SortedDrop = { images: [], audios: [], videos: [], rejected: [] };
  const model = context.videoModelSelected;
  const is15 = typeof model === "string" && VIDEO_15_ALIASES.has(model);
  const isBase = model === VIDEO_MODEL_BASE;

  for (const file of files) {
    if (file.type.startsWith("image/")) {
      sorted.images.push(file);
      continue;
    }
    if (isAudio(file)) {
      // Preset voices are the supported path; an uploaded clip is gated to trusted
      // partners upstream. Both still require 1.5, which is the only model that
      // declares audio as an input modality.
      if (!model) sorted.rejected.push({ file, reason: "audio-needs-video-model" });
      else if (!is15) sorted.rejected.push({ file, reason: "audio-needs-15" });
      else sorted.audios.push(file);
      continue;
    }
    if (isVideo(file)) {
      // Editing and extending run on the base model; 1.5 answers 400 for both.
      if (!isBase) sorted.rejected.push({ file, reason: "video-needs-base" });
      // One source video per request: edits and extensions take a single input, and
      // silently using the first of several would hide which one was chosen.
      else if (sorted.videos.length > 0) sorted.rejected.push({ file, reason: "video-single-only" });
      else sorted.videos.push(file);
      continue;
    }
    sorted.rejected.push({ file, reason: "not-media" });
  }
  return sorted;
}

/**
 * The `accept` attribute for the file picker in the current mode.
 *
 * Kept in step with sortDroppedByKind so the picker cannot offer a file the drop handler
 * would then refuse.
 */
export function composerAcceptAttr(context: DropContext): string {
  const model = context.videoModelSelected;
  if (typeof model === "string" && VIDEO_15_ALIASES.has(model)) return "image/*,audio/*";
  if (model === VIDEO_MODEL_BASE) return "image/*,video/mp4";
  return "image/*";
}

