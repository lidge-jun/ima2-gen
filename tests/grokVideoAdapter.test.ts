import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildVideoGenerationPayload,
  buildGrokVideoPlannerPayload,
  downloadVideo,
  parseGrokVideoPlanPrompt,
  normalizeVideoPoll,
  generateVideoViaGrok,
  startVideoRequest,
  type GrokVideoEvent,
  type GrokVideoPlan,
} from "../lib/grokVideoAdapter.js";
import {
  buildGrokVideoPlannerSystemPrompt,
  formatDurationPacingGuidance,
} from "../lib/grokVideoPlannerPrompt.js";
import { normalizeGrokVideoModel, VALID_GROK_VIDEO_MODELS } from "../lib/imageModels.js";
import { parsePngInfo } from "../lib/pngInfo.js";
import { config } from "../config.js";
import { DEFAULT_GROK_PLANNER_MODEL } from "../config.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function ctx(overrides: Record<string, unknown> = {}) {
  return {
    config: {
      ...config,
      grokProvider: {
        ...config.grokProvider,
        proxyHost: "127.0.0.1",
        proxyPort: 18645,
        plannerModel: "grok-4.3",
        plannerTimeoutMs: 10_000,
        videoStartTimeoutMs: 10_000,
        videoPollIntervalMs: 1,
        videoTimeoutMs: 60_000,
        videoDownloadTimeoutMs: 10_000,
      },
    },
    packageVersion: "test",
    ...overrides,
  } as any;
}

function fakeMp4Bytes() {
  return Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]);
}

function jsonRes(body: unknown, status = 200, contentType = "application/json") {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? contentType : null) },
  } as any;
}

function videoBytesRes() {
  const buf = fakeMp4Bytes();
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? "video/mp4" : null) },
  } as any;
}

const SEARCH_RES = jsonRes({ output: [{ type: "message", content: [{ type: "text", text: "current cinematic references" }] }] });

function plannerRes(prompt = "An English cinematic 1-second push-in shot.") {
  return jsonRes({
    choices: [
      {
        message: {
          tool_calls: [
            { type: "function", function: { name: "generate_video", arguments: JSON.stringify({ prompt, mode: "text-to-video", duration: 99, resolution: "720p" }) } },
          ],
        },
      },
    ],
  });
}

// Install a URL-routing fetch mock. pollSequence is consumed in order for poll GETs.
function installFetch(opts: { pollSequence: unknown[]; start?: unknown; captureStart?: (body: any) => void }) {
  let pollIdx = 0;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input);
    if (url.includes("/v1/responses")) return SEARCH_RES;
    if (url.includes("/v1/chat/completions")) return plannerRes();
    if (url.includes("/v1/videos/generations")) {
      opts.captureStart?.(JSON.parse(init?.body || "{}"));
      return jsonRes(opts.start ?? { request_id: "vid-1" });
    }
    if (url.includes("/v1/videos/vid-1")) {
      const next = opts.pollSequence[Math.min(pollIdx, opts.pollSequence.length - 1)];
      pollIdx += 1;
      return jsonRes(next);
    }
    if (url.includes("vidgen.example")) return videoBytesRes();
    throw new Error(`unexpected fetch: ${url}`);
  }) as any;
}

const DONE_POLL = { status: "done", progress: 100, video: { url: "https://vidgen.example/v.mp4", duration: 1, respect_moderation: true }, usage: { cost_in_usd_ticks: 500000000 } };

