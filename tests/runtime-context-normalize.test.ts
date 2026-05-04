import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { requireRuntimeContext, type RouteRuntimeContext } from "../lib/runtimeContext.js";

describe("requireRuntimeContext", () => {
  it("preserves object identity so live mutations remain visible", () => {
    const ctx: RouteRuntimeContext = { oauthReadyState: "starting" };
    const rctx = requireRuntimeContext(ctx);
    assert.equal(rctx, ctx as unknown);
    // Simulate startServer flipping readiness after route registration.
    (ctx as { oauthReadyState: "ready" }).oauthReadyState = "ready";
    assert.equal(rctx.oauthReadyState, "ready");
  });

  it("fills missing top-level scalars without erasing live ones", () => {
    const ctx: RouteRuntimeContext = {};
    const rctx = requireRuntimeContext(ctx);
    assert.equal(rctx.hasApiKey, false);
    assert.equal(rctx.openai, null);
    assert.equal(rctx.oauthReadyPromise, null);
    assert.ok(typeof rctx.serverConfiguredPort === "number");
    assert.ok(typeof rctx.oauthPort === "number");
    assert.ok(rctx.oauthUrl.startsWith("http"));
  });

  it("merges partial nested config keys so deep callers see oauth/storage/ids defaults", () => {
    const ctx: RouteRuntimeContext = {
      config: { storage: { generatedDir: "/tmp/custom-generated" } as never },
    };
    const rctx = requireRuntimeContext(ctx);
    assert.equal(rctx.config.storage.generatedDir, "/tmp/custom-generated");
    assert.ok(rctx.config.oauth, "oauth nest must be filled from defaults");
    assert.ok(typeof rctx.config.oauth.proxyPort === "number");
    assert.ok(rctx.config.ids, "ids nest must be filled from defaults");
  });

  it("readiness change on ctx is observed by a route-style consumer holding rctx", async () => {
    const ctx: RouteRuntimeContext = { oauthReadyState: "starting" };
    const rctx = requireRuntimeContext(ctx);
    // Consumer captures rctx at registration time.
    const peekState = () => rctx.oauthReadyState;
    assert.equal(peekState(), "starting");
    (ctx as { oauthReadyState: "ready" }).oauthReadyState = "ready";
    assert.equal(peekState(), "ready");
    (ctx as { oauthReadyState: "failed" }).oauthReadyState = "failed";
    assert.equal(peekState(), "failed");
  });

  it("server port mutation is observed via the same identity", () => {
    const ctx: RouteRuntimeContext = { serverConfiguredPort: 0 };
    const rctx = requireRuntimeContext(ctx);
    assert.equal(rctx.serverActualPort, undefined);
    (ctx as { serverActualPort: number }).serverActualPort = 49999;
    assert.equal(rctx.serverActualPort, 49999);
  });
});
