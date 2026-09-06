import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { spawn } from "node:child_process";
import { executionChildEnv, executionTestProcess } from "./_executionTestProcess.ts";
import { bounded } from "./_executionTrackedWrites.ts";
import { FINAL_B64, PUBLIC_KEY, VERTEX_TOKEN, gate, openGeminiFixture, publicUrl, success, vertexUrl } from "./_geminiTransportFixture.ts";

type Fixture = Awaited<ReturnType<typeof openGeminiFixture>>;
type GetFixture = () => Fixture;

function authCases(get: GetFixture) {
  for (const kind of ["public", "forced-vertex", "keyless-vertex", "unready-vertex-fallback"] as const)
    it(`Q06-4/5 auth selection: ${kind}`, async () => {
      const f = get(); f.ctx.hasVertexKey = true;
      f.vertex.ready = kind !== "unready-vertex-fallback";
      f.ctx.geminiAuthMode = kind.includes("vertex") ? "vertex" : "api";
      if (kind === "keyless-vertex") { f.ctx.geminiApiKey = undefined; f.ctx.geminiAuthMode = "api"; }
      const vertex = kind === "forced-vertex" || kind === "keyless-vertex";
      f.respond(() => success(), vertex ? vertexUrl() : publicUrl());
      const result = await f.run("wire fixture", { size: "2048x1152" });
      const body = JSON.parse(f.calls[0]!.body);
      assert.deepEqual(body.contents, [{ role: "user", parts: [{ text: "wire fixture" }] }]);
      assert.deepEqual(body[vertex ? "generationConfig" : "generation_config"], vertex
        ? { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: "16:9", imageSize: "2K" } }
        : { response_modalities: ["TEXT", "IMAGE"], response_format: { image: { aspect_ratio: "ASPECT_RATIO_SIXTEEN_BY_NINE", image_size: "IMAGE_SIZE_TWO_K" } } });
      assert.equal(body[vertex ? "generation_config" : "generationConfig"], undefined);
      assert.deepEqual([f.vertex.initCalls, f.vertex.tokenCalls, f.vertex.projectCalls], [1, vertex ? 1 : 0, vertex ? 1 : 0]);
      assert.ok(!JSON.stringify(result).includes(PUBLIC_KEY) && !JSON.stringify(result).includes(VERTEX_TOKEN));
      assert.equal(f.calls.length, 1);
    });
  for (const hasVertexKey of [false, true]) it(`missing/uninitialized credentials: hasVertexKey=${hasVertexKey}`, async () => {
    const f = get(); f.ctx.geminiApiKey = undefined; f.ctx.hasVertexKey = hasVertexKey;
    await assert.rejects(f.run(), { code: "GEMINI_API_KEY_MISSING", status: 401 });
    assert.equal(f.calls.length, 0); assert.equal(f.vertex.tokenCalls, 0);
  });
}

function wireCases(get: GetFixture) {
  for (const [model, native] of [["nano-banana-2", "gemini-3.1-flash-image"], ["nano-banana-pro", "gemini-3-pro-image"], ["fixture-native-model", "fixture-native-model"]])
    it(`model alias/pass-through ${model}`, async () => {
      const f = get(); f.respond(() => success(), publicUrl(native));
      await f.run("alias", { model }); assert.equal(f.calls.length, 1);
    });
  for (const [size, expected] of [["512x512", "FIVE_TWELVE"], ["1024x1024", "ONE_K"], ["2048x2048", "TWO_K"], ["4096x4096", "FOUR_K"], ["invalid", "ONE_K"]])
    it(`dimension tier ${size}`, async () => {
      const f = get(); await f.run("size", { size });
      assert.equal(JSON.parse(f.calls[0]!.body).generation_config.response_format.image.image_size, `IMAGE_SIZE_${expected}`);
    });
  it("Vertex auto omits imageConfig", async () => {
    const f = get(); Object.assign(f.ctx, { hasVertexKey: true, geminiAuthMode: "vertex" }); f.vertex.ready = true;
    f.respond(() => success(), vertexUrl()); await f.run("auto", { size: "auto" });
    assert.deepEqual(JSON.parse(f.calls[0]!.body).generationConfig, { responseModalities: ["TEXT", "IMAGE"] });
  });
  it("accepted three refs preserve order and declared/detected/fallback MIME precedence", async () => {
    const f = get();
    await f.run("after refs", { references: [
      { b64: "ZGVjbGFyZWQ=", declaredMime: "image/webp", detectedMime: "image/jpeg" },
      { b64: "ZGV0ZWN0ZWQ=", detectedMime: "image/gif" }, { b64: "ZmFsbGJhY2s=" },
    ] });
    assert.deepEqual(JSON.parse(f.calls[0]!.body).contents[0].parts, [
      { inlineData: { data: "ZGVjbGFyZWQ=", mimeType: "image/webp" } },
      { inlineData: { data: "ZGV0ZWN0ZWQ=", mimeType: "image/gif" } },
      { inlineData: { data: "ZmFsbGJhY2s=", mimeType: "image/png" } }, { text: "after refs" },
    ]);
  });
}

