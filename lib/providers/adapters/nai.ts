/**
 * NovelAI adapter — lane descriptor for ProviderAdapterV1.
 *
 * Mirrors the MiniMax split: this file owns auth state, the model list, and
 * error normalization, while the generation call itself stays in
 * lib/naiImageAdapter.ts.
 */
import type { RuntimeContext } from "../../runtimeContext.js";
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
