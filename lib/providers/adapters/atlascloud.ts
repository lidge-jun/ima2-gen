/**
 * Atlas Cloud adapter (#150, phase 2 — the second adapter).
 *
 * Atlas Cloud is the second lane behind ProviderAdapterV1 because it is the
 * only remaining lane with exactly one API key, a unique error prefix, image-
 * only models, and synchronously readable auth state. gemini-api carries two
 * credentials (a multi-credential AuthResult design question), agy's auth
 * comes from async binary detection, grok-api shares its error prefix with
 * grok, and oauth/api have no prefix for the contract suite to assert on.
 *
 * This wraps the existing runtime; it does not move it. lib/atlasCloudImageAdapter
 * keeps generating images exactly as before.
 */
import type { RuntimeContext } from "../../runtimeContext.js";
import { getProvider } from "../registry.js";
import type { CoreProviderModel } from "../types.js";
import type { AuthResult, ProviderAdapterV1, ProviderError } from "./types.js";

const LANE_ID = "atlascloud" as const;
const ERROR_PREFIX = "ATLASCLOUD_";

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
 * process constant: routes/keys.ts updates ctx.atlasCloudApiKey while the
 * server runs, so reading process.env would report the lane as unauthenticated
 * right after the user configured it.
 */
export function createAtlasCloudAdapter(ctx: RuntimeContext): ProviderAdapterV1 {
  return {
    laneId: LANE_ID,

    validateAuth(): AuthResult {
      // Presence only, and note the spelling: the context field is
      // atlasCloudApiKey (capital C) while the lane id is all-lowercase.
      return ctx.atlasCloudApiKey
        ? { ok: true }
        : { ok: false, reason: "Atlas Cloud API key missing" };
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
        : "Atlas Cloud request failed";
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
