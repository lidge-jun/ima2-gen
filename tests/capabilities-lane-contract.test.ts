import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildIma2Capabilities } from "../lib/capabilities.ts";

describe("capability lane contract", () => {
  it("omits lanes entirely when no server answered", () => {
    const built = buildIma2Capabilities({ packageVersion: "0.0.0-test", source: "local" });
    // Absence must read as "nobody could know", never as "no lane exists".
    // `source` is the disambiguator, so a guessed status here would be worse
    // than silence.
    assert.equal(built.source, "local");
    assert.equal("lanes" in built, false);
  });

  it("carries lane state when a server supplied it", () => {
    const built = buildIma2Capabilities({
      packageVersion: "0.0.0-test",
      source: "server",
      lanes: {
        grok: { status: "ready", models: { image: 3, video: 2 } },
        minimax: { status: "key-missing", reason: "MiniMax API key missing", models: { image: 2, video: 0 } },
      },
    });
    assert.equal(built.source, "server");
    assert.equal("lanes" in built, true);
    const lanes = (built as { lanes: Record<string, { status: string; reason?: string }> }).lanes;
    assert.equal(lanes.grok?.status, "ready");
    // A lane that cannot run must say why; the reason is the load-bearing part.
    assert.equal(lanes.minimax?.reason, "MiniMax API key missing");
  });

  it("keeps the flag vocabulary separate from the runtime lane map", () => {
    const built = buildIma2Capabilities({ packageVersion: "0.0.0-test", source: "local" });
    const providers = built.valid.providers as readonly string[];
    // valid.providers is what the CLI --provider flag accepts, which includes
    // `auto` and omits the MCP lanes. It is not an availability list, and
    // conflating the two is what sent agents at lanes that had no key.
    assert.ok(providers.includes("auto"));
    assert.equal(providers.includes("runway"), false);
  });

  it("publishes the NovelAI display defaults from runtime config", () => {
    const built = buildIma2Capabilities({ packageVersion: "0.0.0-test", source: "local" });
    const nai = (built.defaults as Record<string, Record<string, unknown>>).nai;
    // Display only. The web UI shows these so its panel matches the operator's
    // configuration; it never re-sends an untouched value, which is what keeps
    // IMA2_NAI_DEFAULT_* authoritative at the adapter.
    assert.ok(nai, "defaults.nai must exist");
    assert.deepEqual(Object.keys(nai).sort(), ["noiseSchedule", "sampler", "scale", "steps"]);
    assert.equal(typeof nai.sampler, "string");
    assert.equal(typeof nai.noiseSchedule, "string");
    assert.equal(typeof nai.steps, "number");
    assert.equal(typeof nai.scale, "number");
    // No model: NaiOptions has no model member, and publishing a field nothing
    // consumes is the drift this unit exists to remove.
    assert.equal("model" in nai, false);
  });
});
