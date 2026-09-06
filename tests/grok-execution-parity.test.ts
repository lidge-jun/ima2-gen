import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import type { ExecutionProgress, ImageExecutionRequest, ImageExecutionResult } from "../lib/providers/execution/types.ts";
import { executionTestProcess } from "./_executionTestProcess.ts";
import { openRouteHarness, type RouteCase, type Surface, type UpstreamCall } from "./_executionRouteHarness.ts";
import { bounded } from "./_executionTrackedWrites.ts";

type Lane = "grok" | "grok-api";
const KEY = "xai-parity-original";
const ARTIFACT = "https://fixture.invalid/parity.png";
const SOURCE_URL = "https://fixture.invalid/source.png";
const options = { model: "grok-imagine-image", quality: "medium", size: "1024x1024",
  moderation: "low", mode: "direct" as const, reasoningEffort: "none", webSearchEnabled: false };

function plan(prompt = "planned fixture", args = JSON.stringify({ prompt })) {
  return Response.json({ choices: [{ message: { tool_calls: [{ type: "function", function: {
    name: "generate_image", arguments: args,
  } }] } }] });
}

function requestFor(fixture: RouteCase, surface: Surface, provider: Lane, signal: AbortSignal): ImageExecutionRequest {
  const base = { provider, signal, requestId: fixture.requestId, prompt: "effective fixture",
    rawPrompt: "raw fixture", references: [], options: { ...options } };
  switch (surface) {
    case "classic": return { ...base, surface, providerUrl: null, background: null,
      backgroundConstraint: "KEEP_ALPHA_FIXTURE", nai: {}, comfy: {} };
    case "node": return { ...base, surface, sourceImage: null, contextMode: "parent-plus-refs", searchMode: "off", partialImages: 0, nai: {} };
    case "edit": return { ...base, surface, sourceImage: "", mask: null };
    case "multimode": return { ...base, surface, providerUrl: null, maxImages: 2, nai: {} };
  }
}

/** Track preparation immediately as well as execution, including assertion-failure paths. */
async function withNative(fixture: RouteCase, surface: Surface, provider: Lane,
  body: (request: ImageExecutionRequest, run: (progress?: ExecutionProgress) => Promise<ImageExecutionResult>, controller: AbortController) => Promise<void>) {
  const controller = new AbortController();
  const pending: Promise<unknown>[] = [];
  const request = requestFor(fixture, surface, provider, controller.signal);
  async function execute(progress?: ExecutionProgress) {
    const work = fixture.trackWork((async () => {
      const { prepareImageExecution } = await import("../lib/providers/execution/index.ts");
      return (await prepareImageExecution(fixture.ctx, request, progress)).execute();
    })());
    pending.push(work);
    return work;
  }
  try { await body(request, execute, controller); }
  finally { controller.abort(); await bounded(Promise.allSettled(pending)); }
}

function counts(calls: readonly UpstreamCall[]) {
  return ["/responses", "/chat/completions", "/images/generations", "/images/edits"]
    .map((suffix) => calls.filter((call) => call.url.endsWith(suffix)).length);
}

