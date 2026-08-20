import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { MAX_REF2V_REFERENCES, MAX_VIDEO_DURATION, deriveVideoMode } from "../lib/imageModels.js";

// devlog/_plan/260820_grok15_multi_reference_video/010_duration_ceiling.md (issue #155).
//
// reference-to-video used to be clamped to 10s. That ceiling was invented, not
// observed: a live request against api.x.ai on 2026-08-20 with two reference
// images and duration=15 returned status=done with video.duration=15. The probe
// table lives in 000_research.md.

test("reference-to-video has no duration ceiling of its own", () => {
  assert.equal(MAX_VIDEO_DURATION, 15);
});

test("no surface re-introduces a reference-to-video duration clamp", () => {
  // A clamp is easy to add back by reflex ("R2V is special"), and the symptom is
  // silent: the user asks for 15s and receives 10s with no error. Pin the absence.
  const sources = [
    "lib/imageModels.ts",
    "routes/video.ts",
    "ui/src/lib/imageModels.ts",
    "ui/src/store/storeVideoImpl.ts",
    "ui/src/components/VideoControlsPanel.tsx",
  ];
  for (const path of sources) {
    const text = readFileSync(new URL("../" + path, import.meta.url), "utf8");
    assert.ok(
      !/MAX_REF2V_DURATION/.test(text),
      path + " references a reference-to-video duration ceiling; xAI accepts 1-15s for R2V",
    );
    assert.ok(
      !/clampVideoDuration/.test(text),
      path + " clamps video duration by mode; R2V is not shorter than other modes",
    );
  }
});

test("the reference-image ceiling is 7, which xAI does enforce", () => {
  // Contrast with duration: this limit is real. 8 references returns
  // 400 "Too many reference images: 8. Maximum allowed is 7."
  assert.equal(MAX_REF2V_REFERENCES, 7);
});

test("two or more references still select reference-to-video", () => {
  assert.equal(deriveVideoMode(0), "text-to-video");
  assert.equal(deriveVideoMode(1), "image-to-video");
  assert.equal(deriveVideoMode(2), "reference-to-video");
  assert.equal(deriveVideoMode(MAX_REF2V_REFERENCES), "reference-to-video");
});
