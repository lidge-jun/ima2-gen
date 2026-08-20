import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { deriveVideoMode as deriveFromSlot, normalizeVideoGenerationRequest, isVideoGenerationError } from "../lib/videoGenerationRequest.js";
import { deriveVideoMode as deriveFromCount } from "../lib/imageModels.js";
import { buildVideoGenerationPayload } from "../lib/grokVideoAdapter.js";

// devlog/_plan/260820_grok15_multi_reference_video/030_single_ref_mode_choice.md (issue #157).
//
// A single reference image used to be forced into image-to-video, which locks it as the
// first frame. That made the reference tray unable to do the one thing it is named for.
// xAI accepts a 1-image reference-to-video request (verified 2026-08-20, 000_research.md);
// the restriction was ours.

function plan(mode: "text-to-video" | "image-to-video" | "reference-to-video") {
  return { prompt: "p", mode, duration: 6, resolution: "720p" as const, aspectRatio: "16:9" as const, webSearchCalls: 0 };
}

test("one reference image is a legal reference-to-video payload", () => {
  const payload = buildVideoGenerationPayload(plan("reference-to-video"), {
    model: "grok-imagine-video-1.5",
    referenceImageUrls: ["https://example.invalid/a.png"],
  });
  assert.deepEqual(payload.reference_images, [{ url: "https://example.invalid/a.png" }]);
  assert.equal(payload.image, undefined, "a reference must not become the locked first frame");
});

test("reference-to-video with nothing to reference is still rejected", () => {
  // Relaxing the floor to 1 must not open a path to an empty reference_images array.
  assert.throws(
    () => buildVideoGenerationPayload(plan("reference-to-video"), { model: "grok-imagine-video-1.5", referenceImageUrls: [] }),
    /at least 1 reference image/,
  );
});

test("the slot the caller used decides the mode, not the count", () => {
  assert.equal(deriveFromSlot({ referenceImages: ["a"] }), "reference-to-video");
  assert.equal(deriveFromSlot({ sourceImage: "data:..." }), "image-to-video");
  // Same single image, opposite meanings, distinguished only by the field it arrived in.
});

test("the count-only helper keeps its historical default for callers without slot info", () => {
  assert.equal(deriveFromCount(1), "image-to-video");
  assert.equal(deriveFromCount(2), "reference-to-video");
});

test("an explicit mode still wins over any derivation", () => {
  const result = normalizeVideoGenerationRequest({ prompt: "x", mode: "reference-to-video", referenceImages: ["a"] });
  assert.ok(!isVideoGenerationError(result));
  assert.equal(result.request.mode, "reference-to-video");
});

test("every surface sends a lone attachment to the reference slot", () => {
  // The UI store and the CLI both used to special-case length 1 into sourceImage, which
  // is how the same feature ended up behaving differently on each surface.
  const store = readFileSync(new URL("../ui/src/store/storeVideoImpl.ts", import.meta.url), "utf8");
  assert.ok(
    !/referenceImages:\s*refs\.length\s*>=\s*2/.test(store),
    "the UI store must not gate the reference slot on having two attachments",
  );
  const cli = readFileSync(new URL("../bin/lib/videoMcp.ts", import.meta.url), "utf8");
  assert.ok(
    !/references\.length === 1.*sourceImage/.test(cli),
    "the CLI must not route a single --ref into sourceImage",
  );
  assert.ok(
    !/1 and 10 when using 2 or more/.test(cli),
    "the CLI must not re-impose the removed 10s reference ceiling",
  );
});
