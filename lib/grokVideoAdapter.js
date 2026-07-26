import { logEvent } from "./logger.js";
import { getGrokProxyUrl } from "./grokRuntime.js";
import { grokError, searchGrokVisualContext } from "./grokImageAdapter.js";
import { detectImageMimeFromB64 } from "./refs.js";
import { aspectToCanvas, generateWhiteCanvasB64 } from "./grokVideoCanvas.js";
import { downloadVideo } from "./grokVideoDownload.js";
import { buildGrokVideoPlannerSystemPrompt, formatDurationPacingGuidance } from "./grokVideoPlannerPrompt.js";
import { GROK_FALLBACK_VIDEO_MODEL, GROK_VIDEO_MODEL_15, GROK_VIDEO_MODEL_15_PREVIEW_ALIAS, GROK_VIDEO_MODEL_BASE, MAX_REF2V_REFERENCES, validateVideoResolutionForRequest, } from "./imageModels.js";
import { formatVideoContinuityForPlanner } from "./videoContinuity.js";
import { DEFAULT_GROK_PLANNER_MODEL } from "../config.js";
export { downloadVideo } from "./grokVideoDownload.js";
const STALE_PROGRESS_MS = 180_000;
function canonicalVideoModel(model) {
    return model === GROK_VIDEO_MODEL_15_PREVIEW_ALIAS ? GROK_VIDEO_MODEL_15 : model;
}
function videoConfig(ctx) {
    const g = ctx.config.grokProvider || {};
    return {
        model: g.defaultVideoModel || GROK_FALLBACK_VIDEO_MODEL,
        startTimeoutMs: g.videoStartTimeoutMs || 60_000,
        pollIntervalMs: g.videoPollIntervalMs || 5_000,
        totalTimeoutMs: g.videoTimeoutMs || 900_000,
        plannerModel: g.plannerModel || DEFAULT_GROK_PLANNER_MODEL,
        plannerTimeoutMs: g.plannerTimeoutMs || 60_000,
    };
}
function videoEndpoint(ctx, path, directApiKey) {
    if (directApiKey) {
        const normalizedPath = path.startsWith("/") ? path : `/${path}`;
        return {
            url: `https://api.x.ai${normalizedPath}`,
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${directApiKey}` },
        };
    }
    return {
        url: getGrokProxyUrl(ctx, path),
        headers: { "Content-Type": "application/json", Authorization: "Bearer dummy" },
    };
}
function withTimeoutSignal(signal, timeoutMs) {
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
    const combinedSignal = signal ? AbortSignal.any([signal, timeoutController.signal]) : timeoutController.signal;
    return { combinedSignal, timer };
}
function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted)
            return reject(grokError("Generation canceled", 499, "GENERATION_CANCELED"));
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(grokError("Generation canceled", 499, "GENERATION_CANCELED"));
        }, { once: true });
    });
}
function sourceImageUrl(image, mime) {
    if (image.startsWith("data:") || image.startsWith("http"))
        return image;
    const detected = mime || detectImageMimeFromB64(image) || "image/png";
    return `data:${detected};base64,${image}`;
}
const FAILED_CODE_MAP = {
    invalid_argument: { code: "GROK_VIDEO_REQUEST_FAILED", status: 400 },
    permission_denied: { code: "GROK_VIDEO_REQUEST_FAILED", status: 403 },
    failed_precondition: { code: "GROK_VIDEO_REQUEST_FAILED", status: 412 },
    service_unavailable: { code: "GROK_VIDEO_POLL_FAILED", status: 502 },
    internal_error: { code: "GROK_VIDEO_FAILED", status: 502 },
};
export function buildGrokVideoPlannerPayload(prompt, opts) {
    const isI2V = opts.mode === "image-to-video";
    const isRef2V = opts.mode === "reference-to-video";
    const continuity = isRef2V
        ? "This is reference-to-video: use the provided reference images (referred to as <IMAGE_1>..<IMAGE_N>) as subject/style guidance and keep their subjects recognizable in the generated video."
        : isI2V
            ? "This is image-to-video: preserve subject identity and composition unless asked otherwise, and use the source image as the first frame / starting point."
            : "This is text-to-video: describe motion, camera, and action clearly.";
    const lineageText = formatVideoContinuityForPlanner(opts.continuityLineage);
    const userContent = [
        {
            type: "text",
            text: [
                `Selected video model: ${opts.model}. Mode: ${opts.mode}.`,
                `Requested duration: ${opts.duration}s, resolution: ${opts.resolution}, aspect ratio: ${opts.aspectRatio}.`,
                continuity,
                lineageText ? `Authoritative continuation context:\n${lineageText}` : "Authoritative continuation context: none.",
                formatDurationPacingGuidance(opts.duration, opts.mode, opts.resolution),
                opts.searchSummary ? `Mandatory web-search brief:\n${opts.searchSummary}` : "Mandatory web-search brief: unavailable.",
                ...(opts.backgroundConstraint ? [opts.backgroundConstraint] : []),
                "Return the generate_video.prompt argument in English only, except for exact visible text the user explicitly requested.",
                "\nUser prompt:",
                prompt,
            ].join("\n"),
        },
    ];
    if (isI2V && opts.sourceImageUrl) {
        userContent.push({ type: "image_url", image_url: { url: opts.sourceImageUrl, detail: "high" } });
    }
    if (isRef2V) {
        for (const url of opts.referenceImageUrls ?? []) {
            userContent.push({ type: "image_url", image_url: { url, detail: "high" } });
        }
    }
    return {
        model: opts.plannerModel || DEFAULT_GROK_PLANNER_MODEL,
        stream: false,
        parallel_tool_calls: false,
        messages: [
            {
                role: "system",
                content: buildGrokVideoPlannerSystemPrompt({ model: opts.model, mode: opts.mode, resolution: opts.resolution }),
            },
            { role: "user", content: userContent },
        ],
        tools: [
            {
                type: "function",
                function: {
                    name: "generate_video",
                    description: "Generate a single video through xAI Videos API.",
                    parameters: {
                        type: "object",
                        properties: {
                            prompt: { type: "string", description: "Final video-generation prompt to send to xAI Videos API." },
                            model: { type: "string", enum: [GROK_VIDEO_MODEL_BASE, GROK_VIDEO_MODEL_15] },
                            mode: { type: "string", enum: ["text-to-video", "image-to-video", "reference-to-video"] },
                            duration: { type: "number" },
                            aspect_ratio: { type: "string" },
                            resolution: { type: "string", enum: ["480p", "720p", "1080p"] },
                        },
                        required: ["prompt"],
                    },
                },
            },
        ],
        tool_choice: { type: "function", function: { name: "generate_video" } },
    };
}
export function parseGrokVideoPlanPrompt(response) {
    const toolCalls = response?.choices?.[0]?.message?.tool_calls || [];
    const call = toolCalls.find((item) => item.type === "function" && item.function?.name === "generate_video");
    if (!call?.function?.arguments) {
        throw grokError("Grok planner did not call generate_video", 502, "GROK_PLANNER_EMPTY_TOOL_CALL");
    }
    let args;
    try {
        args = JSON.parse(call.function.arguments);
    }
    catch {
        throw grokError("Grok planner returned invalid tool arguments", 502, "GROK_PLANNER_INVALID_TOOL_ARGS");
    }
    if (typeof args?.prompt !== "string" || !args.prompt.trim()) {
        throw grokError("Grok planner returned an empty video prompt", 502, "GROK_PLANNER_INVALID_TOOL_ARGS");
    }
    return args.prompt.trim();
}
export async function planGrokVideo(prompt, ctx, options = {}) {
    const cfg = videoConfig(ctx);
    const mode = options.mode || (options.sourceImage ? "image-to-video" : "text-to-video");
    const duration = options.duration ?? 5;
    const resolution = options.resolution || "480p";
    const aspectRatio = options.aspectRatio || "auto";
    const plannerModel = options.plannerModel || cfg.plannerModel;
    const model = canonicalVideoModel(options.model || cfg.model);
    const search = await searchGrokVisualContext(prompt, ctx, { signal: options.signal, requestId: options.requestId, directApiKey: options.directApiKey, plannerModel });
    const referenceImageUrls = (options.referenceImages ?? []).map((img) => sourceImageUrl(img, undefined));
    const payload = buildGrokVideoPlannerPayload(prompt, {
        model,
        mode,
        duration,
        resolution,
        aspectRatio,
        plannerModel,
        searchSummary: search.summary,
        sourceImageUrl: options.sourceImage ? sourceImageUrl(options.sourceImage, options.sourceMime) : undefined,
        referenceImageUrls,
        continuityLineage: options.continuityLineage,
        backgroundConstraint: options.backgroundConstraint,
    });
    const { url, headers } = videoEndpoint(ctx, "/v1/chat/completions", options.directApiKey);
    const { combinedSignal, timer } = withTimeoutSignal(options.signal, cfg.plannerTimeoutMs);
    logEvent("grok", "video:planner:start", { requestId: options.requestId, mode, duration, resolution });
    try {
        const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload), signal: combinedSignal });
        clearTimeout(timer);
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw grokError(`Grok video planner failed: ${text || `HTTP ${res.status}`}`, res.status >= 500 ? 502 : res.status, "GROK_PLANNER_BAD_REQUEST");
        }
        const planPrompt = parseGrokVideoPlanPrompt(await res.json());
        logEvent("grok", "video:planner:done", { requestId: options.requestId, mode, promptChars: planPrompt.length });
        return { prompt: planPrompt, mode, duration, resolution, aspectRatio, webSearchCalls: 1 };
    }
    catch (e) {
        clearTimeout(timer);
        if (e.name === "AbortError") {
            if (options.signal?.aborted)
                throw grokError("Generation canceled", 499, "GENERATION_CANCELED");
            throw grokError("Grok video planner timed out", 504, "GROK_PLANNER_TIMEOUT");
        }
        if (e.code && e.status)
            throw e;
        throw grokError(`Grok video planner request failed: ${e.message}`, 502, "GROK_PLANNER_NETWORK_FAILED");
    }
}
export function buildVideoGenerationPayload(plan, opts) {
    const model = canonicalVideoModel(opts.model);
    if (plan.mode === "image-to-video" && !opts.sourceImageUrl) {
        throw grokError("image-to-video requires a source image", 400, "GROK_VIDEO_INVALID_MODE");
    }
    const refs = opts.referenceImageUrls ?? [];
    if (plan.mode === "reference-to-video") {
        if (refs.length < 2)
            throw grokError("reference-to-video requires at least 2 reference images", 400, "GROK_VIDEO_INVALID_MODE");
        if (refs.length > MAX_REF2V_REFERENCES)
            throw grokError(`reference-to-video allows at most ${MAX_REF2V_REFERENCES} reference images`, 400, "GROK_VIDEO_REF_TOO_MANY");
        if (opts.sourceImageUrl)
            throw grokError("reference-to-video cannot be combined with a single source image", 400, "GROK_VIDEO_INVALID_MODE");
    }
    const resolutionCheck = validateVideoResolutionForRequest(model, plan.resolution, plan.mode);
    if (!("ok" in resolutionCheck)) {
        throw grokError(resolutionCheck.error, resolutionCheck.status, resolutionCheck.code);
    }
    const payload = { model, prompt: plan.prompt, duration: plan.duration, resolution: plan.resolution };
    if (plan.aspectRatio && plan.aspectRatio !== "auto")
        payload.aspect_ratio = plan.aspectRatio;
    if (plan.mode === "image-to-video")
        payload.image = { url: opts.sourceImageUrl };
    if (plan.mode === "reference-to-video")
        payload.reference_images = refs.map((url) => ({ url }));
    return payload;
}
export async function startVideoRequest(ctx, payload, options) {
    const cfg = videoConfig(ctx);
    const { url, headers } = videoEndpoint(ctx, "/v1/videos/generations", options.directApiKey);
    const { combinedSignal, timer } = withTimeoutSignal(options.signal, cfg.startTimeoutMs);
    try {
        const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload), signal: combinedSignal });
        clearTimeout(timer);
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw grokError(`Grok video request failed: ${text || `HTTP ${res.status}`}`, res.status >= 500 ? 502 : res.status, "GROK_VIDEO_REQUEST_FAILED");
        }
        const data = await res.json();
        const requestId = data?.request_id || data?.id;
        if (!requestId)
            throw grokError("Grok video start returned no request id", 502, "GROK_VIDEO_REQUEST_FAILED");
        return requestId;
    }
    catch (e) {
        clearTimeout(timer);
        if (e.name === "AbortError") {
            if (options.signal?.aborted)
                throw grokError("Generation canceled", 499, "GENERATION_CANCELED");
            throw grokError("Grok video start timed out", 504, "GROK_VIDEO_TIMEOUT");
        }
        if (e.code && e.status)
            throw e;
        throw grokError(`Grok video start request failed: ${e.message}`, 502, "GROK_VIDEO_REQUEST_FAILED");
    }
}
export function normalizeVideoPoll(data) {
    const status = data?.status;
    return {
        status,
        progress: typeof data?.progress === "number" ? data.progress : undefined,
        videoUrl: data?.video?.url,
        duration: data?.video?.duration ?? null,
        respectModeration: data?.video?.respect_moderation,
        usage: data?.usage ? { grok_cost_usd_ticks: data.usage.cost_in_usd_ticks ?? 0 } : null,
        failedCode: data?.error?.code,
    };
}
export async function pollVideoOnce(ctx, requestId, signal, directApiKey) {
    const cfg = videoConfig(ctx);
    const { url, headers } = videoEndpoint(ctx, `/v1/videos/${requestId}`, directApiKey);
    const { combinedSignal, timer } = withTimeoutSignal(signal, cfg.startTimeoutMs);
    try {
        const res = await fetch(url, { method: "GET", headers, signal: combinedSignal });
        clearTimeout(timer);
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw grokError(`Grok video poll failed: ${text || `HTTP ${res.status}`}`, res.status >= 500 ? 502 : res.status, "GROK_VIDEO_POLL_FAILED");
        }
        const pollData = await res.json();
        return normalizeVideoPoll(pollData);
    }
    catch (e) {
        clearTimeout(timer);
        if (e.name === "AbortError") {
            if (signal?.aborted)
                throw grokError("Generation canceled", 499, "GENERATION_CANCELED");
            throw grokError("Grok video poll timed out", 504, "GROK_VIDEO_TIMEOUT");
        }
        if (e.code && e.status)
            throw e;
        throw grokError(`Grok video poll request failed: ${e.message}`, 502, "GROK_VIDEO_POLL_FAILED");
    }
}
function failedToError(poll) {
    if (poll.status === "expired")
        return grokError("Grok video job expired", 502, "GROK_VIDEO_EXPIRED");
    const mapped = poll.failedCode ? FAILED_CODE_MAP[poll.failedCode] : undefined;
    if (mapped)
        return grokError(`Grok video failed: ${poll.failedCode}`, mapped.status, mapped.code);
    return grokError("Grok video generation failed", 502, "GROK_VIDEO_FAILED");
}
export async function pollVideoUntilDone(ctx, requestId, options) {
    const cfg = videoConfig(ctx);
    const deadline = Date.now() + cfg.totalTimeoutMs;
    let lastProgress = -1;
    let lastProgressAt = Date.now();
    for (;;) {
        if (Date.now() > deadline)
            throw grokError("Grok video poll budget exceeded", 504, "GROK_VIDEO_TIMEOUT");
        const poll = await pollVideoOnce(ctx, requestId, options.signal, options.directApiKey);
        if (poll.status === "done")
            return poll;
        if (poll.status === "failed" || poll.status === "expired")
            throw failedToError(poll);
        const progress = poll.progress ?? lastProgress;
        if (progress !== lastProgress) {
            lastProgress = progress;
            lastProgressAt = Date.now();
        }
        const stalled = Date.now() - lastProgressAt > STALE_PROGRESS_MS;
        options.onEvent?.({ phase: "progress", progress: poll.progress, stalled });
        await sleep(cfg.pollIntervalMs, options.signal);
    }
}
export async function generateVideoViaGrok(prompt, ctx, options = {}) {
    const cfg = videoConfig(ctx);
    const model = canonicalVideoModel(options.model || cfg.model);
    const srcUrl = options.sourceImage ? sourceImageUrl(options.sourceImage, options.sourceMime) : undefined;
    const refUrls = (options.referenceImages ?? []).map((img) => sourceImageUrl(img, undefined));
    options.onEvent?.({ phase: "planning" });
    const plan = options.plannedPrompt
        ? {
            prompt: options.plannedPrompt,
            mode: (options.mode || (options.sourceImage ? "image-to-video" : "text-to-video")),
            duration: options.duration ?? 5,
            resolution: options.resolution || "480p",
            aspectRatio: options.aspectRatio || "auto",
            webSearchCalls: options.webSearchCalls ?? 1,
        }
        : await planGrokVideo(prompt, ctx, options);
    let xaiVideoRequestId;
    let effectiveModel = model;
    // grokv1.5 doesn't support T2V — inject a white canvas as source image to use I2V path
    let effectivePayload;
    if (model === GROK_VIDEO_MODEL_15 && plan.mode === "text-to-video" && !srcUrl && refUrls.length === 0) {
        const { width, height } = aspectToCanvas(plan.aspectRatio, plan.resolution);
        const whiteCanvas = await generateWhiteCanvasB64(width, height);
        const canvasSrcUrl = `data:image/png;base64,${whiteCanvas}`;
        effectivePayload = buildVideoGenerationPayload({ ...plan, mode: "image-to-video", prompt: `[Technical note: the attached image is a blank white canvas used as a technical placeholder for text-to-video generation. It is NOT a meaningful source frame. Ignore it completely and generate a fresh scene from scratch.]\n\n${plan.prompt}` }, { model, sourceImageUrl: canvasSrcUrl, referenceImageUrls: [] });
        logEvent("grok", "video:1.5-t2v-canvas", { requestId: options.requestId, width, height });
    }
    else {
        effectivePayload = buildVideoGenerationPayload(plan, { model, sourceImageUrl: srcUrl, referenceImageUrls: refUrls });
    }
    try {
        xaiVideoRequestId = await startVideoRequest(ctx, effectivePayload, options);
    }
    catch (e) {
        // Fallback: if 1.5-preview still fails, retry with base model
        if (model !== GROK_VIDEO_MODEL_BASE && e?.status === 400) {
            effectiveModel = GROK_VIDEO_MODEL_BASE;
            const fallbackPayload = buildVideoGenerationPayload(plan, { model: effectiveModel, sourceImageUrl: srcUrl, referenceImageUrls: refUrls });
            xaiVideoRequestId = await startVideoRequest(ctx, fallbackPayload, options);
            logEvent("grok", "video:fallback", { requestId: options.requestId, from: model, to: effectiveModel });
        }
        else {
            throw e;
        }
    }
    const modelFallback = effectiveModel === model ? null : { from: model, to: effectiveModel };
    options.onEvent?.({ phase: "submitted", xaiVideoRequestId, requestedModel: model, effectiveModel, modelFallback });
    logEvent("grok", "video:submitted", { requestId: options.requestId, xaiVideoRequestId, mode: plan.mode });
    const poll = await pollVideoUntilDone(ctx, xaiVideoRequestId, options);
    if (!poll.videoUrl)
        throw grokError("Grok video done without a video url", 502, "GROK_VIDEO_EMPTY_RESPONSE");
    if (poll.respectModeration === false)
        throw grokError("Grok video blocked by moderation", 502, "GROK_VIDEO_MODERATION_BLOCKED");
    const { buffer, contentType } = await downloadVideo(ctx, poll.videoUrl, options.signal);
    logEvent("grok", "video:done", { requestId: options.requestId, xaiVideoRequestId, bytes: buffer.length });
    return {
        videoBuffer: buffer,
        contentType,
        url: poll.videoUrl,
        duration: poll.duration ?? plan.duration,
        resolution: plan.resolution,
        aspectRatio: plan.aspectRatio,
        mode: plan.mode,
        usage: poll.usage ?? null,
        revisedPrompt: plan.prompt,
        xaiVideoRequestId,
        webSearchCalls: plan.webSearchCalls,
        requestedModel: model,
        effectiveModel,
        modelFallback,
    };
}
