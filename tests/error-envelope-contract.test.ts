import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEST_DIR = mkdtempSync(join(tmpdir(), "ima2-error-envelope-"));
process.env.IMA2_CONFIG_DIR = TEST_DIR;
process.env.IMA2_DB_PATH = join(TEST_DIR, "sessions.db");

const { errorEnvelopeFields } = await import("../lib/errors/envelope.ts");
const { upstreamErrorFields } = await import("../lib/routeHelpers.ts");
const { writeNodeError, nodeErrorDetails } = await import("../lib/nodeHelpers.ts");
const { normalizeGenerationFailure } = await import("../lib/generationErrors.ts");
const { generateMultimodeViaGrok } = await import("../lib/grokMultimodeAdapter.ts");
const { registerVideoExtendedRoutes } = await import("../routes/videoExtended.ts");
const { registerVideoRoutes } = await import("../routes/video.ts");
const { registerEditRoutes } = await import("../routes/edit.ts");
const { registerMcpMediaRoutes } = await import("../routes/mcpMedia.ts");
const { registerMcpRecoverRoutes } = await import("../routes/mcpRecover.ts");
const { registerMcpMultishotRoutes } = await import("../routes/mcpMultishot.ts");
const { registerNodeRoutes } = await import("../routes/nodes.ts");
const { createAgentSession } = await import("../lib/agentStore.ts");
const { tickAgentQueueWorker } = await import("../lib/agentQueueWorker.ts");
const queue = await import("../lib/agentQueueStore.ts");
const db = await import("../lib/db.ts");
const { subscribe } = await import("../lib/eventBus.ts");
const { config } = await import("../config.ts");

after(() => {
  db.closeDb();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function providerError(code: string, status: number) {
  return Object.assign(new Error("ordinary provider failure"), {
    code,
    status,
    rawCode: code,
    errorClass: errorEnvelopeFields({ code, status }).errorClass,
  });
}

async function withServer(app: express.Express, run: (baseUrl: string) => Promise<void>) {
  const server = await new Promise<import("node:http").Server>((resolve) => {
    const value = app.listen(0, "127.0.0.1", () => resolve(value));
  });
  const address = server.address() as import("node:net").AddressInfo;
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function parseSse(text: string) {
  const events: Array<{ event: string; data: Record<string, unknown> }> = [];
  for (const block of text.split("\n\n")) {
    const ev = /event: (.+)/.exec(block);
    const data = /data: (.+)/.exec(block);
    if (ev && data) events.push({ event: ev[1].trim(), data: JSON.parse(data[1]) });
  }
  return events;
}

function waitForError(requestId: string, timeoutMs = 4000) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const timer = setTimeout(() => { stop(); reject(new Error(`timeout waiting error for ${requestId}`)); }, timeoutMs);
    const stop = subscribe((ev) => {
      if (ev.jobId === requestId && ev.event === "error") {
        clearTimeout(timer);
        stop();
        resolve(ev.data);
      }
    });
  });
}

