import { extractFirstFrame, extractLastFrame, extractMidFrame } from "./videoMedia";

export type FramePosition = "first" | "mid" | "last";

export type FrameSource =
  /** A file under the generated directory, reachable by the server. */
  | { kind: "generated"; filename: string }
  /** Any browser-loadable URL (remote, blob, data). */
  | { kind: "url"; url: string };

export type FrameResult = {
  dataUrl: string;
  /** Which implementation produced the frame. Without this the fallback is unprovable. */
  via: "server-ffmpeg" | "browser-canvas";
};

export interface FrameExtractionService {
  extractFrame(
    source: FrameSource,
    position: FramePosition,
    options?: { signal?: AbortSignal },
  ): Promise<FrameResult>;
}

type Deps = {
  fetchGeneratedFrame: (
    filename: string,
    position: "last",
    options?: { signal?: AbortSignal },
  ) => Promise<string>;
  extractFromElement: (
    url: string,
    position: FramePosition,
    options?: { signal?: AbortSignal },
  ) => Promise<string>;
};

/**
 * Only infrastructure failures fall back.
 *
 * A user abort must stay aborted — retrying elsewhere is not a cancellation. A 4xx means
 * the input itself is bad, and the browser would fail on it too; falling back would just
 * turn a fast clear error into a slow confusing one.
 */
function isRecoverable(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  const code = (error as { code?: string })?.code;
  if (code === "VIDEO_FRAME_EXTRACT_ABORTED") return false;
  if (typeof status !== "number") return true;
  return status >= 500 || status === 503 || status === 504;
}

export async function fetchGeneratedFrameApi(
  filename: string,
  position: "last",
  options: { signal?: AbortSignal } = {},
): Promise<string> {
  const url = `/api/video/frame?file=${encodeURIComponent(filename)}&position=${position}`;
  const response = await fetch(url, { signal: options.signal });
  if (!response.ok) {
    throw Object.assign(new Error(`frame extraction failed (${response.status})`), {
      status: response.status,
    });
  }
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("frame decode failed"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Orchestrates frame extraction across the server (ffmpeg) and the browser (canvas).
 *
 * Direction of dependency is one-way: this module calls `videoMedia`, never the reverse,
 * so there is no cycle and the browser implementation stays independently testable.
 *
 * The server only accepts files inside the generated directory (SSRF guard) and only
 * understands `"last"` directly — `"first"`/`"mid"` need a duration the client does not
 * have, so they stay on the browser path rather than silently returning a wrong frame.
 */
export function createFrameExtractionService(deps: Deps): FrameExtractionService {
  return {
    async extractFrame(source, position, options = {}) {
      if (source.kind === "generated" && position === "last") {
        try {
          const dataUrl = await deps.fetchGeneratedFrame(source.filename, "last", options);
          return { dataUrl, via: "server-ffmpeg" };
        } catch (error) {
          if (!isRecoverable(error)) throw error;
        }
      }
      const url = source.kind === "url" ? source.url : `/generated/${encodeURIComponent(source.filename)}`;
      return { dataUrl: await deps.extractFromElement(url, position, options), via: "browser-canvas" };
    },
  };
}

/** Production instance. Created once at module load; holds no mutable state. */
export const frameExtraction = createFrameExtractionService({
  fetchGeneratedFrame: fetchGeneratedFrameApi,
  extractFromElement: (url, position, options) =>
    position === "last" ? extractLastFrame(url, options)
    : position === "first" ? extractFirstFrame(url, options)
    : extractMidFrame(url, options),
});
