import type { RuntimeContext } from "../../runtimeContext.js";
import { planGrokImage } from "../../grokImagePlanner.js";
import { resolveGrokQualityModel } from "../../imageModels.js";
import { toGrokReferences } from "../../nodeHelpers.js";
import { generateViaGrok, editViaGrok } from "./grokOperations.js";
import { generateMultimodeViaGrok } from "./grokMultimodeOperations.js";
import type {
  ExecutionProgress, ExecutionSurface, ImageExecutionRequest, PreparedImageExecution,
  SingleImageExecutionResult, SequenceImageExecutionResult,
} from "../execution/types.js";

export type GrokRequest = ImageExecutionRequest & { provider: "grok" | "grok-api" };

export function isGrokRequest(request: ImageExecutionRequest): request is GrokRequest {
  return request.provider === "grok" || request.provider === "grok-api";
}

async function prepareGrokClassic(
  ctx: RuntimeContext, request: Extract<GrokRequest, { surface: "classic" }>,
): Promise<PreparedImageExecution<"classic">> {
  const { provider: activeProvider, prompt: generationPrompt, requestId } = request;
  const { model: imageModel, quality, size: effectiveSize, webSearchEnabled } = request.options;
  const grokRefs = request.providerUrl
    ? [{ b64: "", url: request.providerUrl, declaredMime: "image/png", detectedMime: "image/png" }, ...request.references]
    : request.references;
  // Keep classic's once-per-batch key and shared plan capture before any image attempt.
  const grokDirectApiKey = activeProvider === "grok-api" ? ctx.xaiApiKey : undefined;
  const sharedGrokPlan = await planGrokImage(generationPrompt, ctx, {
    model: resolveGrokQualityModel(imageModel, quality),
    size: effectiveSize,
    signal: request.signal,
    requestId,
    referenceCount: grokRefs.length,
    references: grokRefs,
    directApiKey: grokDirectApiKey,
    backgroundConstraint: request.backgroundConstraint,
    webSearchEnabled,
  });
  return { execute: async () => {
    const grokModel = resolveGrokQualityModel(imageModel, quality);
    const value = await generateViaGrok(generationPrompt, ctx, {
      model: grokModel,
      size: effectiveSize,
      signal: request.signal,
      requestId,
      plannedPrompt: sharedGrokPlan?.prompt,
      webSearchCalls: sharedGrokPlan?.webSearchCalls,
      references: grokRefs,
      directApiKey: grokDirectApiKey,
    });
    return { kind: "single", value };
  } };
}

function prepareGrokNode(
  ctx: RuntimeContext, request: Extract<GrokRequest, { surface: "node" }>,
): PreparedImageExecution<"node"> {
  // The outer execution boundary checks current presence; retries retain this key.
  const grokDirectApiKey = request.provider === "grok-api" ? ctx.xaiApiKey : undefined;
  return { execute: async () => {
    return { kind: "single", value: await executeGrokNode(ctx, request, grokDirectApiKey) };
  } };
}

async function executeGrokNode(
  ctx: RuntimeContext, request: Extract<GrokRequest, { surface: "node" }>,
  grokDirectApiKey: string | undefined,
): Promise<SingleImageExecutionResult> {
  const { sourceImage: parentB64, prompt: generationPrompt, references, requestId, signal, options } = request;
  const { model, size, webSearchEnabled } = options;
  const refsForRequest = request.contextMode === "parent-only" ? [] : references;
  return await generateViaGrok(generationPrompt, ctx, {
    model, size, requestId, signal,
    references: toGrokReferences(parentB64, refsForRequest),
    directApiKey: grokDirectApiKey,
    webSearchEnabled,
  });
}

async function executeGrokEdit(
  ctx: RuntimeContext, request: Extract<GrokRequest, { surface: "edit" }>,
): Promise<SingleImageExecutionResult> {
  const { provider, rawPrompt, sourceImage, signal, requestId, options } = request;
  const directApiKey = provider === "grok-api" ? ctx.xaiApiKey : undefined;
  return await editViaGrok(rawPrompt, sourceImage, ctx, {
    model: resolveGrokQualityModel(options.model, options.quality),
    size: options.size, signal, requestId, directApiKey,
  });
}

async function executeGrokMultimode(
  ctx: RuntimeContext, request: Extract<GrokRequest, { surface: "multimode" }>,
  progress: ExecutionProgress,
): Promise<SequenceImageExecutionResult> {
  const { provider, prompt, references, signal, requestId, options, maxImages } = request;
  const directApiKey = provider === "grok-api" ? ctx.xaiApiKey : undefined;
  const grokRefs = request.providerUrl
    ? [{ b64: "", url: request.providerUrl }, ...references] : references;
  return await generateMultimodeViaGrok(prompt, ctx, {
    model: resolveGrokQualityModel(options.model, options.quality), maxImages,
    size: options.size, signal, requestId, references: grokRefs, directApiKey,
    onFinalImage: progress.onFinalImage,
    webSearchEnabled: options.webSearchEnabled,
  });
}

export function prepareGrokExecution<R extends GrokRequest>(
  ctx: RuntimeContext, request: R, progress?: ExecutionProgress,
): Promise<PreparedImageExecution<R["surface"]>>;
export async function prepareGrokExecution(
  ctx: RuntimeContext, request: GrokRequest, progress: ExecutionProgress = {},
): Promise<PreparedImageExecution<ExecutionSurface>> {
  switch (request.surface) {
    case "classic": return await prepareGrokClassic(ctx, request);
    case "node": return prepareGrokNode(ctx, request);
    case "edit": return { execute: async () => {
      return { kind: "single", value: await executeGrokEdit(ctx, request) };
    } };
    case "multimode": return { execute: async () => {
      return { kind: "sequence", value: await executeGrokMultimode(ctx, request, progress) };
    } };
  }
}