if (executionTestProcess(import.meta.url)) describe("G05 real Grok routes and family parity", { concurrency: false }, () => {
  let harness: Awaited<ReturnType<typeof openRouteHarness>>;
  let png: string;
  let referencePng: string;
  before(async () => {
    harness = await openRouteHarness();
    png = (await sharp({ create: { width: 8, height: 8, channels: 3, background: "#2367ab" } }).png().toBuffer()).toString("base64");
    referencePng = (await sharp({ create: { width: 8, height: 8, channels: 3, background: "#ab6723" } }).png().toBuffer()).toString("base64");
  });
  after(async () => { await harness?.close(); });

  function upstream(provider: Lane, override?: (call: UpstreamCall) => Response | Promise<Response> | undefined, expectedKey = KEY) {
    let planned = 0;
    return (call: UpstreamCall): Response | Promise<Response> => {
      if (call.method === "GET") {
        assert.equal(call.url, ARTIFACT);
        assert.equal(call.headers.get("authorization"), null);
        assert.equal(call.headers.get("cookie"), null);
      } else {
        assert.equal(call.method, "POST");
        assert.equal(new URL(call.url).origin, provider === "grok" ? "http://grok-fixture.invalid" : "https://api.x.ai");
        assert.equal(call.headers.get("authorization"), provider === "grok" ? "Bearer dummy" : `Bearer ${expectedKey}`);
      }
      const changed = override?.(call);
      if (changed !== undefined) return changed;
      if (call.method === "GET") return new Response(Buffer.from(png, "base64"), { headers: { "content-type": "image/png" } });
      if (call.url.endsWith("/responses")) return Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: "fixture research" }] }] });
      if (call.url.endsWith("/chat/completions")) return plan(`planned fixture ${++planned}`);
      assert.match(call.url, /\/images\/(generations|edits)$/);
      return Response.json({ data: [{ url: ARTIFACT }], usage: { cost_in_usd_ticks: 31 } });
    };
  }

  for (const provider of ["grok", "grok-api"] as const) {
    for (const surface of ["classic", "node", "multimode", "edit"] as const) {
      for (const search of [false, true]) it(`G05-1/2/4 ${provider}/${surface} route search=${search}`, async () => {
        await harness.run(surface, { context: { xaiApiKey: KEY }, upstream: upstream(provider) }, async (fixture) => {
          fixture.ctx.config = { ...fixture.ctx.config, grokProvider: { ...fixture.ctx.config.grokProvider, plannerModel: "grok-parity-planner" } };
          const result = await fixture.post({ provider, prompt: "route toggle fixture", image: png, model: options.model,
            n: 3, maxImages: 2, webSearchEnabled: search, searchMode: search ? "on" : "off", async: surface !== "edit" });
          assert.equal(result.status, surface === "edit" ? 200 : 202);
          const json = await result.json();
          const terminal = surface === "edit" ? undefined : await fixture.waitTerminal();
          await fixture.waitSettled();
          if (terminal) assert.equal(terminal.event, "done");
          const plans = surface === "edit" ? 0 : surface === "multimode" ? 2 : 1;
          const images = surface === "classic" ? 3 : surface === "multimode" ? 2 : 1;
          assert.deepEqual(counts(fixture.calls), [search ? plans : 0, plans, surface === "edit" ? 0 : images, surface === "edit" ? 1 : 0]);
          assert.equal(fixture.imageTransportCalls.length, images, "artifact bytes use intercepted pinned GET");
          assert.equal(fixture.imageResolutions.length, images);
          assert.equal((terminal?.data ?? json).webSearchCalls, search ? plans : 0);
          for (const call of fixture.calls.filter((call) => /\/(responses|chat\/completions)$/.test(call.url))) {
            assert.equal(JSON.parse(call.body).model, "grok-parity-planner", "configured planner stays distinct from image model");
          }
          const payloads = fixture.calls.filter((call) => /\/images\//.test(call.url)).map((call) => JSON.parse(call.body));
          if (surface === "classic") assert.deepEqual(payloads.map((payload) => payload.prompt), Array(3).fill("planned fixture 1"));
          if (surface === "multimode") {
            assert.deepEqual(payloads.map((payload) => payload.prompt), ["planned fixture 1", "planned fixture 2"]);
            const planners = fixture.calls.filter((call) => call.url.endsWith("/chat/completions"));
            assert.ok(planners[0].body.includes("[Image 1 of 2]"));
            assert.ok(planners[1].body.includes("[Image 2 of 2]"));
          }
          if (surface === "edit") assert.equal(payloads[0].prompt, "route toggle fixture");
          assert.ok(!JSON.stringify([json, fixture.events]).includes('"originalIndexes"'));
        });
      });
    }

    for (const surface of ["classic", "multimode"] as const) it(`G05-6 ${provider}/${surface} URL reference precedes bytes`, async () => {
      await harness.run(surface, { context: { xaiApiKey: KEY }, upstream: upstream(provider) }, async (fixture) => {
        const response = await fixture.post({ provider, prompt: "ordered refs", references: [png], providerUrl: SOURCE_URL,
          model: options.model, n: 1, maxImages: 1, webSearchEnabled: false, async: true });
        assert.equal(response.status, 202);
        const terminal = await fixture.waitTerminal();
        await fixture.waitSettled();
        assert.equal(terminal.event, "done");
        assert.deepEqual(counts(fixture.calls), [0, 1, 0, 1]);
        const wire = JSON.parse(fixture.calls.find((call) => call.url.endsWith("/images/edits"))!.body);
        assert.deepEqual(wire.images, [{ type: "image_url", url: SOURCE_URL }, { type: "image_url", url: `data:image/png;base64,${png}` }]);
        const sidecars = (await readdir(fixture.generatedDir)).filter((name) => name.endsWith(".json"));
        assert.equal(sidecars.length, 1);
        const meta = JSON.parse(await readFile(join(fixture.generatedDir, sidecars[0]), "utf8"));
        assert.equal(meta.providerUrl, ARTIFACT);
        assert.ok(!("originalIndexes" in meta));
        assert.deepEqual(terminal.data.usage, { grok_cost_usd_ticks: 31 });
      });
    });

    for (const contextMode of ["parent-plus-refs", "parent-only"] as const) it(`G05-5 ${provider} child ${contextMode} plans with search off`, async () => {
      await harness.run("node", { context: { xaiApiKey: KEY }, upstream: upstream(provider) }, async (fixture) => {
        const { saveNode } = await import("../lib/nodeStore.ts");
        await saveNode(fixture.ctx.rootDir, { nodeId: "n_parity_parent", b64: png, meta: { format: "png" }, generatedDir: fixture.generatedDir });
        const response = await fixture.post({ provider, prompt: "child fixture", parentNodeId: "n_parity_parent",
          references: [referencePng], contextMode, model: options.model, searchMode: "off", webSearchEnabled: false });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).webSearchCalls, 0);
        await fixture.waitSettled();
        assert.deepEqual(counts(fixture.calls), [0, 1, 0, 1]);
        const wire = JSON.parse(fixture.calls.find((call) => call.url.endsWith("/images/edits"))!.body);
        const refs = wire.images ?? [wire.image];
        assert.equal(refs.length, contextMode === "parent-only" ? 1 : 2);
        const pixels = await sharp(Buffer.from(refs[0].url.split(",")[1], "base64")).raw().toBuffer();
        assert.deepEqual([...pixels.subarray(0, 3)], [35, 103, 171]);
        if (contextMode !== "parent-only") assert.equal(refs[1].url, `data:image/png;base64,${referencePng}`);
      });
    });
  }

  for (const surface of ["classic", "node", "edit", "multimode"] as const) it(`G05 key capture timing/${surface}`, async () => {
    const auth: string[] = [];
    const expected = surface === "classic" || surface === "node" ? KEY : "xai-parity-replacement";
    const respond = upstream("grok-api", undefined, expected);
    await harness.run(surface, { context: { xaiApiKey: KEY }, upstream: (call) => {
      if (call.method !== "GET") auth.push(call.headers.get("authorization")!);
      return respond(call);
    } }, async (fixture) => {
      await withNative(fixture, surface, "grok-api", async (request) => {
        if (request.surface === "edit") request.sourceImage = png;
        const { prepareImageExecution } = await import("../lib/providers/execution/index.ts");
        const prepared = await fixture.trackWork(prepareImageExecution(fixture.ctx, request));
        fixture.ctx.xaiApiKey = "xai-parity-replacement";
        const work = fixture.trackWork(prepared.execute());
        try { await work; } finally { await bounded(Promise.allSettled([work])); }
        assert.ok(auth.length > 0);
        assert.deepEqual(auth, Array(auth.length).fill(`Bearer ${expected}`));
        if (surface === "classic") assert.ok(fixture.calls[0].body.includes("KEEP_ALPHA_FIXTURE"));
        if (surface === "edit") {
          const wire = JSON.parse(fixture.calls[0].body);
          assert.equal(wire.prompt, "raw fixture", "edit never uses effective/planned prompt");
          assert.deepEqual(wire.image, { type: "image_url", url: `data:image/png;base64,${png}` });
        }
      });
    });
  });

  for (const surface of ["node", "edit", "multimode"] as const) it(`G05-8 no URL/${surface} preserves native asymmetry`, async () => {
    await harness.run(surface, { context: { xaiApiKey: KEY }, upstream: upstream("grok-api", (call) =>
      /\/images\//.test(call.url) ? Response.json({ data: [] }) : undefined) }, async (fixture) => {
      await withNative(fixture, surface, "grok-api", async (request, run) => {
        if (request.surface === "edit") request.sourceImage = png;
        if (surface !== "multimode") await assert.rejects(run(), { code: "GROK_EMPTY_RESPONSE", status: 502 });
        else {
          const result = await run({ onFinalImage: () => assert.fail("no URL has no callback") });
          assert.equal(result.kind, "sequence");
          if (result.kind !== "sequence") return;
          assert.deepEqual(result.value.images, []);
          assert.deepEqual(result.value.originalIndexes, []);
          assert.equal(result.value.error, undefined);
        }
        assert.deepEqual(counts(fixture.calls), [0, surface === "edit" ? 0 : surface === "multimode" ? 2 : 1, surface === "edit" ? 0 : surface === "multimode" ? 2 : 1, surface === "edit" ? 1 : 0]);
        assert.equal(fixture.imageTransportCalls.length, 0);
      });
    });
  });

  for (const surface of ["node", "multimode"] as const)
  for (const failure of ["planner", "search", "image", "download"] as const) it(`G05-8 ${surface}/${failure} stage code and POST budget`, async () => {
    const code = { planner: "GROK_PLANNER_INVALID_TOOL_ARGS", search: "GROK_SEARCH_EMPTY_RESPONSE",
      image: "GROK_UPSTREAM_ERROR", download: "GROK_IMAGE_DOWNLOAD_FAILED" }[failure];
    await harness.run("node", { context: { xaiApiKey: KEY }, upstream: upstream("grok-api", (call) => {
      if (failure === "planner" && call.url.endsWith("/chat/completions")) return plan("", "not-json");
      if (failure === "search" && call.url.endsWith("/responses")) return Response.json({ output: [] });
      if (failure === "image" && call.url.endsWith("/images/generations")) return Response.json({ error: "fixture error" }, { status: 500 });
      if (failure === "download" && call.method === "GET") return new Response(null, { status: 404 });
      return undefined;
    }) }, async (fixture) => {
      await withNative(fixture, surface, "grok-api", async (request, run) => {
        request.options.webSearchEnabled = failure === "search";
        const caughtPerItem = surface === "multimode" && (failure === "image" || failure === "download");
        if (!caughtPerItem) await assert.rejects(run(), { code, status: 502 });
        else {
          const result = await run();
          assert.equal(result.kind, "sequence");
          if (result.kind !== "sequence") return;
          assert.deepEqual(result.value.images, []);
          assert.deepEqual(result.value.originalIndexes, []);
          assert.ok(result.value.error instanceof Error);
          assert.equal(Reflect.get(result.value.error, "code"), code);
          assert.equal(Reflect.get(result.value.error, "status"), 502);
        }
        const plans = failure === "search" ? 0 : caughtPerItem ? 2 : 1;
        const images = failure === "image" || failure === "download" ? plans : 0;
        assert.deepEqual(counts(fixture.calls), [failure === "search" ? 1 : 0, plans, images, 0]);
      });
    });
  });

  for (const provider of ["grok", "grok-api"] as const)
  for (const surface of ["node", "edit", "multimode"] as const)
  for (const samePort of [false, true]) it(`G05 private artifact policy ${provider}/${surface}/samePort=${samePort}`, async () => {
    const origin = "http://127.0.0.1:18463";
    const artifact = `${samePort ? origin : "http://127.0.0.1:18464"}/private.png`;
    const allowed = provider === "grok" && samePort;
    await harness.run(surface, { context: { xaiApiKey: KEY, grokUrl: `${origin}/v1` }, upstream: (call) => {
      if (call.method === "GET") {
        assert.equal(allowed, true, "forbidden local artifact never reaches fake GET");
        assert.equal(call.url, artifact);
        assert.equal(call.headers.get("authorization"), null);
        return new Response(Buffer.from(png, "base64"), { headers: { "content-type": "image/png" } });
      }
      assert.equal(new URL(call.url).origin, provider === "grok" ? origin : "https://api.x.ai");
      assert.equal(call.headers.get("authorization"), provider === "grok" ? "Bearer dummy" : `Bearer ${KEY}`);
      if (call.url.endsWith("/chat/completions")) return plan();
      assert.match(call.url, /\/images\/(generations|edits)$/);
      return Response.json({ data: [{ url: artifact }] });
    } }, async (fixture) => {
      await withNative(fixture, surface, provider, async (request, run) => {
        if (request.surface === "edit") request.sourceImage = png;
        if (request.surface === "multimode") request.maxImages = 1;
        if (!allowed && surface !== "multimode") await assert.rejects(run(), { code: "GROK_IMAGE_DOWNLOAD_FAILED", status: 502 });
        else {
          const result = await run();
          if (result.kind === "single") { assert.equal(result.value.b64, png); assert.equal(result.value.providerUrl, artifact); }
          else if (allowed) { assert.equal(result.value.images[0].b64, png); assert.deepEqual(result.value.originalIndexes, [0]); }
          else {
            assert.deepEqual(result.value.images, []);
            assert.ok(result.value.error instanceof Error);
            assert.equal(Reflect.get(result.value.error, "code"), "GROK_IMAGE_DOWNLOAD_FAILED");
          }
        }
        assert.equal(fixture.imageTransportCalls.length, allowed ? 1 : 0);
        assert.equal(fixture.imageResolutions.length, 0, "literal IP policy needs no DNS");
      });
    });
  });

  for (const body of ["declared-oversize", "empty"] as const) it(`G05-10 family retains download ${body} rejection`, async () => {
    await harness.run("node", { context: { xaiApiKey: KEY }, upstream: upstream("grok-api", (call) => {
      if (call.method !== "GET") return undefined;
      return body === "empty" ? new Response(null) : new Response(new Uint8Array([1]), { headers: { "content-length": String(50 * 1024 * 1024 + 1) } });
    }) }, async (fixture) => {
      await withNative(fixture, "node", "grok-api", async (_request, run) => {
        await assert.rejects(run(), { code: "GROK_IMAGE_DOWNLOAD_FAILED", status: 502 });
        assert.deepEqual(counts(fixture.calls), [0, 1, 1, 0]);
        assert.equal(fixture.imageTransportCalls.length, 1);
      });
    });
  });

  for (const failedItems of [[0], [0, 2], [1]] as const) it(`G05-7 native sparse callbacks/indexes ${failedItems}`, async () => {
    let attempt = 0;
    await harness.run("multimode", { context: { xaiApiKey: KEY }, upstream: upstream("grok-api", (call) => {
      if (!call.url.endsWith("/images/generations")) return undefined;
      const index = attempt++;
      return failedItems.some((failed) => failed === index) ? Response.json({ error: "item refused" }, { status: 400 }) : undefined;
    }) }, async (fixture) => {
      await withNative(fixture, "multimode", "grok-api", async (request, run) => {
        assert.equal(request.surface, "multimode");
        if (request.surface !== "multimode") return;
        request.maxImages = 3;
        const callbacks: number[] = [];
        const result = await run({ onFinalImage: (_image, index) => { callbacks.push(index); } });
        assert.equal(result.kind, "sequence");
        if (result.kind !== "sequence") return;
        const expected = [0, 1, 2].filter((index) => !failedItems.some((failed) => failed === index));
        assert.deepEqual(callbacks, expected);
        assert.deepEqual(result.value.originalIndexes, expected);
        assert.equal(result.value.images.length, expected.length);
        assert.equal(result.value.error, undefined);
        assert.deepEqual(result.value.usage, { grok_cost_usd_ticks: 31 * expected.length });
      });
    });
  });

  for (const callback of ["absent", "throws"] as const) it(`G05-7 sequence ${callback} callback retains images and indices`, async () => {
    await harness.run("multimode", { context: { xaiApiKey: KEY }, upstream: upstream("grok-api") }, async (fixture) => {
      await withNative(fixture, "multimode", "grok-api", async (_request, run) => {
        let calls = 0;
        const result = await run(callback === "absent" ? undefined : { onFinalImage: () => { calls++; throw new Error("callback fixture"); } });
        assert.equal(result.kind, "sequence");
        if (result.kind !== "sequence") return;
        assert.deepEqual(result.value.originalIndexes, [0, 1]);
        assert.equal(result.value.images.length, 2);
        assert.equal(result.value.error, undefined);
        assert.deepEqual(result.value.usage, { grok_cost_usd_ticks: 62 });
        assert.equal(calls, callback === "absent" ? 0 : 2);
      });
    });
  });

  for (const stage of ["planner", "image", "download"] as const) it(`G05-9 route cancellation in held ${stage} saves no final`, async () => {
    let entered!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    let signal: AbortSignal | undefined;
    await harness.run("multimode", { context: { xaiApiKey: KEY }, upstream: upstream("grok-api", (call) => {
      const hit = stage === "planner" ? call.url.endsWith("/chat/completions") : stage === "image" ? call.url.endsWith("/images/generations") : call.method === "GET";
      if (!hit) return undefined;
      signal = call.signal; assert.ok(signal); entered();
      return new Promise<Response>((_resolve, reject) => {
        if (signal!.aborted) reject(signal!.reason);
        else signal!.addEventListener("abort", () => reject(signal!.reason), { once: true });
      });
    }) }, async (fixture) => {
      try {
        assert.equal((await fixture.post({ provider: "grok-api", prompt: "cancel fixture", maxImages: 2, webSearchEnabled: false, async: true })).status, 202);
        await bounded(started);
        fixture.cancel();
        const terminal = await fixture.waitTerminal();
        await fixture.waitSettled();
        assert.equal(terminal.event, "error");
        assert.equal(terminal.data.code, "GENERATION_CANCELED");
        assert.equal(signal?.aborted, true);
        assert.deepEqual(counts(fixture.calls), [0, 1, stage === "planner" ? 0 : 1, 0]);
        assert.equal(fixture.events.some((entry) => entry.event === "image" || entry.event === "done"), false);
        assert.deepEqual(await readdir(fixture.generatedDir), []);
      } finally { fixture.cancel(); await fixture.waitSettled(); }
    });
  });

  it("G05-9 abort in awaited callback stops before the next sequence item", async () => {
    await harness.run("multimode", { context: { xaiApiKey: KEY }, upstream: upstream("grok-api") }, async (fixture) => {
      await withNative(fixture, "multimode", "grok-api", async (_request, run, controller) => {
        const callbacks: number[] = [];
        await assert.rejects(run({ onFinalImage: (_image, index) => { callbacks.push(index); controller.abort(); } }), { code: "GENERATION_CANCELED", status: 499 });
        assert.deepEqual(callbacks, [0]);
        assert.deepEqual(counts(fixture.calls), [0, 1, 1, 0]);
      });
    });
  });

  it("G05-11 compatibility exports are the actual runtime owners", async () => {
    const facade = await import("../lib/grokImageAdapter.js");
    const sequenceFacade = await import("../lib/grokMultimodeAdapter.js");
    const operations = await import("../lib/providers/adapters/grokOperations.js");
    const sequence = await import("../lib/providers/adapters/grokMultimodeOperations.js");
    const planner = await import("../lib/grokImagePlanner.js");
    const core = await import("../lib/grokImageCore.js");
    for (const name of ["generateViaGrok", "editViaGrok"] as const) assert.equal(facade[name], operations[name]);
    for (const name of ["planGrokImage", "buildGrokPlannerPayload", "buildGrokSearchPayload", "searchGrokVisualContext", "parseGrokImagePlan"] as const) assert.equal(facade[name], planner[name]);
    assert.equal(facade.downloadGrokImageUrl, core.downloadGrokImageUrl);
    assert.equal(sequenceFacade.generateMultimodeViaGrok, sequence.generateMultimodeViaGrok);
    assert.equal(sequenceFacade.representativeItemError, sequence.representativeItemError);
  });
});