const TINY_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("062 error transport envelopes", () => {
  it("Classic SSE carries MiniMax fields without changing code", () => {
    const err = providerError("MINIMAX_INSUFFICIENT_BALANCE", 402);
    const payload = { code: "INVALID_REQUEST", ...upstreamErrorFields(err as unknown as Record<string, unknown>) };
    assert.equal(payload.code, "INVALID_REQUEST");
    assert.equal(payload.rawCode, "MINIMAX_INSUFFICIENT_BALANCE");
    assert.equal(payload.errorClass, "BILLING_REQUIRED");
  });

  it("Node SSE nests fields inside error without changing code", () => {
    let body: unknown;
    const res = {
      writableEnded: false, destroyed: false, headersSent: false,
      status() { return this; },
      json(value: unknown) { body = value; return this; },
    } as unknown as express.Response;
    const err = providerError("MINIMAX_INSUFFICIENT_BALANCE", 402) as unknown as Record<string, unknown>;
    const normalized = normalizeGenerationFailure(err as never) as unknown as Record<string, unknown>;
    assert.equal(normalized.code, "INVALID_REQUEST");
    writeNodeError(res, 402, normalized.code as string, normalized.message as string, null, nodeErrorDetails(normalized, err as never));
    const error = (body as { error: Record<string, unknown> }).error;
    assert.equal(error.code, "INVALID_REQUEST");
    assert.equal(error.rawCode, "MINIMAX_INSUFFICIENT_BALANCE");
    assert.equal(error.errorClass, "BILLING_REQUIRED");
  });

  it("Node outer catch uses the same helper as the live writer", () => {
    // Provider failures are caught inside the generation loop and already
    // covered by the Node SSE canary. The outer catch only sees persist or
    // unexpected throws; it must still recover fields from the thrown object.
    let body: unknown;
    const res = {
      writableEnded: false, destroyed: false, headersSent: false,
      status() { return this; },
      json(value: unknown) { body = value; return this; },
    } as unknown as express.Response;
    const thrown = Object.assign(new Error("ordinary provider failure"), {
      code: "MINIMAX_INSUFFICIENT_BALANCE",
      status: 402,
    });
    writeNodeError(res, 402, "INVALID_REQUEST", thrown.message, null, {
      ...errorEnvelopeFields(thrown),
    });
    const error = (body as { error: Record<string, unknown> }).error;
    assert.equal(error.code, "INVALID_REQUEST");
    assert.equal(error.rawCode, "MINIMAX_INSUFFICIENT_BALANCE");
    assert.equal(error.errorClass, "BILLING_REQUIRED");
    assert.match(source("lib/nodeGeneration.ts"), /\.\.\.errorEnvelopeFields\(err\.raw\)/);
  });

  it("Video SSE dual-emit carries Grok 502 fields without changing code", async () => {
    const originalFetch = globalThis.fetch;
    const app = express();
    app.use(express.json());
    registerVideoRoutes(app, {
      rootDir: process.cwd(),
      packageVersion: "test",
      config: {
        ...config,
        storage: { ...config.storage, generatedDir: TEST_DIR },
        grokProvider: { ...config.grokProvider, proxyHost: "127.0.0.1", proxyPort: 1, videoPollIntervalMs: 1, videoStartTimeoutMs: 1000, videoTimeoutMs: 2000, plannerTimeoutMs: 1000 },
        log: { ...config.log, level: "silent" },
      },
    });
    try {
      await withServer(app, async (baseUrl) => {
        globalThis.fetch = async (url, init) => {
          if (String(url).startsWith(baseUrl)) return originalFetch(url, init);
          throw providerError("GROK_VIDEO_REQUEST_FAILED", 502);
        };
        const response = await originalFetch(`${baseUrl}/api/video/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: "animate", provider: "grok", duration: 1, resolution: "480p", requestId: "env-video-sse" }),
        });
        const events = parseSse(await response.text());
        const error = events.find((event) => event.event === "error")?.data;
        assert.ok(error, "video generate must emit an SSE error");
        assert.equal(error.code, "GROK_VIDEO_REQUEST_FAILED");
        assert.equal(error.rawCode, "GROK_VIDEO_REQUEST_FAILED");
        assert.equal(error.errorClass, "NETWORK_FAILURE");
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("Video JSON restores structured code and fields", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw providerError("GROK_VIDEO_REQUEST_FAILED", 502); };
    const app = express();
    app.use(express.json());
    registerVideoExtendedRoutes(app, { config: { storage: { generatedDir: TEST_DIR }, grokProvider: { proxyHost: "127.0.0.1", proxyPort: 1 } } });
    try {
      await withServer(app, async (baseUrl) => {
        const response = await originalFetch(`${baseUrl}/api/video/edit`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: "edit", videoUrl: "https://example.test/input.mp4" }),
        });
        const body = await response.json() as Record<string, unknown>;
        assert.equal(body.code, "GROK_VIDEO_REQUEST_FAILED");
        assert.equal(body.rawCode, "GROK_VIDEO_REQUEST_FAILED");
        assert.equal(body.errorClass, "NETWORK_FAILURE");
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("Video extend event-bus carries Grok 502 fields", async () => {
    writeFileSync(join(TEST_DIR, "root.mp4"), Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]));
    writeFileSync(join(TEST_DIR, "root.mp4.json"), JSON.stringify({
      kind: "video", provider: "grok", model: "grok-imagine-video",
      userPrompt: "parent", video: { duration: 5, resolution: "480p", aspectRatio: "auto" },
    }));
    const app = express();
    app.use(express.json());
    registerVideoExtendedRoutes(app, {
      rootDir: process.cwd(),
      packageVersion: "test",
      config: {
        ...config,
        storage: { ...config.storage, generatedDir: TEST_DIR },
        grokProvider: { ...config.grokProvider, proxyHost: "127.0.0.1", proxyPort: 1 },
        log: { ...config.log, level: "silent" },
      },
    }, {
      extractFrame: async () => TINY_PNG,
      generateVideo: async () => { throw providerError("GROK_VIDEO_REQUEST_FAILED", 502); },
    });
    await withServer(app, async (baseUrl) => {
      const pending = waitForError("env-video-extend");
      const response = await fetch(`${baseUrl}/api/video/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceVideoId: "root.mp4", requestId: "env-video-extend", prompt: "continue" }),
      });
      assert.equal(response.status, 202);
      const payload = await pending;
      assert.equal(payload.code, "GROK_VIDEO_REQUEST_FAILED");
      assert.equal(payload.rawCode, "GROK_VIDEO_REQUEST_FAILED");
      assert.equal(payload.errorClass, "NETWORK_FAILURE");
    });
  });

  it("Video extend preflight fail() carries a thrown provider error", async () => {
    const app = express();
    app.use(express.json());
    registerVideoExtendedRoutes(app, {
      rootDir: process.cwd(),
      packageVersion: "test",
      config: {
        ...config,
        storage: { ...config.storage, generatedDir: TEST_DIR },
        grokProvider: { ...config.grokProvider, proxyHost: "127.0.0.1", proxyPort: 1 },
        log: { ...config.log, level: "silent" },
      },
    }, {
      readSidecar: async () => {
        throw providerError("GROK_VIDEO_REQUEST_FAILED", 502);
      },
    });
    await withServer(app, async (baseUrl) => {
      const pending = waitForError("env-video-preflight");
      const response = await fetch(`${baseUrl}/api/video/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceVideoId: "root.mp4", requestId: "env-video-preflight", prompt: "continue" }),
      });
      const body = await response.json() as Record<string, unknown>;
      const payload = await pending.catch(() => body);
      assert.equal(response.status, 502);
      assert.equal(payload.code, "GROK_VIDEO_REQUEST_FAILED");
      assert.equal(payload.rawCode, "GROK_VIDEO_REQUEST_FAILED");
      assert.equal(payload.errorClass, "NETWORK_FAILURE");
    });
  });

  it("Multimode returns the last item failure from the adapter", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      const target = String(url);
      if (target.endsWith("/v1/responses")) {
        return Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: "brief" }] }] });
      }
      if (target.endsWith("/v1/chat/completions")) {
        return Response.json({
          choices: [{
            message: {
              tool_calls: [{
                type: "function",
                function: { name: "generate_image", arguments: JSON.stringify({ prompt: "planned", model: "grok-imagine-image-quality" }) },
              }],
            },
          }],
        });
      }
      throw providerError("GROK_UPSTREAM_ERROR", 502);
    };
    try {
      const result = await generateMultimodeViaGrok("sequence", {
        config: {
          ...config,
          grokProvider: { ...config.grokProvider, proxyHost: "127.0.0.1", proxyPort: 9, plannerTimeoutMs: 2000, generationTimeoutMs: 2000 },
        },
        packageVersion: "test",
      } as never, { maxImages: 1, requestId: "env-multimode" });
      assert.equal(result.images.length, 0);
      const err = result.error as { code?: string; status?: number };
      assert.equal(err.code, "GROK_UPSTREAM_ERROR");
      assert.deepEqual(errorEnvelopeFields(result.error), {
        rawCode: "GROK_UPSTREAM_ERROR",
        errorClass: "NETWORK_FAILURE",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("MCP event payload prefers structured code over message parsing", async () => {
    mkdirSync(join(TEST_DIR, "snapshots"), { recursive: true });
    mkdirSync(join(TEST_DIR, "generated"), { recursive: true });
    writeFileSync(join(TEST_DIR, "snapshots", "runway.json"), JSON.stringify({
      provenance: { provider: "runway", endpoint: "https://mcp.runwayml.com/mcp", fetchedAt: "t", entitlementTag: "u", originalHash: "sha256:0", sanitizedHash: "sha256:0" },
      tools: [{ name: "upscale_image" }],
    }));
    writeFileSync(join(TEST_DIR, "generated", "src-image.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const app = express();
    app.use(express.json());
    registerMcpMediaRoutes(app, {
      config: {
        storage: { generatedDir: join(TEST_DIR, "generated"), packageRoot: TEST_DIR },
        ids: { generatedHexBytes: 4 },
        mcp: { enabledProviders: ["runway"], tokenDir: TEST_DIR, snapshotDir: join(TEST_DIR, "snapshots") },
      },
      mcpConnectionManager: {
        status: () => ({ provider: "runway", state: "connected", snapshotDiff: { drifted: [], missing: [], added: [] } }),
        callTool: async () => { throw new Error("unused"); },
      },
    } as never, {
      upload: async () => "https://runway.example/datasets/abc.png",
      executePlan: async () => {
        throw Object.assign(new Error("ordinary provider failure:ignored"), {
          code: "MINIMAX_NETWORK_FAILED",
          status: 502,
        });
      },
    } as never);
    await withServer(app, async (baseUrl) => {
      const pending = waitForError("env-mcp");
      const response = await fetch(`${baseUrl}/api/mcp/media-action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "upscale-image", files: ["src-image.png"], requestId: "env-mcp" }),
      });
      assert.equal(response.status, 202);
      const payload = await pending;
      assert.equal(payload.code, "MINIMAX_NETWORK_FAILED");
      assert.equal(payload.rawCode, "MINIMAX_NETWORK_FAILED");
      assert.equal(payload.errorClass, "NETWORK_FAILURE");
    });
  });

  it("MCP generate event payload prefers structured code", async () => {
    const app = express();
    app.use(express.json());
    registerMcpMediaRoutes(app, {
      config: {
        storage: { generatedDir: join(TEST_DIR, "generated"), packageRoot: TEST_DIR },
        ids: { generatedHexBytes: 4 },
        mcp: { enabledProviders: ["runway"], tokenDir: TEST_DIR, snapshotDir: join(TEST_DIR, "snapshots") },
      },
      mcpConnectionManager: {
        status: () => ({ provider: "runway", state: "connected", snapshotDiff: { drifted: [], missing: [], added: [] } }),
        callTool: async () => { throw new Error("unused"); },
      },
    } as never, {
      execute: async () => {
        throw Object.assign(new Error("ordinary provider failure:ignored"), {
          code: "MINIMAX_NETWORK_FAILED",
          status: 502,
        });
      },
    } as never);
    await withServer(app, async (baseUrl) => {
      const pending = waitForError("env-mcp-generate");
      const response = await fetch(`${baseUrl}/api/mcp/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "runway", kind: "image", prompt: "generate", requestId: "env-mcp-generate" }),
      });
      assert.equal(response.status, 202);
      const payload = await pending;
      assert.equal(payload.code, "MINIMAX_NETWORK_FAILED");
      assert.equal(payload.rawCode, "MINIMAX_NETWORK_FAILED");
      assert.equal(payload.errorClass, "NETWORK_FAILURE");
    });
  });

  it("MCP recover event payload prefers structured code", async () => {
    const app = express();
    app.use(express.json());
    registerMcpRecoverRoutes(app, {
      config: {
        storage: { generatedDir: join(TEST_DIR, "generated") },
        ids: { generatedHexBytes: 4 },
      },
      mcpConnectionManager: {
        status: () => ({ provider: "runway", state: "connected" }),
        callTool: async () => {
          throw Object.assign(new Error("ordinary provider failure:ignored"), {
            code: "MINIMAX_NETWORK_FAILED",
            status: 502,
          });
        },
      },
    } as never);
    await withServer(app, async (baseUrl) => {
      // recover generates its own requestId; subscribe to any mcp recover error.
      const payloadPromise = new Promise<Record<string, unknown>>((resolve, reject) => {
        const timer = setTimeout(() => { stop(); reject(new Error("timeout recover error")); }, 4000);
        const stop = subscribe((ev) => {
          if (ev.event === "error" && String(ev.jobId || "").startsWith("mcpr_")) {
            clearTimeout(timer);
            stop();
            resolve(ev.data);
          }
        });
      });
      const response = await fetch(`${baseUrl}/api/mcp/tasks/20fba936-054a-4563-b91b-8fa9b019bb20/recover`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "runway", kind: "video" }),
      });
      assert.equal(response.status, 202);
      const payload = await payloadPromise;
      assert.equal(payload.code, "MINIMAX_NETWORK_FAILED");
      assert.equal(payload.rawCode, "MINIMAX_NETWORK_FAILED");
      assert.equal(payload.errorClass, "NETWORK_FAILURE");
    });
  });

  it("MCP multishot event payload prefers structured code", async () => {
    const app = express();
    app.use(express.json());
    registerMcpMultishotRoutes(app, {
      config: {
        storage: { generatedDir: join(TEST_DIR, "generated") },
        ids: { generatedHexBytes: 4 },
      },
      mcpConnectionManager: {
        status: () => ({ provider: "runway", state: "connected" }),
        callTool: async () => {
          throw Object.assign(new Error("ordinary provider failure:ignored"), {
            code: "MINIMAX_NETWORK_FAILED",
            status: 502,
          });
        },
      },
    } as never);
    await withServer(app, async (baseUrl) => {
      const pending = waitForError("env-mcp-multishot");
      const response = await fetch(`${baseUrl}/api/mcp/multishot`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "story", requestId: "env-mcp-multishot" }),
      });
      assert.equal(response.status, 202);
      const payload = await pending;
      assert.equal(payload.code, "MINIMAX_NETWORK_FAILED");
      assert.equal(payload.rawCode, "MINIMAX_NETWORK_FAILED");
      assert.equal(payload.errorClass, "NETWORK_FAILURE");
    });
  });

  it("Edit JSON carries Gemini fields from the real route", async () => {
    const originalFetch = globalThis.fetch;
    const app = express();
    app.use(express.json({ limit: "2mb" }));
    registerEditRoutes(app, {
      geminiApiKey: "test-key",
      config: {
        ...config,
        storage: { ...config.storage, generatedDir: TEST_DIR },
        log: { ...config.log, level: "silent" },
      },
      packageVersion: "test",
    });
    try {
      await withServer(app, async (baseUrl) => {
        globalThis.fetch = async (url, init) => {
          if (String(url).startsWith(baseUrl)) return originalFetch(url, init);
          return new Response("rate limited", { status: 429 });
        };
        const response = await originalFetch(`${baseUrl}/api/edit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: "edit", image: TINY_PNG, provider: "gemini-api" }),
        });
        const body = await response.json() as Record<string, unknown>;
        assert.equal(body.code, "GEMINI_API_RATE_LIMITED");
        assert.equal(body.rawCode, "GEMINI_API_RATE_LIMITED");
        assert.equal(body.errorClass, "RATE_LIMITED");
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  async function waitForQueueStatus(id: string, status: string) {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const item = queue.getAgentQueueItem(id);
      if (item?.status === status) return item;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`timed out waiting for ${id} to become ${status} (now ${queue.getAgentQueueItem(id)?.status})`);
  }

  it("Agent queue worker stores Atlas 400 and 502 classes", async () => {
    const originalFetch = globalThis.fetch;
    const session = createAgentSession({ title: "error envelope" });
    const cases = [[400, "CAPABILITY_UNSUPPORTED"], [502, "NETWORK_FAILURE"]] as const;
    try {
      for (const [status, expectedClass] of cases) {
        const item = queue.createAgentQueueItem({
          sessionId: session.id,
          prompt: `atlas ${status}`,
          options: { provider: "atlascloud", generationStrategy: "manual" },
        });
        globalThis.fetch = async (url) => {
          if (String(url).includes("/model/generateImage")) {
            return new Response("failed", { status });
          }
          throw new Error(`unexpected fetch ${String(url)}`);
        };
        await tickAgentQueueWorker({
          atlasCloudApiKey: "test-key",
          config: {
            storage: { generatedDir: TEST_DIR },
            agentPlanner: { enabled: false },
            log: { level: "silent" },
          },
          packageVersion: "test",
        } as never);
        const stored = await waitForQueueStatus(item.id, "failed");
        assert.equal(stored.errorCode, "ATLASCLOUD_GENERATE_FAILED");
        assert.equal(stored.errorClass, expectedClass);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }

    const appItem = queue.createAgentQueueItem({ sessionId: session.id, prompt: "canceled" });
    queue.claimNextAgentQueueItem({ maxGlobalRunning: 10, maxSessionRunning: 10 });
    queue.failAgentQueueItem(appItem.id, { code: "timeout", message: "timeout" });
    assert.equal("errorClass" in queue.getAgentQueueItem(appItem.id)!, false);
    const classes = queue.getAgentGenerationErrors(session.id)
      .map((record) => record.errorClass)
      .filter((value): value is string => typeof value === "string")
      .sort();
    assert.deepEqual(classes, ["CAPABILITY_UNSUPPORTED", "NETWORK_FAILURE"]);
  });

  it("app codes never gain provider envelope fields", () => {
    assert.deepEqual(errorEnvelopeFields({ code: "SAFETY_REFUSAL", status: 422 }), {});
    const fields = upstreamErrorFields({ code: "SAFETY_REFUSAL", status: 422 });
    assert.equal("rawCode" in fields, false);
    assert.equal("errorClass" in fields, false);
  });
});
