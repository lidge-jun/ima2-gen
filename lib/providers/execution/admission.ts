import type { RuntimeContext } from "../../runtimeContext.js";
import { getProviderSurfaceSupport } from "../derive.js";
import type { CoreProviderId } from "../registry.js";
import type { ProviderSurface } from "../types.js";
import type { ExecutionSurface } from "./types.js";

type AdmissionFailure = {
  status: 400 | 401;
  code: "GROK_API_KEY_MISSING" | "NAI_REF_UNSUPPORTED";
  message: string;
};

function directKeyFailure(ctx: RuntimeContext, provider: CoreProviderId): AdmissionFailure | null {
  if (provider !== "grok-api" || (typeof ctx.xaiApiKey === "string" && ctx.xaiApiKey.trim())) return null;
  return { status: 401, code: "GROK_API_KEY_MISSING",
    message: "Grok API key is required for grok-api image generation" };
}

export function checkImageExecutionAdmission(ctx: RuntimeContext, input: {
  provider: CoreProviderId; surface: ExecutionSurface; referenceCount: number;
}): AdmissionFailure | null {
  const missingKey = directKeyFailure(ctx, input.provider);
  if (missingKey) return missingKey;
  const surface: ProviderSurface = input.surface === "classic" ? "generate" : input.surface;
  if (input.provider === "nai" && surface === "multimode" && input.referenceCount > 0
    && getProviderSurfaceSupport(input.provider, surface)?.references === false) {
    return { status: 400, code: "NAI_REF_UNSUPPORTED",
      message: "NovelAI image generation does not accept reference images yet" };
  }
  return null;
}

/** Recheck mutable direct credentials without changing the provider or captured key. */
export function assertDirectGrokKey(ctx: RuntimeContext, provider: CoreProviderId): void {
  const failure = directKeyFailure(ctx, provider);
  if (failure) throw Object.assign(new Error(failure.message), { status: failure.status, code: failure.code });
}
