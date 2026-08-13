// Pure derivations over any manifest list. Kept free of the REGISTRY value so
// contract tests can drive them with a fixture registry (d5) without resolving
// built output, and so production consumers share one implementation.
import type { CoreProviderManifestBase, ProviderModelKind, ProviderReferenceMode } from "./types.js";

type RegistryInput = readonly CoreProviderManifestBase[];

export function deriveIdsFrom<const T extends RegistryInput>(registry: T): Array<T[number]["id"]> {
  return registry.map((provider) => provider.id) as Array<T[number]["id"]>;
}

export function deriveModelsFrom(
  registry: RegistryInput,
  providerId: string,
  kind: ProviderModelKind,
): Set<string> {
  const provider = registry.find((entry) => entry.id === providerId);
  return new Set(provider?.models.filter((model) => model.kind === kind).map((model) => model.id) ?? []);
}

export function deriveSupportedImageModelsFrom(registry: RegistryInput, providerId: string): Set<string> {
  const provider = registry.find((entry) => entry.id === providerId);
  return new Set(provider?.models.filter(
    (model) => model.kind === "image" && supportsAnything(model.supports),
  ).map((model) => model.id) ?? []);
}

export function deriveUnsupportedImageModelsFrom(registry: RegistryInput): Set<string> {
  return new Set(registry.flatMap((provider) => provider.models.filter(
    (model) => model.kind === "image" && !supportsAnything(model.supports),
  ).map((model) => model.id)));
}

export function deriveImageModelSetFrom(registry: RegistryInput): Set<string> {
  return new Set(registry.flatMap((provider) => provider.models.filter(
    (model) => model.kind === "image",
  ).map((model) => model.id)));
}

export function deriveCliImageModelSetFrom(registry: RegistryInput): Set<string> {
  return new Set([...deriveImageModelSetFrom(registry)].filter((model) => !model.includes("/")));
}

export function deriveReferenceLimitMapFrom(
  registry: RegistryInput,
  mode: ProviderReferenceMode,
): Record<string, number> {
  return Object.fromEntries(registry.flatMap((provider) => {
    const limit = provider.referenceLimits[mode];
    return limit === undefined ? [] : [[provider.id, limit]];
  }));
}

export function deriveReferenceLimitFrom(
  registry: RegistryInput,
  providerId: string | undefined,
  mode: ProviderReferenceMode,
): number | undefined {
  return registry.find((entry) => entry.id === providerId)?.referenceLimits[mode];
}

// A model with no capability at all is an explicitly unsupported entry
// (gpt-5.3-codex-spark), which lib/imageModels.ts rejects by name.
function supportsAnything(supports: CoreProviderModel["supports"]): boolean {
  return Boolean(supports.edit || supports.mask || supports.streaming);
}

type CoreProviderModel = CoreProviderManifestBase["models"][number];
