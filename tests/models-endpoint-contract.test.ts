import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tsImport } from "tsx/esm/api";

const { clearModelsCatalogCache } = await tsImport(
  "../lib/mcp/modelsCatalog.js",
  import.meta.url,
) as typeof import("../lib/mcp/modelsCatalog.ts");
const { registerMcpConnectionRoutes } = await tsImport(
  "../routes/mcpConnections.ts",
  import.meta.url,
) as typeof import("../routes/mcpConnections.ts");
const { registerModelsRoutes } = await tsImport(
  "../routes/models.ts",
  import.meta.url,
) as typeof import("../routes/models.ts");

type ProviderState = "connected" | "disconnected";
type ModelLaneId = import("../routes/models.ts").ModelLaneId;
type ModelLaneDto = import("../routes/models.ts").ModelLaneDto;
type ModelsBody = { ok: true; lanes: Record<ModelLaneId, ModelLaneDto> };
type ProviderBody = {
  providers: Array<{
    id: string;
    executable: boolean;
    lockReason?: string;
  }>;
};

class FakeMcpManager {
  readonly calls: Array<{ provider: string; name: string; args: Record<string, unknown> }> = [];
  readonly states = new Map<string, ProviderState>();
  failCatalog = false;

  status(provider: string) {
    return { provider, state: this.states.get(provider) ?? "disconnected" };
  }

  async callTool(provider: string, name: string, args: Record<string, unknown>) {
    this.calls.push({ provider, name, args });
    if (this.failCatalog) throw new Error("MCP_NOT_CONNECTED");
    return {
      structuredContent: {
        items: args.type === "video"
          ? [{ id: "kling_3", name: "Kling 3", duration_range: { min: 3, max: 10 } }]
          : [{ id: "soul_2", name: "Soul 2", medias: [{ roles: ["image"] }] }],
        has_more: false,
      },
    };
  }
}

const servers = new Set<Server>();

