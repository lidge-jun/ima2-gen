import type { RouteRuntimeContext } from "./runtimeContext.js";
import { grokError } from "./grokImageAdapter.js";
import { grokFetchWithRetry } from "./grokUpstreamRetry.js";

const MAX_VIDEO_DOWNLOAD_BYTES = 100 * 1024 * 1024;

function downloadTimeoutMs(ctx: RouteRuntimeContext): number {
  const g = (ctx.config as any).grokProvider || {};
  return g.videoDownloadTimeoutMs || 120_000;
}

function withTimeoutSignal(signal: AbortSignal | undefined, timeoutMs: number) {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
  const combinedSignal = signal ? AbortSignal.any([signal, timeoutController.signal]) : timeoutController.signal;
  return { combinedSignal, timer };
}

export function isMp4Container(buffer: Buffer): boolean {
  return buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp";
}

export async function downloadVideo(ctx: RouteRuntimeContext, url: string, signal?: AbortSignal): Promise<{ buffer: Buffer; contentType: string }> {
  const { combinedSignal, timer } = withTimeoutSignal(signal, downloadTimeoutMs(ctx));
  try {
    const parsed = new URL(url);
    const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLoopback)) {
      throw grokError("Grok video download URL must be HTTPS", 502, "GROK_VIDEO_DOWNLOAD_FAILED");
    }
    // Safe to replay: downloading a finished artifact creates nothing upstream.
    const res = await grokFetchWithRetry(
      () => fetch(url, { signal: combinedSignal }),
      { signal: combinedSignal, label: "video-download" },
    );
    if (!res.ok) throw grokError(`Grok video download failed: HTTP ${res.status}`, 502, "GROK_VIDEO_DOWNLOAD_FAILED");
    const contentLength = Number(res.headers.get("content-length") || "0");
    if (contentLength > MAX_VIDEO_DOWNLOAD_BYTES) {
      throw grokError("Grok video download exceeds the 100MB limit", 502, "GROK_VIDEO_DOWNLOAD_FAILED");
    }
    const contentType = res.headers.get("content-type") || "video/mp4";
    if (!/^video\/mp4\b/i.test(contentType) && !/^application\/octet-stream\b/i.test(contentType)) {
      throw grokError("Grok video download returned a non-video response", 502, "GROK_VIDEO_DOWNLOAD_FAILED");
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    clearTimeout(timer);
    if (buffer.length === 0) throw grokError("Grok video download was empty", 502, "GROK_VIDEO_DOWNLOAD_FAILED");
    if (buffer.length > MAX_VIDEO_DOWNLOAD_BYTES) {
      throw grokError("Grok video download exceeds the 100MB limit", 502, "GROK_VIDEO_DOWNLOAD_FAILED");
    }
    if (!isMp4Container(buffer)) {
      throw grokError("Grok video download returned an invalid MP4 container", 502, "GROK_VIDEO_DOWNLOAD_FAILED");
    }
    return { buffer, contentType };
  } catch (e: any) {
    clearTimeout(timer);
    if (e.name === "AbortError") {
      if (signal?.aborted) throw grokError("Generation canceled", 499, "GENERATION_CANCELED");
      throw grokError("Grok video download timed out", 504, "GROK_VIDEO_TIMEOUT");
    }
    if (e.code && e.status) throw e;
    throw grokError(`Grok video download request failed: ${e.message}`, 502, "GROK_VIDEO_DOWNLOAD_FAILED");
  }
}
