import { after, afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { executionTestProcess } from "./_executionTestProcess.ts";
import type { UpstreamCall } from "./_videoExecutionFixture.ts";

if (executionTestProcess(import.meta.url)) {
const { openVideoFixture } = await import("./_videoExecutionFixture.ts");
const fixture = await openVideoFixture();
const TEST_DIR = fixture.root;
const { config } = fixture;
after(async () => { await fixture.close(); });
beforeEach(() => { fixture.beginCase(); });
afterEach(async () => { await fixture.finishCase(); });

const { errorEnvelopeFields } = await import("../lib/errors/envelope.js");
const { upstreamErrorFields } = await import("../lib/routeHelpers.js");
const { writeNodeError, nodeErrorDetails } = await import("../lib/nodeHelpers.js");
const { normalizeGenerationFailure } = await import("../lib/generationErrors.js");
const { generateMultimodeViaGrok } = await import("../lib/grokMultimodeAdapter.js");
const { registerVideoExtendedRoutes } = await import("../routes/videoExtended.js");
const { registerVideoRoutes } = await import("../routes/video.js");
const { registerEditRoutes } = await import("../routes/edit.js");
const { registerMcpMediaRoutes } = await import("../routes/mcpMedia.js");
const { registerMcpRecoverRoutes } = await import("../routes/mcpRecover.js");
const { registerMcpMultishotRoutes } = await import("../routes/mcpMultishot.js");
const { createAgentSession } = await import("../lib/agentStore.js");
const { tickAgentQueueWorker } = await import("../lib/agentQueueWorker.js");
const queue = await import("../lib/agentQueueStore.js");
const { subscribe } = await import("../lib/eventBus.js");

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
  try {
    const baseUrl = await fixture.listen(createServer(app), "app");
    await run(baseUrl);
  } finally {
    await fixture.drain();
  }
}

function trackedApp() {
  const app = express();
  fixture.trackApp(app);
  return app;
}

function assertJsonPost(call: UpstreamCall, origin: string, paths: readonly string[], authorization: string | null) {
  const url = new URL(call.url);
  assert.equal(url.origin, origin);
  assert.ok(paths.includes(url.pathname), `Unexpected provider path: ${url.pathname}`);
  assert.equal(url.search, "");
  assert.equal(call.method, "POST");
  assert.equal(call.headers.get("authorization"), authorization);
  assert.equal(call.headers.get("cookie"), null);
  assert.equal(call.headers.get("content-type"), "application/json");
  const body: unknown = JSON.parse(call.body);
  assert.ok(body && typeof body === "object" && !Array.isArray(body));
  return body as Record<string, unknown>;
}

function failVideoRequests(paths: readonly string[]) {
  const failure = providerError("GROK_VIDEO_REQUEST_FAILED", 502);
  fixture.allowFailure(failure);
  fixture.respond((call) => {
    assertJsonPost(call, "http://127.0.0.1:1", paths, "Bearer dummy");
    throw failure;
  });
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
    failVideoRequests(["/v1/responses", "/v1/chat/completions", "/v1/videos/generations"]);
    const app = trackedApp();
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
        const response = await fixture.fetchApp(`${baseUrl}/api/video/generate`, {
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
      await fixture.drain();
    }
  });

  it("Video JSON restores structured code and fields", async () => {
    failVideoRequests(["/v1/videos/edits"]);
    const app = trackedApp();
    app.use(express.json());
    registerVideoExtendedRoutes(app, { config: { storage: { generatedDir: TEST_DIR }, grokProvider: { proxyHost: "127.0.0.1", proxyPort: 1 } } });
    try {
      await withServer(app, async (baseUrl) => {
        const response = await fixture.fetchApp(`${baseUrl}/api/video/edit`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: "edit", videoUrl: "https://example.test/input.mp4" }),
        });
        const body = await response.json() as Record<string, unknown>;
        assert.equal(body.code, "GROK_VIDEO_REQUEST_FAILED");
        assert.equal(body.rawCode, "GROK_VIDEO_REQUEST_FAILED");
        assert.equal(body.errorClass, "NETWORK_FAILURE");
      });
    } finally {
      await fixture.drain();
    }
  });

  it("Video extend event-bus carries Grok 502 fields", async () => {
    writeFileSync(join(TEST_DIR, "root.mp4"), Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]));
    writeFileSync(join(TEST_DIR, "root.mp4.json"), JSON.stringify({
      kind: "video", provider: "grok", model: "grok-imagine-video",
      userPrompt: "parent", video: { duration: 5, resolution: "480p", aspectRatio: "auto" },
    }));
    const app = trackedApp();
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
      const response = await fixture.fetchApp(`${baseUrl}/api/video/extend`, {
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
    const app = trackedApp();
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
      const response = await fixture.fetchApp(`${baseUrl}/api/video/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceVideoId: "root.mp4", requestId: "env-video-preflight", prompt: "continue" }),
      });
      const body = await response.json() as Record<string, unknown>;
      const payload = await pending;
      assert.equal(response.status, 502);
      assert.equal(body.code, "GROK_VIDEO_REQUEST_FAILED");
      assert.equal(body.rawCode, "GROK_VIDEO_REQUEST_FAILED");
      assert.equal(body.errorClass, "NETWORK_FAILURE");
      assert.equal(payload.code, "GROK_VIDEO_REQUEST_FAILED");
      assert.equal(payload.rawCode, "GROK_VIDEO_REQUEST_FAILED");
      assert.equal(payload.errorClass, "NETWORK_FAILURE");
    });
  });

  it("Multimode returns the last item failure from the adapter", async () => {
    const failure = providerError("GROK_UPSTREAM_ERROR", 502);
    fixture.allowFailure(failure);
    fixture.respond((call) => {
      assertJsonPost(call, "http://127.0.0.1:9", ["/v1/responses", "/v1/chat/completions", "/v1/images/generations"], "Bearer dummy");
      const target = call.url;
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
      throw failure;
    });
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
      await fixture.drain();
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
    const app = trackedApp();
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
      const response = await fixture.fetchApp(`${baseUrl}/api/mcp/media-action`, {
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
    const app = trackedApp();
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
      const response = await fixture.fetchApp(`${baseUrl}/api/mcp/generate`, {
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
    const app = trackedApp();
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
      const response = await fixture.fetchApp(`${baseUrl}/api/mcp/tasks/20fba936-054a-4563-b91b-8fa9b019bb20/recover`, {
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
    const app = trackedApp();
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
      const response = await fixture.fetchApp(`${baseUrl}/api/mcp/multishot`, {
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
    fixture.respond((call) => {
      assertJsonPost(call, "https://generativelanguage.googleapis.com", ["/v1beta/models/gemini-3.1-flash-image:generateContent"], null);
      assert.equal(call.headers.get("x-goog-api-key"), "test-key");
      return new Response("rate limited", { status: 429 });
    });
    const app = trackedApp();
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
        const response = await fixture.fetchApp(`${baseUrl}/api/edit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: "edit", image: TINY_PNG, provider: "gemini-api", model: "nano-banana-2" }),
        });
        const body = await response.json() as Record<string, unknown>;
        assert.equal(body.code, "GEMINI_API_RATE_LIMITED");
        assert.equal(body.rawCode, "GEMINI_API_RATE_LIMITED");
        assert.equal(body.errorClass, "RATE_LIMITED");
      });
    } finally {
      await fixture.drain();
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
    const session = createAgentSession({ title: "error envelope" });
    const cases = [[400, "CAPABILITY_UNSUPPORTED"], [502, "NETWORK_FAILURE"]] as const;
    try {
      for (const [status, expectedClass] of cases) {
        const item = queue.createAgentQueueItem({
          sessionId: session.id,
          prompt: `atlas ${status}`,
          options: { provider: "atlascloud", generationStrategy: "manual" },
        });
        fixture.respond((call) => {
          assertJsonPost(call, "https://api.atlascloud.ai", ["/api/v1/model/generateImage"], "Bearer test-key");
          return new Response("failed", { status });
        });
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
      await fixture.drain();
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
}
