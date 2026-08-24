// wp3 routing contract for the NovelAI lane.
//
// The load-bearing part is the alpha guard at the bottom. NovelAI V5 returns a
// real RGBA PNG when straight_alpha is set (measured 42.1% transparent pixels
// against the live service), and persistence re-encodes through
// sharp.toFormat(resultFormat). So a single conditional decides whether the
// feature exists: put "nai" in a JPEG-forcing list and the transparency is
// silently flattened while every other test stays green.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveProviderOptions } from "../lib/providerOptions.ts";
import { normalizeNaiImageModel } from "../lib/imageModels.ts";
import { createTestRuntimeContext } from "../lib/runtimeContext.ts";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (rel: string) => readFileSync(join(repoRoot, rel), "utf8");

function naiCtx() {
  return createTestRuntimeContext({
    naiApiKey: "nai-test-token",
    config: {
      naiProvider: {
        defaultImageModel: "nai-diffusion-5-full",
        baseUrl: "https://image.novelai.net",
        accountBaseUrl: "https://image.novelai.net",
        generationTimeoutMs: 180_000,
        defaultSteps: 23,
        defaultScale: 5,
        defaultSampler: "k_euler_ancestral",
        defaultNoiseSchedule: "karras",
      },
    },
  } as never);
}

/** Isolates one expression so a match cannot leak in from a neighbouring line. */
function expressionAt(source: string, anchor: string): string {
  const start = source.indexOf(anchor);
  assert.notEqual(start, -1, `anchor not found, the file changed shape: ${anchor}`);
  const end = source.indexOf(";", start);
  assert.notEqual(end, -1, `no statement terminator after: ${anchor}`);
  return source.slice(start, end);
}

test("nai provider options default to V5 Full at NovelAI's native portrait size", () => {
  const resolved = resolveProviderOptions(naiCtx(), { provider: "nai" });
  assert.equal(resolved.provider, "nai");
  assert.equal(resolved.model, "nai-diffusion-5-full");
  assert.equal(resolved.size, "832x1216");
  assert.equal(resolved.reasoningEffort, "none");
  assert.equal(resolved.webSearchEnabled, false, "NovelAI has no search tool");
});

test("nai provider options accept every shipped model and reject unknown ones", () => {
  for (const model of [
    "nai-diffusion-5-full",
    "nai-diffusion-5-curated",
    "nai-diffusion-4-5-full",
    "nai-diffusion-4-5-curated",
  ]) {
    assert.equal(resolveProviderOptions(naiCtx(), { provider: "nai", rawModel: model }).model, model);
  }

  const bad = resolveProviderOptions(naiCtx(), { provider: "nai", rawModel: "nai-diffusion-9000" });
  assert.equal(bad.code, "INVALID_NAI_IMAGE_MODEL");
  assert.equal(bad.status, 400);

  assert.equal(normalizeNaiImageModel("").model, "nai-diffusion-5-full", "empty falls back, no error");
});

test("nai refuses reference input rather than discarding it", () => {
  // The adapter is text-to-image only. Every entry point that could carry an
  // image must say so out loud; a silent drop would look like a bad edit.
  assert.match(read("lib/generatePipeline.ts"), /activeProvider === "nai" && providerRefCount > 0/);
  assert.match(read("lib/generatePipeline.ts"), /NAI_REF_UNSUPPORTED/);
  assert.match(read("lib/nodeGeneration.ts"), /activeProvider === "nai" && inputImageCount > 0/);
  assert.match(read("routes/edit.ts"), /NAI_EDIT_UNSUPPORTED/);
});

test("no nai dispatch forwards references to the adapter", () => {
  // generateViaNai has no references parameter. A copied MiniMax branch would
  // either fail typecheck or, behind a cast, drop the user's image silently.
  for (const file of [
    "lib/generatePipeline.ts",
    "lib/multimodePipeline.ts",
    "lib/nodeGeneration.ts",
    "lib/agentImageVideoGen.ts",
  ]) {
    const source = read(file);
    let index = source.indexOf("generateViaNai(");
    while (index !== -1) {
      const call = source.slice(index, source.indexOf("})", index) + 2);
      assert.ok(
        !/\breferences\s*:/.test(call),
        `${file}: a generateViaNai call passes references, which the adapter cannot use`,
      );
      index = source.indexOf("generateViaNai(", index + 1);
    }
  }
});

test("every NAI_ code the lane can emit is classified", () => {
  // An unmapped code degrades to an unclassified failure in the UI.
  const map = read("lib/errors/providerMap.ts");
  for (const code of [
    "NAI_API_KEY_MISSING", "NAI_AUTH_FAILED", "NAI_SUBSCRIPTION_REQUIRED",
    "NAI_BAD_REQUEST", "NAI_RATE_LIMITED", "NAI_UPSTREAM_ERROR",
    "NAI_EMPTY_IMAGE", "NAI_IMAGE_INVALID", "NAI_RESPONSE_NOT_ZIP",
    "NAI_ZIP_INVALID", "NAI_ZIP_UNSUPPORTED", "NAI_ZIP_TOO_LARGE",
    "NAI_REF_UNSUPPORTED", "NAI_EDIT_UNSUPPORTED", "NAI_MASK_UNSUPPORTED",
  ]) {
    assert.match(map, new RegExp(`\\b${code}:`), `${code} is not in PROVIDER_ERROR_MAP`);
  }
});

test("the nai lane advertises no capability the routes refuse", () => {
  // A catalog that promises image_references while the route answers
  // NAI_REF_UNSUPPORTED is worse than one that omits the feature.
  const models = read("routes/models.ts");
  const laneStart = models.indexOf("function naiLane(");
  assert.notEqual(laneStart, -1);
  const lane = models.slice(laneStart, models.indexOf("\n}", laneStart));
  assert.match(lane, /textOnlyCapabilities\(\)/);
  assert.ok(!/image_references/.test(lane));
});

test("nai never joins a JPEG-forcing conditional", () => {
  // Three sites, each isolated so a nearby MIME line cannot produce a false pass.
  const sites: Array<[string, string]> = [
    ["lib/generatePipeline.ts", "const providerForcesJpeg ="],
    ["lib/multimodePipeline.ts", "const mmFormat ="],
    ["lib/nodeGeneration.ts", 'let resultFormat: "png" | "jpeg" | "webp" ='],
  ];
  for (const [file, anchor] of sites) {
    const expression = expressionAt(read(file), anchor);
    assert.ok(
      !/activeProvider === "nai"/.test(expression),
      `${file} ${anchor} must not force jpeg for nai: V5 straight_alpha returns RGBA and toFormat("jpeg") would flatten it`,
    );
  }
});

test("nai is present at every MIME-reporting site", () => {
  const sites: Array<[string, string]> = [
    ["lib/generatePipeline.ts", "const providerReportsMime ="],
    ["lib/multimodePipeline.ts", "const resultMime = activeProvider"],
    ["lib/multimodePipeline.ts", "const resultFormat = activeProvider"],
    ["lib/nodeGeneration.ts", 'if (activeProvider === "grok" || activeProvider === "grok-api"'],
    ["lib/agentImageVideoGen.ts", "const format = activeProvider"],
    ["routes/edit.ts", "const editMime = activeProvider"],
    ["routes/edit.ts", "const editExt = activeProvider"],
  ];
  for (const [file, anchor] of sites) {
    const expression = expressionAt(read(file), anchor);
    assert.ok(
      /activeProvider === "nai"/.test(expression),
      `${file} ${anchor} must report nai's own mime so the PNG survives persistence`,
    );
  }
});
