import { test } from "node:test";
import assert from "node:assert/strict";

import { buildIma2Capabilities } from "../lib/capabilities.js";
import { buildVideoGenerationPayload } from "../lib/grokVideoAdapter.js";
import { MAX_REF2V_REFERENCES, MAX_REFERENCE_AUDIOS, MAX_VIDEO_DURATION } from "../lib/imageModels.js";

// devlog/_plan/260820_grok15_multi_reference_video/050_capabilities_truth.md (issue #159).
//
// Capabilities advertised one flat set of numbers describing the widest case, so a client
// that believed it would draw controls the server rejects. These tests tie the
// advertisement to the constants the request path actually enforces.

type ModeLimits = {
  maxReferences: number;
  durationRange: [number, number];
  resolutions: string[];
  notes: string;
};

type VideoCapabilities = {
  modes: Record<string, ModeLimits>;
  referenceAudio: {
    maxVoices: number;
    models: string[];
    knownPresets: string[];
    presetsAreAuthoritative: boolean;
  };
};

function caps(): VideoCapabilities {
  const built = buildIma2Capabilities({ packageVersion: "0.0.0-test", source: "server" });
  return built.valid.videoModels as unknown as VideoCapabilities;
}

function plan(mode: "text-to-video" | "image-to-video" | "reference-to-video") {
  return { prompt: "p", mode, duration: 6, resolution: "1080p" as const, aspectRatio: "16:9" as const, webSearchCalls: 0 };
}

test("each video mode advertises its own reference limit", () => {
  const modes = caps().modes;
  assert.equal(modes["reference-to-video"]?.maxReferences, MAX_REF2V_REFERENCES);
  assert.equal(modes["image-to-video"]?.maxReferences, 1);
  assert.equal(modes["text-to-video"]?.maxReferences, 0);
});

test("the advertised reference-to-video resolutions are the ones the server accepts", () => {
  const advertised = caps().modes["reference-to-video"]?.resolutions ?? [];
  assert.ok(!advertised.includes("1080p"), "1080p is rejected upstream for reference-to-video");
  // And the server really does refuse it, so the advertisement is not merely cautious.
  assert.throws(() => buildVideoGenerationPayload(plan("reference-to-video"), {
    model: "grok-imagine-video-1.5",
    referenceImageUrls: ["https://example.invalid/a.png"],
  }));
});

test("image-to-video advertises 1080p and the server allows it", () => {
  const advertised = caps().modes["image-to-video"]?.resolutions ?? [];
  assert.ok(advertised.includes("1080p"));
  const payload = buildVideoGenerationPayload(plan("image-to-video"), {
    model: "grok-imagine-video-1.5",
    sourceImageUrl: "https://example.invalid/a.png",
  });
  assert.equal(payload.resolution, "1080p");
});

test("no mode advertises a duration ceiling the shared range does not allow", () => {
  for (const [mode, entry] of Object.entries(caps().modes)) {
    assert.equal(entry.durationRange[1], MAX_VIDEO_DURATION, mode + " advertises a different ceiling");
  }
});

test("reference audio advertises the enforced ceiling and stays non-authoritative", () => {
  const audio = caps().referenceAudio;
  assert.equal(audio.maxVoices, MAX_REFERENCE_AUDIOS);
  assert.deepEqual(audio.models, ["grok-imagine-video-1.5"]);
  // The roster belongs to xAI, which also accepts custom voice ids we cannot enumerate.
  assert.equal(audio.presetsAreAuthoritative, false);
  assert.ok(audio.knownPresets.includes("eve"));
});
