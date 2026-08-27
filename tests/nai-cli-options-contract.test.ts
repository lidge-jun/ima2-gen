import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  NAI_CLI_FLAGS,
  finalizeNaiCliTarget,
  parseNaiCliOptions,
} from "../bin/lib/nai-options.js";
import type { ParsedArgs } from "../bin/lib/args.js";

function args(over: Record<string, unknown> = {}): ParsedArgs {
  return { positional: [], _unknown: [], _present: [], ...over } as ParsedArgs;
}

function parsed(over: Record<string, unknown>, policy: "allow-unknown" | "require-explicit" = "require-explicit") {
  const result = parseNaiCliOptions(args(over), policy);
  if ("message" in result) assert.fail(result.message);
  assert.equal(result.ok, true);
  return result.value;
}

test("maps every NovelAI CLI flag to the server request vocabulary", () => {
  const value = parsed({
    provider: "nai",
    "nai-negative-prompt": "lowres",
    "nai-sampler": "k_dpmpp_2m",
    "nai-noise-schedule": "native",
    "nai-steps": "28",
    "nai-scale": "5.5",
    "nai-cfg-rescale": "0.25",
    "nai-seed": "0",
    "nai-uc-preset": "light",
    "nai-quality-preset": "none",
    "nai-auto-smea": true,
    "no-nai-decrisper": true,
    "nai-variety-plus": true,
    "nai-straight-alpha": true,
    model: "nai-diffusion-5-full",
  });
  assert.deepEqual(value.payload, {
    negativePrompt: "lowres",
    sampler: "k_dpmpp_2m",
    noiseSchedule: "native",
    steps: 28,
    scale: 5.5,
    cfgRescale: 0.25,
    seed: 0,
    ucPresetId: "light",
    qualityPresetId: "none",
    autoSmea: true,
    decrisper: false,
    varietyPlus: true,
    straightAlpha: true,
  });
});

test("rejects malformed enum, number, prompt, and boolean-pair values", () => {
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ provider: "nai", "nai-sampler": "ddim_v3" }, "NAI_FLAG_INVALID"],
    [{ provider: "nai", "nai-noise-schedule": "bad" }, "NAI_FLAG_INVALID"],
    [{ provider: "nai", "nai-steps": "2.5" }, "NAI_FLAG_INVALID"],
    [{ provider: "nai", "nai-scale": "11" }, "NAI_FLAG_INVALID"],
    [{ provider: "nai", "nai-cfg-rescale": "-1" }, "NAI_FLAG_INVALID"],
    [{ provider: "nai", "nai-seed": "4294967296" }, "NAI_FLAG_INVALID"],
    [{ provider: "nai", "nai-negative-prompt": "x".repeat(10_001) }, "NAI_FLAG_INVALID"],
    [{ provider: "nai", "nai-auto-smea": true, "no-nai-auto-smea": true }, "NAI_FLAG_CONFLICT"],
  ];
  for (const [input, code] of cases) {
    const result = parseNaiCliOptions(args(input), "require-explicit");
    assert.equal(result.ok, false, JSON.stringify(input));
    if (!result.ok) assert.equal(result.code, code);
  }
});

test("rejects a present value-taking flag whose argv value is missing", () => {
  for (const key of [
    "nai-negative-prompt", "nai-sampler", "nai-noise-schedule", "nai-steps",
    "nai-scale", "nai-cfg-rescale", "nai-seed", "nai-uc-preset", "nai-quality-preset",
  ]) {
    const result = parseNaiCliOptions(args({ provider: "nai", _present: [key] }), "require-explicit");
    assert.equal(result.ok, false, key);
    if (!result.ok) {
      assert.equal(result.code, "NAI_FLAG_INVALID");
      assert.equal(result.flag, `--${key}`);
      assert.match(result.message, /requires a value/);
    }
  }
});

test("classifies exact bare and namespaced NovelAI targets without prefix guessing", () => {
  assert.equal(parsed({ provider: "nai", "nai-steps": "20" }).target, "nai");
  assert.equal(parsed({ model: "nai-diffusion-5-curated", "nai-steps": "20" }).target, "nai");
  assert.equal(parsed({ provider: "auto", model: "nai-diffusion-5-full", "nai-steps": "20" }).target, "nai");
  assert.equal(parsed({ model: "nai/nai-diffusion-4-5-full", "nai-steps": "20" }).target, "nai");

  for (const input of [
    { provider: "oauth", "nai-steps": "20" },
    { model: "gpt-5.6-luna", "nai-steps": "20" },
    { model: "nai-diffusion-invalid", "nai-steps": "20" },
  ]) {
    const result = parseNaiCliOptions(args(input), "require-explicit");
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "NAI_FLAG_TARGET_MISMATCH");
  }
});

