// Activation evidence for the NovelAI adapter (C-ACTIVATION-GROUNDING-01).
//
// fetch is stubbed throughout: no network, no token, no Anlas spent. Every
// error branch and the sampler-gated request fields are driven explicitly,
// because none of them execute on a default run.
import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";

import { generateViaNai, NAI_DEFAULT_IMAGE_MODEL } from "../lib/naiImageAdapter.ts";
import { createNaiAdapter } from "../lib/providers/adapters/nai.ts";
import { createTestRuntimeContext } from "../lib/runtimeContext.ts";

const originalFetch = globalThis.fetch;

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

function zipOf(payload: Buffer): Buffer {
  const body = deflateRawSync(payload);
  const name = Buffer.from("image_0.png", "utf8");
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(8, 8);
  header.writeUInt32LE(body.length, 18);
  header.writeUInt32LE(payload.length, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, name, body]);
}

function naiCtx(over: Record<string, unknown> = {}) {
  return createTestRuntimeContext({
    naiApiKey: "nai-test-token",
    config: {
      naiProvider: {
        defaultImageModel: "nai-diffusion-5-full",
        baseUrl: "https://image.novelai.net",
        accountBaseUrl: "https://api.novelai.net",
        generationTimeoutMs: 180_000,
        defaultSteps: 23,
        defaultScale: 5,
        defaultSampler: "k_euler_ancestral",
        defaultNoiseSchedule: "karras",
        defaultAutoSmea: false,
        defaultDecrisper: false,
      },
    },
    ...over,
  } as never);
}

/** Captures the outgoing request so the body can be asserted. */
function stubFetch(response: { status: number; body: Buffer | string; contentType?: string }) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    const buf = typeof response.body === "string" ? Buffer.from(response.body) : response.body;
    return {
      status: response.status,
      headers: new Headers({ "content-type": response.contentType ?? "application/x-zip-compressed" }),
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      text: async () => buf.toString("utf8"),
    };
  }) as never;
  return calls;
}

async function codeOf(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (err) {
    return (err as { code?: string }).code ?? "NO_CODE";
  }
  return "NO_THROW";
}

test("nai adapter refuses to call upstream without a token", async () => {
  const ctx = naiCtx({ naiApiKey: undefined });
  let called = false;
  globalThis.fetch = (async () => { called = true; return {} as never; }) as never;
  assert.equal(await codeOf(() => generateViaNai("cat", ctx)), "NAI_API_KEY_MISSING");
  assert.equal(called, false, "must fail before spending a request");
});

test("nai adapter decodes a 200 ZIP response into a PNG", async () => {
  stubFetch({ status: 200, body: zipOf(PNG_BYTES) });
  const out = await generateViaNai("cat", naiCtx());
  assert.equal(out.mime, "image/png");
  assert.equal(out.effectiveModel, NAI_DEFAULT_IMAGE_MODEL);
  assert.deepEqual(Buffer.from(out.b64, "base64"), PNG_BYTES);
});

test("nai adapter accepts 201 as success", async () => {
  // The OpenAPI documents 201; working clients observe 200.
  stubFetch({ status: 201, body: zipOf(PNG_BYTES) });
  const out = await generateViaNai("cat", naiCtx());
  assert.deepEqual(Buffer.from(out.b64, "base64"), PNG_BYTES);
});

test("nai adapter maps upstream status codes to NAI_ codes", async () => {
  const cases: Array<[number, string]> = [
    [401, "NAI_AUTH_FAILED"],
    [402, "NAI_SUBSCRIPTION_REQUIRED"],
    [429, "NAI_RATE_LIMITED"],
    [400, "NAI_BAD_REQUEST"],
    [409, "NAI_BAD_REQUEST"],
    [500, "NAI_UPSTREAM_ERROR"],
  ];
  for (const [status, expected] of cases) {
    stubFetch({ status, body: JSON.stringify({ statusCode: status, message: "upstream said no" }) });
    assert.equal(await codeOf(() => generateViaNai("cat", naiCtx())), expected, `status ${status}`);
  }
});

test("nai adapter names the container when a 2xx body is not a ZIP", async () => {
  // Guards the open msgpack question: the failure must say what arrived.
  stubFetch({ status: 200, body: JSON.stringify({ ptr: 1 }), contentType: "application/json" });
  assert.equal(await codeOf(() => generateViaNai("cat", naiCtx())), "NAI_RESPONSE_NOT_ZIP");
});

