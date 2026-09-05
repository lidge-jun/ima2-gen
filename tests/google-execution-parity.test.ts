import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import type { ImageExecutionRequest } from "../lib/providers/execution/types.ts";
import { executionTestProcess } from "./_executionTestProcess.ts";
import type { RouteCase, Surface } from "./_executionRouteHarness.ts";
import { bounded } from "./_executionTrackedWrites.ts";
import { PUBLIC_KEY, assertWire, gate, openGeminiRoutes, publicUrl, success, vertexUrl } from "./_geminiTransportFixture.ts";

const BASE = { provider: "gemini-api", prompt: "Google raw fixture", model: "nano-banana-2",
  quality: "medium", size: "1024x1024", format: "png", moderation: "low", mode: "direct" as const,
  webSearchEnabled: false, searchMode: "off", sizeNudge: false };
type Harness = Awaited<ReturnType<typeof openGeminiRoutes>>;
type State = { harness: Harness; pixels: string[] };
type GetState = () => State;
type Part = { text?: string; inlineData?: { data: string; mimeType: string } };

async function metadata(f: RouteCase) {
  try {
    const files = (await readdir(f.generatedDir)).filter((name) => name.endsWith(".json"));
    return await Promise.all(files.map(async (name) => {
      try { return JSON.parse(await readFile(join(f.generatedDir, name), "utf8")); } catch (error) { throw error; }
    }));
  } catch (error) { throw error; }
}

function parts(f: RouteCase): Part[] { return JSON.parse(f.calls[0]!.body).contents[0].parts; }

async function assertPixels(actual: Part[], channels: number[]) {
  try {
    const refs = actual.filter((part) => part.inlineData).map((part) => part.inlineData!);
    assert.equal(refs.length, channels.length);
    for (const [index, channel] of channels.entries()) {
      const data = await sharp(Buffer.from(refs[index]!.data, "base64")).raw().toBuffer();
      for (let c = 0; c < 3; c++) assert.ok(Math.abs(data[c]! - (c === channel ? 255 : 0)) < 5, `reference ${index}, channel ${c}`);
    }
  } catch (error) { throw error; }
}

async function parent(f: RouteCase, b64: string) {
  try {
    const { saveNode } = await import("../lib/nodeStore.ts");
    await saveNode(f.ctx.rootDir, { nodeId: "n_google_parent", b64, meta: { format: "png" }, generatedDir: f.generatedDir });
  } catch (error) { throw error; }
}

function successOptions(png: string) {
  return { context: { geminiApiKey: PUBLIC_KEY }, upstream: (call: Parameters<typeof assertWire>[0]) => {
    assertWire(call); return success(png);
  } };
}

function surfaceCases(get: GetState) {
  for (const surface of ["classic", "node", "edit", "multimode"] as const) it(`Q06 real ${surface}: one native output and raw sidecar`, async () => {
    const { harness, pixels } = get();
    await harness.run(surface, successOptions(pixels[0]!), async (f) => {
      const response = await f.post({ ...BASE, image: pixels[1], references: surface === "edit" ? [] : [pixels[2]],
        n: 1, maxImages: 3, async: surface !== "edit" });
      assert.equal(response.status, surface === "edit" ? 200 : 202);
      const json = await response.json();
      const terminal = surface === "edit" ? undefined : await f.waitTerminal();
      await f.waitSettled();
      if (terminal) assert.equal(terminal.event, "done");
      assert.equal(f.calls.length, 1); assert.equal(harness.vertex.tokenCalls, 0);
      assert.equal(parts(f).at(-1)!.text, surface === "edit" ? `Edit this image: ${BASE.prompt}` : BASE.prompt);
      await assertPixels(parts(f), [surface === "edit" ? 1 : 2]);
      const sidecars = await metadata(f); assert.equal(sidecars.length, 1);
      assert.equal(sidecars[0].prompt, BASE.prompt); assert.equal(sidecars[0].userPrompt, BASE.prompt);
      assert.equal(sidecars[0].revisedPrompt, "fixture revised"); assert.equal(sidecars[0].provider, "gemini-api");
      assert.equal(sidecars[0].format, "png");
      assert.equal(f.events.some((entry) => entry.event === "partial"), false);
      assert.ok(!JSON.stringify([json, f.events, sidecars]).includes(PUBLIC_KEY));
      if (surface === "multimode") {
        assert.equal(terminal!.data.requested, 3); assert.equal(terminal!.data.returned, 1);
        assert.equal(terminal!.data.status, "partial");
        assert.equal(sidecars[0].sequenceStatus, "partial"); assert.equal(sidecars[0].sequenceIndex, 1);
        assert.equal(f.events.filter((entry) => entry.event === "image").length, 1);
      }
    });
  });
}

