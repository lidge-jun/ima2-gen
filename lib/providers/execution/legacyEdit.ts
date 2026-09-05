import type { RuntimeContext } from "../../runtimeContext.js";
import { detectImageMimeFromB64 } from "../../refs.js";
import { generateViaAgy } from "../../agyImageAdapter.js";
import { generateViaGeminiApi } from "../../geminiApiImageAdapter.js";
import { generateViaAtlasCloud } from "../../atlasCloudImageAdapter.js";
import { generateViaMinimax } from "../../minimaxImageAdapter.js";
import { generateViaComfy } from "../../comfyImageAdapter.js";
import type { ExecutionProgress, PreparedImageExecution, SingleImageExecutionResult } from "./types.js";
import type { LegacyExecutionRequest } from "./legacy.js";

type EditRequest = Extract<LegacyExecutionRequest, { surface: "edit" }>;

function executeImageToImage(ctx: RuntimeContext, request: EditRequest) {
  const { provider, prompt, sourceImage, signal, requestId, options } = request;
  const references = [{ b64: sourceImage, declaredMime: null, detectedMime: detectImageMimeFromB64(sourceImage) || null }];
  const editPrompt = `Edit this image: ${prompt}`;
  const params = { model: options.model, size: options.size, signal, ...(requestId !== undefined ? { requestId } : {}), references };
  switch (provider) {
    case "gemini-api": return generateViaGeminiApi(editPrompt, ctx, params);
    case "agy": return generateViaAgy(editPrompt, { references, signal, requestId });
    case "atlascloud": return generateViaAtlasCloud(editPrompt, ctx, { ...params, quality: options.quality });
    case "minimax": return generateViaMinimax(editPrompt, ctx, params);
    // LoadImage binding owns i2i; missing workflow binding still refuses there.
    case "comfy": return generateViaComfy(editPrompt, ctx, params);
    default: throw new Error(`Unsupported legacy edit provider: ${provider}`);
  }
}

async function executeEdit(ctx: RuntimeContext, request: EditRequest): Promise<SingleImageExecutionResult> {
  return executeImageToImage(ctx, request);
}

export async function prepareLegacyEdit(
  ctx: RuntimeContext, request: EditRequest, _progress?: ExecutionProgress,
): Promise<PreparedImageExecution<"edit">> {
  return { execute: async () => {
    try { return { kind: "single", value: await executeEdit(ctx, request) }; }
    catch (error) { throw error; } // Route owns failure normalization and job cleanup.
  } };
}
