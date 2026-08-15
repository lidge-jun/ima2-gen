import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { getProviderAdapter, listProviderAdapters } from "../lib/providers/adapters/index.js";
import { getProvider, REGISTRY } from "../lib/providers/registry.js";
import type { RuntimeContext } from "../lib/runtimeContext.js";

/**
 * The contract every ProviderAdapterV1 must satisfy (#150).
 *
 * It iterates listProviderAdapters rather than naming providers, so the day a
 * second adapter is registered it inherits every assertion here without anyone
 * remembering to extend this file. That automatic coverage is one of #150's
 * acceptance criteria.
 */
function contextWith(minimaxApiKey: string | undefined): RuntimeContext {
  return { minimaxApiKey } as unknown as RuntimeContext;
}

const withKey = contextWith("test-key");
const withoutKey = contextWith(undefined);

test("at least one adapter is registered", () => {
  assert.ok(listProviderAdapters(withKey).length >= 1);
});

test("every adapter implements the required members", () => {
  for (const adapter of listProviderAdapters(withKey)) {
    assert.equal(typeof adapter.laneId, "string", "adapter must name its lane");
    assert.equal(typeof adapter.validateAuth, "function");
    assert.equal(typeof adapter.listModels, "function");
    assert.equal(typeof adapter.normalizeError, "function");
  }
});

test("every adapter lane exists in the capability registry", () => {
  const known = new Set(REGISTRY.map((manifest) => manifest.id as string));
  for (const adapter of listProviderAdapters(withKey)) {
    assert.ok(known.has(adapter.laneId), `${adapter.laneId} is not a registry lane`);
  }
});

test("listModels comes from the registry, not a hand-written list", () => {
  for (const adapter of listProviderAdapters(withKey)) {
    assert.deepEqual(
      adapter.listModels().map((model) => model.id),
      getProvider(adapter.laneId).models.map((model) => model.id),
      `${adapter.laneId} must report exactly the registry's models`,
    );
  }
});

test("no adapter source hard-codes a model id", () => {
  // A literal here would drift from the registry silently, which is the exact
  // failure the capability registry was built to prevent.
  for (const adapter of listProviderAdapters(withKey)) {
    const source = readFileSync(
      new URL(`../lib/providers/adapters/${adapter.laneId}.ts`, import.meta.url),
      "utf8",
    );
    for (const model of getProvider(adapter.laneId).models) {
      assert.ok(
        !source.includes(`"${model.id}"`),
        `${adapter.laneId}.ts hard-codes model id ${model.id}; derive it from the registry`,
      );
    }
  }
});

test("validateAuth reflects live credentials from the runtime context", () => {
  // Not process.env: routes/keys.ts updates the context while the server runs,
  // so an env read would report a lane unauthenticated right after setup.
  const present = getProviderAdapter(withKey, "minimax");
  assert.ok(present);
  assert.deepEqual(present!.validateAuth(), { ok: true });

  const absent = getProviderAdapter(withoutKey, "minimax");
  assert.ok(absent);
  const result = absent!.validateAuth();
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /MiniMax API key missing/);
});

test("normalizeError owns the lane's error vocabulary", () => {
  for (const adapter of listProviderAdapters(withKey)) {
    const prefix = getProvider(adapter.laneId).errorPrefix;
    if (!prefix) continue;

    const unauthorized = adapter.normalizeError(Object.assign(new Error("bad key"), { status: 401 }));
    assert.ok(unauthorized.code.startsWith(prefix), `${adapter.laneId} must prefix its codes with ${prefix}`);
    assert.equal(unauthorized.retryable, false, "a rejected credential is not worth retrying");
    assert.equal(unauthorized.status, 401);

    const throttled = adapter.normalizeError(Object.assign(new Error("slow down"), { status: 429 }));
    assert.equal(throttled.retryable, true, "throttling is transient");

    const upstream = adapter.normalizeError(Object.assign(new Error("boom"), { status: 502 }));
    assert.equal(upstream.retryable, true);

    const unknown = adapter.normalizeError("something odd");
    assert.ok(unknown.code.startsWith(prefix));
    assert.equal(unknown.retryable, false, "an unrecognized failure is not assumed retryable");
  }
});

test("an existing provider-specific code is preserved, not double-prefixed", () => {
  const adapter = getProviderAdapter(withKey, "minimax");
  const normalized = adapter!.normalizeError(
    Object.assign(new Error("empty payload"), { status: 502, code: "MINIMAX_IMAGE_INVALID" }),
  );
  assert.equal(normalized.code, "MINIMAX_IMAGE_INVALID");
});

test("an unregistered lane returns null so its current path is untouched", () => {
  for (const lane of ["oauth", "api", "grok", "grok-api", "agy", "gemini-api", "atlascloud"] as const) {
    assert.equal(getProviderAdapter(withKey, lane), null, `${lane} must not be adapter-routed in phase 1`);
  }
});
