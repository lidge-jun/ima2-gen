/**
 * Types, config, and transport helpers shared by the Grok video adapter and its poll loop.
 *
 * This module exists to keep the dependency one-way. `videoEndpoint`/`withTimeoutSignal`
 * are used by the planner and start calls in `grokVideoAdapter.ts` AND by the poll loop in
 * `grokVideoPoll.ts`; leaving them in the adapter would force the poll module to import
 * the adapter that imports it back.
 *
 * MUST stay a leaf: it may import runtime/config/model helpers, never the adapter or the
 * poll loop.
 */
import type { RouteRuntimeContext } from "./runtimeContext.js";
import { getGrokProxyUrl } from "./grokRuntime.js";
import { grokError } from "./grokImageCore.js";
import { GROK_FALLBACK_VIDEO_MODEL } from "./imageModels.js";
import type { VideoAspectRatio, VideoMode, VideoResolution } from "./imageModels.js";
import type { VideoContinuityLineage } from "./videoContinuity.js";
import { DEFAULT_GROK_PLANNER_MODEL } from "../config.js";

export type GrokVideoPhase = "planning" | "submitted" | "progress";

export interface GrokVideoEvent {
  phase: GrokVideoPhase;
  xaiVideoRequestId?: string | undefined;
  requestedModel?: string | undefined;
  effectiveModel?: string | undefined;
  modelFallback?: { from: string; to: string } | null;
  progress?: number | undefined;
  stalled?: boolean | undefined;
}

export interface GrokVideoPollResult {
  status: "pending" | "done" | "failed" | "expired";
  progress?: number | undefined;
  videoUrl?: string | undefined;
  duration?: number | null | undefined;
  respectModeration?: boolean | undefined;
  usage?: Record<string, number> | null | undefined;
  failedCode?: string | undefined;
}

export interface GrokVideoOptions {
  model?: string | undefined;
  mode?: VideoMode | undefined;
  duration?: number | undefined;
  resolution?: VideoResolution | undefined;
  aspectRatio?: VideoAspectRatio | undefined;
  sourceImage?: string | undefined;
  sourceMime?: string | null | undefined;
  referenceImages?: string[] | undefined;
  signal?: AbortSignal | undefined;
  requestId?: string | undefined;
  plannedPrompt?: string | undefined;
  webSearchCalls?: number | undefined;
  continuityLineage?: VideoContinuityLineage | null | undefined;
  plannerModel?: string | undefined;
  directApiKey?: string | undefined;
  onEvent?: (ev: GrokVideoEvent) => void | undefined;
  storyboardActive?: boolean | undefined;
  backgroundConstraint?: string | undefined;
}

export interface VideoConfig {
  model: string;
  startTimeoutMs: number;
  pollIntervalMs: number;
  totalTimeoutMs: number;
  pollMaxConsecutiveErrors: number;
  plannerModel: string;
  plannerTimeoutMs: number;
}

export const STALE_PROGRESS_MS = 180_000;

export const FAILED_CODE_MAP: Record<string, { code: string; status: number }> = {
  invalid_argument: { code: "GROK_VIDEO_REQUEST_FAILED", status: 400 },
  permission_denied: { code: "GROK_VIDEO_REQUEST_FAILED", status: 403 },
  failed_precondition: { code: "GROK_VIDEO_REQUEST_FAILED", status: 412 },
  service_unavailable: { code: "GROK_VIDEO_POLL_FAILED", status: 502 },
  internal_error: { code: "GROK_VIDEO_FAILED", status: 502 },
};

export function videoConfig(ctx: RouteRuntimeContext): VideoConfig {
  const g = (ctx.config as any).grokProvider || {}; // justified: RouteRuntimeContext.config is a loose runtime bag; every Grok adapter reads grokProvider this way
  return {
    model: g.defaultVideoModel || GROK_FALLBACK_VIDEO_MODEL,
    startTimeoutMs: g.videoStartTimeoutMs || 60_000,
    pollIntervalMs: g.videoPollIntervalMs || 5_000,
    totalTimeoutMs: g.videoTimeoutMs || 900_000,
    pollMaxConsecutiveErrors: g.videoPollMaxConsecutiveErrors || 5,
    plannerModel: g.plannerModel || DEFAULT_GROK_PLANNER_MODEL,
    plannerTimeoutMs: g.plannerTimeoutMs || 60_000,
  };
}

export function videoEndpoint(ctx: RouteRuntimeContext, path: string, directApiKey?: string) {
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

export function withTimeoutSignal(signal: AbortSignal | undefined, timeoutMs: number) {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
  const combinedSignal = signal ? AbortSignal.any([signal, timeoutController.signal]) : timeoutController.signal;
  return { combinedSignal, timer };
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(grokError("Generation canceled", 499, "GENERATION_CANCELED"));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(grokError("Generation canceled", 499, "GENERATION_CANCELED"));
      },
      { once: true },
    );
  });
}

export function normalizeVideoPoll(data: any): GrokVideoPollResult { // justified: raw xAI JSON response, shape is validated field by field below
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