function nodeCases(get: GetState) {
  for (const child of [false, true]) for (const contextMode of ["parent-only", "parent-plus-refs"] as const)
    it(`Q06-2/3 actual Gemini ${child ? "child" : "root"}/${contextMode} ordered bytes`, async () => {
      const { harness, pixels } = get();
      await harness.run("node", successOptions(pixels[0]!), async (f) => {
        if (child) await parent(f, pixels[0]!);
        const response = await f.post({ ...BASE, references: [pixels[1], pixels[2]], contextMode,
          ...(child ? { parentNodeId: "n_google_parent" } : {}), elementNotes: ["distinct element note"] });
        assert.equal(response.status, 200); const result = await response.json(); await f.waitSettled();
        assert.equal(f.calls.length, 1);
        const expected = [...(child ? [0] : []), ...(contextMode === "parent-only" ? [] : [1, 2])];
        await assertPixels(parts(f), expected);
        assert.equal(parts(f).at(-1)!.text, `${child ? "Edit this image: " : ""}${BASE.prompt}\n\nElement notes:\ndistinct element note`);
        assert.equal(result.refsCount, contextMode === "parent-only" ? 0 : 2);
        const sidecar = (await metadata(f)).find((meta) => meta.requestId === f.requestId);
        assert.ok(sidecar); assert.equal(sidecar.prompt, BASE.prompt); assert.equal(sidecar.userPrompt, BASE.prompt);
        assert.equal(sidecar.refsCount, result.refsCount); assert.equal(sidecar.contextMode, contextMode);
      });
    });
  it("Q06-3 parent plus three is rejected before token/fetch with historical Gemini code", async () => {
    const { harness, pixels } = get(); harness.vertex.ready = true;
    await harness.run("node", { ...successOptions(pixels[0]!), context: { geminiApiKey: PUBLIC_KEY, hasVertexKey: true, geminiAuthMode: "vertex" } }, async (f) => {
      await parent(f, pixels[0]!); const before = await readdir(f.generatedDir);
      const response = await f.post({ ...BASE, parentNodeId: "n_google_parent", references: pixels, contextMode: "parent-plus-refs" });
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: { code: "GROK_REF_TOO_MANY", message: "Grok image editing supports up to 3 reference images." },
        code: "GROK_REF_TOO_MANY", parentNodeId: "n_google_parent" });
      await f.waitSettled(); assert.equal(f.calls.length, 0); assert.equal(harness.vertex.tokenCalls, 0);
      assert.deepEqual(await readdir(f.generatedDir), before);
    });
  });
}

function admissionCases(get: GetState) {
  it("Q06-11 Gemini mask rejection preserves the flat envelope before native execution", async () => {
    const { harness, pixels } = get();
    await harness.run("edit", successOptions(pixels[0]!), async (f) => {
      const response = await f.post({ ...BASE, image: pixels[1], mask: "truthy-invalid-mask" });
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: "Gemini API provider does not support mask editing",
        code: "GEMINI_API_MASK_UNSUPPORTED", rawCode: "GEMINI_API_MASK_UNSUPPORTED", errorClass: "CAPABILITY_UNSUPPORTED" });
      await f.waitSettled(); assert.equal(f.calls.length, 0); assert.equal(harness.vertex.tokenCalls, 0);
      assert.deepEqual(await readdir(f.generatedDir), []);
    });
  });
  it("Q06-5 real node route uses synthetic Vertex state", async () => {
    const { harness, pixels } = get(); harness.vertex.ready = true;
    await harness.run("node", { context: { geminiApiKey: PUBLIC_KEY, hasVertexKey: true, geminiAuthMode: "vertex" },
      upstream: (call) => { assertWire(call, vertexUrl()); return success(pixels[0]); } }, async (f) => {
      const response = await f.post(BASE); assert.equal(response.status, 200);
      const result = await response.json(); await f.waitSettled();
      assert.equal(f.calls.length, 1); assert.equal(harness.vertex.tokenCalls, 1); assert.equal(harness.vertex.projectCalls, 1);
      assert.deepEqual(JSON.parse(f.calls[0]!.body).generationConfig, {
        responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: "1:1", imageSize: "1K" },
      });
      assert.ok(!JSON.stringify(result).includes(PUBLIC_KEY));
    });
  });
}

