import type { CoreProviderManifestBase, ProviderSurface, ProviderSurfaceSupport } from "./types.js";

export const PROVIDER_SURFACES = [
  "generate", "edit", "multimode", "node", "video",
] as const satisfies readonly ProviderSurface[];

/** Project supported operations; a runtime catalog is not an empty static one. */
export function deriveProviderSurfaceSupportFrom(
  registry: readonly CoreProviderManifestBase[],
  providerId: string,
  surface: ProviderSurface,
): ProviderSurfaceSupport | null {
  const provider = registry.find((entry) => entry.id === providerId);
  if (!provider) return null;
  const catalogAccess = provider.catalogAccess ?? "static";
  const runtime = catalogAccess === "runtime";
  const models = provider.models.filter((model) =>
    model.kind === (surface === "video" ? "video" : "image"));
  const runnable = runtime || models.some((model) =>
    surface === "edit" ? model.supports.edit : model.supports.generate);
  const supported = provider.surfaces.includes(surface) && runnable;
  return {
    supported,
    references: supported && (runtime || models.some((model) => model.supports.edit)),
    mask: supported && surface === "edit" && models.some((model) => model.supports.mask),
    streaming: supported && (surface === "multimode" || surface === "node")
      && models.some((model) => model.supports.streaming),
    catalogAccess,
  };
}
