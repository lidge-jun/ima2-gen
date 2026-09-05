import { requireRuntimeContext, type RuntimeContext } from "../../runtimeContext.js";
import { detectImageMimeFromB64 } from "../../refs.js";
import { generateViaAgy } from "./agyOperations.js";
import { generateViaGeminiApi } from "./geminiOperations.js";
import type {
  ExecutionProgress, ExecutionReference, ExecutionSurface, ImageExecutionRequest,
  PreparedImageExecution, SequenceImageExecutionResult, SingleImageExecutionResult,
} from "../execution/types.js";

export type GoogleRequest = ImageExecutionRequest & { provider: "agy" | "gemini-api" };

export function isGoogleRequest(request: ImageExecutionRequest): request is GoogleRequest {
  return request.provider === "agy" || request.provider === "gemini-api";
}

function googleInput(request: GoogleRequest): { prompt: string; references: ExecutionReference[] } {
  if (request.surface === "edit") {
    return {
      prompt: `Edit this image: ${request.prompt}`,
      references: [{ b64: request.sourceImage, declaredMime: null,
        detectedMime: detectImageMimeFromB64(request.sourceImage) || null }],
    };
  }
  if (request.surface === "node") {
    const selectedRefs = request.contextMode === "parent-only" ? [] : request.references;
    return {
      prompt: request.sourceImage ? `Edit this image: ${request.prompt}` : request.prompt,
      references: request.sourceImage
        ? [{ b64: request.sourceImage, declaredMime: null, detectedMime: null }, ...selectedRefs]
        : selectedRefs,
    };
  }
  return { prompt: request.prompt, references: request.references };
}

function prepareGoogleClassic(
  ctx: RuntimeContext, request: Extract<GoogleRequest, { surface: "classic" }>,
): PreparedImageExecution<"classic"> {
  const { provider, prompt, requestId } = request;
  const { model, size } = request.options;
  // Classic captures scalars once; each attempt reads live refs, signal and credentials.
  return { execute: async () => {
    try {
      const value = provider === "agy"
        ? await generateViaAgy(prompt, { references: request.references, signal: request.signal, requestId })
        : await generateViaGeminiApi(prompt, requireRuntimeContext(ctx), {
            model, size, signal: request.signal,
            ...(requestId !== undefined ? { requestId } : {}),
            references: request.references,
          });
      return { kind: "single", value };
    } catch (error) { throw error; } // Preserve native identity; caller owns normalization.
  } };
}

async function runGoogleImage(
  ctx: RuntimeContext, request: GoogleRequest, input: ReturnType<typeof googleInput>,
): Promise<SingleImageExecutionResult> {
  try {
    const { provider, signal, requestId, options } = request;
    if (provider === "agy") {
      return await generateViaAgy(input.prompt, { references: input.references, signal, requestId });
    }
    return await generateViaGeminiApi(input.prompt,
      request.surface === "node" ? requireRuntimeContext(ctx) : ctx, {
        model: options.model, size: options.size, signal,
        ...(requestId !== undefined ? { requestId } : {}),
        references: input.references,
      });
  } catch (error) { throw error; }
}

function googleSequence(result: SingleImageExecutionResult): SequenceImageExecutionResult {
  // Preserve the dense one-image projection; the caller owns the final persistence sweep.
  return {
    images: [{ b64: result.b64, ...(result.revisedPrompt !== undefined ? { revisedPrompt: result.revisedPrompt } : {}) }],
    usage: result.usage, webSearchCalls: result.webSearchCalls,
  };
}

export function prepareGoogleExecution<R extends GoogleRequest>(
  ctx: RuntimeContext, request: R, progress?: ExecutionProgress,
): Promise<PreparedImageExecution<R["surface"]>>;
export async function prepareGoogleExecution(
  ctx: RuntimeContext, request: GoogleRequest, _progress?: ExecutionProgress,
): Promise<PreparedImageExecution<ExecutionSurface>> {
  try {
    switch (request.surface) {
      case "classic": return prepareGoogleClassic(ctx, request);
      case "node":
      case "edit": return { execute: async () => {
        try { return { kind: "single", value: await runGoogleImage(ctx, request, googleInput(request)) }; }
        catch (error) { throw error; } // Caller owns retries, cancellation and cleanup.
      } };
      case "multimode": return { execute: async () => {
        try {
          const result = await runGoogleImage(ctx, request, googleInput(request));
          return { kind: "sequence", value: googleSequence(result) };
        } catch (error) { throw error; }
      } };
    }
  } catch (error) { throw error; }
}
