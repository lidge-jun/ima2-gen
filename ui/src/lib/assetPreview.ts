import type { AssetItem } from "../store/storeTypes";
import type { GenerateItem } from "../types";
import { elementPreviewPath } from "./elementMembership";

export function assetMediaUrl(path: string): string {
  return `/generated/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Convert a stored AssetItem into the GenerateItem shape used by preview lightboxes. */
export function assetToPreviewItem(asset: AssetItem): GenerateItem {
  // Element assets created via promote-to-element carry no direct filePath —
  // fall back to the first metadata.refs entry, same as the grid thumbnail fix
  // (element-library-fixes). Without this the preview lightbox renders
  // `/generated/` (broken image) and canKey suppresses the keying entry.
  const path = asset.filePath ?? (asset.kind === "element" ? elementPreviewPath(asset) ?? "" : "");
  const url = assetMediaUrl(path);
  const derivedKind = asset.metadata?.derivedKind;
  // Preserve the alpha marker across the asset→preview conversion so the
  // lightbox can suppress keying for a transparent asset the same way the
  // generation grid does.
  const storedPreset = asset.metadata?.backgroundPreset;
  return {
    image: url,
    url,
    filename: path,
    prompt: asset.name,
    mediaType: asset.kind === "video" ? "video" : "image",
    createdAt: asset.createdAt,
    requestId: `asset:${asset.id}`,
    ...(storedPreset === "transparent" ? { backgroundPreset: "transparent" as const } : {}),
    kind: typeof derivedKind === "string" && derivedKind.startsWith("keyed-") ? "edit" : "imported",
  };
}
