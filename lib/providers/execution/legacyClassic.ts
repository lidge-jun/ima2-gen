import { generateViaAgy } from "../../agyImageAdapter.js";
import { generateViaGeminiApi } from "../../geminiApiImageAdapter.js";
import { generateViaAtlasCloud } from "../../atlasCloudImageAdapter.js";
import { generateViaMinimax } from "../../minimaxImageAdapter.js";
import { generateViaNai } from "../../naiImageAdapter.js";
import { generateViaComfy } from "../../comfyImageAdapter.js";
import { requireRuntimeContext, type RuntimeContext } from "../../runtimeContext.js";
import type { ImageBackgroundParams } from "../../imageBackgroundParam.js";
import type {
  ExecutionProgress, PreparedImageExecution, SingleImageExecutionResult,
} from "./types.js";
import type { LegacyExecutionRequest } from "./legacy.js";

export async function prepareLegacyClassic(
  ctx: RuntimeContext,
  request: Extract<LegacyExecutionRequest, { surface: "classic" }>,
  progress: ExecutionProgress = {},
): Promise<PreparedImageExecution<"classic">> {
  try {
    const { provider: activeProvider, prompt: generationPrompt, requestId, background: backgroundParams } = request;
    const { model: imageModel, quality, size: effectiveSize } = request.options;
    const generateOne = async (): Promise<SingleImageExecutionResult> => {
      if (activeProvider === "gemini-api") {
        const r = await generateViaGeminiApi(generationPrompt, requireRuntimeContext(ctx), {
          model: imageModel,
          size: effectiveSize,
          signal: request.signal,
          ...(requestId !== undefined ? { requestId } : {}),
          references: request.references,
        });
        return r;
      }
      if (activeProvider === "agy") {
        const r = await generateViaAgy(generationPrompt, {
          references: request.references,
          signal: request.signal,
          requestId,
        });
        return r;
      }
      if (activeProvider === "atlascloud") {
        const r = await generateViaAtlasCloud(generationPrompt, requireRuntimeContext(ctx), {
          model: imageModel,
          size: effectiveSize,
          quality,
          signal: request.signal,
          requestId,
          references: request.references,
          ...(backgroundParams ? { background: backgroundParams.background } : {}),
          // The caller's resolveImageBackgroundParams validates this alpha-only format.
          ...(backgroundParams?.outputFormat ? { outputFormat: backgroundParams.outputFormat as ImageBackgroundParams["outputFormat"] } : {}),
        });
        return r;
      }
      if (activeProvider === "minimax") {
        const r = await generateViaMinimax(generationPrompt, requireRuntimeContext(ctx), {
          model: imageModel,
          size: effectiveSize,
          signal: request.signal,
          requestId,
          references: request.references,
        });
        return r;
      }
      if (activeProvider === "nai") {
        // No references argument: the adapter is text-to-image only, and the
        // caller already refused any reference input rather than letting
        // it be silently discarded here.
        const r = await generateViaNai(generationPrompt, requireRuntimeContext(ctx), {
          model: imageModel,
          size: effectiveSize,
          signal: request.signal,
          requestId,
          // One normalizer for every request-driven lane: the multimode and
          // node branches spread the same call, so the three cannot drift.
          ...request.nai,
        });
        return r;
      }
      if (activeProvider === "comfy") {
        const r = await generateViaComfy(generationPrompt, requireRuntimeContext(ctx), {
          model: imageModel,
          size: effectiveSize,
          signal: request.signal,
          requestId,
          references: request.references,
          ...request.comfy,
          onQueue: progress.onQueue,
        });
        return r;
      }
      throw new Error(`Unsupported classic execution provider: ${activeProvider}`);
    };

    return { execute: async () => {
      try {
        return { kind: "single", value: await generateOne() };
      } catch (error) { throw error; } // Caller owns lifecycle and the existing error envelope.
    } };
  } catch (error) { throw error; }
}
