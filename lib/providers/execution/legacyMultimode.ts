import type { RuntimeContext } from "../../runtimeContext.js";
import { generateViaAgy } from "../../agyImageAdapter.js";
import { generateViaGeminiApi } from "../../geminiApiImageAdapter.js";
import { generateViaAtlasCloud } from "../../atlasCloudImageAdapter.js";
import { generateViaMinimax } from "../../minimaxImageAdapter.js";
import { generateViaNai } from "../../naiImageAdapter.js";
import type { ExecutionProgress, PreparedImageExecution, SequenceImageExecutionResult } from "./types.js";
import type { LegacyExecutionRequest } from "./legacy.js";

type MultimodeRequest = Extract<LegacyExecutionRequest, { surface: "multimode" }>;

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
  ctx: RuntimeContext, request: MultimodeRequest, _progress: ExecutionProgress,
): Promise<SequenceImageExecutionResult> {
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
