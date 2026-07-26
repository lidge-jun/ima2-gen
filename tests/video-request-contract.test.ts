import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  deriveVideoMode,
  isVideoGenerationError,
  normalizeVideoGenerationRequest,
} from "../lib/videoGenerationRequest.js";

// WP7 / issue #84 (devlog/_plan/260726_zero-backlog-frontend-qa/070_video_request_unification.md).

function ok(input: Parameters<typeof normalizeVideoGenerationRequest>[0]) {
  const result = normalizeVideoGenerationRequest(input);
  assert.ok(!isVideoGenerationError(result), `expected success, got ${JSON.stringify(result)}`);
  return result.request;
}

test("mode is derived from what the caller actually supplied", () => {
  assert.equal(deriveVideoMode({}), "text-to-video");
  assert.equal(deriveVideoMode({ sourceFilename: "a.png" }), "image-to-video");
  assert.equal(deriveVideoMode({ sourceImage: "data:..." }), "image-to-video");
  assert.equal(deriveVideoMode({ referenceImages: ["a"] }), "reference-to-video");
  assert.equal(deriveVideoMode({ referenceFilenames: ["a.png"] }), "reference-to-video");
});

test("an explicit mode wins over inference", () => {
  assert.equal(ok({ prompt: "x", mode: "text-to-video", sourceFilename: "a.png" }).mode, "text-to-video");
});

test("conflicting sources are rejected instead of silently ignored", () => {
  // The server consumes one of them; accepting both means dropping the other without
  // telling anyone.
  const result = normalizeVideoGenerationRequest({
    prompt: "x",
    sourceImage: "data:image/png;base64,AAA",
    sourceFilename: "a.png",
  });
  assert.ok(isVideoGenerationError(result));
  assert.equal(result.code, "VIDEO_SOURCE_CONFLICT");
  assert.equal(result.status, 400);
});

test("all three surfaces land on the same defaults from a minimal request", () => {
  // UI store, CLI and agent runtime each used to apply their own fallbacks.
  const fromUi = ok({ prompt: "a cat" });
  const fromCli = ok({ prompt: "a cat", provider: "grok" });
  const fromAgent = ok({ prompt: "a cat", duration: undefined, resolution: undefined, aspectRatio: undefined });

  for (const request of [fromUi, fromCli, fromAgent]) {
    assert.equal(request.duration, 5);
    assert.equal(request.resolution, "480p");
    assert.equal(request.aspectRatio, "auto");
    assert.equal(request.mode, "text-to-video");
  }
});

test("invalid values are refused rather than coerced", () => {
  for (const input of [
    { prompt: "x", duration: 999 },
    { prompt: "x", resolution: "8k" },
    { prompt: "x", aspectRatio: "banana" },
    { prompt: "  " },
  ]) {
    assert.ok(isVideoGenerationError(normalizeVideoGenerationRequest(input)), JSON.stringify(input));
  }
});

test("optional fields are omitted rather than sent as undefined", () => {
  const request = ok({ prompt: "x" });
  for (const key of ["sourceImage", "sourceFilename", "topic", "storyboard", "plannerModel"]) {
    assert.ok(!(key in request), `${key} should be absent, not undefined`);
  }
});

test("the agent path routes through the shared normalizer", () => {
  const agent = readFileSync("lib/agentImageVideoGen.ts", "utf8");
  assert.match(agent, /normalizeVideoGenerationRequest\(/);
  assert.match(agent, /isVideoGenerationError\(normalized\)/);
  // The inline `?? 5` / `?? "480p"` fallbacks are what let the agent drift.
  assert.doesNotMatch(agent, /duration: videoParams\.duration \?\? 5/);
  assert.doesNotMatch(agent, /resolution: videoParams\.resolution \?\? "480p"/);
});

test("extend and edit keep their own contract", () => {
  // The extend/edit-only fields must not become part of the generate request TYPE.
  // Checking the declared shape rather than the file text, so the doc comment explaining
  // the exclusion cannot trip its own assertion.
  const request = ok({ prompt: "x" });
  for (const key of ["videoUrl", "operation", "sourceVideoId"]) {
    assert.ok(!(key in request), `${key} belongs to extend/edit, not generate`);
  }
  const type = readFileSync("lib/videoGenerationRequest.ts", "utf8")
    .split("export type VideoGenerationRequest = {")[1]
    ?.split("};")[0] ?? "";
  assert.doesNotMatch(type, /videoUrl|sourceVideoId|operation/);
});
