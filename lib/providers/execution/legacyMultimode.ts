import type { RuntimeContext } from "../../runtimeContext.js";
import { generateMultimodeViaResponses } from "../../responsesImageAdapter.js";
import { generateMultimodeViaGrok } from "../../grokMultimodeAdapter.js";
import { resolveGrokQualityModel } from "../../imageModels.js";
import { generateViaAgy } from "../../agyImageAdapter.js";
import { generateViaGeminiApi } from "../../geminiApiImageAdapter.js";
import { generateViaAtlasCloud } from "../../atlasCloudImageAdapter.js";
import { generateViaMinimax } from "../../minimaxImageAdapter.js";
import { generateViaNai } from "../../naiImageAdapter.js";
import type { ExecutionProgress, ImageExecutionRequest, PreparedImageExecution, SequenceImageExecutionResult } from "./types.js";

type MultimodeRequest = Extract<ImageExecutionRequest, { surface: "multimode" }>;

function executeSingleLane(ctx: RuntimeContext, request: MultimodeRequest) {
  const { provider, prompt, rawPrompt, references, signal, requestId, options } = request;
  const params = { model: options.model, size: options.size, signal, ...(requestId !== undefined ? { requestId } : {}), references };
  switch (provider) {
    case "gemini-api": return generateViaGeminiApi(prompt, ctx, params);
    case "agy": return generateViaAgy(prompt, { references, signal, requestId });
    case "atlascloud": return generateViaAtlasCloud(rawPrompt, ctx, { ...params, quality: options.quality });
    case "minimax": return generateViaMinimax(rawPrompt, ctx, params);
    // Text-to-image only: no references; admission rejects them before startJob.
    case "nai": return generateViaNai(rawPrompt, ctx, {
      model: options.model, size: options.size, signal, requestId, ...request.nai,
    });
    default: throw new Error(`Unsupported legacy multimode provider: ${provider}`);
  }
}

async function executeSequence(
  ctx: RuntimeContext, request: MultimodeRequest, progress: ExecutionProgress,
): Promise<SequenceImageExecutionResult> {
  const { provider, prompt, references, signal, requestId, options, maxImages } = request;
  if (provider === "grok" || provider === "grok-api") {
    const directApiKey = provider === "grok-api" ? ctx.xaiApiKey : undefined;
    const grokRefs = request.providerUrl
      ? [{ b64: "", url: request.providerUrl }, ...references] : references;
    return generateMultimodeViaGrok(prompt, ctx, {
      model: resolveGrokQualityModel(options.model, options.quality), maxImages,
      size: options.size, signal, requestId, references: grokRefs, directApiKey,
      onFinalImage: progress.onFinalImage,
    });
  }
  if (provider === "api" || provider === "oauth") {
    return generateMultimodeViaResponses(
      provider, prompt, options.quality, options.size, options.moderation,
      references, requestId, options.mode, ctx,
      { model: options.model, maxImages, reasoningEffort: options.reasoningEffort,
        webSearchEnabled: options.webSearchEnabled,
        ...(progress.onPartialImage !== undefined ? { onPartialImage: progress.onPartialImage } : {}),
        ...(progress.onFinalImage !== undefined ? { onFinalImage: progress.onFinalImage } : {}), signal },
    );
  }
  const result = await executeSingleLane(ctx, request);
  // Preserve the old per-lane projection: downstream detects bytes, not MIME here.
  return {
    images: [{ b64: result.b64, ...(result.revisedPrompt !== undefined ? { revisedPrompt: result.revisedPrompt } : {}) }],
    usage: result.usage, webSearchCalls: result.webSearchCalls,
  };
}

export async function prepareLegacyMultimode(
  ctx: RuntimeContext, request: MultimodeRequest, progress: ExecutionProgress = {},
): Promise<PreparedImageExecution<"multimode">> {
  return { execute: async () => {
    try { return { kind: "sequence", value: await executeSequence(ctx, request, progress) }; }
    catch (error) { throw error; } // Preserve native errors; caller owns timeout recovery.
  } };
}
