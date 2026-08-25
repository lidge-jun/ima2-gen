import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { composerNegativePromptMeta, readNaiOptions } from "../lib/naiOptions.js";
import { NAI_SAMPLERS } from "../lib/naiImageAdapter.js";

// The defect this file exists to prevent: /api/generate accepted seven NovelAI
// tuning fields that no other lane forwarded and no client ever sent. One
// normalizer now serves every request-driven lane; these cases pin both halves.

test("readNaiOptions returns nothing for an empty or malformed body", () => {
  for (const body of [undefined, null, {}, [], "nope", 42]) {
    assert.deepEqual(readNaiOptions(body), {}, `body: ${JSON.stringify(body)}`);
  }
});

test("readNaiOptions round-trips every valid field", () => {
  const input = {
    negativePrompt: "lowres, bad anatomy",
    steps: 28,
    scale: 6.5,
    cfgRescale: 0.4,
    sampler: "k_dpmpp_2m_sde",
    noiseSchedule: "exponential",
    seed: 12345,
    straightAlpha: true,
    varietyPlus: true,
    ucPresetId: "light",
    qualityPresetId: "none",
  };
  assert.deepEqual(readNaiOptions(input), input);
});

test("readNaiOptions ignores unrelated body fields", () => {
  const out = readNaiOptions({ prompt: "a cat", provider: "nai", steps: 20 });
  assert.deepEqual(out, { steps: 20 });
});

test("readNaiOptions drops ddim_v3 because no registered model accepts it", () => {
  assert.ok(NAI_SAMPLERS.includes("ddim_v3"), "adapter still declares the V3 sampler");
  assert.deepEqual(readNaiOptions({ sampler: "ddim_v3" }), {});
});

test("readNaiOptions drops out-of-alphabet values rather than forwarding them", () => {
  assert.deepEqual(readNaiOptions({ sampler: "nonsense" }), {});
  assert.deepEqual(readNaiOptions({ noiseSchedule: "nonsense" }), {});
  assert.deepEqual(readNaiOptions({ ucPresetId: "nonsense" }), {});
  assert.deepEqual(readNaiOptions({ qualityPresetId: "nonsense" }), {});
});

test("readNaiOptions clamps numeric fields instead of dropping them", () => {
  assert.equal(readNaiOptions({ steps: 999 }).steps, 50);
  assert.equal(readNaiOptions({ steps: 0 }).steps, 1);
  assert.equal(readNaiOptions({ scale: -5 }).scale, 1);
  assert.equal(readNaiOptions({ scale: 99 }).scale, 10);
  assert.equal(readNaiOptions({ cfgRescale: 2 }).cfgRescale, 1);
  assert.equal(readNaiOptions({ cfgRescale: -1 }).cfgRescale, 0);
});

test("readNaiOptions drops an unusable seed", () => {
  for (const seed of [-1, 2 ** 33, Number.NaN, 1.5, "7"]) {
    assert.deepEqual(readNaiOptions({ seed }), {}, `seed: ${String(seed)}`);
  }
  assert.equal(readNaiOptions({ seed: 0 }).seed, 0, "0 is a valid NovelAI seed");
});

test("readNaiOptions does not coerce wrong types", () => {
  assert.deepEqual(readNaiOptions({ negativePrompt: 12345 }), {});
  assert.deepEqual(readNaiOptions({ straightAlpha: "true" }), {});
  assert.deepEqual(readNaiOptions({ varietyPlus: 1 }), {});
});

test("readNaiOptions truncates an oversized negative prompt", () => {
  const out = readNaiOptions({ negativePrompt: "x".repeat(20_000) });
  assert.equal(out.negativePrompt?.length, 10_000);
});

test("every request-driven nai dispatch uses the shared normalizer", () => {
  const requestDriven = [
    "lib/generatePipeline.ts",
    "lib/multimodePipeline.ts",
    "lib/nodeGeneration.ts",
  ];
  for (const file of requestDriven) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(source, /readNaiOptions\(req\.body\)/, `${file} must spread the normalizer`);
  }

  // Agent is a fourth direct generateViaNai caller and is DELIBERATELY excluded:
  // it is a conversational surface with no per-request option source, so it
  // stays on adapter/config defaults. Wiring it up is a decision, not an
  // oversight — changing this assertion is how you record making it.
  const agent = readFileSync(new URL("../lib/agentImageVideoGen.ts", import.meta.url), "utf8");
  assert.ok(agent.includes("generateViaNai"), "agent still calls the adapter directly");
  assert.ok(
    !agent.includes("readNaiOptions"),
    "agent is default-only by design (devlog 004 B1); wiring it up needs a plan, not a patch",
  );
});

test("composerNegativePromptMeta records only for the nai lane", () => {
  const body = { negativePrompt: "watermark" };
  assert.deepEqual(composerNegativePromptMeta("nai", body), { composerNegativePrompt: "watermark" });
  // Without the lane check any caller could write this into another lane's
  // history, describing a generation that never had a negative prompt.
  assert.deepEqual(composerNegativePromptMeta("oauth", body), {});
  assert.deepEqual(composerNegativePromptMeta("grok", body), {});
  assert.deepEqual(composerNegativePromptMeta(undefined, body), {});
});

test("composerNegativePromptMeta omits an empty or whitespace prompt", () => {
  assert.deepEqual(composerNegativePromptMeta("nai", { negativePrompt: "" }), {});
  assert.deepEqual(composerNegativePromptMeta("nai", { negativePrompt: "   " }), {});
  assert.deepEqual(composerNegativePromptMeta("nai", {}), {});
  assert.deepEqual(composerNegativePromptMeta("nai", { negativePrompt: 5 }), {});
});

test("composerNegativePromptMeta trims what it records", () => {
  assert.deepEqual(
    composerNegativePromptMeta("nai", { negativePrompt: "  blurry  " }),
    { composerNegativePrompt: "blurry" },
  );
});

