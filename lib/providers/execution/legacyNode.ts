import { generateViaGrok } from "../../grokImageAdapter.js";
import { generateViaAgy } from "../../agyImageAdapter.js";
import { generateViaGeminiApi } from "../../geminiApiImageAdapter.js";
import { generateViaAtlasCloud } from "../../atlasCloudImageAdapter.js";
import { generateViaMinimax } from "../../minimaxImageAdapter.js";
import { generateViaNai } from "../../naiImageAdapter.js";
import { toGrokReferences } from "../../nodeHelpers.js";
import { requireRuntimeContext, type RuntimeContext } from "../../runtimeContext.js";
import type { ExecutionProgress, PreparedImageExecution, SingleImageExecutionResult } from "./types.js";
import type { LegacyExecutionRequest } from "./legacy.js";

type NodeRequest = Extract<LegacyExecutionRequest, { surface: "node" }>;

export async function prepareLegacyNode(
  ctx: RuntimeContext, request: NodeRequest, _progress?: ExecutionProgress,
): Promise<PreparedImageExecution<"node">> {
  // Preserve the original pre-attempt capture. The facade checks current presence
  // on every execute, but replacing a nonblank key must not rebind either retry.
  const grokDirectApiKey = request.provider === "grok-api" ? ctx.xaiApiKey : undefined;
  return { execute: async () => {
    try {
      return { kind: "single", value: await executeNodeAttempt(ctx, request, grokDirectApiKey) };
    } catch (error) { throw error; } // The caller owns retries and normalization.
  } };
}

// Keep the legacy one-attempt branches together; retry/lifecycle stays at the caller.
async function executeNodeAttempt(
  ctx: RuntimeContext, request: NodeRequest,
  grokDirectApiKey: string | undefined,
): Promise<SingleImageExecutionResult> {
  const { provider, sourceImage: parentB64, prompt: generationPrompt, rawPrompt: prompt,
    references, requestId, signal, options } = request;
  const { model, size, quality } = options;
  const refsForRequest = request.contextMode === "parent-only" ? [] : references;
  return provider === "gemini-api"
    ? await generateViaGeminiApi(parentB64 ? `Edit this image: ${generationPrompt}` : generationPrompt, requireRuntimeContext(ctx), {
        model, size, signal, ...(requestId !== undefined ? { requestId } : {}),
        references: parentB64
          ? [{ b64: parentB64, declaredMime: null, detectedMime: null }, ...references]
          : references,
      })
    : provider === "agy"
    ? await generateViaAgy(parentB64 ? `Edit this image: ${generationPrompt}` : generationPrompt, {
        ...(parentB64
          ? { references: [{ b64: parentB64, declaredMime: null, detectedMime: null }] }
          : {}),
        signal, requestId,
      })
    : provider === "atlascloud"
    ? await generateViaAtlasCloud(parentB64 ? `Edit this image: ${prompt}` : prompt, requireRuntimeContext(ctx), {
        model, size, quality, signal, requestId,
        references: parentB64
          ? [{ b64: parentB64, declaredMime: null, detectedMime: null }, ...references]
          : references,
      })
    : provider === "minimax"
    ? await generateViaMinimax(parentB64 ? `Edit this image: ${prompt}` : prompt, requireRuntimeContext(ctx), {
        model, size, signal, requestId,
        references: parentB64
          ? [{ b64: parentB64, declaredMime: null, detectedMime: null }, ...references]
          : references,
      })
    : provider === "nai"
    ? await generateViaNai(prompt, requireRuntimeContext(ctx), {
        model, size, signal, requestId, ...request.nai,
      })
    : provider === "grok" || provider === "grok-api"
    ? await generateViaGrok(generationPrompt, ctx, {
        model, size, requestId, signal,
        references: toGrokReferences(parentB64, refsForRequest),
        directApiKey: grokDirectApiKey,
      })
    : unsupportedNodeProvider(provider);
}

function unsupportedNodeProvider(provider: NodeRequest["provider"]): never {
  throw new Error(`Unsupported node execution provider: ${provider}`);
}