function cancellationCases(get: GetState) {
  for (const surface of ["classic", "node", "edit", "multimode"] as const)
    it(`Q06-7 ${surface} cancellation while fetch held persists nothing`, async () => {
      const { harness, pixels } = get(), entered = gate();
      await harness.run(surface, { context: { geminiApiKey: PUBLIC_KEY }, upstream: (call) => {
        assertWire(call); entered.release();
        return new Promise<Response>((_resolve, reject) => {
          if (call.signal!.aborted) reject(call.signal!.reason);
          else call.signal!.addEventListener("abort", () => reject(call.signal!.reason), { once: true });
        });
      } }, async (f) => {
        const post = f.trackWork(f.post({ ...BASE, image: pixels[1], maxImages: 3, async: surface !== "edit" }));
        try {
          await bounded(entered.promise); f.cancel();
          const response = await post;
          if (surface === "edit") {
            assert.equal(response.status, 499); assert.equal((await response.json()).code, "GENERATION_CANCELED");
          } else {
            assert.equal(response.status, 202); const terminal = await f.waitTerminal();
            assert.equal(terminal.event, "error"); assert.equal(terminal.data.code, "GENERATION_CANCELED");
          }
          await f.waitSettled(); assert.equal(f.calls.length, 1); assert.equal(harness.vertex.tokenCalls, 0);
          assert.equal(f.events.some((entry) => entry.event === "image" || entry.event === "done"), false);
          assert.deepEqual(await readdir(f.generatedDir), []);
        } finally { f.cancel(); await bounded(Promise.allSettled([post])); await f.waitSettled(); }
      });
    });
}

function upstreamErrorCases(get: GetState) {
  const cases = [
    { status: 429, code: "GEMINI_API_RATE_LIMITED", errorClass: "RATE_LIMITED", message: "Gemini API rate limited: fixture refusal" },
    { status: 403, code: "GEMINI_API_BAD_REQUEST", errorClass: "CAPABILITY_UNSUPPORTED", message: "Gemini API error: fixture refusal" },
    { status: 400, code: "GEMINI_API_BAD_REQUEST", errorClass: "CAPABILITY_UNSUPPORTED", message: "Gemini API error: fixture refusal" },
    { status: 500, code: "GEMINI_API_UPSTREAM_ERROR", errorClass: "NETWORK_FAILURE", message: "Gemini API error (500): fixture refusal" },
    { status: 200, code: "GEMINI_API_SAFETY_BLOCKED", errorClass: "CONTENT_REJECTED", message: "Gemini API: generation blocked by safety filter" },
  ];
  for (const example of cases) it(`Q06-6 actual edit upstream ${example.code}/${example.status} envelope`, async () => {
    const { harness, pixels } = get();
    await harness.run("edit", { context: { geminiApiKey: PUBLIC_KEY }, upstream: (call) => {
      assertWire(call);
      return example.status === 200 ? Response.json({ candidates: [{ finishReason: "SAFETY" }] })
        : new Response("fixture refusal", { status: example.status });
    } }, async (f) => {
      const response = await f.post({ ...BASE, image: pixels[0] });
      assert.equal(response.status, example.status === 500 ? 502 : example.status === 200 ? 400 : example.status);
      assert.deepEqual(await response.json(), {
        error: example.message, code: example.code, rawCode: example.code, errorClass: example.errorClass,
        upstreamCode: null, upstreamType: null, upstreamParam: null, diagnosticReason: null,
        retryKind: null, initialEventCount: null, initialEventTypes: null, referencesDroppedOnRetry: null,
        developerPromptDroppedOnRetry: null, webSearchDroppedOnRetry: null, fallbackEventCount: null,
        fallbackEventTypes: null, fallbackImageCallSeen: null, fallbackImageResultCount: null,
        errorEventCount: null, eventTypes: null, webSearchCalls: null, responseDiagnostics: null,
        toolTypes: null, toolChoiceKind: null, requestId: f.requestId,
      });
      await f.waitSettled(); assert.equal(f.calls.length, 1); assert.equal(harness.vertex.tokenCalls, 0);
      assert.deepEqual(await readdir(f.generatedDir), []);
    });
  });
}

