import test from "node:test";
import assert from "node:assert/strict";
import { generateViaMinimax, MINIMAX_TEXT_TO_IMAGE_MODEL, MINIMAX_IMAGE_TO_IMAGE_MODEL } from "../lib/minimaxImageAdapter.ts";
import { resolveProviderOptions } from "../lib/providerOptions.ts";
import { createTestRuntimeContext } from "../lib/runtimeContext.ts";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

function minimaxCtx(over: Record<string, unknown> = {}) {
  return createTestRuntimeContext({
    minimaxApiKey: "mm-test-key",
    config: {
      minimaxProvider: {
        defaultImageModel: "image-01",
        region: "global_en",
        globalBaseUrl: "https://api.minimax.io/v1",
        cnBaseUrl: "https://api.minimaxi.com/v1",
        generationTimeoutMs: 120_000,
      },
    },
    ...over,
  } as never);
}

test("minimax provider options normalize model and disable unsupported controls", () => {
  const resolved = resolveProviderOptions(minimaxCtx(), {
    provider: "minimax",
    rawModel: "image-01",
    rawReasoningEffort: "high",
    rawWebSearchEnabled: true,
    rawSize: "1024x1024",
  });

  assert.equal(resolved.provider, "minimax");
  assert.equal(resolved.model, "image-01");
  assert.equal(resolved.reasoningEffort, "none");
  assert.equal(resolved.webSearchEnabled, false);
  assert.equal(resolved.size, "1024x1024");
});

test("minimax provider options reject an unknown model", () => {
  const resolved = resolveProviderOptions(minimaxCtx(), {
    provider: "minimax",
    rawModel: "image-99",
  });
  assert.equal(resolved.code, "INVALID_MINIMAX_IMAGE_MODEL");
  assert.equal(resolved.status, 400);
});

test("minimax adapter requires MINIMAX_API_KEY", async () => {
  await assert.rejects(
    () => generateViaMinimax("city skyline", createTestRuntimeContext()),
    (err: any) => err?.code === "MINIMAX_API_KEY_MISSING" && err?.status === 401,
  );
});

test("minimax adapter submits a text-to-image request and parses a url response", async () => {
  const calls: Array<{ url: string; body?: any; headers?: Record<string, string> }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    const headers = init?.headers as Record<string, string> | undefined;
    calls.push({ url, body, headers });

    if (url === "https://api.minimax.io/v1/image_generation") {
      return Response.json({
        data: { image_urls: ["https://cdn.example/out.jpg"] },
        metadata: { success_count: 1, failed_count: 0 },
        base_resp: { status_code: 0, status_msg: "success" },
      });
    }
    if (url === "https://cdn.example/out.jpg") {
      return new Response(Buffer.from("fake image"), { headers: { "content-type": "image/jpeg" } });
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;

  const result = await generateViaMinimax("city skyline", minimaxCtx(), {
    model: "image-01",
    size: "1024x1024",
  });

  assert.equal(calls[0].url, "https://api.minimax.io/v1/image_generation");
  assert.equal(calls[0].headers?.Authorization, "Bearer mm-test-key");
  assert.equal(calls[0].headers?.["Content-Type"], "application/json");
  assert.deepEqual(calls[0].body, {
    model: "image-01",
    prompt: "city skyline",
    response_format: "url",
    aspect_ratio: "1:1",
  });
  assert.equal(result.b64, Buffer.from("fake image").toString("base64"));
  assert.equal(result.mime, "image/jpeg");
  assert.equal(result.providerUrl, "https://cdn.example/out.jpg");
});

test("minimax adapter maps references to subject_reference and uses the live model", async () => {
  const calls: Array<{ body?: any }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    if (url === "https://api.minimax.io/v1/image_generation") {
      calls.push({ body });
      return Response.json({
        data: { image_base64: ["b3V0"] },
        metadata: { success_count: 1, failed_count: 0 },
        base_resp: { status_code: 0, status_msg: "success" },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;

  const result = await generateViaMinimax("same character", minimaxCtx(), {
    references: [{ b64: Buffer.from("ref").toString("base64"), declaredMime: "image/png" }],
  });

  assert.equal(calls[0].body.model, MINIMAX_IMAGE_TO_IMAGE_MODEL);
  assert.ok(Array.isArray(calls[0].body.subject_reference));
  assert.equal(calls[0].body.subject_reference[0].type, "character");
  assert.match(calls[0].body.subject_reference[0].image_file, /^data:image\/png;base64,/);
  assert.equal(result.b64, "b3V0");
});

test("minimax adapter routes to the China base url for the cn_zh region", async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    urls.push(url);
    if (url === "https://api.minimaxi.com/v1/image_generation") {
      return Response.json({
        data: { image_base64: ["b3V0"] },
        metadata: { success_count: 1, failed_count: 0 },
        base_resp: { status_code: 0, status_msg: "success" },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;

  const cnCtx = minimaxCtx({
    config: {
      minimaxProvider: {
        defaultImageModel: "image-01",
        region: "cn_zh",
        globalBaseUrl: "https://api.minimax.io/v1",
        cnBaseUrl: "https://api.minimaxi.com/v1",
        generationTimeoutMs: 120_000,
      },
    },
  });
  await generateViaMinimax("city skyline", cnCtx, { model: MINIMAX_TEXT_TO_IMAGE_MODEL });
  assert.ok(urls.includes("https://api.minimaxi.com/v1/image_generation"));
});

test("minimax adapter rejects more than one subject reference", async () => {
  await assert.rejects(
    () => generateViaMinimax("two refs", minimaxCtx(), {
      references: [
        { b64: "AAAA", declaredMime: "image/png" },
        { b64: "BBBB", declaredMime: "image/png" },
      ],
    }),
    (err: any) => err?.code === "MINIMAX_REF_TOO_MANY" && err?.status === 400,
  );
});

test("minimax adapter surfaces content-safety blocks as a safety error", async () => {
  globalThis.fetch = (async () => {
    return Response.json({
      data: { image_urls: [] },
      metadata: { success_count: 0, failed_count: 1 },
      base_resp: { status_code: 0, status_msg: "success" },
    });
  }) as typeof fetch;

  await assert.rejects(
    () => generateViaMinimax("blocked", minimaxCtx()),
    (err: any) => err?.code === "MINIMAX_SAFETY_BLOCKED" && err?.status === 400,
  );
});

test("minimax adapter surfaces upstream base_resp auth failures", async () => {
  globalThis.fetch = (async () => {
    return Response.json({
      base_resp: { status_code: 2049, status_msg: "invalid api key" },
    });
  }) as typeof fetch;

  await assert.rejects(
    () => generateViaMinimax("city skyline", minimaxCtx()),
    (err: any) => err?.code === "MINIMAX_AUTH_FAILED" && err?.status === 401,
  );
});
