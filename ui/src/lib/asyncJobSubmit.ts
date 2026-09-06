import { fetchApi } from "./api-core";
import { createLanAuthError, getLanAuthEpoch, isLanSessionLocked } from "./lanSession";

const DEFAULT_CAPACITY_RETRY_MS = 5000;
const MAX_CAPACITY_RETRY_MS = 30000;

export type AsyncJobError = Error & { code?: string; status?: number };

export function parseRetryAfterMs(value: string | null): number {
  if (!value) return DEFAULT_CAPACITY_RETRY_MS;
  const seconds = Number.parseFloat(value);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(MAX_CAPACITY_RETRY_MS, Math.max(1000, Math.round(seconds * 1000)));
  }
  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) {
    return Math.min(MAX_CAPACITY_RETRY_MS, Math.max(1000, dateMs - Date.now()));
  }
  return DEFAULT_CAPACITY_RETRY_MS;
}

function isCapacityResponse(res: Response, data: { code?: unknown; error?: unknown }): boolean {
  return res.status === 429 && data.code === "TOO_MANY_JOBS";
}

function abortError(): DOMException {
  return new DOMException("Aborted", "AbortError");
}

export function mergeAbortSignals(...signals: Array<AbortSignal | undefined>): AbortSignal | undefined {
  const active = signals.filter((signal): signal is AbortSignal => Boolean(signal));
  if (active.length === 0) return undefined;
  if (active.length === 1) return active[0];
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any(active);
  }
  const controller = new AbortController();
  const abort = () => {
    for (const signal of active) signal.removeEventListener("abort", abort);
    controller.abort();
  };
  if (active.some((signal) => signal.aborted)) abort();
  else active.forEach((signal) => signal.addEventListener("abort", abort, { once: true }));
  return controller.signal;
}

export async function submitAsyncJobWithCapacityRetry<TErrorBody>({
  url,
  payload,
  requestId,
  signal,
  parseError,
}: {
  url: string;
  payload: Record<string, unknown>;
  requestId: string;
  signal?: AbortSignal;
  parseError: (res: Response, data: TErrorBody) => AsyncJobError;
}): Promise<void> {
  const epoch = getLanAuthEpoch();
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const wait = (ms: number): Promise<void> => new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      reject(abortError());
    };
    retryTimer = setTimeout(() => {
      retryTimer = null;
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });

  while (true) {
    if (signal?.aborted) throw abortError();
    if (epoch !== getLanAuthEpoch()) throw createLanAuthError(epoch);
    if (isLanSessionLocked()) throw createLanAuthError(epoch - 1);
    const res = await fetchApi(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, async: true, requestId }),
      signal,
    });
    if (res.ok) return;

    const data = await res.json().catch(() => ({})) as TErrorBody;
    if (isCapacityResponse(res, data as { code?: unknown; error?: unknown })) {
      await wait(parseRetryAfterMs(res.headers.get("Retry-After")));
      continue;
    }
    throw parseError(res, data);
  }
}
