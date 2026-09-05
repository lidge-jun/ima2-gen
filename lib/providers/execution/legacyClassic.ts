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

type ClassicRequest = Extract<LegacyExecutionRequest, { surface: "classic" }>;

function captureClassicRequest(request: ClassicRequest) {
  const { provider: activeProvider, prompt: generationPrompt, requestId, background: backgroundParams } = request;
  const { model: imageModel, quality, size: effectiveSize } = request.options;
  return { activeProvider, generationPrompt, requestId, backgroundParams, imageModel, quality, effectiveSize };
}

async function executeLegacyClassic(
  ctx: RuntimeContext, request: ClassicRequest, progress: ExecutionProgress,
  captured: ReturnType<typeof captureClassicRequest>,
): Promise<SingleImageExecutionResult> {
  try {
    const { activeProvider, generationPrompt, requestId, backgroundParams, imageModel, quality, effectiveSize } = captured;
    if (activeProvider === "atlascloud") {
      return await generateViaAtlasCloud(generationPrompt, requireRuntimeContext(ctx), {
        model: imageModel, size: effectiveSize, quality, signal: request.signal,
        requestId, references: request.references,
        ...(backgroundParams ? { background: backgroundParams.background } : {}),
        // The caller's resolveImageBackgroundParams validates this alpha-only format.
        ...(backgroundParams?.outputFormat ? { outputFormat: backgroundParams.outputFormat as ImageBackgroundParams["outputFormat"] } : {}),
      });
    }
    if (activeProvider === "minimax") {
      return await generateViaMinimax(generationPrompt, requireRuntimeContext(ctx), {
        model: imageModel, size: effectiveSize, signal: request.signal,
        requestId, references: request.references,
      });
    }
    if (activeProvider === "nai") {
      // Text-to-image only: the caller already refused references.
      return await generateViaNai(generationPrompt, requireRuntimeContext(ctx), {
        model: imageModel, size: effectiveSize, signal: request.signal, requestId,
        // Reuse the same normalized options as node and multimode.
        ...request.nai,
      });
    }
    if (activeProvider === "comfy") {
      return await generateViaComfy(generationPrompt, requireRuntimeContext(ctx), {
        model: imageModel, size: effectiveSize, signal: request.signal,
        requestId, references: request.references,
        ...request.comfy, onQueue: progress.onQueue,
      });
    }
    throw new Error(`Unsupported classic execution provider: ${activeProvider}`);
  } catch (error) { throw error; }
}

export async function prepareLegacyClassic(
  ctx: RuntimeContext, request: ClassicRequest, progress: ExecutionProgress = {},
): Promise<PreparedImageExecution<"classic">> {
  try {
    // Preserve scalar/background capture; ctx, refs, signal and lane options stay live.
    const captured = captureClassicRequest(request);
    return { execute: async () => {
      try {
        return { kind: "single", value: await executeLegacyClassic(ctx, request, progress, captured) };
      } catch (error) { throw error; } // Caller owns lifecycle and the existing error envelope.
    } };
  } catch (error) { throw error; }
}
