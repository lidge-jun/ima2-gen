import type { GenerateItem } from "../types";

const VIDEO_EXT = /\.(mp4|webm|mov)$/i;

export function isVideoUrl(src: string | null | undefined): boolean {
  if (!src || src.startsWith("data:image/")) return false;
  const clean = src.split("?")[0];
  return VIDEO_EXT.test(clean) || src.startsWith("data:video/");
}

export function isVideoItem(
  item: Pick<GenerateItem, "filename" | "url" | "image" | "mediaType"> | null | undefined,
): boolean {
  if (!item) return false;
  if (item.mediaType === "video") return true;
  return isVideoUrl(item.filename) || isVideoUrl(item.url) || isVideoUrl(item.image);
}

const FRAME_EXTRACT_TIMEOUT_MS = 15_000;

export type FrameExtractOptions = { signal?: AbortSignal };

/**
 * Extract a frame at a specific time position from a video as a JPEG data URL.
 * Uses a hidden <video> + <canvas> to seek and capture.
 *
 * Guards that matter here:
 * - `video.duration` can be NaN or Infinity before metadata settles, and assigning NaN
 *   to `currentTime` is silently ignored — `onseeked` then never fires and the promise
 *   hangs forever. Reject explicitly instead.
 * - A hard timeout covers the remaining ways a load can stall.
 * - Every exit path tears the element down, including the error path.
 */
export function extractFrameAtTime(
  videoSrc: string,
  seekFn: (duration: number) => number,
  options: FrameExtractOptions = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.muted = true;

    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timer !== null) clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.onerror = null;
      video.src = "";
      video.load();
    };
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };
    function onAbort() {
      finish(() => reject(Object.assign(new Error("frame extraction aborted"), {
        code: "VIDEO_FRAME_EXTRACT_ABORTED",
      })));
    }

    if (options.signal?.aborted) { onAbort(); return; }
    options.signal?.addEventListener("abort", onAbort);
    timer = setTimeout(() => {
      finish(() => reject(new Error("frame extraction timed out")));
    }, FRAME_EXTRACT_TIMEOUT_MS);

    video.onloadedmetadata = () => {
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        finish(() => reject(new Error("video duration is unavailable")));
        return;
      }
      video.currentTime = Math.max(0, seekFn(duration));
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) { finish(() => reject(new Error("canvas 2d context unavailable"))); return; }
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        finish(() => resolve(dataUrl));
      } catch (e) {
        finish(() => reject(e));
      }
    };

    video.onerror = () => {
      finish(() => reject(new Error("Failed to load video for frame extraction")));
    };

    video.src = videoSrc;
  });
}

export function extractLastFrame(videoSrc: string, options?: FrameExtractOptions): Promise<string> {
  return extractFrameAtTime(videoSrc, (d) => d - 0.1, options);
}

export function extractFirstFrame(videoSrc: string, options?: FrameExtractOptions): Promise<string> {
  return extractFrameAtTime(videoSrc, (d) => Math.min(d * 0.3, 0.4), options);
}

export function extractMidFrame(videoSrc: string, options?: FrameExtractOptions): Promise<string> {
  return extractFrameAtTime(videoSrc, (d) => d / 2, options);
}
