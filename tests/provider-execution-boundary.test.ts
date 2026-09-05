import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import type { CoreProviderId } from "../lib/providers/registry.ts";
import type { ExecutionSurface, ExecutionProgress } from "../lib/providers/execution/types.ts";
import { executionTestProcess } from "./_executionTestProcess.ts";
import { openBoundaryProbe, requestFor, assertCall, assertReferenceOrder, type BoundaryProbe } from "./_executionBoundaryProbe.ts";

const lanes: Record<ExecutionSurface, readonly CoreProviderId[]> = {
  classic: ["api", "oauth", "grok", "grok-api", "agy", "gemini-api", "atlascloud", "minimax", "nai", "comfy"],
  node: ["api", "oauth", "grok", "grok-api", "agy", "gemini-api", "atlascloud", "minimax", "nai"],
  edit: ["api", "oauth", "grok", "grok-api", "agy", "gemini-api", "atlascloud", "minimax", "comfy"],
  multimode: ["api", "oauth", "grok", "grok-api", "agy", "gemini-api", "atlascloud", "minimax", "nai"],
};
const concrete: Partial<Record<CoreProviderId, string>> = {
  agy: "generateViaAgy", "gemini-api": "generateViaGeminiApi", atlascloud: "generateViaAtlasCloud",
  minimax: "generateViaMinimax", nai: "generateViaNai", comfy: "generateViaComfy",
};
function expectedTransport(surface: ExecutionSurface, provider: CoreProviderId) {
  if (provider === "api" || provider === "oauth") return surface === "classic" ? "generateViaResponses"
    : surface === "multimode" ? "generateMultimodeViaResponses" : "editViaResponses";
  if (provider.startsWith("grok")) return surface === "edit" ? "editViaGrok"
    : surface === "multimode" ? "generateMultimodeViaGrok" : "generateViaGrok";
  return concrete[provider];
}

