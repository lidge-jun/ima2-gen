import assert from "node:assert/strict";
import test from "node:test";
import { composerUsesMultimode, effectiveCoreGenerationMode } from "../ui/src/lib/coreGenerationMode.ts";

const base = { provider: "oauth", uiMode: "classic", multimode: true };

test("core mode matches independent operation choices, not the stored toggle alone", () => {
  const cases = [
    [{ provider: "oauth" }, "multimode"], [{ provider: "api" }, "multimode"],
    [{ provider: "grok" }, "multimode"], [{ provider: "grok-api" }, "multimode"], [{ provider: "agy" }, "multimode"],
    [{ provider: "gemini-api" }, "multimode"], [{ provider: "atlascloud" }, "multimode"],
    [{ provider: "minimax" }, "multimode"], [{ provider: "nai" }, "image"],
    [{ provider: "comfy" }, "image"], [{ multimode: false }, "image"],
    [{ uiMode: "node" }, "image"], [{ uiMode: "home" }, "image"],
    [{ provider: "comfy", comfyVideoWorkflow: "wf-selected-video" }, "video"],
    [{ provider: "grok", videoModelSelected: "grok-imagine-video" }, "video"],
    [{ provider: "grok-api", videoModelSelected: "grok-imagine-video-1.5" }, "video"],
    [{ provider: "oauth", videoModelSelected: "grok-imagine-video", comfyVideoWorkflow: "wf-stale" }, "multimode"],
    [{ provider: "nai", videoModelSelected: "grok-imagine-video", comfyVideoWorkflow: "wf-stale" }, "image"],
    [{ provider: "comfy", videoModelSelected: "grok-imagine-video" }, "image"],
  ] as const;
  for (const [overrides, expected] of cases) {
    const input = Object.freeze({ ...base, ...overrides });
    assert.equal(effectiveCoreGenerationMode(input), expected, JSON.stringify(overrides));
    assert.equal(input.multimode, "multimode" in overrides ? overrides.multimode : true);
  }
});

test("unknown and prototype-named providers never index generated surface metadata", () => {
  for (const provider of ["auto", "missing", "constructor", "__proto__", "toString", ""]) {
    assert.equal(effectiveCoreGenerationMode({ ...base, provider }), "image", provider);
  }
});

test("composer selector uses effective core mode and preserves independent MCP preference", () => {
  assert.equal(composerUsesMultimode(base), true);
  assert.equal(composerUsesMultimode({ ...base, provider: "comfy" }), false);
  assert.equal(composerUsesMultimode({ ...base, provider: "nai" }), false);
  assert.equal(composerUsesMultimode({ ...base, provider: "grok-api", videoModelSelected: "grok-imagine-video" }), false);
  assert.equal(composerUsesMultimode({ ...base, provider: "comfy", mcpProvider: "fixture-mcp" }), true);
  assert.equal(composerUsesMultimode({ ...base, mcpProvider: "fixture-mcp", multimode: false }), false);
});

test("absent, undefined, null and false video choices remain image choices on Comfy", () => {
  for (const comfyVideoWorkflow of [undefined, null, ""]) {
    assert.equal(effectiveCoreGenerationMode({ ...base, provider: "comfy", comfyVideoWorkflow }), "image");
  }
  for (const videoModelSelected of [undefined, null, false] as const) {
    assert.equal(effectiveCoreGenerationMode({ ...base, provider: "grok-api", videoModelSelected }), "multimode");
  }
});
