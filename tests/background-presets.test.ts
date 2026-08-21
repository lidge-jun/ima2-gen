import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BACKGROUND_PRESETS,
  parseBackgroundPreset,
  backgroundPromptSuffix,
  backgroundPlannerConstraint,
} from "../lib/backgroundPresets.ts";
import { buildGrokPlannerPayload } from "../lib/grokImageAdapter.ts";
import { buildGrokVideoPlannerPayload } from "../lib/grokVideoAdapter.ts";

describe("backgroundPresets parse", () => {
  it("accepts all valid presets", () => {
    for (const preset of BACKGROUND_PRESETS) {
      assert.deepEqual(parseBackgroundPreset(preset), { preset });
    }
  });
  it("treats undefined/null/empty as unspecified (backward compat)", () => {
    for (const raw of [undefined, null, ""]) {
      assert.deepEqual(parseBackgroundPreset(raw), { preset: null });
    }
  });
  it("rejects unknown values with INVALID_BACKGROUND_PRESET", () => {
    // "transparent" is a VALID preset since 260821 (gpt-image-2 alpha support).
    for (const raw of ["green", "alpha", 42, {}]) {
      const parsed = parseBackgroundPreset(raw);
      assert.ok("error" in parsed, `expected error for ${String(raw)}`);
      if ("error" in parsed) assert.equal(parsed.code, "INVALID_BACKGROUND_PRESET");
    }
  });
});

describe("backgroundPromptSuffix", () => {
  it("image suffix demands a uniform background per preset", () => {
    assert.match(backgroundPromptSuffix("chroma-green", "image"), /uniform solid chroma key green/);
    assert.match(backgroundPromptSuffix("white", "image"), /seamless white studio background/);
    assert.match(backgroundPromptSuffix("black", "image"), /seamless black studio background/);
  });
  it("transparent suffix demands a real alpha channel, not a colored matte", () => {
    const suffix = backgroundPromptSuffix("transparent", "image");
    assert.match(suffix, /fully transparent/i);
    assert.match(suffix, /alpha channel/i);
    // The whole point is that it must NOT ask for a solid backdrop.
    assert.doesNotMatch(suffix, /uniform solid/i);
  });
  it("video suffix additionally pins per-frame stability", () => {
    const suffix = backgroundPromptSuffix("chroma-green", "video");
    assert.match(suffix, /uniform solid chroma key green/);
    assert.match(suffix, /every frame of the video/);
  });
  it("image suffix never contains the video clause", () => {
    assert.doesNotMatch(backgroundPromptSuffix("chroma-green", "image"), /every frame/);
  });
});

describe("grok planner background constraint", () => {
  it("inserts the constraint line into planner user content when provided", () => {
    const constraint = backgroundPlannerConstraint("chroma-green");
    const payload = buildGrokPlannerPayload(
      "a red apple", "grok-imagine-image", "1024x1024",
      { width: 1024, height: 1024 } as never, "grok-4.3", "", 0, constraint,
    );
    const userMessage = payload.messages.find((m: { role: string }) => m.role === "user") as { content: { type: string; text?: string }[] };
    const text = userMessage.content.find((c) => c.type === "text")?.text ?? "";
    assert.ok(text.includes(constraint), "constraint line missing from planner user content");
    const lines = text.split("\n");
    assert.ok(lines.indexOf(constraint) < lines.indexOf("User prompt:"), "constraint must precede the user prompt");
  });
  it("omits the line when no constraint is provided (backward compat)", () => {
    const payload = buildGrokPlannerPayload(
      "a red apple", "grok-imagine-image", "1024x1024",
      { width: 1024, height: 1024 } as never, "grok-4.3", "", 0,
    );
    const userMessage = payload.messages.find((m: { role: string }) => m.role === "user") as { content: { type: string; text?: string }[] };
    const text = userMessage.content.find((c) => c.type === "text")?.text ?? "";
    assert.doesNotMatch(text, /Hard constraint/);
  });
});

describe("grok video planner background constraint", () => {
  const baseOpts = {
    model: "grok-imagine-video",
    mode: "text-to-video" as const,
    duration: 5,
    resolution: "720p" as const,
    aspectRatio: "1:1" as const,
  };

  it("inserts the constraint line before the return-instruction line", () => {
    const constraint = backgroundPlannerConstraint("chroma-green");
    const payload = buildGrokVideoPlannerPayload("a rotating apple", { ...baseOpts, backgroundConstraint: constraint });
    const userMessage = payload.messages.find((m: { role: string }) => m.role === "user") as { content: { type: string; text?: string }[] };
    const text = userMessage.content.find((c) => c.type === "text")?.text ?? "";
    const lines = text.split("\n");
    const ci = lines.indexOf(constraint);
    const ri = lines.findIndex((l) => l.startsWith("Return the generate_video.prompt"));
    assert.ok(ci !== -1, "constraint line missing");
    assert.ok(ci < ri, "constraint must precede the return instruction");
  });

  it("omits the line without a constraint (backward compat)", () => {
    const payload = buildGrokVideoPlannerPayload("a rotating apple", baseOpts);
    const userMessage = payload.messages.find((m: { role: string }) => m.role === "user") as { content: { type: string; text?: string }[] };
    const text = userMessage.content.find((c) => c.type === "text")?.text ?? "";
    assert.doesNotMatch(text, /Hard constraint/);
  });
});