test("nai adapter rejects an empty 200 body", async () => {
  stubFetch({ status: 200, body: Buffer.alloc(0) });
  assert.equal(await codeOf(() => generateViaNai("cat", naiCtx())), "NAI_EMPTY_IMAGE");
});

test("nai adapter sends the documented V5 request shape", async () => {
  const calls = stubFetch({ status: 200, body: zipOf(PNG_BYTES) });
  await generateViaNai("a cat", naiCtx(), { straightAlpha: true, size: "1024x1024" });

  assert.equal(calls[0].url, "https://image.novelai.net/ai/generate-image");
  assert.match(String((calls[0].init.headers as Record<string, string>).Authorization), /^Bearer /);

  const body = JSON.parse(String(calls[0].init.body));
  assert.equal(body.input, "a cat");
  assert.equal(body.action, "generate");
  assert.equal(body.model, "nai-diffusion-5-full");
  assert.equal(body.parameters.params_version, 3);
  assert.equal(body.parameters.n_samples, 1, "free-tier eligibility depends on this");
  assert.equal(body.parameters.width, 1024);
  assert.equal(body.parameters.height, 1024);
  assert.equal(body.parameters.straight_alpha, true, "V5 native alpha must reach the wire");
  assert.equal(body.parameters.ucPresetId, "heavy", "V5 uses string preset ids, not V4 numbers");
  assert.equal(body.parameters.qualityPresetId, "standard");
});

test("nai adapter gates the ancestral-noise fields on the sampler", async () => {
  // This branch is invisible on a default run, so drive both sides.
  const ancestral = stubFetch({ status: 200, body: zipOf(PNG_BYTES) });
  await generateViaNai("cat", naiCtx(), { sampler: "k_euler_ancestral" });
  const withAncestral = JSON.parse(String(ancestral[0].init.body));
  assert.equal(withAncestral.parameters.prefer_brownian, true);
  assert.equal(withAncestral.parameters.deliberate_euler_ancestral_bug, false);

  const plain = stubFetch({ status: 200, body: zipOf(PNG_BYTES) });
  await generateViaNai("cat", naiCtx(), { sampler: "k_euler" });
  const withoutAncestral = JSON.parse(String(plain[0].init.body));
  assert.equal("prefer_brownian" in withoutAncestral.parameters, false);
  assert.equal("deliberate_euler_ancestral_bug" in withoutAncestral.parameters, false);
});

test("nai adapter exposes cfg_rescale instead of pinning it to zero", async () => {
  const tuned = stubFetch({ status: 200, body: zipOf(PNG_BYTES) });
  await generateViaNai("cat", naiCtx(), { cfgRescale: 0.7 });
  assert.equal(JSON.parse(String(tuned[0].init.body)).parameters.cfg_rescale, 0.7);

  const untouched = stubFetch({ status: 200, body: zipOf(PNG_BYTES) });
  await generateViaNai("cat", naiCtx(), {});
  assert.equal(JSON.parse(String(untouched[0].init.body)).parameters.cfg_rescale, 0);
});

test("nai adapter exposes Auto SMEA and Decrisper with explicit false overrides", async () => {
  const configured = stubFetch({ status: 200, body: zipOf(PNG_BYTES) });
  await generateViaNai("cat", naiCtx({
    config: {
      naiProvider: {
        defaultImageModel: "nai-diffusion-5-full",
        baseUrl: "https://image.novelai.net",
        accountBaseUrl: "https://image.novelai.net",
        generationTimeoutMs: 180_000,
        defaultSteps: 23,
        defaultScale: 5,
        defaultSampler: "k_euler_ancestral",
        defaultNoiseSchedule: "karras",
        defaultAutoSmea: true,
        defaultDecrisper: true,
      },
    },
  }), { autoSmea: false, decrisper: false });
  const explicitFalse = JSON.parse(String(configured[0].init.body)).parameters;
  assert.equal(explicitFalse.autoSmea, false);
  assert.equal(explicitFalse.dynamic_thresholding, false);

  const requested = stubFetch({ status: 200, body: zipOf(PNG_BYTES) });
  await generateViaNai("cat", naiCtx(), { autoSmea: true, decrisper: true });
  const explicitTrue = JSON.parse(String(requested[0].init.body)).parameters;
  assert.equal(explicitTrue.autoSmea, true);
  assert.equal(explicitTrue.dynamic_thresholding, true);
});

