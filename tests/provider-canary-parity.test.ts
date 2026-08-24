import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { CANARY_ENDPOINTS } from "../scripts/provider-canary.mjs";

/**
 * The canary duplicates provider endpoints instead of importing them from
 * routes/keys.ts, because that module needs a RuntimeContext and its PUT route
 * writes config. The duplication is deliberate, so it needs a guard: if someone
 * moves an endpoint in routes/keys.ts and not in the canary, the canary would
 * silently keep probing a dead URL and report "pass" for a lane that no longer
 * works.
 */
test("canary endpoints match VALIDATE_URL_MAP in routes/keys.ts", () => {
  const source = readFileSync(new URL("../routes/keys.ts", import.meta.url), "utf8");
  const block = source.match(/const VALIDATE_URL_MAP: Record<KeyProvider, string> = \{([\s\S]*?)\n\};/);
  assert.ok(block, "VALIDATE_URL_MAP not found in routes/keys.ts");

  const routeUrls = new Map<string, string>();
  for (const line of block[1].split("\n")) {
    const entry = line.match(/^\s*"?([a-z]+)"?:\s*"(https:\/\/[^"]+)"/);
    if (entry) routeUrls.set(entry[1], entry[2]);
  }
  assert.ok(routeUrls.size >= 5, `expected at least 5 validate URLs, got ${routeUrls.size}`);

  // routes/keys.ts is keyed by credential vendor; the canary is keyed by
  // provider lane. This is the mapping between the two vocabularies.
  const laneForVendor: Record<string, string> = {
    openai: "api",
    xai: "grok-api",
    gemini: "gemini-api",
    atlascloud: "atlascloud",
    minimax: "minimax",
    nai: "nai",
  };

  for (const [vendor, url] of routeUrls) {
    const lane = laneForVendor[vendor];
    assert.ok(lane, `routes/keys.ts has vendor "${vendor}" with no canary lane mapping`);
    assert.equal(
      (CANARY_ENDPOINTS as Record<string, string>)[lane],
      url,
      `canary lane "${lane}" probes a different URL than routes/keys.ts vendor "${vendor}"`,
    );
  }
});

test("every canary lane keyed by an endpoint is a real provider lane", async () => {
  const registry = readFileSync(new URL("../lib/providers/registry.ts", import.meta.url), "utf8");
  for (const lane of Object.keys(CANARY_ENDPOINTS)) {
    assert.ok(
      registry.includes(`id: "${lane}"`),
      `canary probes "${lane}" but the registry has no such lane`,
    );
  }
});
