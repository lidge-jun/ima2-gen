/**
 * NovelAI adapter: readiness, registry models, errors and image execution surfaces.
 * The existing image adapter retains transport and provider protocol ownership.
 */
import { generateViaNai } from "../../naiImageAdapter.js";
import type {
  ExecutionProgress, ExecutionSurface, ImageExecutionRequest, PreparedImageExecution,
} from "../execution/types.js";
import { requireRuntimeContext, type RuntimeContext } from "../../runtimeContext.js";
import { getProvider } from "../registry.js";
import type { CoreProviderModel } from "../types.js";
import type { AuthResult, ProviderAdapterV1, ProviderError } from "./types.js";

const LANE_ID = "nai" as const;
const ERROR_PREFIX = "NAI_";

/** Transient upstream conditions, not bad input. */
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
 * A factory rather than a singleton: routes/keys.ts updates ctx.naiApiKey while
 * the server runs, so reading process.env would report the lane as
 * unauthenticated right after the user configured it.
 */
export function createNaiAdapter(ctx: RuntimeContext): ProviderAdapterV1 {
  return {
    laneId: LANE_ID,
    prepareImageExecution: prepareLaneImageExecution,

    validateAuth(): AuthResult {
      // Presence only. NovelAI accepts a persistent token or a session JWT and
      // publishes no prefix or length rule, so a format check would invent one.
      return ctx.naiApiKey
        ? { ok: true }
        : { ok: false, reason: "NovelAI API token missing" };
    },

    listModels(): readonly CoreProviderModel[] {
      // Straight from the registry; a hand-written list here is exactly the
      // drift the capability registry exists to remove.
      return getProvider(LANE_ID).models;
    },

    normalizeError(error: unknown): ProviderError {
      const status = readStatus(error);
      const rawCode = readCode(error);
      const message = error instanceof Error ? error.message
        : typeof error === "string" ? error
        : "NovelAI request failed";
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
    // Text-to-image only: the caller already refused references.
    const value = await generateViaNai(generationPrompt, requireRuntimeContext(ctx), {
      model: imageModel, size: effectiveSize, signal: request.signal, requestId,
      // Reuse the same normalized options as node and multimode.
      ...request.nai,
    });
    return { kind: "single", value };
  } };
}

function prepareNode(
  ctx: RuntimeContext, request: Extract<ImageExecutionRequest, { surface: "node" }>,
): PreparedImageExecution<"node"> {
  return { execute: async () => {
    const { rawPrompt: prompt, requestId, signal, options } = request;
    const { model, size } = options;
    const value = await generateViaNai(prompt, requireRuntimeContext(ctx), {
      model, size, signal, requestId, ...request.nai,
    });
    return { kind: "single", value };
  } };
}

function prepareMultimode(
  ctx: RuntimeContext, request: Extract<ImageExecutionRequest, { surface: "multimode" }>,
): PreparedImageExecution<"multimode"> {
  return { execute: async () => {
    const { rawPrompt, signal, requestId, options } = request;
    // Text-to-image only: admission rejects references before startJob.
    const result = await generateViaNai(rawPrompt, ctx, {
      model: options.model, size: options.size, signal, requestId, ...request.nai,
    });
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
    case "edit": return { execute: async () => {
      throw new Error(`Unsupported legacy edit provider: ${request.provider}`);
    } };
    case "multimode": return prepareMultimode(ctx, request);
  }
}