test("nai adapter computes Variety+ from the V4.5/V5 coefficient", async () => {
  const on = stubFetch({ status: 200, body: zipOf(PNG_BYTES) });
  await generateViaNai("cat", naiCtx(), { varietyPlus: true, size: "832x1216" });
  const withVariety = JSON.parse(String(on[0].init.body));
  assert.ok(
    Math.abs(withVariety.parameters.skip_cfg_above_sigma - Math.sqrt(832 * 1216) * 0.05766) < 1e-9,
    "matches CLIsu's coefficient for the registered model family",
  );

  const off = stubFetch({ status: 200, body: zipOf(PNG_BYTES) });
  await generateViaNai("cat", naiCtx(), { size: "832x1216" });
  assert.equal("skip_cfg_above_sigma" in JSON.parse(String(off[0].init.body)).parameters, false);
});

test("nai adapter refuses V5-only parameters on a V4.5 model", async () => {
  // Stale client state, not intent: imageModel and the option overrides hydrate
  // from independent persisted keys, so a V4.5 model can arrive alongside a
  // straightAlpha the user set while on V5.
  const stale = stubFetch({ status: 200, body: zipOf(PNG_BYTES) });
  await generateViaNai("cat", naiCtx(), {
    model: "nai-diffusion-4-5-full",
    straightAlpha: true,
    qualityPresetId: "light",
  });
  const staleBody = JSON.parse(String(stale[0].init.body));

  const clean = stubFetch({ status: 200, body: zipOf(PNG_BYTES) });
  await generateViaNai("cat", naiCtx(), { model: "nai-diffusion-4-5-full" });
  const cleanBody = JSON.parse(String(clean[0].init.body));

  assert.equal(staleBody.parameters.straight_alpha, false);
  assert.equal(staleBody.parameters.qualityPresetId, "standard");
  assert.deepEqual(
    staleBody.parameters,
    cleanBody.parameters,
    "a V4.5 request carrying stale V5 state must be indistinguishable from one that sent neither",
  );
});

test("nai adapter still honors V5-only parameters on a V5 model", async () => {
  const calls = stubFetch({ status: 200, body: zipOf(PNG_BYTES) });
  await generateViaNai("cat", naiCtx(), {
    model: "nai-diffusion-5-curated",
    straightAlpha: true,
    qualityPresetId: "light",
  });
  const body = JSON.parse(String(calls[0].init.body));
  assert.equal(body.parameters.straight_alpha, true);
  assert.equal(body.parameters.qualityPresetId, "light");
});

test("nai lane adapter reports auth state and registry models", () => {
  const withKey = createNaiAdapter(naiCtx());
  assert.equal(withKey.laneId, "nai");
  assert.equal(withKey.validateAuth().ok, true);

  const withoutKey = createNaiAdapter(naiCtx({ naiApiKey: undefined }));
  const auth = withoutKey.validateAuth();
  assert.equal(auth.ok, false);
  assert.match(String(auth.reason), /NovelAI API token missing/);

  const ids = withKey.listModels().map((m) => m.id);
  assert.deepEqual(ids, [
    "nai-diffusion-5-full",
    "nai-diffusion-5-curated",
    "nai-diffusion-4-5-full",
    "nai-diffusion-4-5-curated",
  ]);
});

test("nai lane adapter normalizes errors under the NAI_ prefix", () => {
  const adapter = createNaiAdapter(naiCtx());
  const known = adapter.normalizeError(Object.assign(new Error("nope"), { status: 429, code: "NAI_RATE_LIMITED" }));
  assert.equal(known.code, "NAI_RATE_LIMITED");
  assert.equal(known.retryable, true, "429 is transient");

  const foreign = adapter.normalizeError(Object.assign(new Error("odd"), { status: 400, code: "WEIRD" }));
  assert.equal(foreign.code, "NAI_WEIRD");
  assert.equal(foreign.retryable, false);

  assert.equal(adapter.normalizeError(new Error("bare")).code, "NAI_UNKNOWN");
});
