import test from "node:test";
import assert from "node:assert/strict";
import { generateViaAtlasCloud } from "../lib/atlasCloudImageAdapter.ts";
import { resolveProviderOptions } from "../lib/providerOptions.ts";
import { createTestRuntimeContext } from "../lib/runtimeContext.ts";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("atlascloud provider options normalize model and disable unsupported controls", () => {
  const resolved = resolveProviderOptions(createTestRuntimeContext(), {
    provider: "atlascloud",
    rawModel: "openai/gpt-image-2/text-to-image",
    rawReasoningEffort: "high",
    rawWebSearchEnabled: true,
    rawSize: "1792x1024",
  });

  assert.equal(resolved.provider, "atlascloud");
  assert.equal(resolved.model, "openai/gpt-image-2/text-to-image");
  assert.equal(resolved.reasoningEffort, "none");
  assert.equal(resolved.webSearchEnabled, false);
  assert.equal(resolved.size, "1792x1024");
});

test("atlascloud adapter requires ATLASCLOUD_API_KEY", async () => {
  await assert.rejects(
    () => generateViaAtlasCloud("city skyline", createTestRuntimeContext()),
    (err: any) => err?.code === "ATLASCLOUD_API_KEY_MISSING" && err?.status === 401,
  );
});

test("atlascloud adapter submits text-to-image requests and downloads output", async () => {
  const calls: Array<{ url: string; body?: any }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ url, body });

    if (url.endsWith("/model/generateImage")) {
      return Response.json({ data: { id: "pred_1" } });
    }
    if (url.endsWith("/model/result/pred_1")) {
      return Response.json({ data: { status: "completed", outputs: [{ url: "https://cdn.example/out.jpg" }] } });
    }
    if (url === "https://cdn.example/out.jpg") {
      return new Response(Buffer.from("fake image"), { headers: { "content-type": "image/jpeg" } });
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;

  const result = await generateViaAtlasCloud("city skyline", createTestRuntimeContext({ atlasCloudApiKey: "ak-test" }), {
    model: "openai/gpt-image-2/text-to-image",
    size: "1024x1024",
    quality: "high",
  });

  assert.equal(calls[0].url, "https://api.atlascloud.ai/api/v1/model/generateImage");
  assert.deepEqual(calls[0].body, {
    model: "openai/gpt-image-2/text-to-image",
    prompt: "city skyline",
    size: "1024x1024",
    quality: "high",
    output_format: "jpeg",
    enable_base64_output: false,
    enable_sync_mode: false,
  });
  assert.equal(result.b64, Buffer.from("fake image").toString("base64"));
  assert.equal(result.mime, "image/jpeg");
  assert.equal(result.providerUrl, "https://cdn.example/out.jpg");
});

test("atlascloud adapter uploads references before edit requests", async () => {
  const generatedBodies: any[] = [];
  const urls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    urls.push(url);

    if (url.endsWith("/model/uploadMedia")) {
      assert.ok(init?.body instanceof FormData);
      return Response.json({ data: { url: "https://media.example/ref.png" } });
    }
    if (url.endsWith("/model/generateImage")) {
      generatedBodies.push(JSON.parse(String(init?.body)));
      return Response.json({ data: { request_id: "pred_edit" } });
    }
    if (url.endsWith("/model/result/pred_edit")) {
      return Response.json({ data: { status: "succeeded", result: "data:image/png;base64,b3V0" } });
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;

  const result = await generateViaAtlasCloud("make it brighter", createTestRuntimeContext({ atlasCloudApiKey: "ak-test" }), {
    references: [{ b64: Buffer.from("ref").toString("base64"), declaredMime: "image/png" }],
  });

  assert.deepEqual(generatedBodies[0].images, ["https://media.example/ref.png"]);
  assert.equal(generatedBodies[0].model, "openai/gpt-image-2/edit");
  assert.equal(result.b64, "b3V0");
  assert.equal(result.mime, "image/png");
  assert.deepEqual(urls.slice(0, 3), [
    "https://api.atlascloud.ai/api/v1/model/uploadMedia",
    "https://api.atlascloud.ai/api/v1/model/generateImage",
    "https://api.atlascloud.ai/api/v1/model/result/pred_edit",
  ]);
});
