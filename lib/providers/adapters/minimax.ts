/**
 * MiniMax adapter: readiness, registry models, errors and image execution surfaces.
 * The existing image adapter retains transport and provider protocol ownership.
 */
import { generateViaMinimax } from "../../minimaxImageAdapter.js";
import type {
  ExecutionProgress, ExecutionSurface, ImageExecutionRequest, PreparedImageExecution,
} from "../execution/types.js";
import { detectImageMimeFromB64 } from "../../refs.js";
import { requireRuntimeContext, type RuntimeContext } from "../../runtimeContext.js";
import { getProvider } from "../registry.js";
import type { CoreProviderModel } from "../types.js";
import type { AuthResult, ProviderAdapterV1, ProviderError } from "./types.js";

const LANE_ID = "minimax" as const;
const ERROR_PREFIX = "MINIMAX_";

/** Status codes worth retrying: transient upstream conditions, not bad input. */
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function readStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { status?: unknown; statusCode?: unknown };
  return typeof candidate.status === "number" ? candidate.status
    : typeof candidate.statusCode === "number" ? candidate.statusCode
    : undefined;
}

function readCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { code?: unknown };
  return typeof candidate.code === "string" ? candidate.code : undefined;
}

/**
 * Creates an adapter bound to a runtime context.
 *
 * A factory rather than a module-level singleton because the API key is not a
 * process constant: routes/keys.ts updates ctx.minimaxApiKey while the server
 * runs, so reading process.env would report a lane as unauthenticated right
 * after the user configured it.
 */
export function createMinimaxAdapter(ctx: RuntimeContext): ProviderAdapterV1 {
  return {
    laneId: LANE_ID,
    prepareImageExecution: prepareLaneImageExecution,

    validateAuth(): AuthResult {
      // Presence only. MiniMax publishes no key prefix or length rule, so a
      // format check would invent one and reject valid keys.
      return ctx.minimaxApiKey
        ? { ok: true }
        : { ok: false, reason: "MiniMax API key missing" };
    },

    listModels(): readonly CoreProviderModel[] {
      // Straight from the registry. A hand-written list here is exactly the
      // drift the capability registry was built to remove.
      return getProvider(LANE_ID).models;
    },

    normalizeError(error: unknown): ProviderError {
      const status = readStatus(error);
      const rawCode = readCode(error);
      const message = error instanceof Error ? error.message
        : typeof error === "string" ? error
        : "MiniMax request failed";
      const code = rawCode?.startsWith(ERROR_PREFIX)
        ? rawCode
        : rawCode
          ? `${ERROR_PREFIX}${rawCode}`
          : `${ERROR_PREFIX}UNKNOWN`;
      const retryable = status === undefined ? false : RETRYABLE_STATUSES.has(status);
      return {
        code,
        message,
        ...(status === undefined ? {} : { status }),
        retryable,
      };
    },
  };
}

function prepareClassic(
  ctx: RuntimeContext, request: Extract<ImageExecutionRequest, { surface: "classic" }>,
): PreparedImageExecution<"classic"> {
  const { prompt: generationPrompt, requestId } = request;
  const { model: imageModel, size: effectiveSize } = request.options;
  // Capture scalars at prepare; ctx, refs, signal and lane options stay live.
  return { execute: async () => {
    const value = await generateViaMinimax(generationPrompt, requireRuntimeContext(ctx), {
      model: imageModel, size: effectiveSize, signal: request.signal,
      requestId, references: request.references,
    });
    return { kind: "single", value };
  } };
}

function prepareNode(
  ctx: RuntimeContext, request: Extract<ImageExecutionRequest, { surface: "node" }>,
): PreparedImageExecution<"node"> {
  return { execute: async () => {
    const { sourceImage: parentB64, rawPrompt: prompt, references, requestId, signal, options } = request;
    const { model, size } = options;
    const value = await generateViaMinimax(parentB64 ? `Edit this image: ${prompt}` : prompt, requireRuntimeContext(ctx), {
      model, size, signal, requestId,
      references: parentB64
        ? [{ b64: parentB64, declaredMime: null, detectedMime: null }, ...references]
        : references,
    });
    return { kind: "single", value };
  } };
}

function prepareEdit(
  ctx: RuntimeContext, request: Extract<ImageExecutionRequest, { surface: "edit" }>,
): PreparedImageExecution<"edit"> {
  return { execute: async () => {
    const { prompt, sourceImage, signal, requestId, options } = request;
    const references = [{ b64: sourceImage, declaredMime: null, detectedMime: detectImageMimeFromB64(sourceImage) || null }];
    const editPrompt = `Edit this image: ${prompt}`;
    const params = { model: options.model, size: options.size, signal, ...(requestId !== undefined ? { requestId } : {}), references };
    const value = await generateViaMinimax(editPrompt, ctx, params);
    return { kind: "single", value };
  } };
}

function prepareMultimode(
  ctx: RuntimeContext, request: Extract<ImageExecutionRequest, { surface: "multimode" }>,
): PreparedImageExecution<"multimode"> {
  return { execute: async () => {
    const { rawPrompt, references, signal, requestId, options } = request;
    const params = { model: options.model, size: options.size, signal, ...(requestId !== undefined ? { requestId } : {}), references };
    const result = await generateViaMinimax(rawPrompt, ctx, params);
    // Preserve the projection; the caller owns the final persistence sweep.
    return { kind: "sequence", value: {
      images: [{ b64: result.b64, ...(result.revisedPrompt !== undefined ? { revisedPrompt: result.revisedPrompt } : {}) }],
      usage: result.usage, webSearchCalls: result.webSearchCalls,
    } };
  } };
}

function prepareLaneImageExecution<R extends ImageExecutionRequest>(
  ctx: RuntimeContext, request: R, progress?: ExecutionProgress,
): Promise<PreparedImageExecution<R["surface"]>>;
async function prepareLaneImageExecution(
  ctx: RuntimeContext, request: ImageExecutionRequest, _progress?: ExecutionProgress,
): Promise<PreparedImageExecution<ExecutionSurface>> {
  switch (request.surface) {
    case "classic": return prepareClassic(ctx, request);
    case "node": return prepareNode(ctx, request);
    case "edit": return prepareEdit(ctx, request);
    case "multimode": return prepareMultimode(ctx, request);
  }
}
