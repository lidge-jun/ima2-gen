/**
 * MiniMax adapter (#150, phase 1 reference implementation).
 *
 * MiniMax was chosen because it has the smallest runtime surface of the eight
 * lanes: one API key, two image models, no video, one reference image. That
 * makes it the cheapest place to find out whether the interface is shaped
 * correctly before the other seven follow.
 *
 * This wraps the existing runtime; it does not move it. lib/minimaxImageAdapter
 * keeps generating images exactly as before.
 */
import type { RuntimeContext } from "../../runtimeContext.js";
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
