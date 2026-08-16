import { after, afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import sharp from "sharp";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEST_DIR = mkdtempSync(join(tmpdir(), "ima2-agent-runtime-"));
process.env.IMA2_CONFIG_DIR = TEST_DIR;
process.env.IMA2_DB_PATH = join(TEST_DIR, "sessions.db");

const { registerAgentRoutes } = await import("../routes/agent.ts");
const { isRuntimeRestartableError } = await import("../lib/agentRuntime.ts");
const { runAgentVideoGeneration } = await import("../lib/agentImageVideoGen.ts");
const { createAgentSession } = await import("../lib/agentStore.ts");
const { config } = await import("../config.ts");
const db = await import("../lib/db.ts");
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

after(() => {
  db.closeDb();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

function sseResponse(events: unknown[]) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  }), { status: 200, headers: { "Content-Type": "text/event-stream; charset=utf-8" } });
}

async function pngB64() {
  const buffer = await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: "#334455",
    },
  }).png().toBuffer();
  return buffer.toString("base64");
}

function fakeMp4Bytes() {
  return Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]);
}

async function withApp(fn: (baseUrl: string, generatedDir: string) => Promise<void>) {
  const generatedDir = join(TEST_DIR, `generated-${Date.now()}`);
  const app = express();
  app.use(express.json({ limit: "8mb" }));
  registerAgentRoutes(app, {
    apiKey: "sk-test",
    config: {
      storage: { generatedDir },
      log: { level: "silent" },
    },
    packageVersion: "test",
  });
  const server = await new Promise<import("node:http").Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const addr = server.address() as import("node:net").AddressInfo;
  try {
    await fn(`http://127.0.0.1:${addr.port}`, generatedDir);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function createSession(baseUrl: string) {
  const res = await fetch(`${baseUrl}/api/agent/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "contract agent",
      currentImage: {
        id: "img_seed",
        filename: "seed.png",
        url: "/generated/seed.png",
        prompt: "seed prompt",
      },
    }),
  });
  assert.equal(res.status, 201);
  return await res.json() as { selectedSessionId: string; manifest: string };
}

describe("Agent Mode runtime contract", () => {
  it("exposes only ima2 image-agent tools", async () => {
    await withApp(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/agent/tools`);
      const payload = await res.json() as { tools: string[]; manifest: Array<{ name: string; description: string; parameters: unknown }> };
      assert.deepEqual(payload.tools, [
        "ima2.get_image_context",
        "ima2.web_search",
        "ima2.generate_image",
        "ima2.generate_video",
        "ima2.get_generation_errors",
      ]);
      assert.deepEqual(payload.manifest.map((entry) => entry.name), payload.tools);
      for (const entry of payload.manifest) {
        assert.equal(typeof entry.description, "string");
        assert.ok(entry.parameters && typeof entry.parameters === "object");
      }
    });
  });

  it("keeps the image context manifest across compact/resume", async () => {
    await withApp(async (baseUrl, generatedDir) => {
      mkdirSync(generatedDir, { recursive: true });
      writeFileSync(join(generatedDir, "seed.png"), Buffer.from(await pngB64(), "base64"));
      const created = await createSession(baseUrl);
      assert.match(created.manifest, /img_seed/);
      await fetch(`${baseUrl}/api/agent/sessions/${created.selectedSessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleLocks: ["ink wash"], subjectLocks: ["main character"] }),
      });

      const compacted = await fetch(`${baseUrl}/api/agent/sessions/${created.selectedSessionId}/compact`, {
        method: "POST",
      });
      assert.equal(compacted.status, 200);

      const manifestRes = await fetch(`${baseUrl}/api/agent/sessions/${created.selectedSessionId}/manifest`);
      const manifest = await manifestRes.text();
      assert.match(manifest, /img_seed/);
      assert.match(manifest, /ink wash/);
      assert.match(manifest, /main character/);
      assert.match(manifest, /compactStatus: compacted/);
      assert.match(manifest, /ima2.generate_image/);
    });
  });

  it("generates through the allowed Responses tool bridge and stores image handles", async () => {
    const finalImage = await pngB64();
    const calls: Array<{ body: any }> = [];
    globalThis.fetch = async (url, init) => {
      if (String(url).startsWith("http://127.0.0.1:")) return originalFetch(url, init);
      calls.push({ body: JSON.parse(String(init?.body)) });
      return sseResponse([
        { type: "response.output_text.delta", delta: "Use a crisp frontal composition." },
        { type: "response.output_text.done", text: "Use a crisp frontal composition." },
        {
          type: "response.output_item.done",
          item: { type: "image_generation_call", result: finalImage, revised_prompt: "revised agent prompt" },
        },
        { type: "response.output_item.done", item: { type: "web_search_call" } },
        { type: "response.completed", response: { usage: { total_tokens: 7 } } },
      ]);
    };

    await withApp(async (baseUrl) => {
      const created = await createSession(baseUrl);
      const res = await fetch(`${baseUrl}/api/agent/sessions/${created.selectedSessionId}/turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "make a crisp product mockup", provider: "api" }),
      });
      const body = await res.json() as any;
      const images = Object.values(body.imagesById) as Array<{ url: string; revisedPrompt?: string }>;
      const turns = body.turnsBySession[created.selectedSessionId] as Array<{ role: string; text: string; imageIds?: string[] }>;

      assert.equal(res.status, 200);
      assert.deepEqual(calls[0].body.tools.map((tool: { type: string }) => tool.type), ["web_search", "image_generation"]);
      assert.match(calls[0].body.input[1].content, /<ima2-image-context>/);
      assert.ok(images.some((image) => image.url.startsWith("/generated/")));
      assert.ok(!JSON.stringify(turns).includes(finalImage));
      assert.ok(turns.some((turn) => turn.text.includes("ima2.get_image_context")));
      const assistantImageTurn = turns.find((turn) => turn.role === "assistant" && turn.imageIds?.length);
      assert.ok(assistantImageTurn);
      // Prose-first contract: when the model returned text, the assistant turn
      // reads like a normal chat reply — no mechanical artifact summary.
      assert.ok(assistantImageTurn.text.includes("Use a crisp frontal composition."));
      assert.ok(!assistantImageTurn.text.includes("Generated 1 image artifact."));
    });
  });

  it("generates through current and compatibility Grok planner models when Agent provider is grok", async () => {
    const finalImage = await pngB64();
    const calls: Array<{ url: string; body: any }> = [];
    globalThis.fetch = async (url, init) => {
      if (String(url).startsWith("http://127.0.0.1:") && !String(url).includes("/v1/")) return originalFetch(url, init);
      const body = JSON.parse(String(init?.body || "{}"));
      calls.push({ url: String(url), body });
      if (String(url).endsWith("/v1/responses")) {
        return Response.json({
          output: [{ type: "message", content: [{ type: "output_text", text: "Agent Grok visual brief." }] }],
        });
      }
      if (String(url).endsWith("/v1/chat/completions")) {
        return Response.json({
          choices: [{
            message: {
              tool_calls: [{
                type: "function",
                function: {
                  name: "generate_image",
                  arguments: JSON.stringify({ prompt: "planned agent grok prompt", model: "grok-imagine-image" }),
                },
              }],
            },
          }],
        });
      }
      if (String(url).startsWith("https://cdn.x.ai/")) {
        return new Response(Buffer.from(finalImage, "base64"), { headers: { "Content-Type": "image/jpeg" } });
      }
      return Response.json({
        data: [{ url: "https://cdn.x.ai/test-agent.png" }],
        usage: { cost_in_usd_ticks: 5 },
      });
    };

    for (const plannerModel of ["grok-4.5", "grok-4.3"]) {
      calls.length = 0;
      await withApp(async (baseUrl) => {
      const created = await createSession(baseUrl);
      const res = await fetch(`${baseUrl}/api/agent/sessions/${created.selectedSessionId}/turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "make a Grok agent poster",
          provider: "grok",
          model: plannerModel,
          quality: "high",
          webSearchEnabled: false,
        }),
      });
      const body = await res.json() as any;
      const images = Object.values(body.imagesById) as Array<{ url: string; revisedPrompt?: string }>;
      const turns = body.turnsBySession[created.selectedSessionId] as Array<{ text: string; imageIds?: string[] }>;

      assert.equal(res.status, 200);
      assert.ok(images.some((image) => image.url.endsWith(".jpeg")));
      assert.ok(images.some((image) => image.revisedPrompt === "planned agent grok prompt"));
      assert.ok(turns.some((turn) => turn.text.includes("ima2.web_search + ima2.generate_image")));
      assert.equal(calls.filter((call) => call.url.endsWith("/v1/responses")).length, 1);
      assert.equal(calls.filter((call) => call.url.endsWith("/v1/chat/completions")).length, 1);
      assert.equal(calls.filter((call) => call.url.endsWith("/v1/images/generations")).length, 1);
      assert.equal(calls.filter((call) => call.url.endsWith("/v1/images/edits")).length, 0);
      assert.equal(calls.find((call) => call.url.endsWith("/v1/chat/completions"))?.body.model, plannerModel);
      assert.equal(calls.find((call) => call.url.endsWith("/v1/images/generations"))?.body.model, "grok-imagine-image-quality");
      assert.equal(calls.find((call) => call.url.endsWith("/v1/images/generations"))?.body.model === plannerModel, false);
      assert.match(calls.find((call) => call.url.endsWith("/v1/chat/completions"))?.body.messages[1].content[0].text, /English only/);
      });
    }
  });

  it("routes Agent 1080p I2V video through Grok Video 1.5 and records sidecar metadata", async () => {
    const generatedDir = join(TEST_DIR, `generated-video-${Date.now()}`);
    mkdirSync(generatedDir, { recursive: true });
    writeFileSync(join(generatedDir, "seed.png"), Buffer.from(await pngB64(), "base64"));
    const session = createAgentSession({
      title: "agent 1080p video",
      currentImage: {
        id: "img_video_seed",
        filename: "seed.png",
        url: "/generated/seed.png",
        prompt: "seed image",
      },
    });
    const starts: any[] = [];
    globalThis.fetch = async (url, init) => {
      const href = String(url);
      if (href.includes("/v1/responses")) {
        return Response.json({ output: [{ type: "message", content: [{ type: "text", text: "video context" }] }] });
      }
      if (href.includes("/v1/chat/completions")) {
        return Response.json({
          choices: [{
            message: {
              tool_calls: [{
                type: "function",
                function: { name: "generate_video", arguments: JSON.stringify({ prompt: "Agent 1080p I2V prompt." }) },
              }],
            },
          }],
        });
      }
      if (href.includes("/v1/videos/generations")) {
        starts.push(JSON.parse(String(init?.body || "{}")));
        return Response.json({ request_id: "vid-agent-1080" });
      }
      if (href.includes("/v1/videos/vid-agent-1080")) {
        return Response.json({
          status: "done",
          progress: 100,
          video: { url: "https://vidgen.example/agent-1080.mp4", duration: 5, respect_moderation: true },
          usage: { cost_in_usd_ticks: 1000000000 },
        });
      }
      if (href.includes("vidgen.example")) {
        return new Response(fakeMp4Bytes(), { headers: { "Content-Type": "video/mp4" } });
      }
      throw new Error(`unexpected fetch: ${href}`);
    };

    await runAgentVideoGeneration(
      {
        rootDir: process.cwd(),
        packageVersion: "test",
        config: {
          ...config,
          storage: { ...config.storage, generatedDir },
          grokProvider: {
            ...config.grokProvider,
            proxyHost: "127.0.0.1",
            proxyPort: 18645,
            videoPollIntervalMs: 1,
            videoStartTimeoutMs: 5000,
            videoTimeoutMs: 30000,
            videoDownloadTimeoutMs: 5000,
            plannerTimeoutMs: 5000,
          },
        },
      } as any,
      session.id,
      "animate the seed image in 1080p",
      {
        skipUserTurn: true,
        videoParams: { duration: 5, resolution: "1080p", aspectRatio: "16:9" },
        requestId: "agent_video_1080p",
      },
    );

    assert.equal(starts.length, 1);
    assert.equal(starts[0].model, "grok-imagine-video-1.5");
    assert.equal(starts[0].resolution, "1080p");
    assert.ok(starts[0].image?.url?.startsWith("data:image/"));
    const sidecarName = readdirSync(generatedDir).find((name) => name.endsWith("_agent.mp4.json"));
    assert.ok(sidecarName);
    const sidecar = JSON.parse(readFileSync(join(generatedDir, sidecarName), "utf8"));
    assert.equal(sidecar.model, "grok-imagine-video-1.5");
    assert.equal(sidecar.requestedModel, "grok-imagine-video-1.5");
    assert.equal(sidecar.effectiveModel, "grok-imagine-video-1.5");
    assert.equal(sidecar.modelFallback, null);
    assert.equal(sidecar.video.resolution, "1080p");
    assert.equal(sidecar.video.requestedModel, "grok-imagine-video-1.5");
    assert.equal(sidecar.video.effectiveModel, "grok-imagine-video-1.5");
  });

  it("routes Agent prompt-only 1080p video through Grok Video 1.5 canvas shim", async () => {
    const generatedDir = join(TEST_DIR, `generated-video-t2v-${Date.now()}`);
    mkdirSync(generatedDir, { recursive: true });
    const session = createAgentSession({ title: "agent 1080p t2v" });
    const starts: any[] = [];
    globalThis.fetch = async (url, init) => {
      const href = String(url);
      if (href.includes("/v1/responses")) {
        return Response.json({ output: [{ type: "message", content: [{ type: "text", text: "video context" }] }] });
      }
      if (href.includes("/v1/chat/completions")) {
        return Response.json({
          choices: [{
            message: {
              tool_calls: [{
                type: "function",
                function: { name: "generate_video", arguments: JSON.stringify({ prompt: "Agent 1080p T2V prompt." }) },
              }],
            },
          }],
        });
      }
      if (href.includes("/v1/videos/generations")) {
        starts.push(JSON.parse(String(init?.body || "{}")));
        return Response.json({ request_id: "vid-agent-1080-t2v" });
      }
      if (href.includes("/v1/videos/vid-agent-1080-t2v")) {
        return Response.json({
          status: "done",
          progress: 100,
          video: { url: "https://vidgen.example/agent-1080-t2v.mp4", duration: 5, respect_moderation: true },
          usage: { cost_in_usd_ticks: 1000000000 },
        });
      }
      if (href.includes("vidgen.example")) {
        return new Response(fakeMp4Bytes(), { headers: { "Content-Type": "video/mp4" } });
      }
      throw new Error(`unexpected fetch: ${href}`);
    };

    await runAgentVideoGeneration(
      {
        rootDir: process.cwd(),
        packageVersion: "test",
        config: {
          ...config,
          storage: { ...config.storage, generatedDir },
          grokProvider: {
            ...config.grokProvider,
            proxyHost: "127.0.0.1",
            proxyPort: 18645,
            videoPollIntervalMs: 1,
            videoStartTimeoutMs: 5000,
            videoTimeoutMs: 30000,
            videoDownloadTimeoutMs: 5000,
            plannerTimeoutMs: 5000,
          },
        },
      } as any,
      session.id,
      "make a new 1080p video",
      {
        skipUserTurn: true,
        videoParams: { duration: 5, resolution: "1080p", aspectRatio: "16:9" },
        requestId: "agent_video_1080p_t2v",
      },
    );

    assert.equal(starts.length, 1);
    assert.equal(starts[0].model, "grok-imagine-video-1.5");
    assert.equal(starts[0].resolution, "1080p");
    assert.ok(starts[0].image?.url?.startsWith("data:image/png;base64,"));
    assert.match(starts[0].prompt, /blank white canvas.*technical placeholder/);
    const sidecarName = readdirSync(generatedDir).find((name) => name.endsWith("_agent.mp4.json"));
    assert.ok(sidecarName);
    const sidecar = JSON.parse(readFileSync(join(generatedDir, sidecarName), "utf8"));
    assert.equal(sidecar.video.mode, "text-to-video");
    assert.equal(sidecar.video.resolution, "1080p");
    assert.equal(sidecar.video.requestedModel, "grok-imagine-video-1.5");
  });

  it("persists selected Agent image focus and rejects cross-session image ids", async () => {
    const finalImage = await pngB64();
    globalThis.fetch = async (url, init) => {
      if (String(url).startsWith("http://127.0.0.1:")) return originalFetch(url, init);
      return sseResponse([
        {
          type: "response.output_item.done",
          item: { type: "image_generation_call", result: finalImage, revised_prompt: "generated focus target" },
        },
        { type: "response.completed", response: { usage: { total_tokens: 4 } } },
      ]);
    };

    await withApp(async (baseUrl) => {
      const created = await createSession(baseUrl);
      const generated = await fetch(`${baseUrl}/api/agent/sessions/${created.selectedSessionId}/turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "make a second image", provider: "api" }),
      });
      const generatedBody = await generated.json() as {
        currentImageId: string;
        imagesById: Record<string, { id: string }>;
        imageIdsBySession: Record<string, string[]>;
        turnsBySession: Record<string, Array<{ role: string; text: string; imageIds?: string[] }>>;
      };
      const turns = generatedBody.turnsBySession[created.selectedSessionId];

      assert.equal(generated.status, 200);
      assert.notEqual(generatedBody.currentImageId, "img_seed");
      assert.ok(generatedBody.imageIdsBySession[created.selectedSessionId].includes("img_seed"));
      assert.equal(generatedBody.imageIdsBySession[created.selectedSessionId].length, 2);
      const assistantImageTurn = turns.find((turn) => turn.role === "assistant" && turn.imageIds?.includes(generatedBody.currentImageId));
      assert.ok(assistantImageTurn);
      assert.ok(!assistantImageTurn.text.includes("Generated 1 image artifact."));
      assert.ok(!assistantImageTurn.text.includes("Single-image plan completed."));
      assert.equal(assistantImageTurn.text, "Done - I generated the image.");
      assert.ok(turns.some((turn) => turn.imageIds?.includes(generatedBody.currentImageId)));

      const selected = await fetch(`${baseUrl}/api/agent/sessions/${created.selectedSessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentImageId: "img_seed" }),
      });
      const selectedBody = await selected.json() as { currentImageId: string; manifest: string };
      assert.equal(selected.status, 200);
      assert.equal(selectedBody.currentImageId, "img_seed");
      assert.match(selectedBody.manifest, /id: img_seed/);
      assert.match(selectedBody.manifest, /seed prompt/);

      const rejected = await fetch(`${baseUrl}/api/agent/sessions/${created.selectedSessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentImageId: "not_in_this_session" }),
      });
      const rejectedBody = await rejected.json() as { code: string };
      assert.equal(rejected.status, 404);
      assert.equal(rejectedBody.code, "AGENT_IMAGE_NOT_FOUND");
    });
  });

  it("imports a patched current image into an existing Agent session", async () => {
    await withApp(async (baseUrl) => {
      const created = await createSession(baseUrl);
      const patched = await fetch(`${baseUrl}/api/agent/sessions/${created.selectedSessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentImage: {
            id: "img_pasted",
            filename: "pasted.png",
            url: "/generated/pasted.png",
            prompt: "pasted clipboard image",
          },
        }),
      });
      const body = await patched.json() as {
        currentImageId: string;
        imageIdsBySession: Record<string, string[]>;
        manifest: string;
      };

      assert.equal(patched.status, 200);
      assert.equal(body.currentImageId, "img_pasted");
      assert.ok(body.imageIdsBySession[created.selectedSessionId].includes("img_seed"));
      assert.ok(body.imageIdsBySession[created.selectedSessionId].includes("img_pasted"));
      assert.match(body.manifest, /id: img_pasted/);
      assert.match(body.manifest, /pasted clipboard image/);
    });
  });

  it("does not treat text-only model output as success", async () => {
    let upstreamHits = 0;
    globalThis.fetch = async (url, init) => {
      if (String(url).startsWith("http://127.0.0.1:")) return originalFetch(url, init);
      upstreamHits++;
      return sseResponse([
        { type: "response.output_text.delta", delta: "This is a text-only answer." },
        { type: "response.output_text.done", text: "This is a text-only answer." },
        { type: "response.completed", response: { usage: { total_tokens: 1 } } },
      ]);
    };

    await withApp(async (baseUrl) => {
      const created = await createSession(baseUrl);
      const res = await fetch(`${baseUrl}/api/agent/sessions/${created.selectedSessionId}/turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "answer in text only", provider: "api" }),
      });
      const body = await res.json() as { code: string };

      assert.equal(res.status, 422);
      assert.equal(body.code, "AGENT_TEXT_ONLY_RESULT");
      assert.equal(upstreamHits, 2);
    });
  });

  it("retries a failed image tool call instead of surfacing it as a dead end", async () => {
    let upstreamHits = 0;
    globalThis.fetch = async (url, init) => {
      if (String(url).startsWith("http://127.0.0.1:")) return originalFetch(url, init);
      upstreamHits++;
      // An upstream image_generation_call that reports status "failed" is a transient
      // per-call outcome, not a rejection: the same prompt succeeds on a retry.
      return sseResponse([
        {
          type: "response.output_item.done",
          item: { type: "image_generation_call", status: "failed" },
        },
        { type: "response.completed", response: { usage: { total_tokens: 1 } } },
      ]);
    };

    await withApp(async (baseUrl) => {
      const created = await createSession(baseUrl);
      const res = await fetch(`${baseUrl}/api/agent/sessions/${created.selectedSessionId}/turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "draw something", provider: "api" }),
      });
      const body = await res.json() as { code: string; rawCode?: string };

      assert.equal(res.status, 422);
      assert.equal(upstreamHits, 2, "IMAGE_TOOL_FAILED must be retried once before giving up");
      assert.equal(body.code, "AGENT_TEXT_ONLY_RESULT");
      assert.equal(
        body.rawCode,
        "IMAGE_TOOL_FAILED",
        "the give-up error must keep the underlying cause so the UI can explain it",
      );
    });
  });

  it("classifies timeout, auth, and protocol wedge errors as runtime-restartable", () => {
    const timeout = Object.assign(new Error("timed out"), { code: "RESPONSES_IMAGE_TIMEOUT" });
    const auth = Object.assign(new Error("auth failed"), { code: "AUTH_CHATGPT_EXPIRED" });
    const protocol = Object.assign(new Error("protocol wedge detected"), { code: "RESPONSES_PROTOCOL_WEDGE" });
    const validation = Object.assign(new Error("prompt required"), { code: "AGENT_PROMPT_REQUIRED" });

    assert.equal(isRuntimeRestartableError(timeout), true);
    assert.equal(isRuntimeRestartableError(auth), true);
    assert.equal(isRuntimeRestartableError(protocol), true);
    assert.equal(isRuntimeRestartableError(validation), false);
  });
});
