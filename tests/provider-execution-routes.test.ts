import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { executionTestProcess } from "./_executionTestProcess.ts";
import { openRouteHarness, type RouteHarness, type RouteCase } from "./_executionRouteHarness.ts";

const missing = { error: "Grok API key is required for grok-api image generation", code: "GROK_API_KEY_MISSING" };
const nai = { error: "NovelAI image generation does not accept reference images yet", code: "NAI_REF_UNSUPPORTED" };
const denied = () => { throw new Error("Admission must not dispatch any concrete transport"); };

async function assertNoOwnedJob(fixture: RouteCase) {
  await fixture.waitSettled();
  const inflight = await import("../lib/inflight.ts");
  assert.deepEqual(inflight.listJobs(), []);
  assert.deepEqual(inflight.listTerminalJobs(), []);
  assert.equal(fixture.calls.length, 0);
}

async function assertMultimodeEnvelope(response: Response, expected: object, asyncMode: boolean) {
  assert.equal(response.status, asyncMode ? 400 : 200);
  if (asyncMode) assert.deepEqual(await response.json(), expected);
  else {
    const frames = (await response.text()).trim().split("\n\n");
    assert.equal(frames.length, 1);
    assert.equal(frames[0].split("\n")[0], "event: error");
    assert.deepEqual(JSON.parse(frames[0].split("\n")[1].slice(6)), expected);
  }
}