function resultCases(get: GetFixture) {
  it("reference MIME is detected from bytes when metadata is absent", async () => {
    const f = get(); const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]).toString("base64");
    await f.run("detected ref", { references: [{ b64: jpeg }] });
    assert.deepEqual(JSON.parse(f.calls[0]!.body).contents[0].parts, [
      { inlineData: { data: jpeg, mimeType: "image/jpeg" } }, { text: "detected ref" },
    ]);
  });
  it("last inline image wins, text concatenates in order, usage casing stays native", async () => {
    const f = get(); f.respond(() => Response.json({ candidates: [{ content: { parts: [
      { text: "first " }, { inlineData: { data: "Zmlyc3Q=", mimeType: "image/png" } },
      { text: "second" }, { inlineData: { data: "bGFzdA==", mimeType: "image/webp" } },
    ] } }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 5, totalTokenCount: 13 } }));
    assert.deepEqual(await f.run(), { b64: "bGFzdA==", mime: "image/webp", revisedPrompt: "first second",
      usage: { promptTokens: 3, candidatesTokens: 5, totalTokens: 13 }, webSearchCalls: 0 });
  });
  it("missing usage/mime/text retains defaults and prompt fallback", async () => {
    const f = get(); f.respond(() => Response.json({ candidates: [{ content: { parts: [{ inlineData: { data: FINAL_B64 } }] } }] }));
    assert.deepEqual(await f.run("fallback prompt"), { b64: FINAL_B64, mime: "image/png", revisedPrompt: "fallback prompt",
      usage: { promptTokens: 0, candidatesTokens: 0, totalTokens: 0 }, webSearchCalls: 0 });
  });
  for (const finishReason of ["SAFETY", "STOP", undefined]) it(`no image/finishReason=${finishReason}`, async () => {
    const f = get(); f.respond(() => Response.json({ candidates: [{ finishReason, content: { parts: [{ text: "no image" }] } }] }));
    await assert.rejects(f.run(), { code: finishReason === "SAFETY" ? "GEMINI_API_SAFETY_BLOCKED" : "GEMINI_API_NO_IMAGE",
      status: finishReason === "SAFETY" ? 400 : 502 }); assert.equal(f.calls.length, 1);
  });
}

function errorCases(get: GetFixture) {
  for (const [status, code, expected] of [[429, "RATE_LIMITED", 429], [400, "BAD_REQUEST", 400], [403, "BAD_REQUEST", 403], [500, "UPSTREAM_ERROR", 502]] as const)
    it(`HTTP ${status} native error, no retry`, async () => {
      const f = get(); f.respond(() => new Response("fixture refusal", { status }));
      await assert.rejects(f.run(), { code: `GEMINI_API_${code}`, status: expected }); assert.equal(f.calls.length, 1);
    });
  for (const kind of ["json", "fetch", "AbortError", "TimeoutError"] as const) it(`legacy ${kind} classification`, async () => {
    const f = get(); f.respond(() => {
      if (kind === "json") return new Response("not json");
      if (kind === "fetch") throw new TypeError("fixture connection failed");
      throw new DOMException("fixture timeout", kind);
    });
    await assert.rejects(f.run(), { code: kind === "AbortError" ? "GENERATION_TIMEOUT" : "GEMINI_API_NETWORK_FAILED",
      status: kind === "AbortError" ? 504 : 502 }); assert.equal(f.calls.length, 1);
  });
  it("token rejection preserves original identity/status before fetch catch", async () => {
    const f = get(); const error = Object.assign(new Error("fixture token failure"), { status: 418, code: "FIXTURE_TOKEN_FAILURE" });
    Object.assign(f.ctx, { hasVertexKey: true, geminiAuthMode: "vertex" }); f.vertex.ready = true;
    f.vertex.token = () => Promise.reject(error);
    await assert.rejects(f.run(), (caught: unknown) => caught === error);
    assert.deepEqual([f.vertex.tokenCalls, f.vertex.projectCalls, f.calls.length], [1, 0, 0]);
  });
}