test("does not alter target handling when no NovelAI option was supplied", () => {
  for (const input of [
    {},
    { provider: "oauth", model: "gpt-5.6-luna" },
    { provider: "nai", model: "not-a-real-model" },
  ]) {
    const result = parseNaiCliOptions(args(input), "require-explicit");
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.value.payload, {});
  }
});

test("handles unknown and conflict target states by command policy", () => {
  const allowed = parseNaiCliOptions(args({ "nai-steps": "20" }), "allow-unknown");
  assert.equal(allowed.ok, true);
  if (allowed.ok) assert.equal(allowed.value.target, "unknown");

  const required = parseNaiCliOptions(args({ "nai-steps": "20" }), "require-explicit");
  assert.equal(required.ok, false);
  if (!required.ok) assert.equal(required.code, "NAI_EXPLICIT_TARGET_REQUIRED");

  for (const conflict of [
    { provider: "nai", model: "gpt-5.6-luna", "nai-steps": "20" },
    { provider: "oauth", model: "nai-diffusion-5-full", "nai-steps": "20" },
  ]) {
    const result = parseNaiCliOptions(args(conflict), "require-explicit");
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "NAI_TARGET_CONFLICT");
  }
});

test("enforces V5-only fields before or after resolved target selection", () => {
  const v45 = parseNaiCliOptions(args({ model: "nai-diffusion-4-5-full", "nai-straight-alpha": true }), "require-explicit");
  assert.equal(v45.ok, false);
  if (!v45.ok) assert.equal(v45.code, "NAI_V5_MODEL_REQUIRED");

  const providerOnly = parseNaiCliOptions(args({ provider: "nai", "nai-quality-preset": "light" }), "require-explicit");
  assert.equal(providerOnly.ok, false);
  if (!providerOnly.ok) assert.equal(providerOnly.code, "NAI_V5_MODEL_REQUIRED");

  const unknown = parseNaiCliOptions(args({ "nai-straight-alpha": true }), "allow-unknown");
  assert.equal(unknown.ok, true);
  if (!unknown.ok) return;
  const resolvedV45 = finalizeNaiCliTarget(unknown.value, { lane: "nai", model: "nai-diffusion-4-5-curated" });
  assert.equal(resolvedV45.ok, false);
  if (!resolvedV45.ok) assert.equal(resolvedV45.code, "NAI_V5_MODEL_REQUIRED");
  assert.equal(finalizeNaiCliTarget(unknown.value, { lane: "nai", model: "nai-diffusion-5-full" }).ok, true);
});

test("finalize rejects a catalog-resolved non-NovelAI default before generation", () => {
  const preflight = parsed({ "nai-steps": "20" }, "allow-unknown");
  const result = finalizeNaiCliTarget(preflight, { lane: "oauth", model: "gpt-5.6-luna" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "NAI_FLAG_TARGET_MISMATCH");
});

test("all three commands share flags, help, preflight ordering, and payload mapping", () => {
  assert.ok(Object.keys(NAI_CLI_FLAGS).length >= 17);
  for (const file of ["bin/commands/gen.ts", "bin/commands/multimode.ts", "bin/commands/node.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /\.\.\.NAI_CLI_FLAGS/, `${file}: shared flags`);
    assert.match(source, /NAI_CLI_HELP/, `${file}: shared help`);
    assert.match(source, /parseNaiCliOptions/, `${file}: preflight`);
  }

  const gen = readFileSync("bin/commands/gen.ts", "utf8");
  assert.match(gen, /\.\.\.context\.naiOptions/, "gen: body payload");
  assert.ok(gen.indexOf("parseNaiCliOptions") < gen.indexOf("fetchCatalog("));
  assert.ok(gen.indexOf("finalizeNaiCliTarget") < gen.indexOf('request(context.server.base, "/api/generate"'));

  const multimode = readFileSync("bin/commands/multimode.ts", "utf8");
  assert.match(multimode, /\.\.\.naiPreflight\.payload/, "multimode: body payload");
  assert.ok(multimode.indexOf("parseNaiCliOptions") < multimode.indexOf("resolveServer("));

  const node = readFileSync("bin/commands/node.ts", "utf8");
  assert.match(node, /\.\.\.naiPreflight\.payload/, "node: body payload");
  assert.ok(node.indexOf("parseNaiCliOptions") < node.indexOf("fileToDataUri("));
  assert.ok(node.indexOf("parseNaiCliOptions") < node.indexOf("getServer("));
});
