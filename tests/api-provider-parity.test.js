import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import sharp from "sharp";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { registerGenerateRoutes } from "../routes/generate.ts";
import { registerEditRoutes } from "../routes/edit.ts";
import { registerMultimodeRoutes } from "../routes/multimode.ts";
import { registerNodeRoutes } from "../routes/nodes.ts";
import { config } from "../config.js";

const FINAL_B64 = Buffer.from("final image").toString("base64");
const SECOND_B64 = Buffer.from("second image").toString("base64");
const PARTIAL_B64 = Buffer.from("partial image").toString("base64");

let originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function sseResponse(events) {
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

function jsonResponse(body, status = 400) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function imageEvents(images = [FINAL_B64]) {
  return [
    { type: "response.image_generation_call.partial_image", partial_image: PARTIAL_B64, index: 0 },
    ...images.map((result) => ({
      type: "response.output_item.done",
      item: { type: "image_generation_call", result, revised_prompt: "revised" },
    })),
    { type: "response.completed", response: { usage: { total_tokens: 3 } } },
  ];
}

async function withApp(fn, { apiKey = "sk-test" } = {}) {
  const rootDir = await mkdtemp(join(tmpdir(), "ima2-api-provider-"));
  const generatedDir = join(rootDir, "generated");
  const ctx = {
    rootDir,
    apiKey,
    config: {
      ...config,
      storage: { ...config.storage, generatedDir },
      log: { ...config.log, level: "silent" },
    },
    packageVersion: "test",
  };
  const app = express();
  app.use(express.json({ limit: "8mb" }));
  registerGenerateRoutes(app, ctx);
  registerEditRoutes(app, ctx);
  registerMultimodeRoutes(app, ctx);
  registerNodeRoutes(app, ctx);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn({ baseUrl, generatedDir });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(rootDir, { recursive: true, force: true });
  }
}

async function pngB64({ alpha = false } = {}) {
  const buffer = await sharp({
    create: {
      width: 8,
      height: 8,
      channels: alpha ? 4 : 3,
      background: alpha ? { r: 255, g: 255, b: 255, alpha: 0.5 } : "#336699",
    },
  }).png().toBuffer();
  return buffer.toString("base64");
}

describe("API provider parity", () => {
  it("generate provider=api calls Responses with API auth and selected options", async () => {
    const calls = [];
    globalThis.fetch = async (url, init) => {
      if (String(url).startsWith("http://127.0.0.1:")) {
        return originalFetch(url, init);
      }
      calls.push({ url, init, body: JSON.parse(init.body) });
      return sseResponse(imageEvents());
    };
    await withApp(async ({ baseUrl }) => {
      const res = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "api provider generate",
          provider: "api",
          model: "gpt-5.4",
          reasoningEffort: "high",
          webSearchEnabled: true,
          size: "1024x1024",
        }),
      });
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.provider, "api");
      assert.equal(body.model, "gpt-5.4");
      assert.equal(calls[0].url, "https://api.openai.com/v1/responses");
      assert.match(calls[0].init.headers.Authorization, /^Bearer sk-test$/);
      assert.equal(calls[0].body.model, "gpt-5.4");
      assert.equal(calls[0].body.reasoning.effort, "high");
      assert.equal(calls[0].body.tools[0].type, "web_search");
      assert.equal(calls[0].body.tools[1].type, "image_generation");
    });
  });

  it("provider=api requires an API key before upstream", async () => {
    let upstreamHits = 0;
    globalThis.fetch = async (url, init) => {
      if (String(url).startsWith("http://127.0.0.1:")) {
        return originalFetch(url, init);
      }
      upstreamHits++;
      return sseResponse(imageEvents());
    };
    await withApp(async ({ baseUrl }) => {
      const res = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "missing key", provider: "api" }),
      });
      const body = await res.json();
      assert.equal(res.status, 401);
      assert.equal(body.code, "API_KEY_REQUIRED");
      assert.equal(upstreamHits, 0);
    }, { apiKey: null });
  });

  it("provider=api sanitizes upstream 4xx messages before route responses", async () => {
    globalThis.fetch = async (url, init) => {
      if (String(url).startsWith("http://127.0.0.1:")) {
        return originalFetch(url, init);
      }
      return jsonResponse({
        error: {
          message: "Bad prompt private prompt text data:image/png;base64,AAAA sk-test-secret",
          code: "invalid_value",
          type: "invalid_request_error",
          param: "input[1].content",
        },
      });
    };
    await withApp(async ({ baseUrl }) => {
      const res = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "private prompt text",
          provider: "api",
        }),
      });
      const body = await res.json();
      const serialized = JSON.stringify(body);
      assert.equal(res.status, 400);
      assert.equal(body.code, "INVALID_REQUEST");
      assert.equal(body.upstreamCode, "invalid_value");
      assert.equal(body.upstreamType, "invalid_request_error");
      assert.equal(body.upstreamParam, "input[1].content");
      assert.match(body.error, /OpenAI rejected the image request parameters/);
      assert.doesNotMatch(serialized, /private prompt text/);
      assert.doesNotMatch(serialized, /data:image/);
      assert.doesNotMatch(serialized, /AAAA/);
      assert.doesNotMatch(serialized, /sk-test-secret/);
    });
  });

  it("edit provider=api sends input image and mask guidance", async () => {
    const calls = [];
    globalThis.fetch = async (url, init) => {
      if (String(url).startsWith("http://127.0.0.1:")) {
        return originalFetch(url, init);
      }
      calls.push(JSON.parse(init.body));
      return sseResponse(imageEvents());
    };
    const image = await pngB64();
    const mask = await pngB64({ alpha: true });
    await withApp(async ({ baseUrl }) => {
      const res = await fetch(`${baseUrl}/api/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "edit inside mask", image, mask, provider: "api" }),
      });
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.provider, "api");
      const content = calls[0].input[1].content;
      assert.ok(content.some((item) => item.type === "input_image"));
      assert.ok(content.some((item) => item.type === "input_text" && /mask guide/.test(item.text)));
    });
  });

  it("multimode provider=api preserves SSE image and done envelope", async () => {
    globalThis.fetch = async (url, init) => {
      if (String(url).startsWith("http://127.0.0.1:")) {
        return originalFetch(url, init);
      }
      return sseResponse(imageEvents([FINAL_B64, SECOND_B64]));
    };
    await withApp(async ({ baseUrl }) => {
      const res = await fetch(`${baseUrl}/api/generate/multimode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "two stages", provider: "api", maxImages: 2 }),
      });
      const text = await res.text();
      assert.equal(res.status, 200);
      assert.match(text, /event: phase/);
      assert.match(text, /event: image/);
      assert.match(text, /event: done/);
      assert.match(text, /"provider":"api"/);
      assert.match(text, /"requested":2/);
      assert.match(text, /"returned":2/);
    });
  });

  it("node provider=api preserves SSE partial and done envelope", async () => {
    globalThis.fetch = async (url, init) => {
      if (String(url).startsWith("http://127.0.0.1:")) {
        return originalFetch(url, init);
      }
      return sseResponse(imageEvents());
    };
    await withApp(async ({ baseUrl }) => {
      const res = await fetch(`${baseUrl}/api/node/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ prompt: "node api", provider: "api", requestId: "req_node_api" }),
      });
      const text = await res.text();
      assert.equal(res.status, 200);
      assert.match(text, /event: phase/);
      assert.match(text, /event: partial/);
      assert.match(text, /event: done/);
      assert.match(text, /"provider":"api"/);
    });
  });
});
