import {
  normalizeVideoAspectRatio,
  normalizeVideoDuration,
  normalizeVideoResolution,
  type VideoAspectRatio,
  type VideoResolution,
} from "./imageModels.js";

export type VideoGenerationMode = "text-to-video" | "image-to-video" | "reference-to-video";

/**
 * The shape every generate surface (UI store, CLI, agent runtime, HTTP route) agrees on.
 *
 * Extend/edit are deliberately NOT modelled here: `/api/video/extend` and
 * `/api/video/edit` carry `videoUrl` / `operation` / `sourceVideoId` instead, and folding
 * them in would make every field optional — a type that guarantees nothing.
 */
export type VideoGenerationRequest = {
  prompt: string;
  provider?: string | undefined;
  model?: string | undefined;
  mode: VideoGenerationMode;
  sourceImage?: string | undefined;
  sourceFilename?: string | undefined;
  /**
   * Stable reference to the source asset. Preferred over `sourceFilename`, which stops
   * identifying anything once the file is moved or renamed. Both may be present during
   * migration; the resolver takes the id first (lib/assetRef.ts).
   */
  sourceAssetId?: string | undefined;
  referenceImages?: string[] | undefined;
  referenceFilenames?: string[] | undefined;
  continueFromVideo?: string | undefined;
  duration: number;
  resolution: VideoResolution;
  aspectRatio: VideoAspectRatio;
  topic?: string | undefined;
  storyboard?: boolean | undefined;
  plannerModel?: string | undefined;
  presetIds?: string[] | undefined;
  elementIds?: string[] | undefined;
  requestId?: string | undefined;
};

/**
 * Input is intentionally loose: callers pass raw values straight from HTTP bodies, CLI
 * flags or LLM plans. Validation is this module's job, so the strict literal types belong
 * on the OUTPUT, not on what callers must produce.
 */
export type VideoGenerationRequestInput =
  Partial<Omit<VideoGenerationRequest, "prompt" | "duration" | "resolution" | "aspectRatio" | "mode">>
  & {
    prompt?: unknown | undefined;
    mode?: VideoGenerationMode | undefined;
    duration?: unknown | undefined;
    resolution?: unknown | undefined;
    aspectRatio?: unknown | undefined;
  };

export type VideoGenerationNormalizeError = {
  error: string;
  code: string;
  status: number;
};

export type VideoGenerationNormalizeResult =
  | { request: VideoGenerationRequest }
  | VideoGenerationNormalizeError;

export function isVideoGenerationError(
  result: VideoGenerationNormalizeResult,
): result is VideoGenerationNormalizeError {
  return "error" in result;
}

/**
 * Derive the mode from what the caller actually supplied.
 *
 * Each surface used to compute this independently, which is how the agent path ended up
 * supporting a different subset than the HTTP route.
 */
export function deriveVideoMode(input: {
  sourceImage?: unknown | undefined;
  sourceFilename?: unknown | undefined;
  sourceAssetId?: unknown | undefined;
  referenceImages?: unknown | undefined;
  referenceFilenames?: unknown | undefined;
}): VideoGenerationMode {
  if (input.sourceImage || input.sourceFilename || input.sourceAssetId) return "image-to-video";
  const refs =
    (Array.isArray(input.referenceImages) ? input.referenceImages.length : 0)
    + (Array.isArray(input.referenceFilenames) ? input.referenceFilenames.length : 0);
  return refs > 0 ? "reference-to-video" : "text-to-video";
}

/**
 * Validate and fill in one generate request, so every surface lands on the same defaults.
 *
 * `sourceImage` and `sourceFilename` are mutually exclusive: the server only consumes one
 * of them, so accepting both means silently ignoring the other. That is a bug the caller
 * should hear about, not a preference to resolve.
 */
/**
 * The shared normalizers return `{ value }` or `{ error, code, status }` as one loose
 * object shape rather than a discriminated union, so narrow explicitly.
 */
function asError(result: { error?: string; code?: string; status?: number }): VideoGenerationNormalizeError | null {
  return result.error
    ? { error: result.error, code: result.code ?? "INVALID_VIDEO_REQUEST", status: result.status ?? 400 }
    : null;
}

export function normalizeVideoGenerationRequest(
  input: VideoGenerationRequestInput,
): VideoGenerationNormalizeResult {
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  if (!prompt) {
    return { error: "prompt is required", code: "GROK_VIDEO_INVALID_PROMPT", status: 400 };
  }

  if (input.sourceImage && input.sourceFilename) {
    return {
      error: "sourceImage and sourceFilename are mutually exclusive",
      code: "VIDEO_SOURCE_CONFLICT",
      status: 400,
    };
  }

  const duration = normalizeVideoDuration(input.duration);
  const durationError = asError(duration);
  if (durationError) return durationError;
  const resolution = normalizeVideoResolution(input.resolution);
  const resolutionError = asError(resolution);
  if (resolutionError) return resolutionError;
  const aspectRatio = normalizeVideoAspectRatio(input.aspectRatio);
  const aspectError = asError(aspectRatio);
  if (aspectError) return aspectError;

  return {
    request: {
      prompt,
      mode: input.mode ?? deriveVideoMode(input),
      duration: duration.duration as number,
      resolution: resolution.resolution as VideoResolution,
      aspectRatio: aspectRatio.aspectRatio as VideoAspectRatio,
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.model ? { model: input.model } : {}),
      ...(input.sourceImage ? { sourceImage: input.sourceImage } : {}),
      ...(input.sourceFilename ? { sourceFilename: input.sourceFilename } : {}),
      ...(input.sourceAssetId ? { sourceAssetId: input.sourceAssetId } : {}),
      ...(input.referenceImages?.length ? { referenceImages: input.referenceImages } : {}),
      ...(input.referenceFilenames?.length ? { referenceFilenames: input.referenceFilenames } : {}),
      ...(input.continueFromVideo ? { continueFromVideo: input.continueFromVideo } : {}),
      ...(input.topic ? { topic: input.topic } : {}),
      ...(input.storyboard ? { storyboard: true } : {}),
      ...(input.plannerModel ? { plannerModel: input.plannerModel } : {}),
      ...(input.presetIds?.length ? { presetIds: input.presetIds } : {}),
      ...(input.elementIds?.length ? { elementIds: input.elementIds } : {}),
      ...(input.requestId ? { requestId: input.requestId } : {}),
    },
  };
}
