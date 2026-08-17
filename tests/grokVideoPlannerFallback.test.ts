import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { planGrokVideo, isDegradablePlannerFailure } from "../lib/grokVideoAdapter.js";
import { composeFallbackVideoPrompt } from "../lib/grokVideoPlannerPrompt.js";
import { config } from "../config.js";

// The 260817 incident: the web-search stage succeeded and the PLANNER call stalled for its
// whole budget, so the user lost the video. A stalled planner must now degrade to a locally
// composed prompt instead of failing the request, while genuinely fatal cases stay fatal.
// devlog/_plan/260817_grok_video_planner_timeout/040_planner_fallback.md

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

function ctx(grokOverrides: Record<string, unknown> = {}) {
  return {
    config: {
      ...config,
      grokProvider: {
        ...config.grokProvider,
        proxyHost: "127.0.0.1",
        proxyPort: 18645,
        plannerModel: "grok-4.3",
        searchTimeoutMs: 2_000,
        plannerTimeoutMs: 2_000,
        videoPlanTotalTimeoutMs: 30_000,
        ...grokOverrides,
      },
    },
    packageVersion: "test",
  } as any; // justified: RouteRuntimeContext is a loose runtime bag; every Grok adapter test builds it this way
}

const SEARCH_URL = "/v1/responses";

function searchOk() {
  return new Response(JSON.stringify({
    output: [{ content: [{ type: "output_text", text: "brief: snowy field, golden hour" }] }],
  }), { status: 200, headers: { "content-type": "application/json" } });
}

/** Routes the search call to a canned brief and the planner call to plannerHandler. */
function stubFetch(plannerHandler: (init: RequestInit | undefined) => Promise<Response>) {
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = typeof input === "string" ? input : String(input);
    if (url.includes(SEARCH_URL)) return searchOk();
    return plannerHandler(init);
  }) as typeof fetch; // justified: a narrowed stub cannot satisfy the full fetch overload set
}

/** A fetch that never resolves until its signal aborts — the observed stall shape. */
function stallUntilAbort(init: RequestInit | undefined): Promise<Response> {
  return new Promise((_resolve, reject) => {
    const signal = init?.signal ?? undefined;
    const abortErr = () => Object.assign(new Error("aborted"), { name: "AbortError" });
    if (signal?.aborted) return reject(abortErr());
    signal?.addEventListener("abort", () => reject(abortErr()), { once: true });
  });
}

describe("planner degradation classification", () => {
  it("treats stalls, upstream 5xx, 429, and network faults as degradable", () => {
    assert.equal(isDegradablePlannerFailure({ name: "AbortError", message: "aborted" })?.reason, "timeout");
    assert.equal(isDegradablePlannerFailure({ code: "GROK_PLANNER_TIMEOUT", status: 504, message: "x" })?.reason, "timeout");
    assert.equal(isDegradablePlannerFailure({ code: "GROK_PLANNER_NETWORK_FAILED", status: 502, message: "x" })?.reason, "failed");
    assert.equal(isDegradablePlannerFailure({ code: "GROK_PLANNER_BAD_REQUEST", status: 502, message: "x" })?.reason, "failed");
    assert.equal(isDegradablePlannerFailure({ code: "GROK_PLANNER_BAD_REQUEST", status: 429, message: "x" })?.reason, "failed");
  });

  it("keeps 4xx and planner refusals fatal so a rejected request never spends video quota", () => {
    assert.equal(isDegradablePlannerFailure({ code: "GROK_PLANNER_BAD_REQUEST", status: 400, message: "bad" }), null);
    assert.equal(isDegradablePlannerFailure({ code: "GROK_PLANNER_BAD_REQUEST", status: 401, message: "auth" }), null);
    assert.equal(isDegradablePlannerFailure({ code: "GENERATION_CANCELED", status: 499, message: "canceled" }), null);
    // A 200 with no usable tool call means the planner answered and declined: degrading
    // would bill a video start on the back of a refusal.
    assert.equal(isDegradablePlannerFailure({ code: "GROK_PLANNER_EMPTY_TOOL_CALL", status: 502, message: "x" }), null);
    assert.equal(isDegradablePlannerFailure({ code: "GROK_PLANNER_INVALID_TOOL_ARGS", status: 502, message: "x" }), null);
  });
});

describe("composeFallbackVideoPrompt", () => {
  it("keeps the user prompt and adds pacing plus mode guidance", () => {
    const out = composeFallbackVideoPrompt("a red fox runs through snow", {
      mode: "image-to-video", duration: 5, resolution: "480p",
    });
    assert.match(out, /a red fox runs through snow/);
    assert.match(out, /first frame/i);
    assert.match(out, /Duration pacing/);
  });

  it("caps length so a degraded prompt cannot bloat the payload", () => {
    const out = composeFallbackVideoPrompt("x".repeat(5000), { mode: "text-to-video", duration: 5 });
    assert.ok(out.length <= 4000);
  });

  it("keeps the user scene rather than a long storyboard preamble", () => {
    // routes/video.ts prepends a ~1900-char storyboard prefix before planning; a naive
    // front-slice would keep only boilerplate and drop the scene the user asked for.
    const preamble = "STORYBOARD INSTRUCTIONS. ".repeat(80);
    const out = composeFallbackVideoPrompt(preamble + "SCENE: a red fox runs through snow", {
      mode: "text-to-video", duration: 5,
    });
    assert.match(out, /SCENE: a red fox runs through snow/);
  });

  it("carries continuity and background constraints into the degraded prompt", () => {
    const out = composeFallbackVideoPrompt("the fox keeps running", {
      mode: "image-to-video", duration: 5,
      continuityText: "previous clip ended on a wide shot",
      backgroundConstraint: "Keep the background a solid chroma green.",
    });
    assert.match(out, /previous clip ended on a wide shot/);
    assert.match(out, /solid chroma green/);
  });
});

