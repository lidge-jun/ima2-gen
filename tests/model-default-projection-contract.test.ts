import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  config,
  DEFAULT_GROK_PLANNER_MODEL,
  GROK_PLANNER_MODELS,
} from "../config.ts";

function readSource(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("current model defaults: runtime contract", () => {
  it("projects Grok 4.5 and Luna through shared configuration", () => {
    assert.equal(DEFAULT_GROK_PLANNER_MODEL, "grok-4.5");
    assert.equal(GROK_PLANNER_MODELS[0], DEFAULT_GROK_PLANNER_MODEL);
    assert.ok(GROK_PLANNER_MODELS.includes("grok-4.3"));
    assert.equal(config.grokProvider.plannerModel, DEFAULT_GROK_PLANNER_MODEL);
    assert.equal(config.imageModels.default, "gpt-5.6-luna");
    assert.equal(config.styleSheet.model, "gpt-5.6-luna");
    assert.equal(config.cardNewsPlanner.model, "gpt-5.6-luna");
  });

  it("keeps compatibility activation while centralizing Grok fallbacks", () => {
    const agentSource = readSource("lib/agentImageVideoGen.ts");
    assert.match(agentSource, /DEFAULT_GROK_PLANNER_MODEL, "grok-4\.3"/);

    for (const path of [
      "lib/grokImageCore.ts",
      "lib/grokImageAdapter.ts",
      "lib/grokVideoAdapter.ts",
      "routes/videoExtended.ts",
    ]) {
      const source = readSource(path);
      assert.match(source, /DEFAULT_GROK_PLANNER_MODEL/, `${path} must use the shared Grok planner default`);
    }
  });

  it("derives API model projections from runtime configuration", () => {
    assert.match(readSource("routes/models.ts"), /video:\s*ctx\.config\.grokProvider\.defaultVideoModel/);
    assert.match(readSource("routes/capabilities.ts"), /GROK_PLANNER_MODELS/);
  });
});
