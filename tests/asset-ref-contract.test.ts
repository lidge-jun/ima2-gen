import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isEmptyAssetRef, resolveAssetRef } from "../lib/assetRef.js";
import { normalizeVideoGenerationRequest, isVideoGenerationError, deriveVideoMode } from "../lib/videoGenerationRequest.js";

// WP8 / issue #85 (devlog/_plan/260726_zero-backlog-frontend-qa/080_asset_ref_model.md).
//
// The biggest risk in this change is that existing results stop loading — from the user's
// side that reads as data loss. Both directions of the fallback are proven below.

const catalog: Record<string, { filePath: string | null }> = {
  a_known: { filePath: "/Users/x/.ima2/generated/1780_abc.png" },
  a_pathless: { filePath: null },
};
const lookupAsset = (id: string) => catalog[id] ?? null;

test("an asset id resolves ahead of the filename", () => {
  const result = resolveAssetRef({ assetId: "a_known", filename: "stale-name.png" }, { lookupAsset });
  assert.equal(result?.via, "asset-id");
  assert.equal(result?.filename, "1780_abc.png", "the id must win over a renamed file");
});

test("legacy references without an asset id still resolve", () => {
  // Every result generated before asset IDs existed hits this branch.
  const result = resolveAssetRef({ assetId: null, filename: "legacy.mp4" }, { lookupAsset });
  assert.equal(result?.via, "filename", "the fallback branch must actually fire");
  assert.equal(result?.filename, "legacy.mp4");
});

test("an unknown or path-less asset id degrades to the filename", () => {
  // Partially migrated rows are expected mid-transition; failing outright would hide
  // results that are perfectly loadable.
  assert.equal(resolveAssetRef({ assetId: "a_missing", filename: "x.png" }, { lookupAsset })?.via, "filename");
  assert.equal(resolveAssetRef({ assetId: "a_pathless", filename: "x.png" }, { lookupAsset })?.via, "filename");
});

test("a reference with nothing usable resolves to null", () => {
  assert.equal(resolveAssetRef({ assetId: "a_missing" }, { lookupAsset }), null);
  assert.ok(isEmptyAssetRef({}));
  assert.ok(!isEmptyAssetRef({ filename: "a.png" }));
});

test("resolution returns a bare filename, never a traversable path", () => {
  // Path safety still belongs to safeGeneratedFilePath; this guarantees the resolver
  // does not hand it a directory escape to begin with.
  const result = resolveAssetRef({ filename: "../../etc/passwd" }, { lookupAsset });
  assert.equal(result?.filename, "passwd");
  assert.doesNotMatch(result?.filename ?? "", /\.\.|\//);
});

test("the resolver does not bypass path validation", () => {
  const src = readFileSync("lib/assetRef.ts", "utf8");
  assert.match(src, /safeGeneratedFilePath/, "the contract must point callers at validation");
});

test("a source asset id implies image-to-video", () => {
  assert.equal(deriveVideoMode({ sourceAssetId: "a_known" }), "image-to-video");
});

test("the generate request carries sourceAssetId alongside the legacy filename", () => {
  const result = normalizeVideoGenerationRequest({ prompt: "x", sourceAssetId: "a_known" });
  assert.ok(!isVideoGenerationError(result));
  assert.equal(result.request.sourceAssetId, "a_known");
  assert.equal(result.request.mode, "image-to-video");

  const legacy = normalizeVideoGenerationRequest({ prompt: "x", sourceFilename: "old.png" });
  assert.ok(!isVideoGenerationError(legacy));
  assert.equal(legacy.request.sourceFilename, "old.png", "legacy callers must keep working");
});
