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
import { readFileSync } from "node:fs";
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

describe("surface routing and entrypoint guards (source contract)", () => {
  const read = (p: string) => readFileSync(p, "utf8");

  it("keys forced-transparent support off activeProvider, not the raw request provider", () => {
    const pipeline = read("lib/generatePipeline.ts");
    // The raw body `provider` defaults to "auto", so it can never be trusted to
    // name the lane that actually runs.
    assert.match(pipeline, /supportsForcedTransparent: activeProvider === "atlascloud"/);
    assert.doesNotMatch(pipeline, /supportsForcedTransparent: provider === /);
  });

  it("resolves background params only after provider resolution", () => {
    const pipeline = read("lib/generatePipeline.ts");
    const activeIdx = pipeline.indexOf("const activeProvider = providerOptions.provider");
    const paramsIdx = pipeline.indexOf("const backgroundParams = resolveImageBackgroundParams");
    assert.ok(activeIdx > 0 && paramsIdx > 0);
    assert.ok(activeIdx < paramsIdx, "backgroundParams must resolve after activeProvider");
  });

  it("refuses transparent on the video route, which has no alpha channel", () => {
    const video = read("routes/video.ts");
    assert.match(video, /backgroundPreset === "transparent"/);
    assert.match(video, /TRANSPARENT_VIDEO_UNSUPPORTED/);
  });

  it("atlas cloud never defaults a transparent request to jpeg", () => {
    const atlas = read("lib/atlasCloudImageAdapter.ts");
    assert.match(atlas, /background === "transparent" \? "png" : "jpeg"/);
  });

  it("ignores provider-reported mime for alpha results and trusts the bytes", () => {
    const pipeline = read("lib/generatePipeline.ts");
    // Atlas reads its mime from the download Content-Type header, so a
    // transparent PNG mislabeled "image/jpeg" would be re-encoded to JPEG by
    // embedImageMetadata's sharp.toFormat() and lose its alpha.
    assert.match(pipeline, /const resultMime = backgroundParams\s*\n\s*\? \(detectMime\(\) \|\| mime\)/);
    assert.match(pipeline, /const resultFormat = backgroundParams/);
    // And a result that claims alpha must actually carry it — verified for the
    // WHOLE batch before any file is written, so a failure cannot leave orphans.
    assert.match(pipeline, /verifyBufferAlpha\(Buffer\.from\(r\.value\.b64, "base64"\), decodeRawForAlpha\)/);
    assert.match(pipeline, /makeTransparentResultError/);
    const verifyIdx = pipeline.indexOf("verifyBufferAlpha(Buffer.from");
    const writeIdx = pipeline.indexOf("await writeFileUnique(");
    assert.ok(verifyIdx > 0 && writeIdx > 0);
    assert.ok(verifyIdx < writeIdx, "alpha verification must precede any file write");
  });

  it("captures the preset on the video item so registration cannot race it", () => {
    const impl = read("ui/src/store/storeAssetGenImpl.ts");
    assert.match(impl, /backgroundPreset: item\.backgroundPreset \?\? s\.assetGenBackground/);
    assert.doesNotMatch(impl, /metadata: \{\s*\n\s*source: "asset-gen",\s*\n\s*backgroundPreset: s\.assetGenBackground/);
  });
});
