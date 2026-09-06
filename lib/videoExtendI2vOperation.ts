import type { RouteRuntimeContext, RuntimeContext } from "./runtimeContext.js";
import type { GrokVideoEvent, GrokVideoGenerateResult, GrokVideoOptions } from "./grokVideoAdapter.js";
import type { persistVideoArtifact } from "./videoArtifactPersistence.js";
import { appendVideoContinuityEntry, lineageFromVideoMetadata } from "./videoContinuity.js";
import { deriveChildVideoLineage } from "./videoLineage.js";
import { invalidateHistoryIndex } from "./historyIndex.js";
import { finishJob, isJobCanceled, setJobPhase } from "./inflight.js";
import { makeGenerationCanceledError } from "./generationCancel.js";
import { publish } from "./eventBus.js";
import { publishJobEvent } from "./ssePublish.js";
import { errInfo } from "./errInfo.js";
import { codedVideoError as codedError, emitPhase, extractError, retryableData } from "./videoExtendedHelpers.js";
import { errorEnvelopeFields } from "./errors/envelope.js";

export type ParentMetadata = {
  provider?: unknown; model?: unknown;
  prompt?: unknown; userPrompt?: unknown; revisedPrompt?: unknown;
  presetIds?: unknown; motionPresetIds?: unknown;
  video?: { duration?: unknown; resolution?: unknown; aspectRatio?: unknown };
  videoLineage?: unknown; videoContinuity?: unknown; createdAt?: unknown;
};

type LastFrameI2vTask = {
  ctx: RuntimeContext;
  requestId: string; sourceVideoId: string; prompt: string; model: string;
  provider: "grok" | "grok-api"; duration: number;
  resolution: NonNullable<GrokVideoOptions["resolution"]>;
  aspectRatio: NonNullable<GrokVideoOptions["aspectRatio"]>;
  parent: ParentMetadata | null;
  motion: { ids: string[]; fragment: string };
  cancelController: AbortController;
  extractFrame: (dir: string, file: string, position: string, options: { signal: AbortSignal }) => Promise<string>;
  generateVideo: (prompt: string, ctx: RouteRuntimeContext, options: GrokVideoOptions) => Promise<GrokVideoGenerateResult>;
  persistArtifact: typeof persistVideoArtifact;
  createFilename: (ctx: RuntimeContext) => string;
};

// Approved relocation: keep the original operation body and ordering unchanged.
export async function runLastFrameI2v(task: LastFrameI2vTask): Promise<void> {
  const { ctx, requestId, sourceVideoId, prompt, model, provider, duration, resolution,
    aspectRatio, parent, motion, cancelController, extractFrame, generateVideo,
    persistArtifact, createFilename } = task;
  const startedAt = Date.now();
  let stage = "extracting-frame";
  try {
    emitPhase(requestId, stage);
    let sourceImage: string;
    try {
      sourceImage = await extractFrame(ctx.config.storage.generatedDir, sourceVideoId, "last", { signal: cancelController.signal });
    } catch (error) {
      throw extractError(error, cancelController.signal);
    }
    if (cancelController.signal.aborted) throw makeGenerationCanceledError();
    const parentContinuity = lineageFromVideoMetadata(sourceVideoId, parent);
    const onEvent = (event: GrokVideoEvent) => {
      setJobPhase(requestId, event.phase === "submitted" ? "streaming" : event.phase);
      publish(requestId, event.phase, {
        requestId,
        ...(event.phase === "submitted" ? { xaiVideoRequestId: event.xaiVideoRequestId, requestedModel: event.requestedModel, effectiveModel: event.effectiveModel, modelFallback: event.modelFallback ?? null } : {}),
        ...(event.phase === "progress" ? { progress: typeof event.progress === "number" ? event.progress / 100 : null, stalled: Boolean(event.stalled) } : {}),
      });
    };
    const compiledPrompt = motion.fragment ? `${prompt}\n\nCamera motion: ${motion.fragment}.` : prompt;
    const result = await generateVideo(compiledPrompt, ctx, {
      model, mode: "image-to-video", duration, resolution, aspectRatio,
      sourceImage, sourceMime: "image/png", signal: cancelController.signal,
      requestId, continuityLineage: parentContinuity,
      directApiKey: provider === "grok-api" ? ctx.xaiApiKey ?? undefined : undefined,
      onEvent,
    });
    if (cancelController.signal.aborted) throw makeGenerationCanceledError();
    stage = "persisting";
    emitPhase(requestId, stage);
    const filename = createFilename(ctx);
    const createdAt = Date.now();
    const videoLineage = deriveChildVideoLineage(filename, sourceVideoId, parent);
    const videoContinuity = appendVideoContinuityEntry(parentContinuity, { filename, userPrompt: prompt, revisedPrompt: result.revisedPrompt, createdAt });
    const elapsed = +((createdAt - startedAt) / 1000).toFixed(1);
    const video = { operation: "extend", mode: "image-to-video", sourceVideoId, sourceFrame: "last", duration: result.duration, resolution: result.resolution, aspectRatio: result.aspectRatio, xaiVideoRequestId: result.xaiVideoRequestId };
    const metadata = { kind: "video", mediaType: "video", providerUrl: result.url, requestId, prompt, userPrompt: prompt, revisedPrompt: result.revisedPrompt, motionPresetIds: motion.ids, provider, model: result.effectiveModel, createdAt, elapsed, usage: result.usage, webSearchCalls: result.webSearchCalls, video, videoLineage, videoContinuity };
    try {
      await persistArtifact(ctx.config.storage.generatedDir, filename, result.videoBuffer, metadata);
    } catch (error) {
      throw codedError(errInfo(error).message, 500, "VIDEO_PERSIST_FAILED");
    }
    invalidateHistoryIndex();
    const done = { requestId, filename, url: `/generated/${encodeURIComponent(filename)}`, providerUrl: result.url, mediaType: "video", provider, model: result.effectiveModel, prompt, userPrompt: prompt, revisedPrompt: result.revisedPrompt, createdAt, elapsed, usage: result.usage, webSearchCalls: result.webSearchCalls, video, videoLineage, videoContinuity };
    // finishJob BEFORE done (audit blocker B4): a done event must never be
    // followed by an error from a failing inflight-completion write.
    finishJob(requestId, { status: "completed", meta: { filename, xaiVideoRequestId: result.xaiVideoRequestId } });
    publishJobEvent(requestId, "done", done);
  } catch (error) {
    if (!isJobCanceled(requestId)) {
      const info = errInfo(error);
      // #151 stage 2: terminal failure carries the canonical envelope.
      publishJobEvent(requestId, "error", { requestId, error: info.message, code: info.code ?? "VIDEO_EXTEND_FAILED", status: info.status ?? 500, ...retryableData(error), ...errorEnvelopeFields(error) });
      finishJob(requestId, { status: "error", httpStatus: info.status ?? 500, errorCode: info.code ?? "VIDEO_EXTEND_FAILED", meta: { stage } });
    }
  }
}
