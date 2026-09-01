// GPT-5.6 rollout contract (devlog/_plan/260707_gpt56-oidc-devlog-hardening).
// Activation evidence for the widened validators: the previously-rejecting
// branches must now accept gpt-5.6-* and "max", while unknown values still
// hit the reject branch (proving the guard is alive, not removed).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeImageModel, normalizeReasoningEffort } from "../lib/imageModels.ts";
import { config } from "../config.ts";

const GPT56_MODELS = ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"];

function readSource(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("gpt-5.6 rollout: validators", () => {
  it("accepts every GPT-5.6 slug (fires the accept branch)", () => {
    for (const model of GPT56_MODELS) {
      assert.deepEqual(normalizeImageModel({}, model), { model });
    }
  });

  it("still rejects unknown gpt-family slugs (reject branch alive)", () => {
    const result = normalizeImageModel({}, "gpt-5.6-nova");
    assert.equal(result.code, "INVALID_IMAGE_MODEL");
    assert.equal(result.status, 400);
    assert.match(result.error ?? "", /gpt-5\.6-sol, gpt-5\.6-terra, gpt-5\.6-luna/);
  });

  it("accepts max reasoning effort (previously rejected)", () => {
    assert.deepEqual(normalizeReasoningEffort({}, "max"), { effort: "max" });
  });

  it("still rejects non-ladder reasoning efforts", () => {
    const result = normalizeReasoningEffort({}, "ultra");
    assert.equal(result.code, "INVALID_REASONING_EFFORT");
    assert.equal(result.status, 400);
    assert.match(result.error ?? "", /max/);
  });

  it("uses luna as the product default", () => {
    assert.deepEqual(normalizeImageModel({}, undefined), { model: "gpt-5.6-luna" });
    assert.equal(config.imageModels.default, "gpt-5.6-luna");
  });
});

describe("gpt-5.6 rollout: runtime config", () => {
  it("config advertises the 5.6 slugs and max effort", () => {
    for (const model of GPT56_MODELS) {
      assert.ok(config.imageModels.valid.has(model), `config valid set missing ${model}`);
    }
    assert.ok(config.imageModels.validReasoningEfforts.has("max"));
  });
});

describe("gpt-5.6 rollout: surface contracts", () => {
  it("CLI validators know the 5.6 slugs and max", () => {
    // gen.ts moved to catalog-driven validation (010 CLI strict routing):
    // the resolver validates models against GET /api/models, so gen.ts no
    // longer embeds a KNOWN_IMAGE_MODELS literal. Assert the resolver wiring
    // plus the still-local reasoning ladder instead.
    const genSrc = readSource("bin/commands/gen.ts");
    assert.match(genSrc, /resolveTarget\(\s*"image"/);
    assert.match(genSrc, /\/api\/models/);
    assert.match(genSrc, /none, low, medium, high, xhigh, max/);
    const editSrc = readSource("bin/commands/edit.ts");
    const generatedProviders = readSource("ui/src/generated/providers.ts");
    for (const model of GPT56_MODELS) {
      assert.ok(generatedProviders.includes(`"${model}"`), `generated provider models missing ${model}`);
    }
    assert.match(editSrc, /none, low, medium, high, xhigh, max/);
    for (const path of ["bin/commands/multimode.ts", "bin/commands/node.ts"]) {
      assert.match(readSource(path), /none, low, medium, high, xhigh, max/);
    }
  });

  it("prompt builder accepts the 5.6 slugs", () => {
    const src = readSource("lib/promptBuilder/constants.ts");
    for (const model of GPT56_MODELS) {
      assert.ok(src.includes(`"${model}"`), `prompt builder constants missing ${model}`);
    }
    const menu = readSource("ui/src/components/prompt-builder/PromptBuilderModelMenu.tsx");
    assert.match(menu, /modelOptions/);
    assert.doesNotMatch(menu, /const MODELS|const MODEL_ITEMS/);
  });

  it("UI unions and pickers carry the 5.6 slugs and max", () => {
    const types = readSource("ui/src/types.ts");
    const generatedProviders = readSource("ui/src/generated/providers.ts");
    for (const model of GPT56_MODELS) {
      assert.ok(generatedProviders.includes(`"${model}"`), `generated ui types missing ${model}`);
    }
    assert.match(types, /"xhigh" \| "max"/);
    const imageModels = readSource("ui/src/lib/imageModels.ts");
    for (const model of GPT56_MODELS) {
      assert.ok(imageModels.includes(`"${model}"`), `IMAGE_MODEL_OPTIONS missing ${model}`);
    }
    const reasoning = readSource("ui/src/lib/reasoning.ts");
    assert.match(reasoning, /value: "max"/);
    assert.match(reasoning, /max: "M"/);
  });

  it("i18n carries labels for the new options in both locales", () => {
    for (const path of ["ui/src/i18n/en.json", "ui/src/i18n/ko.json"]) {
      const src = readSource(path);
      for (const key of ["gpt56Sol", "gpt56Terra", "gpt56Luna", "\"max\":"]) {
        assert.ok(src.includes(key), `${path} missing ${key}`);
      }
    }
  });
});
