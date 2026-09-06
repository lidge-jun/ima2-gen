import { fetchApi } from "./api-core";
import { createLanAuthError, getLanAuthEpoch, isLanSessionLocked } from "./lanSession";
import { cancelInflight } from "./api";
import { armStreamTimeout, ensureConnected, subscribe, whenConnected } from "./eventChannel";
import { parseSseErrorPayload } from "./sseStreamError";
import type { VideoExtendDone } from "./videoHistoryItem";

export type VideoExtendRequest = {
  requestId: string;
  sourceVideoId: string;
  prompt?: string;
  provider: "grok" | "grok-api";
  model?: string;
};

async function submitVideoExtend(payload: VideoExtendRequest, signal: AbortSignal): Promise<void> {
  try {
    const response = await fetchApi("/api/video/extend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw parseSseErrorPayload(data, `Request failed: ${response.status}`);
    if (response.status !== 202 || data.requestId !== payload.requestId ||
      data.sourceVideoId !== payload.sourceVideoId || data.workflow !== "last-frame-i2v") {
      throw new Error("Video extension returned an invalid acceptance response");
    }
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}

export function postVideoExtendStream(payload: VideoExtendRequest, signal: AbortSignal): Promise<VideoExtendDone> {
  const epoch = getLanAuthEpoch();
  if (isLanSessionLocked()) return Promise.reject(createLanAuthError(epoch - 1));
  ensureConnected();
  return new Promise((resolve, reject) => {
    let settled = false;
    let clearTimer = () => {};
    let unsubscribe = () => {};
    const finish = (complete: () => void) => {
      if (settled) return;
      settled = true;
      clearTimer();
      unsubscribe();
      signal.removeEventListener("abort", onAbort);
      complete();
    };
    const cancelJob = () => void cancelInflight(payload.requestId).catch(() => undefined);
    const onAbort = () => finish(() => {
      cancelJob();
      reject(new DOMException("Aborted", "AbortError"));
    });
    unsubscribe = subscribe(payload.requestId, null, (event, data) => {
      if (event === "done") finish(() => resolve(data as unknown as VideoExtendDone));
      else if (event === "error") finish(() =>
        reject(parseSseErrorPayload(data, "Video extension failed")));
    });
    clearTimer = armStreamTimeout(() => finish(() => {
      cancelJob(); reject(new Error("Video extension stream timed out"));
    }));
    if (signal.aborted) return onAbort();
    signal.addEventListener("abort", onAbort, { once: true });
    // Await SSE transport open BEFORE submitting (audit blocker B3): on a fresh
    // connection a terminal event emitted before the server-side subscription
    // is installed would be lost, hanging the promise until timeout.
    const submission = whenConnected().then(() => {
      if (epoch !== getLanAuthEpoch()) throw createLanAuthError(epoch);
      if (isLanSessionLocked()) throw createLanAuthError(epoch - 1);
      return submitVideoExtend(payload, signal);
    });
    submission.catch((error) => finish(() => reject(error)));
  });
}
