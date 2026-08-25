// Registry-bound derivations used by production consumers. The pure logic lives
// in deriveCore.ts; this module binds it to REGISTRY and keeps the narrow
// CoreProviderId typing consumers rely on.
import { REGISTRY, type CoreProviderId } from "./registry.js";
import type { CoreProviderManifestBase, ProviderModelKind, ProviderReferenceMode } from "./types.js";
import {
  deriveCliImageModelSetFrom,
  deriveIdsFrom,
  deriveImageModelSetFrom,
  deriveModelsFrom,
  deriveReferenceLimitFrom,
  deriveReferenceLimitMapFrom,
  deriveSupportedImageModelsFrom,
  deriveUnsupportedImageModelsFrom,
} from "./deriveCore.js";

type RegistryInput = readonly CoreProviderManifestBase[];

export function deriveProviderIds(): CoreProviderId[];
export function deriveProviderIds<const T extends RegistryInput>(registry: T): Array<T[number]["id"]>;
export function deriveProviderIds(registry: RegistryInput = REGISTRY): string[] {
  return deriveIdsFrom(registry);
}

export function deriveProviderIdSet(registry: RegistryInput = REGISTRY): Set<CoreProviderId> {
  return new Set(deriveIdsFrom(registry) as CoreProviderId[]);
}

/**
 * Core lane ids that can produce video.
 *
 * A lane qualifies by declaring a `kind: "video"` model, or by holding its
 * catalog at runtime — a comfy workflow is registered by the user, so its
 * models list is empty by construction and a compile-time check would wrongly
 * call the lane image-only.
 *
 * This exists so help text stops being hand-maintained. Listing every provider
 * would advertise `--provider oauth` for video, which the resolver rejects:
 * a stale list replaced by a misleading one.
 */
export function deriveVideoProviderIds(registry: RegistryInput = REGISTRY): CoreProviderId[] {
  return registry
    .filter((provider) => provider.catalogAccess === "runtime"
      || provider.models.some((model) => model.kind === "video"))
    .map((provider) => provider.id as CoreProviderId);
}

export function deriveModels(
  providerId: string,
  kind: ProviderModelKind,
  registry: RegistryInput = REGISTRY,
): Set<string> {
  return deriveModelsFrom(registry, providerId, kind);
}

export function deriveSupportedImageModels(
  providerId: string,
  registry: RegistryInput = REGISTRY,
): Set<string> {
  return deriveSupportedImageModelsFrom(registry, providerId);
}

export function deriveUnsupportedImageModels(registry: RegistryInput = REGISTRY): Set<string> {
  return deriveUnsupportedImageModelsFrom(registry);
}

export function deriveImageModelSet(registry: RegistryInput = REGISTRY): Set<string> {
  return deriveImageModelSetFrom(registry);
}

export function deriveCliImageModelSet(registry: RegistryInput = REGISTRY): Set<string> {
  return deriveCliImageModelSetFrom(registry);
}

export function deriveReferenceLimitMap(
  mode: ProviderReferenceMode,
  registry: RegistryInput = REGISTRY,
): Partial<Record<CoreProviderId, number>> {
  return deriveReferenceLimitMapFrom(registry, mode) as Partial<Record<CoreProviderId, number>>;
}

export function deriveReferenceLimit(
  providerId: string | undefined,
  mode: ProviderReferenceMode,
): number | undefined {
  return deriveReferenceLimitFrom(REGISTRY, providerId, mode);
}
