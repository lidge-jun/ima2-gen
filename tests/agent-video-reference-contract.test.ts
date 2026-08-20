import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { cleanVideoParams } from "../lib/agentGenerationPlanner.js";
import { normalizeVideoGenerationRequest, isVideoGenerationError } from "../lib/videoGenerationRequest.js";
import { validateVideoResolutionForRequest } from "../lib/imageModels.js";

// devlog/_plan/260820_grok15_multi_reference_video/020_agent_reference_loss.md (issue #156).
//
// The agent video path could not reach reference-to-video at all: its local mode variable
// was typed to exclude it, references never entered the normalizer, and the branch that
// looked like it handled R2V was unreachable. It also ignored the planner's
// sourceImagePolicy, so "make something new" still welded the previous image on.

test("the planner can express what the attached image is for", () => {
  assert.equal(cleanVideoParams({ mode: "reference-to-video" })?.mode, "reference-to-video");
  assert.equal(cleanVideoParams({ mode: "image-to-video" })?.mode, "image-to-video");
});

test("a bogus planner mode is dropped rather than trusted", () => {
  assert.equal(cleanVideoParams({ mode: "sideways-to-video" })?.mode, undefined);
  assert.equal(cleanVideoParams({ duration: 6 })?.mode, undefined);
});

test("references survive the normalizer the agent path shares with HTTP", () => {
  const result = normalizeVideoGenerationRequest({
    prompt: "carry this character into a new scene",
    mode: "reference-to-video",
    referenceImages: ["b64data"],
  });
  assert.ok(!isVideoGenerationError(result));
  assert.equal(result.request.mode, "reference-to-video");
  assert.deepEqual(result.request.referenceImages, ["b64data"]);
});

test("reference-to-video at 1080p is refused, not quietly downgraded", () => {
  const check = validateVideoResolutionForRequest("grok-imagine-video-1.5", "1080p", "reference-to-video");
  assert.ok(!("ok" in check), "xAI rejects 1080p for reference-to-video, so we must too");
});

test("the agent video path no longer discards reference intent", () => {
  const source = readFileSync(new URL("../lib/agentImageVideoGen.ts", import.meta.url), "utf8");
  assert.ok(
    !/mode:\s*videoParams\.mode === "reference-to-video" \? "text-to-video"/.test(source),
    "the agent path must not rewrite reference-to-video into text-to-video",
  );
  assert.ok(
    /referenceImages: videoParams\.referenceImages/.test(source),
    "references must reach generateVideoViaGrok, not stop at the normalizer",
  );
  assert.ok(
    /options\.sourceImagePolicy/.test(source),
    "the video path must consult the planner policy the image path already honors",
  );
});

test("the runtime forwards the policy the video path now reads", () => {
  // Reading options.sourceImagePolicy is useless if the caller never sets it.
  const runtime = readFileSync(new URL("../lib/agentRuntime.ts", import.meta.url), "utf8");
  const videoCall = runtime.slice(runtime.indexOf("runAgentVideoGeneration("));
  assert.ok(
    /sourceImagePolicy: plan\.sourceImagePolicy/.test(videoCall.slice(0, 600)),
    "the video dispatch must pass sourceImagePolicy like the image dispatch does",
  );
});