describe("planGrokVideo planner degradation", () => {
  it("returns a locally composed plan when the planner stalls", async () => {
    stubFetch(stallUntilAbort);
    const plan = await planGrokVideo("a red fox runs through snow", ctx(), {
      mode: "text-to-video", duration: 5, resolution: "480p", requestId: "t_stall",
    });
    assert.equal(plan.plannerDegraded?.reason, "timeout");
    assert.match(plan.prompt, /a red fox runs through snow/);
    assert.equal(plan.mode, "text-to-video");
  });

  it("degrades on an upstream 5xx", async () => {
    stubFetch(async () => new Response("upstream boom", { status: 503 }));
    const plan = await planGrokVideo("a lighthouse in fog", ctx(), { mode: "text-to-video", duration: 5, requestId: "t_5xx" });
    assert.equal(plan.plannerDegraded?.reason, "failed");
    assert.match(plan.prompt, /a lighthouse in fog/);
  });

  it("stays fatal when the planner answers without a tool call", async () => {
    stubFetch(async () => new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "sure!" } }] }),
      { status: 200, headers: { "content-type": "application/json" } }));
    await assert.rejects(
      planGrokVideo("a paper boat on a puddle", ctx(), { mode: "text-to-video", duration: 5, requestId: "t_empty" }),
      (e: { code?: string }) => e.code === "GROK_PLANNER_EMPTY_TOOL_CALL",
    );
  });

  it("stays fatal on a 4xx planner rejection", async () => {
    stubFetch(async () => new Response("bad request", { status: 400 }));
    await assert.rejects(
      planGrokVideo("anything", ctx(), { mode: "text-to-video", duration: 5, requestId: "t_400" }),
      (e: { code?: string; status?: number }) => e.code === "GROK_PLANNER_BAD_REQUEST" && e.status === 400,
    );
  });

  it("honors user cancellation instead of degrading", async () => {
    const controller = new AbortController();
    stubFetch((init) => { controller.abort(); return stallUntilAbort(init); });
    await assert.rejects(
      planGrokVideo("anything", ctx(), { mode: "text-to-video", duration: 5, requestId: "t_cancel", signal: controller.signal }),
      (e: { code?: string }) => e.code === "GENERATION_CANCELED",
    );
  });

  it("treats the planning-phase ceiling as fatal, never as a degrade", async () => {
    stubFetch(stallUntilAbort);
    await assert.rejects(
      planGrokVideo("anything", ctx({ videoPlanTotalTimeoutMs: 150, plannerTimeoutMs: 60_000 }), {
        mode: "text-to-video", duration: 5, requestId: "t_phase",
      }),
      (e: { code?: string }) => e.code === "GROK_VIDEO_PLAN_TIMEOUT",
    );
  });

  it("still plans when the search stage fails, and reports it honestly", async () => {
    globalThis.fetch = (async (input: unknown) => {
      const url = typeof input === "string" ? input : String(input);
      if (url.includes(SEARCH_URL)) return new Response("search down", { status: 503 });
      return new Response(JSON.stringify({
        choices: [{ message: { role: "assistant", tool_calls: [{ type: "function", function: { name: "generate_video", arguments: JSON.stringify({ prompt: "planned prompt" }) } }] } }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch; // justified: a narrowed stub cannot satisfy the full fetch overload set
    const plan = await planGrokVideo("a kite over dunes", ctx(), { mode: "text-to-video", duration: 5, requestId: "t_search" });
    assert.equal(plan.prompt, "planned prompt");
    assert.ok(plan.searchDegraded);
    assert.equal(plan.webSearchCalls, 0);
    assert.equal(plan.plannerDegraded, undefined);
  });

  it("degrades a STALLED search instead of reporting it as a cancellation", async () => {
    // Regression: an earlier wiring passed a locally created search deadline in as the
    // user signal, and searchGrokVisualContext reports any abort of that signal as a user
    // cancel — so a slow search killed the request as GENERATION_CANCELED instead of
    // degrading to a planned video.
    globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
      const url = typeof input === "string" ? input : String(input);
      if (url.includes(SEARCH_URL)) return stallUntilAbort(init);
      return new Response(JSON.stringify({
        choices: [{ message: { role: "assistant", tool_calls: [{ type: "function", function: { name: "generate_video", arguments: JSON.stringify({ prompt: "planned despite a stalled search" }) } }] } }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch; // justified: a narrowed stub cannot satisfy the full fetch overload set
    const plan = await planGrokVideo("a heron over still water", ctx({ searchTimeoutMs: 300 }), {
      mode: "text-to-video", duration: 5, requestId: "t_search_stall",
    });
    assert.equal(plan.prompt, "planned despite a stalled search");
    assert.equal(plan.searchDegraded?.reason, "timeout");
    assert.equal(plan.webSearchCalls, 0);
  });
});