if (executionTestProcess(import.meta.url)) {
  let probe: BoundaryProbe;
  before(async () => { probe = await openBoundaryProbe(); });
  after(async () => { await probe?.close(); });

  for (const surface of Object.keys(lanes) as ExecutionSurface[]) {
    for (const provider of lanes[surface]) {
      test(`${surface}/${provider}: actual facade/legacy dispatch, fields, identity and native result`, async () => {
        probe.reset();
        const request = requestFor(surface, provider, probe.source);
        const result = await (await probe.prepareImageExecution(probe.ctx, request)).execute();
        const names = probe.calls.map((call) => call.name);
        assert.deepEqual(names, surface === "classic" && provider.startsWith("grok")
          ? ["planGrokImage", "generateViaGrok"] : [expectedTransport(surface, provider)]);
        const call = probe.calls.at(-1)!;
        assertCall(call, probe.ctx, request);
        assertReferenceOrder(call, request, probe.source);
        if (surface === "multimode") {
          assert.equal(result.kind, "sequence");
          if (["api", "oauth", "grok", "grok-api"].includes(provider)) assert.equal(result.value, probe.sequence);
          else assert.deepEqual(result.value, {
            images: [{ b64: "native-image", revisedPrompt: "native-revised" }], usage: { total_tokens: 17 }, webSearchCalls: 3,
          });
        } else {
          assert.equal(result.kind, "single");
          assert.deepEqual(result.value, {
            b64: "native-image", revisedPrompt: "native-revised", providerUrl: null, mime: "image/webp", usage: { total_tokens: 17 },
            webSearchCalls: 3, text: "native-text", retryKind: "native-retry", initialEventCount: 6,
            initialEventTypes: { "native-event": 6 }, hadReferences: true, referencesDroppedOnRetry: false,
            developerPromptDroppedOnRetry: true, webSearchDroppedOnRetry: false, promptId: "comfy-native-id", origin: "native-origin", effectiveModel: "native-effective-model",
          });
          if (!(surface === "edit" && ["api", "oauth"].includes(provider))) assert.equal(result.value, probe.single);
        }
        if (surface === "classic" && provider.startsWith("grok")) {
          const plan = probe.calls[0];
          assertCall(plan, probe.ctx, request);
          const options = plan.args[2] as Record<string, unknown>;
          assert.equal(options.referenceCount, 3); assert.equal(options.backgroundConstraint, "keep alpha");
          assert.equal(options.webSearchEnabled, false);
          assert.equal((call.args[2] as Record<string, unknown>).plannedPrompt, "planned-effective");
          assert.equal((call.args[2] as Record<string, unknown>).webSearchCalls, 7);
        }
      });
    }
  }

  for (const provider of lanes.node) {
    for (const sourceImage of [true, false]) {
      test(`node/${provider}: parent-only ${sourceImage ? "with parent" : "root"} preserves legacy reference exceptions`, async () => {
        probe.reset();
        const request = requestFor("node", provider, probe.source);
        assert.equal(request.surface, "node");
        if (request.surface !== "node") throw new Error("fixture discriminant");
        request.contextMode = "parent-only";
        request.sourceImage = sourceImage ? probe.source : null;
        await (await probe.prepareImageExecution(probe.ctx, request)).execute();
        assert.equal(probe.calls.length, 1);
        assertCall(probe.calls[0], probe.ctx, request);
        assertReferenceOrder(probe.calls[0], request, probe.source);
      });
    }
  }

  for (const provider of ["api", "grok"] as const) {
    test(`multimode/${provider}: original callback/image identity and awaited final callback promise`, async () => {
      probe.reset();
      let release!: () => void;
      let entered!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      const called = new Promise<void>((resolve) => { entered = resolve; });
      const progress: ExecutionProgress = { onFinalImage: (image, index) => {
        assert.equal(image, probe.callbackImage); assert.equal(index, 3); entered(); return held;
      } };
      const request = requestFor("multimode", provider, probe.source);
      const work = (await probe.prepareImageExecution(probe.ctx, request, progress)).execute();
      let settled = false;
      void work.then(() => { settled = true; });
      await called;
      assert.equal(settled, false);
      assert.equal((probe.calls[0].args.at(-1) as ExecutionProgress).onFinalImage, progress.onFinalImage);
      assert.equal(probe.callbackPromise(), held);
      release();
      assert.equal((await work).value, probe.sequence);
    });
  }

  test("node partial and Comfy queue callbacks retain object and function identity", async () => {
    for (const surface of ["node", "classic"] as const) {
      probe.reset();
      const request = requestFor(surface, surface === "node" ? "api" : "comfy", probe.source);
      if (request.surface === "node") request.sourceImage = null;
      let observed = 0;
      const progress: ExecutionProgress = {
        onPartialImage: (value) => { assert.equal(value, probe.partial); observed++; },
        onQueue: (value) => { assert.equal(value, probe.queue); observed++; },
      };
      await (await probe.prepareImageExecution(probe.ctx, request, progress)).execute();
      const options = probe.calls[0].args.at(-1) as ExecutionProgress;
      assert.equal(surface === "node" ? options.onPartialImage : options.onQueue, surface === "node" ? progress.onPartialImage : progress.onQueue);
      assert.equal(observed, 1);
    }
  });

  for (const surface of ["classic", "node", "edit", "multimode"] as const) {
    test(`${surface}: direct key presence is checked at prepare and each execute; capture point is unchanged`, async () => {
      probe.reset();
      const request = requestFor(surface, "grok-api", probe.source);
      for (const absent of [undefined, " \n\t"]) {
        probe.ctx.xaiApiKey = absent;
        await assert.rejects(probe.prepareImageExecution(probe.ctx, request), { code: "GROK_API_KEY_MISSING", status: 401 });
        assert.equal(probe.calls.length, 0);
      }
      probe.ctx.xaiApiKey = "initial-invented-key";
      const prepared = await probe.prepareImageExecution(probe.ctx, request);
      probe.ctx.xaiApiKey = "replacement-invented-key";
      await prepared.execute(); await prepared.execute();
      const executions = probe.calls.filter((call) => call.name !== "planGrokImage");
      assert.equal(executions.length, 2);
      for (const call of executions) assert.equal((call.args.at(-1) as Record<string, unknown>).directApiKey,
        surface === "classic" || surface === "node" ? "initial-invented-key" : "replacement-invented-key");
      probe.ctx.xaiApiKey = undefined;
      await assert.rejects(prepared.execute(), { code: "GROK_API_KEY_MISSING", status: 401 });
      assert.equal(probe.calls.filter((call) => call.name !== "planGrokImage").length, 2);
    });
  }

  for (const surface of ["classic", "node", "edit", "multimode"] as const) {
    test(`${surface}: facade never wraps native non-Responses errors`, async () => {
      probe.reset();
      const failure = Object.assign(new Error("literal native failure"), { code: "NATIVE_FIXTURE_ERROR", status: 409 });
      const prepared = await probe.prepareImageExecution(probe.ctx, requestFor(surface, "minimax", probe.source));
      probe.failWith(failure);
      await assert.rejects(prepared.execute(), (error) => error === failure);
      assert.equal(probe.calls.length, 1);
    });
  }

  for (const [surface, provider] of [["node", "comfy"], ["edit", "nai"], ["multimode", "comfy"]] as const) {
    test(`legacy ${surface}/${provider} refuses an unsupported branch rather than falling through OAuth`, async () => {
      probe.reset();
      await assert.rejects((await probe.prepareLegacyImageExecution(probe.ctx, requestFor(surface, provider, probe.source))).execute(), /Unsupported/);
      assert.equal(probe.calls.length, 0);
    });
  }
}
