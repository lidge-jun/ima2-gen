// Client for POST /api/video/edit — real video-to-video, as opposed to the last-frame
// image-to-video path that /api/video/extend takes.
//
// The route has existed since 260716 with no GUI caller, so editing a clip meant
// dropping to `ima2 video edit`. This is the missing client, not a new capability.
//
// devlog/_plan/260908_xai_imagine_spec_resync/030_wp35_gui_inputs.md
import { parseSseErrorPayload } from "./sseStreamError";

export type VideoEditRequest = {
  /** A filename under /generated, an https URL, an xAI file_id, or a data URL. */
  videoUrl: string;
  prompt: string;
  /** grok-imagine-video only: 1.5 answers 400 "Video editing is not supported". */
  model?: string;
};

export type VideoEditDone = {
  requestId: string;
  url: string;
  filename: string;
  duration: number | null;
  model: string;
};

/**
 * Runs an edit and resolves when the finished video is saved.
 *
 * Unlike the extend path this route answers synchronously after polling upstream, so
 * there is no SSE stream to subscribe to — the request simply stays open. The caller
 * owns the abort signal because that wait can run for minutes.
 */
export async function postVideoEdit(payload: VideoEditRequest, signal: AbortSignal): Promise<VideoEditDone> {
  const response = await fetch("/api/video/edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw parseSseErrorPayload(data, `Request failed: ${response.status}`);
  if (typeof data.url !== "string" || typeof data.filename !== "string") {
    throw new Error("Video edit returned no saved artifact");
  }
  return {
    requestId: String(data.requestId ?? ""),
    url: data.url,
    filename: data.filename,
    duration: typeof data.duration === "number" ? data.duration : null,
    model: String(data.model ?? ""),
  };
}

