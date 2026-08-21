// Contract tests for gpt-image-2 transparent background support (260821).
//
// The load-bearing fact these tests pin: the OAuth path must NOT send a forced
// background:"transparent". The live proxy rejects it with HTTP 400
// "Transparent background is not supported for this model." because the ChatGPT
// session pins the tool to the gpt-image-2-codex variant. "auto" plus a cutout
// prompt is what actually returns a real alpha channel.
// Evidence: devlog/_plan/260821_gpt_image2_transparent_background/{000,001}.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BACKGROUND_PRESETS,
  parseBackgroundPreset,
  backgroundPromptSuffix,
  backgroundPlannerConstraint,
  isColorKeyablePreset,
  presetRequiresAlpha,
} from "../lib/backgroundPresets.ts";
import {
  resolveImageBackgroundParams,
  validateTransparentFormat,
  isAlphaCapableFormat,
  ALPHA_CAPABLE_FORMATS,
} from "../lib/imageBackgroundParam.ts";
import { tools } from "../lib/responsesTools.ts";

describe("transparent preset registration", () => {
  it("is an accepted background preset", () => {
    assert.ok((BACKGROUND_PRESETS as readonly string[]).includes("transparent"));
    assert.deepEqual(parseBackgroundPreset("transparent"), { preset: "transparent" });
  });

  it("is NOT color-keyable: there is no matte to key out", () => {
    assert.equal(isColorKeyablePreset("transparent"), false);
    for (const preset of ["chroma-green", "white", "black"] as const) {
      assert.equal(isColorKeyablePreset(preset), true);
    }
  });

  it("is the only preset that requires alpha", () => {
    assert.equal(presetRequiresAlpha("transparent"), true);
    assert.equal(presetRequiresAlpha("chroma-green"), false);
    assert.equal(presetRequiresAlpha(null), false);
  });

  it("planner constraint forbids substituting a solid color", () => {
    const constraint = backgroundPlannerConstraint("transparent");
    assert.match(constraint, /alpha channel/i);
    assert.match(constraint, /never substitute a solid color/i);
  });
});

describe("OAuth path never forces background:transparent", () => {
  it("maps the transparent preset to auto when forcing is unsupported", () => {
    const params = resolveImageBackgroundParams({ preset: "transparent", supportsForcedTransparent: false });
    assert.equal(params?.background, "auto", "forcing transparent 400s on gpt-image-2-codex");
    assert.equal(params?.outputFormat, "png");
  });

  it("uses the forced value only where the API supports it", () => {
    const params = resolveImageBackgroundParams({ preset: "transparent", supportsForcedTransparent: true });
    assert.equal(params?.background, "transparent");
  });

  it("returns null for non-transparent presets so existing payloads are unchanged", () => {
    for (const preset of ["chroma-green", "white", "black", null, undefined] as const) {
      assert.equal(resolveImageBackgroundParams({ preset }), null);
    }
  });

  it("honors an explicit alpha-capable format", () => {
    const params = resolveImageBackgroundParams({ preset: "transparent", requestedFormat: "webp" });
    assert.equal(params?.outputFormat, "webp");
  });

  it("never resolves to jpeg, which cannot hold alpha", () => {
    const params = resolveImageBackgroundParams({ preset: "transparent", requestedFormat: "jpeg" });
    assert.ok(params);
    assert.ok(ALPHA_CAPABLE_FORMATS.includes(params!.outputFormat!));
  });
});

describe("jpeg + transparent conflict guard (activation)", () => {
  it("fires for an explicitly requested jpeg", () => {
    const conflict = validateTransparentFormat("transparent", "jpeg");
    assert.ok(conflict, "guard must fire");
    assert.equal(conflict?.code, "TRANSPARENT_FORMAT_CONFLICT");
    assert.match(conflict!.error, /alpha-capable/);
  });

  it("stays silent for alpha-capable formats and unset formats", () => {
    for (const format of ["png", "webp", undefined, null, ""]) {
      assert.equal(validateTransparentFormat("transparent", format), null);
    }
  });

  it("never fires for opaque presets", () => {
    assert.equal(validateTransparentFormat("chroma-green", "jpeg"), null);
    assert.equal(validateTransparentFormat(null, "jpeg"), null);
  });

  it("classifies formats correctly", () => {
    assert.equal(isAlphaCapableFormat("png"), true);
    assert.equal(isAlphaCapableFormat("webp"), true);
    assert.equal(isAlphaCapableFormat("jpeg"), false);
    assert.equal(isAlphaCapableFormat(undefined), false);
  });
});

describe("image_generation tool payload wiring", () => {
  it("carries background and output_format into the tool", () => {
    const [imageTool] = tools(false, { quality: "high", size: "1024x1024", background: "auto", output_format: "png" });
    assert.equal(imageTool!.type, "image_generation");
    assert.equal(imageTool!.background, "auto");
    assert.equal(imageTool!.output_format, "png");
  });

  it("omits both keys when unset, preserving the legacy payload shape", () => {
    const [imageTool] = tools(false, { quality: "high", size: "1024x1024" });
    assert.ok(!("background" in imageTool!));
    assert.ok(!("output_format" in imageTool!));
  });

  it("keeps web_search ordering intact", () => {
    const requestTools = tools(true, { background: "auto" });
    assert.equal(requestTools[0]!.type, "web_search");
    assert.equal(requestTools[1]!.type, "image_generation");
  });
});

describe("prompt suffix carries the cutout intent that actually drives alpha", () => {
  it("names transparency and forbids backdrop/shadow", () => {
    const suffix = backgroundPromptSuffix("transparent", "image");
    assert.match(suffix, /no backdrop/i);
    assert.match(suffix, /no drop shadow/i);
    assert.match(suffix, /checkerboard/i);
  });

  it("preserves partial alpha for translucent subjects", () => {
    assert.match(backgroundPromptSuffix("transparent", "image"), /partial transparency/i);
  });
});
