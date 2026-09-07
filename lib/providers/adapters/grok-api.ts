/** xAI descriptor adapter; execution stays with its typed family owner. */
import type { RuntimeContext } from "../../runtimeContext.js";
import { getProvider } from "../registry.js";
import type { CoreProviderModel } from "../types.js";
import type { AuthResult, ProviderAdapterV1, ProviderError } from "./types.js";

const LANE_ID = "grok-api" as const;
const ERROR_PREFIX = getProvider(LANE_ID).errorPrefix;

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

export function createGrokApiAdapter(ctx: RuntimeContext): ProviderAdapterV1 {
  return {
    laneId: LANE_ID,

    validateAuth(): AuthResult {
      return ctx.xaiApiKey
        ? { ok: true }
        : { ok: false, reason: "xAI API key missing" };
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
        : "xAI request failed";
      const code = !ERROR_PREFIX
        ? rawCode ?? "UNKNOWN"
        : rawCode?.startsWith(ERROR_PREFIX)
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
