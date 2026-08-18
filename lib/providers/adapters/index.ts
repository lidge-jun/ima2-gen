/**
 * Adapter lookup (#150, phase 2).
 *
 * MiniMax (phase 1 reference) and Atlas Cloud (second adapter) are registered.
 * Every other lane returns null and keeps its current code path, so each
 * migration is a deliberate, measured step rather than a bulk rewrite.
 */
import type { RuntimeContext } from "../../runtimeContext.js";
import type { CoreProviderId } from "../registry.js";
import { createAtlasCloudAdapter } from "./atlascloud.js";
import { createMinimaxAdapter } from "./minimax.js";
import type { ProviderAdapterV1 } from "./types.js";

type AdapterFactory = (ctx: RuntimeContext) => ProviderAdapterV1;

const ADAPTER_FACTORIES: Partial<Record<CoreProviderId, AdapterFactory>> = {
  minimax: createMinimaxAdapter,
  atlascloud: createAtlasCloudAdapter,
};

export function getProviderAdapter(ctx: RuntimeContext, laneId: CoreProviderId): ProviderAdapterV1 | null {
  const factory = ADAPTER_FACTORIES[laneId];
  return factory ? factory(ctx) : null;
}

/** Every registered adapter, so the contract suite covers new ones automatically. */
export function listProviderAdapters(ctx: RuntimeContext): ProviderAdapterV1[] {
  return Object.values(ADAPTER_FACTORIES)
    .filter((factory): factory is AdapterFactory => typeof factory === "function")
    .map((factory) => factory(ctx));
}

export type { AuthResult, ProviderAdapterV1, ProviderError } from "./types.js";
