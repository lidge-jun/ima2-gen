import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  MAX_REF2V_DURATION_15,
  MAX_REF2V_DURATION_BASE,
  MAX_REF2V_REFERENCES,
  MAX_VIDEO_DURATION,
  deriveVideoMode,
  maxRef2vDuration,
  validateVideoDurationForRequest,
} from "../lib/imageModels.js";

// devlog/_plan/260820_grok15_multi_reference_video/010_duration_ceiling.md (issue #155).
//
// reference-to-video used to be clamped to 10s. That ceiling was invented, not
// observed: a live request against api.x.ai on 2026-08-20 with two reference
// images and duration=15 returned status=done with video.duration=15. The probe
// table lives in 000_research.md.
//
// UPDATE 2026-09-08 (devlog/_plan/260908_xai_imagine_spec_resync/000_research.md):
// a ceiling exists after all, but it is NOT the one 260820 removed. That one was
// ours, applied to every model against evidence. This one is xAI's own and differs
// by model: a 16s request answers "maximum allowed for reference-to-video, which is
// 15s" on grok-imagine-video-1.5 and "... is 10s" on grok-imagine-video. Both
// statements are correct at their own dates; the tests below pin the shape of the
// current rule so neither can be reintroduced as the other.

test("reference-to-video's ceiling is per model: 15s on 1.5, 10s on base", () => {
  assert.equal(MAX_VIDEO_DURATION, 15);
  assert.equal(maxRef2vDuration("grok-imagine-video-1.5"), MAX_REF2V_DURATION_15);
  assert.equal(maxRef2vDuration("grok-imagine-video-1.5-preview"), MAX_REF2V_DURATION_15);
  assert.equal(maxRef2vDuration("grok-imagine-video-1.5-2026-05-30"), MAX_REF2V_DURATION_15);
  assert.equal(maxRef2vDuration("grok-imagine-video"), MAX_REF2V_DURATION_BASE);
});

test("the ceiling stays xAI's rule and does not become a blanket clamp", () => {
  // The 260820 failure mode is still the one to guard: a mode-wide clamp applied
  // regardless of model, whose symptom is silent — the user asks for 15s and receives
  // 10s with no error. What replaced it must stay model-specific, so a lane xAI does
  // not own keeps its own limits.
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
      !/clampVideoDuration/.test(text),
      path + " clamps video duration by mode alone; the ceiling depends on the model too",
    );
  }
  // 1.5 keeps the full range.
  assert.deepEqual(validateVideoDurationForRequest("grok-imagine-video-1.5", 15, "reference-to-video"), { ok: true });
  // A comfy workflow id arrives through the same field and must not inherit 10s.
  assert.equal(maxRef2vDuration("some-comfy-workflow-id"), null);
  assert.deepEqual(validateVideoDurationForRequest("some-comfy-workflow-id", 15, "reference-to-video"), { ok: true });
  // Outside r2v the shared 1-15 bound is the only one.
  assert.deepEqual(validateVideoDurationForRequest("grok-imagine-video", 15, "image-to-video"), { ok: true });
});

test("the base model's shorter r2v ceiling is enforced before the request is billed", () => {
  const rejected = validateVideoDurationForRequest("grok-imagine-video", 11, "reference-to-video");
  assert.equal("error" in rejected, true);
  assert.equal((rejected as { code: string }).code, "INVALID_VIDEO_DURATION");
  assert.equal((rejected as { status: number }).status, 400);
});

test("the reference-image ceiling is 14, which xAI does enforce", () => {
  // 15 references returns 400 "Too many reference images: 15. Maximum allowed is 14."
  // on both models, so the cap is real and model-independent. It was 7 until xAI
  // doubled it; @imagine announced the change on 2026-09-02 and the API docs still
  // say 7, so the measurement is what this pins.
  assert.equal(MAX_REF2V_REFERENCES, 14);
});

test("two or more references still select reference-to-video", () => {
  assert.equal(deriveVideoMode(0), "text-to-video");
  assert.equal(deriveVideoMode(1), "image-to-video");
  assert.equal(deriveVideoMode(2), "reference-to-video");
  assert.equal(deriveVideoMode(MAX_REF2V_REFERENCES), "reference-to-video");
});
