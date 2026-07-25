import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildProvenanceView, isEmptyProvenance } from "../ui/src/lib/provenance";

// WP4 / issue #90 (devlog/_plan/260726_zero-backlog-frontend-qa/040_provenance_chip.md).

test("derivation is inferred from the stored lineage, not guessed", () => {
  assert.equal(buildProvenanceView({ model: "gpt-image-2" }).derivation, "t2i");
  assert.equal(buildProvenanceView({ model: "m", canvasSourceFilename: "a.png" }).derivation, "i2i");
  assert.equal(buildProvenanceView({ model: "m", mediaType: "video" }).derivation, "t2v");
  assert.equal(
    buildProvenanceView({ model: "m", mediaType: "video", sourceImageFilename: "a.png" }).derivation,
    "i2v",
  );
  assert.equal(
    buildProvenanceView({
      model: "m",
      mediaType: "video",
      videoContinuity: { parentFilename: "prev.mp4" } as never,
    }).derivation,
    "v2v",
  );
});

test("a continuation outranks a plain source image", () => {
  // Both fields can be present; continuing a clip is the more specific fact.
  const view = buildProvenanceView({
    model: "m",
    mediaType: "video",
    sourceImageFilename: "still.png",
    videoContinuity: { parentFilename: "prev.mp4" } as never,
  });
  assert.equal(view.derivation, "v2v");
  assert.equal(view.sourceLabel, "prev.mp4");
});

test("items with no metadata render nothing at all", () => {
  // An "unknown" badge would be noise on every legacy sidecar.
  assert.ok(isEmptyProvenance(buildProvenanceView({})));
  assert.ok(!isEmptyProvenance(buildProvenanceView({ model: "gpt-image-2" })));
});

test("the video node path keeps the model the server actually ran", () => {
  const store = readFileSync("ui/src/store/storeVideoImpl.ts", "utf8");
  // Regression guard: this used to hardcode `model: null`, so ImageNode's model label
  // silently disappeared even though the data was on the wire.
  assert.doesNotMatch(store, /\bmodel: null,/);
  assert.match(store, /model: result\.effectiveModel \?\? result\.requestedModel/);

  const api = readFileSync("ui/src/lib/api-generation.ts", "utf8");
  assert.match(api, /effectiveModel\?: string \| null;/, "the done payload type must carry it");
});

test("provenance labels exist in both locales and are not English-only", () => {
  const ko = JSON.parse(readFileSync("ui/src/i18n/ko.json", "utf8"));
  const en = JSON.parse(readFileSync("ui/src/i18n/en.json", "utf8"));
  for (const key of ["t2i", "i2i", "t2v", "i2v", "v2v"]) {
    assert.ok(ko.provenance?.[key], `ko.provenance.${key} missing`);
    assert.ok(en.provenance?.[key], `en.provenance.${key} missing`);
  }
  // Korean UI must not surface bare acronyms like "I2V".
  assert.doesNotMatch(ko.provenance.i2v, /^[\x00-\x7F]+$/);
});

test("the chip is wired into the gallery tile and the node status line", () => {
  const tile = readFileSync("ui/src/components/GalleryImageTile.tsx", "utf8");
  assert.match(tile, /<ProvenanceChip view=\{buildProvenanceView\(item\)\} \/>/);

  const node = readFileSync("ui/src/components/ImageNode.tsx", "utf8");
  assert.match(node, /derivationOf\(d, t\)/);
  assert.match(node, /getImageModelShortLabel\(d\.model, d\.provider\)/);
});