describe("Grok video adapter", () => {
  it("builds a T2V payload and omits aspect_ratio when auto", () => {
    const plan: GrokVideoPlan = { prompt: "p", mode: "text-to-video", duration: 5, resolution: "480p", aspectRatio: "auto", webSearchCalls: 1 };
    const payload = buildVideoGenerationPayload(plan, { model: "grok-imagine-video" });
    assert.equal(payload.model, "grok-imagine-video");
    assert.equal(payload.duration, 5);
    assert.equal(payload.resolution, "480p");
    assert.equal("aspect_ratio" in payload, false);
    assert.equal("image" in payload, false);
  });

  it("includes aspect_ratio when explicitly set", () => {
    const plan: GrokVideoPlan = { prompt: "p", mode: "text-to-video", duration: 3, resolution: "720p", aspectRatio: "16:9", webSearchCalls: 1 };
    const payload = buildVideoGenerationPayload(plan, { model: "grok-imagine-video" });
    assert.equal(payload.aspect_ratio, "16:9");
  });

  it("builds an I2V payload with image url", () => {
    const plan: GrokVideoPlan = { prompt: "p", mode: "image-to-video", duration: 5, resolution: "480p", aspectRatio: "auto", webSearchCalls: 1 };
    const payload = buildVideoGenerationPayload(plan, { model: "grok-imagine-video", sourceImageUrl: "data:image/png;base64,AAAA" });
    assert.deepEqual(payload.image, { url: "data:image/png;base64,AAAA" });
  });

  it("builds a Ref2V payload with reference_images and no source image", () => {
    const plan: GrokVideoPlan = { prompt: "p", mode: "reference-to-video", duration: 5, resolution: "480p", aspectRatio: "1:1", webSearchCalls: 1 };
    const payload = buildVideoGenerationPayload(plan, { model: "grok-imagine-video", referenceImageUrls: ["data:image/png;base64,A", "data:image/png;base64,B"] });
    assert.equal(payload.aspect_ratio, "1:1");
    assert.deepEqual(payload.reference_images, [{ url: "data:image/png;base64,A" }, { url: "data:image/png;base64,B" }]);
    assert.equal("image" in payload, false);
  });

  it("video planner prompt asks for dialogue, audio, and ending-frame continuity", () => {
    const payload = buildGrokVideoPlannerPayload("continue", {
      model: "grok-imagine-video",
      mode: "reference-to-video",
      duration: 10,
      resolution: "720p",
      aspectRatio: "16:9",
      referenceImageUrls: ["data:image/png;base64,A", "data:image/png;base64,B"],
    });
    const system = String(payload.messages[0].content);
    const userText = String((payload.messages[1].content as any[])[0].text);
    assert.equal(payload.model, DEFAULT_GROK_PLANNER_MODEL);
    assert.match(system, /MULTI-CHARACTER DIALOGUE/);
    assert.match(system, /ENDING FRAME \/ CONTINUATION CUT PLANNING/);
    assert.match(system, /no background music/);
    assert.match(system, /sound effects only/);
    assert.match(system, /Duration pacing is mandatory/);
    assert.match(userText, /Duration pacing \(10s total\)/);
    assert.match(userText, /complete visual arc/);
    assert.match(userText, /Beat structure for/);
  });

  it("formats duration pacing without forbidding useful timing detail", () => {
    const guidance = formatDurationPacingGuidance(15, "text-to-video");
    assert.match(guidance, /15s total/);
    assert.match(guidance, /naturally across the entire duration/);
    assert.match(guidance, /Beat structure for 11-15s/);
    assert.match(guidance, /anticipation/);
    assert.doesNotMatch(guidance, /Do not use second-by-second/);
    assert.doesNotMatch(guidance, /0\.0-2\.0s/);
  });

  it("keeps the planner system prompt duration-scaled instead of word-count capped", () => {
    const system = buildGrokVideoPlannerSystemPrompt();
    assert.match(system, /Duration pacing is mandatory/);
    assert.match(system, /Scale detail to duration/);
    assert.doesNotMatch(system, /30-80 words/);
  });

  it("rejects I2V without a source image", () => {
    const plan: GrokVideoPlan = { prompt: "p", mode: "image-to-video", duration: 5, resolution: "480p", aspectRatio: "auto", webSearchCalls: 1 };
    assert.throws(() => buildVideoGenerationPayload(plan, { model: "grok-imagine-video" }), (e: any) => e.code === "GROK_VIDEO_INVALID_MODE");
  });

  it("rejects invalid Ref2V payload combinations", () => {
    const plan: GrokVideoPlan = { prompt: "p", mode: "reference-to-video", duration: 5, resolution: "480p", aspectRatio: "auto", webSearchCalls: 1 };
    // One reference is valid now (issue #157) — the floor is zero references, not one.
    // devlog/_plan/260820_grok15_multi_reference_video/030_single_ref_mode_choice.md
    assert.throws(() => buildVideoGenerationPayload(plan, { model: "grok-imagine-video", referenceImageUrls: [] }), (e: any) => e.code === "GROK_VIDEO_INVALID_MODE");
    assert.throws(
      () => buildVideoGenerationPayload(plan, { model: "grok-imagine-video", referenceImageUrls: ["A", "B"], sourceImageUrl: "data:image/png;base64,S" }),
      (e: any) => e.code === "GROK_VIDEO_INVALID_MODE",
    );
    assert.throws(() => buildVideoGenerationPayload(plan, { model: "grok-imagine-video", referenceImageUrls: ["A", "B", "C", "D", "E", "F", "G", "H"] }), (e: any) => e.code === "GROK_VIDEO_REF_TOO_MANY");
  });

  it("parses the generate_video planner prompt", () => {
    const prompt = parseGrokVideoPlanPrompt({
      choices: [{ message: { tool_calls: [{ type: "function", function: { name: "generate_video", arguments: JSON.stringify({ prompt: "hello" }) } }] } }],
    });
    assert.equal(prompt, "hello");
  });

  it("throws when the planner does not call generate_video", () => {
    assert.throws(() => parseGrokVideoPlanPrompt({ choices: [{ message: { tool_calls: [] } }] }), (e: any) => e.code === "GROK_PLANNER_EMPTY_TOOL_CALL");
  });

  it("normalizes pending and done poll responses", () => {
    assert.equal(normalizeVideoPoll({ status: "pending", progress: 40 }).status, "pending");
    const done = normalizeVideoPoll(DONE_POLL);
    assert.equal(done.videoUrl, "https://vidgen.example/v.mp4");
    assert.equal(done.respectModeration, true);
    assert.equal(done.usage?.grok_cost_usd_ticks, 500000000);
  });

  it("runs the full T2V flow: search -> planner -> start -> poll -> download", async () => {
    const events: GrokVideoEvent[] = [];
    installFetch({ pollSequence: [{ status: "pending", progress: 10 }, DONE_POLL] });
    const result = await generateVideoViaGrok("makje a clip", ctx(), {
      duration: 5,
      resolution: "480p",
      onEvent: (ev) => events.push(ev),
    });
    assert.equal(result.videoBuffer.subarray(4, 8).toString("ascii"), "ftyp");
    assert.equal(result.contentType, "video/mp4");
    assert.equal(result.mode, "text-to-video");
    assert.equal(result.xaiVideoRequestId, "vid-1");
    assert.equal(result.duration, 1);
    assert.ok(events.some((e) => e.phase === "planning"));
    assert.ok(events.some((e) => e.phase === "submitted" && e.xaiVideoRequestId === "vid-1"));
    assert.ok(events.some((e) => e.phase === "progress"));
  });

  it("request settings win over planner duration/resolution", async () => {
    let startBody: any = null;
    installFetch({ pollSequence: [DONE_POLL], captureStart: (b) => (startBody = b) });
    await generateVideoViaGrok("clip", ctx(), { duration: 5, resolution: "480p" });
    // planner returned duration 99 / 720p, but request 5 / 480p must win
    assert.equal(startBody.duration, 5);
    assert.equal(startBody.resolution, "480p");
  });

  it("auto-selects I2V when a source image is supplied", async () => {
    let startBody: any = null;
    installFetch({ pollSequence: [DONE_POLL], captureStart: (b) => (startBody = b) });
    const result = await generateVideoViaGrok("animate", ctx(), { sourceImage: Buffer.from("img").toString("base64"), duration: 1, resolution: "480p" });
    assert.equal(result.mode, "image-to-video");
    assert.ok(startBody.image?.url?.startsWith("data:image/"));
  });

  it("maps moderation-suppressed done to GROK_VIDEO_MODERATION_BLOCKED", async () => {
    installFetch({ pollSequence: [{ status: "done", progress: 100, video: { url: "https://vidgen.example/v.mp4", respect_moderation: false } }] });
    await assert.rejects(generateVideoViaGrok("clip", ctx(), { duration: 1 }), (e: any) => e.code === "GROK_VIDEO_MODERATION_BLOCKED");
  });

  it("maps done-without-url to GROK_VIDEO_EMPTY_RESPONSE", async () => {
    installFetch({ pollSequence: [{ status: "done", progress: 100, video: {} }] });
    await assert.rejects(generateVideoViaGrok("clip", ctx(), { duration: 1 }), (e: any) => e.code === "GROK_VIDEO_EMPTY_RESPONSE");
  });

  it("maps failed status to GROK_VIDEO_FAILED", async () => {
    installFetch({ pollSequence: [{ status: "failed", error: { code: "internal_error" } }] });
    await assert.rejects(generateVideoViaGrok("clip", ctx(), { duration: 1 }), (e: any) => e.code === "GROK_VIDEO_FAILED");
  });

  it("maps expired status to GROK_VIDEO_EXPIRED", async () => {
    installFetch({ pollSequence: [{ status: "expired" }] });
    await assert.rejects(generateVideoViaGrok("clip", ctx(), { duration: 1 }), (e: any) => e.code === "GROK_VIDEO_EXPIRED");
  });

  it("maps failed status codes to stable error taxonomy", async () => {
    for (const [failedCode, expected] of [
      ["invalid_argument", "GROK_VIDEO_REQUEST_FAILED"],
      ["permission_denied", "GROK_VIDEO_REQUEST_FAILED"],
      ["failed_precondition", "GROK_VIDEO_REQUEST_FAILED"],
      ["service_unavailable", "GROK_VIDEO_POLL_FAILED"],
    ] as const) {
      installFetch({ pollSequence: [{ status: "failed", error: { code: failedCode } }] });
      await assert.rejects(generateVideoViaGrok("clip", ctx(), { duration: 1 }), (e: any) => e.code === expected);
    }
  });

  it("maps start HTTP errors and caller cancellation", async () => {
    globalThis.fetch = (async (input: any, init?: any) => {
      if (init?.signal?.aborted) {
        const err = new Error("aborted");
        err.name = "AbortError";
        throw err;
      }
      if (String(input).includes("/v1/videos/generations")) return jsonRes({ error: "bad request" }, 400);
      throw new Error(`unexpected fetch: ${input}`);
    }) as any;
    await assert.rejects(startVideoRequest(ctx(), { prompt: "x" }, {}), (e: any) => e.code === "GROK_VIDEO_REQUEST_FAILED" && e.status === 400);

    const controller = new AbortController();
    controller.abort();
    await assert.rejects(startVideoRequest(ctx(), { prompt: "x" }, { signal: controller.signal }), (e: any) => e.code === "GENERATION_CANCELED" && e.status === 499);
  });

  it("rejects unsafe video download responses", async () => {
    await assert.rejects(downloadVideo(ctx(), "http://example.com/v.mp4"), (e: any) => e.code === "GROK_VIDEO_DOWNLOAD_FAILED");

    globalThis.fetch = (async () => jsonRes("not video", 200, "text/html")) as any;
    await assert.rejects(downloadVideo(ctx(), "https://vidgen.example/not-video"), (e: any) => e.code === "GROK_VIDEO_DOWNLOAD_FAILED");

    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(0),
      headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? "video/mp4" : null) },
    })) as any;
    await assert.rejects(downloadVideo(ctx(), "https://vidgen.example/empty.mp4"), (e: any) => e.code === "GROK_VIDEO_DOWNLOAD_FAILED");

    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => {
        const buf = Buffer.from("<html>not an mp4</html>");
        return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      },
      headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? "video/mp4" : null) },
    })) as any;
    await assert.rejects(downloadVideo(ctx(), "https://vidgen.example/bad.mp4"), (e: any) => e.code === "GROK_VIDEO_DOWNLOAD_FAILED");

    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => Buffer.from("too-large").buffer,
      headers: { get: (k: string) => (k.toLowerCase() === "content-length" ? String(101 * 1024 * 1024) : k.toLowerCase() === "content-type" ? "video/mp4" : null) },
    })) as any;
    await assert.rejects(downloadVideo(ctx(), "https://vidgen.example/too-large.mp4"), (e: any) => e.code === "GROK_VIDEO_DOWNLOAD_FAILED");
  });

  it("maps video download timeout to GROK_VIDEO_TIMEOUT", async () => {
    globalThis.fetch = (async (_input: any, init?: any) => {
      await new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          },
          { once: true },
        );
      });
    }) as any;
    await assert.rejects(
      downloadVideo(ctx({ config: { ...config, grokProvider: { ...config.grokProvider, videoDownloadTimeoutMs: 1 } } } as any), "https://vidgen.example/slow.mp4"),
      (e: any) => e.code === "GROK_VIDEO_TIMEOUT",
    );
  });

  it("accepts canonical 1.5 and normalizes preview alias", () => {
    assert.ok(VALID_GROK_VIDEO_MODELS.has("grok-imagine-video-1.5"));
    assert.ok(VALID_GROK_VIDEO_MODELS.has("grok-imagine-video-1.5-preview"));
    assert.equal((normalizeGrokVideoModel("grok-imagine-video-1.5") as any).model, "grok-imagine-video-1.5");
    const result = normalizeGrokVideoModel("grok-imagine-video-1.5-preview");
    assert.equal((result as any).model, "grok-imagine-video-1.5");
  });

  it("reports requested and effective model when 1.5 falls back for Ref2V", async () => {
    const starts: any[] = [];
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = String(input);
      if (url.includes("/v1/responses")) return SEARCH_RES;
      if (url.includes("/v1/chat/completions")) return plannerRes("reference motion");
      if (url.includes("/v1/videos/generations")) {
        const body = JSON.parse(init?.body || "{}");
        starts.push(body);
        if (starts.length === 1) return jsonRes({ error: "`reference_images` is not supported for this model." }, 400);
        return jsonRes({ request_id: "vid-1" });
      }
      if (url.includes("/v1/videos/vid-1")) return jsonRes(DONE_POLL);
      if (url.includes("vidgen.example")) return videoBytesRes();
      throw new Error(`unexpected fetch: ${url}`);
    }) as any;
    const result = await generateVideoViaGrok("clip", ctx(), {
      model: "grok-imagine-video-1.5-preview",
      plannedPrompt: "reference motion",
      mode: "reference-to-video",
      referenceImages: ["A", "B"],
      duration: 10,
    });
    assert.equal(starts[0].model, "grok-imagine-video-1.5");
    assert.equal(starts[1].model, "grok-imagine-video");
    assert.equal(result.requestedModel, "grok-imagine-video-1.5");
    assert.equal(result.effectiveModel, "grok-imagine-video");
    assert.deepEqual(result.modelFallback, { from: "grok-imagine-video-1.5", to: "grok-imagine-video" });
  });

  it("builds 1.5 I2V payload with 1080p", () => {
    const plan: GrokVideoPlan = { prompt: "dance", mode: "image-to-video", duration: 5, resolution: "1080p", aspectRatio: "16:9", webSearchCalls: 0 };
    const payload = buildVideoGenerationPayload(plan, { model: "grok-imagine-video-1.5-preview", sourceImageUrl: "data:image/png;base64,AAAA" });
    assert.equal(payload.model, "grok-imagine-video-1.5");
    assert.equal(payload.resolution, "1080p");
    assert.deepEqual(payload.image, { url: "data:image/png;base64,AAAA" });
  });

  it("rejects raw 1080p payloads outside canonical 1.5 image-to-video", () => {
    const t2v: GrokVideoPlan = { prompt: "p", mode: "text-to-video", duration: 5, resolution: "1080p", aspectRatio: "auto", webSearchCalls: 0 };
    const i2v: GrokVideoPlan = { ...t2v, mode: "image-to-video" };
    const ref2v: GrokVideoPlan = { ...t2v, mode: "reference-to-video" };
    assert.throws(() => buildVideoGenerationPayload(t2v, { model: "grok-imagine-video-1.5" }), (e: any) => e.code === "INVALID_VIDEO_RESOLUTION");
    assert.throws(() => buildVideoGenerationPayload(i2v, { model: "grok-imagine-video", sourceImageUrl: "data:image/png;base64,AAAA" }), (e: any) => e.code === "INVALID_VIDEO_RESOLUTION");
    assert.throws(() => buildVideoGenerationPayload(ref2v, { model: "grok-imagine-video-1.5", referenceImageUrls: ["A", "B"] }), (e: any) => e.code === "INVALID_VIDEO_RESOLUTION");
  });

  it("sends 1.5-preview 1080p T2V through an injected canvas I2V payload", async () => {
    let startBody: any = null;
    installFetch({ pollSequence: [DONE_POLL], captureStart: (b) => (startBody = b) });
    const result = await generateVideoViaGrok("make a freeform clip", ctx(), {
      model: "grok-imagine-video-1.5-preview",
      plannedPrompt: "A freeform cinematic clip.",
      duration: 5,
      resolution: "1080p",
      aspectRatio: "16:9",
    });
    assert.equal(result.mode, "text-to-video");
    assert.equal(startBody.model, "grok-imagine-video-1.5");
    assert.equal(startBody.resolution, "1080p");
    assert.ok(startBody.image?.url?.startsWith("data:image/png;base64,"));
    const canvas = Buffer.from(startBody.image.url.replace(/^data:image\/png;base64,/, ""), "base64");
    assert.deepEqual(parsePngInfo(canvas), { width: 1920, height: 1080, bitDepth: 8, colorType: 2 });
    assert.match(startBody.prompt, /blank white canvas.*technical placeholder/);
  });
});
