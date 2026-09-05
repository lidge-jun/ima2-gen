import { generateViaResponses } from "../../responsesImageAdapter.js";
import { generateViaGrok, planGrokImage } from "../../grokImageAdapter.js";
import { resolveGrokQualityModel } from "../../imageModels.js";
import { generateViaAgy } from "../../agyImageAdapter.js";
import { generateViaGeminiApi } from "../../geminiApiImageAdapter.js";
import { generateViaAtlasCloud } from "../../atlasCloudImageAdapter.js";
import { generateViaMinimax } from "../../minimaxImageAdapter.js";
import { generateViaNai } from "../../naiImageAdapter.js";
import { generateViaComfy } from "../../comfyImageAdapter.js";
import { isNonRetryableGenerationError, normalizeGenerationFailure, type UpstreamErr } from "../../generationErrors.js";
import { throwIfJobCanceled } from "../../generationCancel.js";
import { logEvent } from "../../logger.js";
import { requireRuntimeContext, type RuntimeContext } from "../../runtimeContext.js";
import type { ImageBackgroundParams } from "../../imageBackgroundParam.js";
import type {
  ExecutionProgress, ImageExecutionRequest, PreparedImageExecution, SingleImageExecutionResult,
} from "./types.js";

export async function prepareLegacyClassic(
  ctx: RuntimeContext,
  request: Extract<ImageExecutionRequest, { surface: "classic" }>,
  progress: ExecutionProgress = {},
): Promise<PreparedImageExecution<"classic">> {
  try {
    const { provider: activeProvider, prompt: generationPrompt, requestId, background: backgroundParams } = request;
    const { model: imageModel, quality, size: effectiveSize, moderation,
      mode: normalizedPromptMode, reasoningEffort, webSearchEnabled } = request.options;
    const grokRefs = request.providerUrl
      ? [{ b64: "", url: request.providerUrl, declaredMime: "image/png", detectedMime: "image/png" }, ...request.references]
      : request.references;
    // Keep classic's once-per-batch key and shared plan capture before any image attempt.
    const grokDirectApiKey = activeProvider === "grok-api" ? ctx.xaiApiKey : undefined;
    const sharedGrokPlan = activeProvider === "grok" || activeProvider === "grok-api"
      ? await planGrokImage(generationPrompt, ctx, {
        model: resolveGrokQualityModel(imageModel, quality),
        size: effectiveSize,
        signal: request.signal,
        requestId,
        referenceCount: grokRefs.length,
        references: grokRefs,
        directApiKey: grokDirectApiKey,
        backgroundConstraint: request.backgroundConstraint,
        webSearchEnabled,
      })
      : null;
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
      if (activeProvider === "grok" || activeProvider === "grok-api") {
        const grokModel = resolveGrokQualityModel(imageModel, quality);
        const r = await generateViaGrok(generationPrompt, ctx, {
          model: grokModel,
          size: effectiveSize,
          signal: request.signal,
          requestId,
          plannedPrompt: sharedGrokPlan?.prompt,
          webSearchCalls: sharedGrokPlan?.webSearchCalls,
          references: grokRefs,
          directApiKey: grokDirectApiKey,
        });
        return r;
      }
      if (activeProvider !== "api" && activeProvider !== "oauth") {
        throw new Error(`Unsupported classic execution provider: ${activeProvider}`);
      }
      const MAX_RETRIES = 1;
      let lastErr: unknown;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const r = await generateViaResponses(
            activeProvider,
            generationPrompt,
            quality,
            effectiveSize,
            moderation,
            request.references,
            requestId,
            normalizedPromptMode,
            ctx,
            {
              model: imageModel,
              reasoningEffort,
              webSearchEnabled,
              signal: request.signal,
              allowPromptOnlyOAuthFallback: activeProvider !== "api",
              ...(backgroundParams ? { background: backgroundParams.background } : {}),
              ...(backgroundParams?.outputFormat ? { outputFormat: backgroundParams.outputFormat } : {}),
            },
          );
          throwIfJobCanceled(requestId);
          if (r.b64) return r;
          lastErr = new Error("Empty response (safety refusal)");
        } catch (e) {
          lastErr = e;
          if (isNonRetryableGenerationError(e as UpstreamErr | null | undefined)) break;
        }
        if (attempt < MAX_RETRIES) {
          const errCode = (lastErr && typeof lastErr === "object" && "code" in lastErr)
            ? (lastErr as { code?: unknown }).code
            : undefined;
          logEvent("generate", "retry", { requestId, attempt: attempt + 1, errorCode: errCode });
        }
      }
      throw normalizeGenerationFailure(lastErr as UpstreamErr | null | undefined, {
        safetyMessage: "Content generation refused after retries",
      });
    };

    return { execute: async () => {
      try {
        return { kind: "single", value: await generateOne() };
      } catch (error) { throw error; } // Caller owns lifecycle and the existing error envelope.
    } };
  } catch (error) { throw error; }
}