afterEach(async () => {
  clearModelsCatalogCache();
  await Promise.all([...servers].map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  servers.clear();
});

async function withApp(
  options: {
    manager?: FakeMcpManager;
    agyInstalled?: boolean;
    minimaxApiKey?: string;
    atlasCloudApiKey?: string;
    grokProxyState?: string;
  } = {},
  run: (base: string, manager: FakeMcpManager) => Promise<void>,
) {
  const app = express();
  const manager = options.manager ?? new FakeMcpManager();
  const ctx = {
    oauthReadyState: "ready",
    hasApiKey: false,
    grokUrl: "http://127.0.0.1:18645/v1",
    xaiApiKey: undefined,
    geminiApiKey: "gemini-test-key",
    minimaxApiKey: options.minimaxApiKey,
    atlasCloudApiKey: options.atlasCloudApiKey,
    mcpConnectionManager: manager,
    ...(options.grokProxyState ? { grokProxy: { state: options.grokProxyState } } : {}),
    config: {
      imageModels: {
        default: "gpt-5.6-luna",
        valid: new Set(["gpt-5.6-luna", "gpt-5.6-sol"]),
      },
      apiProvider: { defaultImageModel: "gpt-5.6-sol" },
      grokProvider: {
        defaultImageModel: "grok-imagine-image-quality",
        defaultVideoModel: "grok-imagine-video-1.5",
      },
      mcp: { enabledProviders: ["runway", "higgsfield"] },
    },
  };
  registerModelsRoutes(app, ctx as never, {
    detectAgyInstalled: async () => options.agyInstalled ?? false,
  });
  registerMcpConnectionRoutes(app, ctx as never);
  const server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  servers.add(server);
  const address = server.address() as AddressInfo;
  await run(`http://127.0.0.1:${address.port}`, manager);
}

test("GET /api/models returns every canonical lane with deterministic statuses and static catalogs", async () => {
  await withApp({ agyInstalled: true }, async (base, manager) => {
    const response = await fetch(`${base}/api/models`);
    assert.equal(response.status, 200);
    const body = await response.json() as ModelsBody;
    assert.equal(body.ok, true);
    assert.deepEqual(Object.keys(body.lanes), [
      "oauth", "api", "grok", "grok-api", "agy", "gemini-api", "atlascloud", "minimax", "comfy", "runway", "higgsfield",
    ]);

    assert.equal(body.lanes.oauth.status, "ready");
    assert.equal(body.lanes.api.status, "key-missing");
    assert.equal(body.lanes.grok.status, "ready");
    assert.match(body.lanes.grok.reason, /live session not probed/);
    assert.equal(body.lanes["grok-api"].status, "key-missing");
    assert.equal(body.lanes.agy.status, "ready");
    assert.equal(body.lanes.agy.reason, "binary installed; login cannot be probed");
    assert.equal(body.lanes["gemini-api"].status, "ready");
    assert.equal(body.lanes.atlascloud.status, "key-missing");
    assert.deepEqual(body.lanes.atlascloud.models.image.map((model) => model.id), [
      "openai/gpt-image-2/text-to-image", "openai/gpt-image-2/edit",
    ]);
    assert.equal(body.lanes.minimax.status, "key-missing");
    assert.deepEqual(body.lanes.minimax.models.image.map((model) => model.id), [
      "image-01", "image-01-live",
    ]);
    assert.equal(body.lanes.runway.status, "disconnected");
    assert.equal(body.lanes.higgsfield.status, "disconnected");
    assert.match(body.lanes.higgsfield.reason ?? "", /MCP connection disconnected/);

    assert.equal(body.lanes.oauth.defaults.image, "gpt-5.6-luna");
    assert.equal(body.lanes.api.defaults.image, "gpt-5.6-sol");
    assert.deepEqual(body.lanes.grok.defaults, {
      image: "grok-imagine-image-quality",
      video: "grok-imagine-video-1.5",
    });
    assert.equal(body.lanes.runway.defaults.image, "nano-banana-pro");
    assert.equal(body.lanes.runway.defaults.video, "seedance-2");

    assert.deepEqual(body.lanes.oauth.models.image.map((model) => model.id), ["gpt-5.6-luna", "gpt-5.6-sol"]);
    assert.deepEqual(body.lanes.grok.models.video.map((model) => model.id), [
      "grok-imagine-video", "grok-imagine-video-1.5",
    ]);
    const grokVideo = body.lanes.grok.models.video[0];
    assert.deepEqual(
      grokVideo.capabilities.parameters.find((parameter) => parameter.name === "resolution")?.options,
      ["480p", "720p", "1080p"],
    );
    assert.ok(body.lanes.runway.models.video.some((model) => model.id === "veo-3.1"));
    assert.deepEqual(body.lanes.higgsfield.models, { image: [], video: [] });
    assert.equal(manager.calls.length, 0, "disconnected lanes must not browse a dynamic catalog");
  });
});

test("catalog failures degrade per lane and provider listings expose registry state", async () => {
  const manager = new FakeMcpManager();
  manager.states.set("higgsfield", "connected");
  manager.failCatalog = true;
  await withApp({ manager }, async (base) => {
    const modelsResponse = await fetch(`${base}/api/models`);
    assert.equal(modelsResponse.status, 200);
    const models = await modelsResponse.json() as ModelsBody;
    assert.equal(models.ok, true);
    // higgsfield is now executable: catalog failure (MCP_NOT_CONNECTED) degrades to disconnected
    assert.equal(models.lanes.higgsfield.status, "disconnected");
    assert.deepEqual(models.lanes.higgsfield.models, { image: [], video: [] });

    const providers = await (await fetch(`${base}/api/mcp/providers`)).json() as ProviderBody;
    const runway = providers.providers.find((provider) => provider.id === "runway");
    const higgsfield = providers.providers.find((provider) => provider.id === "higgsfield");
    assert.equal(runway?.executable, true);
    assert.equal(runway?.lockReason, undefined);
    assert.equal(higgsfield?.executable, true);
    assert.equal(higgsfield?.lockReason, undefined);
  });
});

test("connected MCP lanes add only read-only dynamic models", async () => {
  const manager = new FakeMcpManager();
  manager.states.set("runway", "connected");
  manager.states.set("higgsfield", "connected");
  await withApp({ manager }, async (base) => {
    const body = await (await fetch(`${base}/api/models`)).json() as ModelsBody;
    assert.equal(body.lanes.runway.status, "ready");
    assert.equal(body.lanes.higgsfield.status, "ready");
    assert.deepEqual(body.lanes.higgsfield.models.image.map((model) => model.id), ["soul_2"]);
    assert.deepEqual(body.lanes.higgsfield.models.video.map((model) => model.id), ["kling_3"]);
    assert.deepEqual(body.lanes.higgsfield.models.image[0].capabilities.inputRoles, ["image"]);
    assert.ok(manager.calls.length >= 2);
    for (const call of manager.calls) assert.equal(call.name, "models_explore");
  });
});

test("routes/index.ts registers the canonical models endpoint", () => {
  const source = readFileSync(new URL("../routes/index.ts", import.meta.url), "utf8");
  assert.match(source, /import \{ registerModelsRoutes \} from "\.\/models\.js";/);
  assert.match(source, /registerModelsRoutes\(app, ctx\);/);
});

/**
 * #150 phase 1 routes the MiniMax lane through ProviderAdapterV1. The adapter
 * contract suite proves the adapter is correct; these two prove the DTO the
 * route builds from it did not drift, in both credential states.
 */
test("the MiniMax lane keeps its exact DTO when no key is configured", async () => {
  await withApp({}, async (base) => {
    const body = await (await fetch(`${base}/api/models`)).json() as ModelsBody;
    const minimax = body.lanes.minimax;
    assert.equal(minimax.status, "key-missing");
    assert.equal(minimax.reason, "MiniMax API key missing");
    assert.equal(minimax.defaults.image, "image-01");
    assert.deepEqual(minimax.models.image.map((model) => model.id), ["image-01", "image-01-live"]);
    assert.deepEqual(minimax.models.video, []);
    for (const model of minimax.models.image) {
      assert.equal(model.label, model.id);
      assert.ok(Array.isArray(model.capabilities.inputRoles));
    }
  });
});

test("the MiniMax lane reports ready once the runtime context holds a key", async () => {
  await withApp({ minimaxApiKey: "mm-test-key" }, async (base) => {
    const body = await (await fetch(`${base}/api/models`)).json() as ModelsBody;
    const minimax = body.lanes.minimax;
    assert.equal(minimax.status, "ready");
    assert.equal(minimax.reason, undefined, "a ready lane carries no reason");
    assert.equal(minimax.defaults.image, "image-01");
    assert.deepEqual(minimax.models.image.map((model) => model.id), ["image-01", "image-01-live"]);
    assert.deepEqual(minimax.models.video, []);
  });
});

/**
 * #150 phase 2 routes the Atlas Cloud lane through ProviderAdapterV1. Same
 * proof shape as MiniMax above: the adapter contract suite proves the adapter,
 * these two prove the DTO the route builds from it did not drift, in both
 * credential states.
 */
test("the Atlas Cloud lane keeps its exact DTO when no key is configured", async () => {
  await withApp({}, async (base) => {
    const body = await (await fetch(`${base}/api/models`)).json() as ModelsBody;
    const atlascloud = body.lanes.atlascloud;
    assert.equal(atlascloud.status, "key-missing");
    assert.equal(atlascloud.reason, "Atlas Cloud API key missing");
    assert.equal(atlascloud.defaults.image, "openai/gpt-image-2/text-to-image");
    assert.deepEqual(
      atlascloud.models.image.map((model) => model.id),
      ["openai/gpt-image-2/text-to-image", "openai/gpt-image-2/edit"],
    );
    assert.deepEqual(atlascloud.models.video, []);
    for (const model of atlascloud.models.image) {
      assert.equal(model.label, model.id);
      assert.ok(Array.isArray(model.capabilities.inputRoles));
    }
  });
});

test("the Atlas Cloud lane reports ready once the runtime context holds a key", async () => {
  await withApp({ atlasCloudApiKey: "apikey-test" }, async (base) => {
    const body = await (await fetch(`${base}/api/models`)).json() as ModelsBody;
    const atlascloud = body.lanes.atlascloud;
    assert.equal(atlascloud.status, "ready");
    assert.equal(atlascloud.reason, undefined, "a ready lane carries no reason");
    assert.equal(atlascloud.defaults.image, "openai/gpt-image-2/text-to-image");
    assert.deepEqual(
      atlascloud.models.image.map((model) => model.id),
      ["openai/gpt-image-2/text-to-image", "openai/gpt-image-2/edit"],
    );
    assert.deepEqual(atlascloud.models.video, []);
  });
});

test("the grok lane follows the supervisor instead of the mere presence of a URL", async () => {
  // The old lane answered "ready" whenever a URL string existed, so /api/models
  // could claim ready while /api/grok/status reported offline on the same server.
  const cases: Array<[string, string, RegExp | undefined]> = [
    ["ready", "ready", undefined],
    ["waiting-for-login", "disconnected", /login required/i],
    ["gave-up", "disconnected", /failed to start/i],
    ["stopped", "disconnected", /stopped/i],
  ];
  for (const [supervisorState, expected, reason] of cases) {
    await withApp({ grokProxyState: supervisorState }, async (base) => {
      const body = await (await fetch(`${base}/api/models`)).json() as ModelsBody;
      assert.equal(body.lanes.grok.status, expected, `state=${supervisorState}`);
      if (reason) assert.match(String(body.lanes.grok.reason), reason);
    });
  }
});

test("transient supervisor states do not flicker the grok lane", async () => {
  // Boot and re-arm are not settled failures.
  for (const transient of ["starting", "gave-up-retryable"]) {
    await withApp({ grokProxyState: transient }, async (base) => {
      const body = await (await fetch(`${base}/api/models`)).json() as ModelsBody;
      assert.equal(body.lanes.grok.status, "ready", `state=${transient}`);
    });
  }
  // backoff means the proxy crashed and is retrying — honest about the situation
  await withApp({ grokProxyState: "backoff" }, async (base) => {
    const body = await (await fetch(`${base}/api/models`)).json() as ModelsBody;
    assert.equal(body.lanes.grok.status, "disconnected", "backoff is honest");
    assert.match(String(body.lanes.grok.reason), /restart/i);
  });
});