if (executionTestProcess(import.meta.url)) {
  let harness: RouteHarness;
  let image: string;
  before(async () => {
    harness = await openRouteHarness();
    image = (await sharp({ create: { width: 8, height: 8, channels: 3, background: "#ab4567" } }).png().toBuffer()).toString("base64");
  });
  after(async () => { await harness?.close(); });

  for (const provider of ["grok", "grok-api"] as const) {
    test(`${provider} positive edit reaches its concrete transport without overbroad refusal`, async () => {
      await harness.run("edit", { context: { xaiApiKey: provider === "grok-api" ? "xai-invented-fixture" : undefined }, upstream: (call) => {
        if (call.url.endsWith("/v1/images/edits")) {
          assert.equal(call.headers.get("authorization"), provider === "grok-api" ? "Bearer xai-invented-fixture" : "Bearer dummy");
          assert.equal(new URL(call.url).hostname, provider === "grok-api" ? "api.x.ai" : "grok-fixture.invalid");
          return Response.json({ data: [{ url: "https://fixture.invalid/positive.png" }] });
        }
        assert.equal(call.url, "https://fixture.invalid/positive.png");
        return new Response(new Uint8Array(Buffer.from(image, "base64")), { headers: { "Content-Type": "image/png" } });
      } }, async (fixture) => {
        const response = await fixture.post({ provider, prompt: "positive direct or proxy edit", image, webSearchEnabled: false });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).image, `data:image/png;base64,${image}`);
        await fixture.waitSettled(); assert.equal(fixture.calls.length, 2);
      });
    });
  }

  test("classic key removed during prepare refuses execute and finalizes its already admitted job", async () => {
    let active: RouteCase;
    await harness.run("classic", { context: { xaiApiKey: "xai-invented-before-plan" }, upstream: (call) => {
      assert.equal(call.url, "https://api.x.ai/v1/chat/completions");
      assert.equal(call.headers.get("authorization"), "Bearer xai-invented-before-plan");
      active.ctx.xaiApiKey = undefined;
      return Response.json({ choices: [{ message: { tool_calls: [{ type: "function", function: {
        name: "generate_image", arguments: JSON.stringify({ prompt: "prepared before credential removal" }),
      } }] } }] });
    } }, async (fixture) => {
      active = fixture;
      const response = await fixture.post({ provider: "grok-api", prompt: "remove credential while preparing", async: true, webSearchEnabled: false, n: 1 });
      assert.equal(response.status, 202);
      const terminal = await fixture.waitTerminal();
      assert.equal(terminal.event, "error");
      assert.equal(terminal.data.code, "GROK_API_KEY_MISSING");
      await fixture.waitSettled();
      assert.equal(fixture.calls.length, 1, "only admitted preparation; no image/proxy/fallback request");
      const inflight = await import("../lib/inflight.ts");
      assert.equal(inflight.listJobs().length, 0);
      const jobs = inflight.listTerminalJobs();
      assert.equal(jobs.length, 1);
      assert.equal(jobs[0].requestId, fixture.requestId);
      assert.equal(jobs[0].status, "error");
    });
  });

  for (const surface of ["classic", "node", "multimode", "edit"] as const) {
    for (const key of [undefined, " \t "]) {
      test(`${surface}: ${key === undefined ? "missing" : "blank"} direct key refuses before admission`, async () => {
        await harness.run(surface, { upstream: denied, context: { xaiApiKey: key } }, async (fixture) => {
          const response = await fixture.post({ provider: "grok-api", prompt: "missing direct image key", image, async: true, webSearchEnabled: false });
          assert.equal(response.status, 401);
          const common = { ...missing, requestId: fixture.requestId };
          const expected = surface === "node" ? {
            error: { code: missing.code, message: missing.error }, code: missing.code, parentNodeId: null, requestId: fixture.requestId,
          } : surface === "edit" ? { ...common, rawCode: missing.code, errorClass: "AUTH_INVALID" }
            : surface === "multimode" ? { ...common, status: 401 } : common;
          assert.deepEqual(await response.json(), expected);
          await assertNoOwnedJob(fixture);
        });
      });
    }
  }

  for (const asyncMode of [true, false]) {
    test(`NAI multimode references refuse before admission (${asyncMode ? "JSON" : "legacy SSE"})`, async () => {
      await harness.run("multimode", { upstream: denied }, async (fixture) => {
        const response = await fixture.post({ provider: "nai", prompt: "valid reference refusal", references: [`data:image/png;base64,${image}`], async: asyncMode });
        await assertMultimodeEnvelope(response, { ...nai, status: 400, requestId: fixture.requestId }, asyncMode);
        await assertNoOwnedJob(fixture);
      });
    });
  }

  test("classic NAI references preserve the flat envelope", async () => {
    await harness.run("classic", { upstream: denied }, async (fixture) => {
      const response = await fixture.post({ provider: "nai", prompt: "valid reference refusal", references: [image] });
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { ...nai, requestId: fixture.requestId });
      await fixture.waitSettled();
      assert.equal(fixture.calls.length, 0);
    });
  });

  for (const source of ["parent", "references"] as const) {
    test(`node NAI actual ${source} refusal cannot be hidden by missing bytes`, async () => {
      await harness.run("node", { upstream: denied }, async (fixture) => {
        const parentNodeId = source === "parent" ? "n_fixture_parent" : null;
        if (parentNodeId) await writeFile(join(fixture.generatedDir, `${parentNodeId}.png`), Buffer.from(image, "base64"));
        const response = await fixture.post({ provider: "nai", prompt: "valid node input refusal", parentNodeId, references: source === "references" ? [image] : [] });
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), {
          error: { code: "NAI_REF_UNSUPPORTED", message: "NovelAI image generation does not accept input images yet." },
          code: "NAI_REF_UNSUPPORTED", parentNodeId,
        });
        await fixture.waitSettled(); assert.equal(fixture.calls.length, 0);
      });
    });
  }

  for (const mask of [null, "truthy-invalid-mask"]) {
    test(`NAI edit ${mask ? "mask wins before edit refusal" : "unsupported"} finalizes its admitted job`, async () => {
      await harness.run("edit", { upstream: denied }, async (fixture) => {
        const response = await fixture.post({ provider: "nai", prompt: "edit refusal", image, mask });
        const code = mask ? "NAI_MASK_UNSUPPORTED" : "NAI_EDIT_UNSUPPORTED";
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), {
          error: mask ? "NovelAI provider does not support mask editing" : "NovelAI image editing is not supported yet",
          code, rawCode: code, errorClass: "CAPABILITY_UNSUPPORTED",
        });
        await fixture.waitSettled();
        const inflight = await import("../lib/inflight.ts");
        assert.deepEqual(inflight.listJobs(), []);
        const terminal = inflight.listTerminalJobs();
        assert.equal(terminal.length, 1, "existing validation owns and finalizes an admitted job");
        assert.equal(terminal[0].requestId, fixture.requestId);
        assert.equal(terminal[0].status, "error");
        assert.equal(fixture.calls.length, 0);
      });
    });
  }

  for (const [provider, contextMode, code, message] of [
    ["comfy", "parent-plus-refs", "COMFY_SURFACE_UNSUPPORTED", "provider 'comfy' is not supported on this surface yet"],
    ["api", "ancestry", "CONTEXT_MODE_UNSUPPORTED", "Ancestry context is not supported yet."],
  ]) {
    test(`node preserves ${code}`, async () => {
      await harness.run("node", { upstream: denied }, async (fixture) => {
        const response = await fixture.post({ provider, contextMode, prompt: "surface refusal", parentNodeId: "n_not_loaded" });
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { error: { code, message }, parentNodeId: "n_not_loaded" });
        await fixture.waitSettled(); assert.equal(fixture.calls.length, 0);
      });
    });
  }

  for (const asyncMode of [true, false]) {
    test(`Comfy multimode unsupported envelope (${asyncMode ? "JSON" : "legacy SSE"})`, async () => {
      await harness.run("multimode", { upstream: denied }, async (fixture) => {
        const response = await fixture.post({ provider: "comfy", prompt: "surface refusal", async: asyncMode });
        await assertMultimodeEnvelope(response, {
          error: "provider 'comfy' is not supported on this surface yet", code: "COMFY_SURFACE_UNSUPPORTED", status: 400, requestId: fixture.requestId,
        }, asyncMode);
        await fixture.waitSettled(); assert.equal(fixture.calls.length, 0);
      });
    });
  }
}
