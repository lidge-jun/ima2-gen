import { generateViaAtlasCloud } from "../../atlasCloudImageAdapter.js";
import { generateViaMinimax } from "../../minimaxImageAdapter.js";
import { generateViaNai } from "../../naiImageAdapter.js";
import { requireRuntimeContext, type RuntimeContext } from "../../runtimeContext.js";
import type { ExecutionProgress, PreparedImageExecution, SingleImageExecutionResult } from "./types.js";
import type { LegacyExecutionRequest } from "./legacy.js";

type NodeRequest = Extract<LegacyExecutionRequest, { surface: "node" }>;

export async function prepareLegacyNode(
  ctx: RuntimeContext, request: NodeRequest, _progress?: ExecutionProgress,
): Promise<PreparedImageExecution<"node">> {
  return { execute: async () => {
    try {
      return { kind: "single", value: await executeNodeAttempt(ctx, request) };
    } catch (error) { throw error; } // The caller owns retries and normalization.
  } };
}

// Keep the legacy one-attempt branches together; retry/lifecycle stays at the caller.
async function executeNodeAttempt(
  ctx: RuntimeContext, request: NodeRequest,
): Promise<SingleImageExecutionResult> {
  const { provider, sourceImage: parentB64, rawPrompt: prompt,
    references, requestId, signal, options } = request;
  const { model, size, quality } = options;
  return provider === "atlascloud"
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
    : unsupportedNodeProvider(provider);
}

function unsupportedNodeProvider(provider: NodeRequest["provider"]): never {
  throw new Error(`Unsupported node execution provider: ${provider}`);
}
