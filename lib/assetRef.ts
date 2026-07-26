import { basename } from "node:path";
import { getAsset } from "./assetsStore.js";

export type AssetRelationship = "source" | "reference" | "last-frame" | "continuation";

export type AssetRef = {
  assetId: string;
  /** Retained during migration so legacy sidecars keep resolving. */
  filename?: string;
  relationship?: AssetRelationship;
};

export type AssetResolution = {
  filename: string;
  via: "asset-id" | "filename";
};

export type AssetRefInput = {
  assetId?: string | null;
  filename?: string | null;
};

/**
 * Resolve a request reference to a generated filename.
 *
 * Asset IDs win because a filename stops being an identity the moment an asset is moved
 * or renamed; the filename stays as a fallback so every result produced before asset IDs
 * existed still loads. `via` is returned so callers and tests can prove which branch ran
 * — without it a dead fallback looks exactly like a live one.
 *
 * This only maps a reference to a NAME. Callers must still run the result through
 * `safeGeneratedFilePath` (lib/videoFrameExtract.ts): an id coming out of the database is
 * not automatically a safe path.
 */
export function resolveAssetRef(
  input: AssetRefInput,
  deps: { lookupAsset?: (id: string) => { filePath: string | null } | null } = {},
): AssetResolution | null {
  const lookup = deps.lookupAsset ?? ((id: string) => getAsset(id));

  if (input.assetId) {
    const record = lookup(input.assetId);
    const filePath = record?.filePath;
    if (filePath) return { filename: basename(filePath), via: "asset-id" };
    // An unknown or path-less asset id falls through to the filename rather than failing
    // outright: partially migrated rows are expected during the transition.
  }

  if (input.filename) return { filename: basename(input.filename), via: "filename" };
  return null;
}

/** True when a reference carries nothing usable, so callers can fail fast with context. */
export function isEmptyAssetRef(input: AssetRefInput): boolean {
  return !input.assetId && !input.filename;
}