function familyRequest(surface: Surface, signal: AbortSignal, png: string): ImageExecutionRequest {
  const base = { provider: "gemini-api" as const, requestId: "prepare-original", signal,
    prompt: "effective original", rawPrompt: "raw original", references: [],
    options: { ...BASE, reasoningEffort: "none" } };
  switch (surface) {
    case "classic": return { ...base, surface, providerUrl: null, background: null, backgroundConstraint: undefined, nai: {}, comfy: {} };
    case "node": return { ...base, surface, sourceImage: null, contextMode: "parent-plus-refs", searchMode: "off", partialImages: 0, nai: {} };
    case "edit": return { ...base, surface, sourceImage: png, mask: null };
    case "multimode": return { ...base, surface, providerUrl: null, maxImages: 3, nai: {} };
  }
}

function captureCases(get: GetState) {
  for (const surface of ["classic", "node", "edit", "multimode"] as const) it(`Q06 ${surface} capture timing and no native callbacks`, async () => {
    const { harness, pixels } = get(); const controller = new AbortController(), originalSignal = new AbortController();
    const model = surface === "classic" ? "gemini-3.1-flash-image" : "gemini-3-pro-image";
    await harness.run(surface, { context: { geminiApiKey: PUBLIC_KEY }, upstream: (call) => {
      assertWire(call, publicUrl(model), "gemini-replacement-fixture");
      assert.equal(call.signal!.aborted, false, "signal is read at execution, not preparation");
      assert.equal(JSON.parse(call.body).generation_config.response_format.image.image_size,
        surface === "classic" ? "IMAGE_SIZE_ONE_K" : "IMAGE_SIZE_FIVE_TWELVE");
      return success(pixels[0]);
    } }, async (f) => {
      const request = familyRequest(surface, originalSignal.signal, pixels[1]!);
      const { prepareImageExecution } = await import("../lib/providers/execution/index.ts");
      const prepared = await f.trackWork(prepareImageExecution(f.ctx, request, {
        onPartialImage: () => assert.fail("Google has no native partial callback"),
        onFinalImage: () => assert.fail("Google uses caller final sweep"),
      }));
      assert.equal(f.calls.length, 0); assert.equal(harness.vertex.tokenCalls, 0);
      request.prompt = "effective replacement"; request.options.model = "nano-banana-pro";
      request.options.size = "512x512"; request.signal = controller.signal; originalSignal.abort();
      request.references = [{ b64: pixels[2]!, declaredMime: "image/png", detectedMime: "image/png" }];
      f.ctx.geminiApiKey = "gemini-replacement-fixture";
      const work = f.trackWork(prepared.execute());
      try {
        const result = await work;
        assert.equal(parts(f).at(-1)!.text, surface === "classic" ? "effective original" : `${surface === "edit" ? "Edit this image: " : ""}effective replacement`);
        await assertPixels(parts(f), [surface === "edit" ? 1 : 2]); assert.equal(f.calls.length, 1);
        if (surface === "multimode") {
          assert.equal(result.kind, "sequence"); assert.ok(result.kind === "sequence");
          assert.deepEqual(result.value.images, [{ b64: pixels[0], revisedPrompt: "fixture revised" }]);
          assert.equal(result.value.originalIndexes, undefined);
        } else {
          assert.equal(result.kind, "single"); assert.ok(result.kind === "single");
          assert.equal(result.value.b64, pixels[0]); assert.equal(result.value.mime, "image/png");
        }
        assert.deepEqual(result.value.usage, { promptTokens: 7, candidatesTokens: 11, totalTokens: 18 });
      } finally { controller.abort(); await bounded(Promise.allSettled([work])); }
    });
  });
}

if (executionTestProcess(import.meta.url)) describe("Q06 real Gemini routes and family parity/source graph", { concurrency: false }, () => {
  let state: State;
  before(async () => {
    const harness = await openGeminiRoutes(); state = { harness, pixels: [] };
    for (const background of ["#ff0000", "#00ff00", "#0000ff"])
      state.pixels.push((await sharp({ create: { width: 8, height: 8, channels: 3, background } }).png().toBuffer()).toString("base64"));
  });
  after(async () => { await state?.harness.close(); });
  beforeEach(() => { Object.assign(state.harness.vertex, { ready: false, initCalls: 0, tokenCalls: 0, projectCalls: 0 }); });
  const get = () => state;
  surfaceCases(get); nodeCases(get); admissionCases(get); cancellationCases(get); upstreamErrorCases(get); captureCases(get);
});