function cancellationCases(get: GetFixture) {
  it("external abort produces 499 after observed fetch entry", async () => {
    const f = get(), entered = gate(), controller = new AbortController();
    f.respond((call) => new Promise((_resolve, reject) => {
      entered.release(); call.signal!.addEventListener("abort", () => reject(call.signal!.reason), { once: true });
    }));
    const work = f.run("cancel", { signal: controller.signal });
    try { await bounded(entered.promise); controller.abort(); await assert.rejects(work, { code: "GENERATION_CANCELED", status: 499 }); }
    finally { controller.abort(); await bounded(Promise.allSettled([work])); }
    assert.equal(f.calls.length, 1);
  });
  it("held token then abort reaches one already-aborted fetch (legacy semantics)", async () => {
    const f = get(), entered = gate(), held = f.hold(), controller = new AbortController();
    Object.assign(f.ctx, { hasVertexKey: true, geminiAuthMode: "vertex" }); f.vertex.ready = true;
    f.vertex.token = async () => { try { entered.release(); await held.promise; return VERTEX_TOKEN; } catch (error) { throw error; } };
    f.respond((call) => { assert.equal(call.signal!.aborted, true); throw call.signal!.reason; }, vertexUrl());
    const work = f.run("held token", { signal: controller.signal });
    try {
      await bounded(entered.promise); assert.equal(f.calls.length, 0); controller.abort(); held.release();
      await assert.rejects(work, { code: "GENERATION_CANCELED", status: 499 });
      assert.deepEqual([f.vertex.tokenCalls, f.vertex.projectCalls, f.calls.length], [1, 1, 1]);
    } finally { controller.abort(); held.release(); await bounded(Promise.allSettled([work])); }
  });
}

function emittedScript() {
  const helper = new URL("./_geminiTransportFixture.ts", import.meta.url).href;
  // import(url) lives in plain JS, keeping emitted native imports outside TSX's TS resolver.
  return `import assert from 'node:assert/strict'; import {mock} from 'node:test';
    const h = await import(${JSON.stringify(helper)});
    const f = await h.openGeminiFixture('emitted', url => import(url), (url, options) => mock.module(url, options));
    try {
      f.ctx.hasVertexKey = true; f.ctx.geminiAuthMode = 'vertex'; f.vertex.ready = true;
      f.respond(() => h.success(), h.vertexUrl('gemini-3-pro-image'));
      const result = await f.run('emitted Vertex', {model:'nano-banana-pro',size:'2048x1152'});
      assert.deepEqual(JSON.parse(f.calls[0].body), {
        contents:[{role:'user',parts:[{text:'emitted Vertex'}]}],
        generationConfig:{responseModalities:['TEXT','IMAGE'],imageConfig:{aspectRatio:'16:9',imageSize:'2K'}}});
      assert.deepEqual(result,{b64:h.FINAL_B64,revisedPrompt:'fixture revised',mime:'image/png',
        usage:{promptTokens:7,candidatesTokens:11,totalTokens:18},webSearchCalls:0});
      assert.equal(f.vertex.initCalls,1); assert.equal(f.vertex.tokenCalls,1); assert.equal(f.vertex.projectCalls,1);
      assert.ok(!JSON.stringify(result).includes(h.PUBLIC_KEY)); assert.ok(!JSON.stringify(result).includes(h.VERTEX_TOKEN));
      f.ctx.geminiApiKey = null; f.ctx.geminiAuthMode = 'api';
      f.respond(() => h.success(), h.vertexUrl()); await f.run('keyless Vertex',{size:'auto'});
      assert.deepEqual(JSON.parse(f.calls[1].body).generationConfig,{responseModalities:['TEXT','IMAGE']});
      assert.equal(f.vertex.tokenCalls,2); assert.equal(f.calls.length,2);
      console.log('Q06-5 emitted Vertex executed; facade identity verified');
    } finally { await f.close(); }`;
}

async function emittedVertexProbe() {
  const child = spawn(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "--input-type=module", "--eval", emittedScript()],
    { env: executionChildEnv(), stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; }); child.stderr.on("data", (chunk) => { output += chunk; });
  const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once("error", reject); child.once("close", (code, signal) => resolve({ code, signal }));
  });
  try {
    const result = await bounded(closed, 15_000);
    assert.deepEqual(result, { code: 0, signal: null }, output); assert.match(output, /Q06-5 emitted Vertex executed/);
  } finally {
    if (child.exitCode === null && child.signalCode === null) { child.kill("SIGKILL"); await bounded(closed); }
  }
}

if (executionTestProcess(import.meta.url)) {
  describe("Q06 actual Gemini native operation/source graph", { concurrency: false }, () => {
    let f: Fixture;
    before(async () => { f = await openGeminiFixture(); }); after(async () => { await f?.close(); });
    beforeEach(() => {
      f.calls.length = 0;
      Object.assign(f.ctx, { geminiApiKey: PUBLIC_KEY, hasVertexKey: false, geminiAuthMode: "api" });
      Object.assign(f.vertex, { ready: false, initCalls: 0, tokenCalls: 0, projectCalls: 0, token: () => Promise.resolve(VERTEX_TOKEN) });
      f.respond(() => success());
    });
    const get = () => f;
    authCases(get); wireCases(get); resultCases(get); errorCases(get); cancellationCases(get);
  });
  it("Q06-5/12 fresh emitted graph executes full Vertex wire without skips", { timeout: 20_000 }, emittedVertexProbe);
}
