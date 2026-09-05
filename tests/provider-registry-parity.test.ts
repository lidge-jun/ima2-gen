import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { ELEMENT_CAPACITY_DEFAULTS } from "../lib/elementCompiler.js";
import { REGISTRY } from "../lib/providers/registry.ts";
import { deriveProviderSurfaceSupportFrom } from "../lib/providers/surfaceSupport.ts";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const CORE_IDS = ["oauth", "api", "grok", "grok-api", "agy", "gemini-api", "atlascloud", "minimax", "nai", "comfy"];
const OPENAI_MODELS = ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"];
const CLI_IMAGE_MODELS = [
  ...OPENAI_MODELS,
  "gpt-5.3-codex-spark",
  "grok-imagine-image-2.0", "grok-imagine-image", "grok-imagine-image-quality",
  "nano-banana-2", "nano-banana-pro", "image-01", "image-01-live",
  "nai-diffusion-5-full", "nai-diffusion-5-curated", "nai-diffusion-4-5-full", "nai-diffusion-4-5-curated",
];

function provider(id: string) {
  return REGISTRY.find((entry) => entry.id === id)!;
}

function models(id: string, kind: "image" | "video") {
  return provider(id).models.filter((model) => model.kind === kind).map((model) => model.id);
}

function referenceLimits(mode: "image" | "edit" | "video") {
  return Object.fromEntries(REGISTRY.flatMap((entry) => {
    const limits = entry.referenceLimits as Partial<Record<typeof mode, number>>;
    return limits[mode] === undefined ? [] : [[entry.id, limits[mode]]];
  }));
}

describe("core provider registry parity", () => {
  it("preserves core ids and model sets exactly", () => {
    assert.deepEqual(REGISTRY.map((entry) => entry.id), CORE_IDS);
    assert.deepEqual(models("oauth", "image").filter((id) => id !== "gpt-5.3-codex-spark"), OPENAI_MODELS);
    assert.deepEqual(models("oauth", "image").filter((id) => id === "gpt-5.3-codex-spark"), ["gpt-5.3-codex-spark"]);
    assert.deepEqual(models("grok", "image"), ["grok-imagine-image-2.0", "grok-imagine-image", "grok-imagine-image-quality"]);
    assert.deepEqual(models("gemini-api", "image"), ["nano-banana-2", "nano-banana-pro"]);
    assert.deepEqual(models("atlascloud", "image"), [
      "openai/gpt-image-2/text-to-image", "openai/gpt-image-2/edit",
    ]);
    assert.deepEqual(models("minimax", "image"), ["image-01", "image-01-live"]);
    const cliModels = [...new Set(REGISTRY.flatMap((entry) => models(entry.id, "image")))].filter((id) => !id.includes("/"));
    assert.deepEqual(cliModels, CLI_IMAGE_MODELS);
    assert.deepEqual([...config.imageModels.valid], OPENAI_MODELS);
  });

  it("preserves all four reference-capacity layers", () => {
    assert.equal(config.limits.maxRefCount, 5);
    assert.deepEqual(referenceLimits("image"), {
      // nai is absent on purpose: the lane takes no reference input, so it
      // declares no capacity rather than a capacity the adapter cannot honor.
      grok: 3, "grok-api": 3, agy: 3, "gemini-api": 3, atlascloud: 10, minimax: 1, comfy: 4,
    });
    assert.deepEqual(referenceLimits("video"), { grok: 7, "grok-api": 7 });
    assert.deepEqual(ELEMENT_CAPACITY_DEFAULTS, {
      gpt: { image: { maxTotalRefs: 6, maxRefsPerElement: 6 }, edit: { maxTotalRefs: 6, maxRefsPerElement: 6 }, video: { maxTotalRefs: 1, maxRefsPerElement: 6 } },
      gemini: { image: { maxTotalRefs: 6, maxRefsPerElement: 6 }, edit: { maxTotalRefs: 6, maxRefsPerElement: 6 }, video: { maxTotalRefs: 3, maxRefsPerElement: 6 } },
      grok: { image: { maxTotalRefs: 4, maxRefsPerElement: 4 }, edit: { maxTotalRefs: 4, maxRefsPerElement: 4 }, video: { maxTotalRefs: 1, maxRefsPerElement: 4 } },
    });
    // MCP transport is a separate owner, so read its real enforcement instead of
    // asserting a literal against itself: routes/mcpMedia.ts rejects >3 entries.
    const mcpSource = readFileSync(join(repoRoot, "routes/mcpMedia.ts"), "utf8");
    assert.match(mcpSource, /references\.length > 3/);
    assert.equal(
      REGISTRY.some((entry) => (entry.referenceLimits as Record<string, number>).mcp !== undefined),
      false,
      "MCP transport limit must stay outside the core registry",
    );
  });

  it("declares mask support exactly where the edit route allows it", () => {
    // The oracle is the ACTIVE route, not the manifest talking to itself:
    // routes/edit.ts names the lanes it rejects masks for, and everything else
    // reaches editViaResponses, whose options accept a mask.
    const editSource = readFileSync(join(repoRoot, "routes/edit.ts"), "utf8");
    const adapterSource = readFileSync(join(repoRoot, "lib/responsesImageAdapter.ts"), "utf8");
    assert.match(editSource, /editViaResponses\(/);
    assert.match(adapterSource, /\bmask\?: string(?: \| undefined)?;/);

    assert.match(editSource, /getProviderSurfaceSupport\(activeProvider,\s*"edit"\)\?\.mask\s*===\s*false/);
    const maskRejectedLanes = REGISTRY
      .map((entry) => entry.id)
      .filter((id) => deriveProviderSurfaceSupportFrom(REGISTRY, id, "edit")?.mask === false);

    assert.deepEqual(
      maskRejectedLanes.sort(),
      ["agy", "atlascloud", "comfy", "gemini-api", "grok", "grok-api", "minimax", "nai"],
      "surface policy must preserve the existing mask rejection matrix",
    );

    for (const entry of REGISTRY) {
      const rejected = maskRejectedLanes.includes(entry.id);
      for (const model of entry.models) {
        if (model.kind !== "image") continue;
        const expected = rejected ? false : model.supports.generate;
        assert.equal(
          model.supports.mask,
          expected,
          `${entry.id}/${model.id} mask capability must match the edit route`,
        );
      }
    }
  });

  it("keeps credential metadata faithful to runtime plumbing", () => {
    const configSource = readFileSync(join(repoRoot, "config.ts"), "utf8");
    const oauthCredential = provider("oauth").credentials[0] as { envVars: readonly string[] };
    // ./config.ts reads both names, so the manifest must list both.
    assert.match(configSource, /env\.IMA2_OAUTH_PROXY_PORT, env\.OAUTH_PORT/);
    assert.deepEqual([...oauthCredential.envVars], ["IMA2_OAUTH_PROXY_PORT", "OAUTH_PORT"]);

    const minimaxCredential = provider("minimax").credentials[0] as {
      validateUrl?: string;
      validateUrlIsFallback?: boolean;
    };
    const keysSource = readFileSync(join(repoRoot, "routes/keys.ts"), "utf8");
    assert.match(keysSource, /resolveMinimaxValidateUrl/);
    assert.equal(minimaxCredential.validateUrlIsFallback, true);
    assert.equal(minimaxCredential.validateUrl, "https://api.minimax.io/v1/models");

    // Timeouts must match what the runtime actually uses.
    assert.equal(provider("oauth").limits.timeoutMs, config.oauth.generationTimeoutMs);
  });
});
