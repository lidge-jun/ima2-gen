/**
 * Retry guard for Grok upstream fetches.
 *
 * Only pre-response failures are retried: fetch() rejects before any response header
 * arrives, so a caught rejection here means the origin never answered. Deliberately
 * narrow — aborts, timeouts, DNS/refusal, and 4xx are honest failures and stay failures.
 *
 * Non-idempotent generation calls (postGrokImages, startVideoRequest) must NOT use this
 * wrapper: retrying a request the origin may already have accepted bills the user twice.
 * See devlog/_plan/260812_navrail_grok_autotag/020_grok_upstream_retry.md.
 *
 * MUST stay a leaf module: no imports from config, routes, or adapters.
 */

const RESET_RETRY_MAX_ATTEMPTS = 3;
const RESET_RETRY_BASE_DELAY_MS = 150;
const RESET_RETRY_MAX_DELAY_MS = 1_000;

const TRANSIENT_RETRY_MAX_ATTEMPTS = 3;
const TRANSIENT_RETRY_BASE_DELAY_MS = 400;
const TRANSIENT_RETRY_MAX_DELAY_MS = 5_000;
/**
 * An attempt slower than this already burned the caller's patience; retrying only
 * duplicates upstream load past the client timeout.
 */
const TRANSIENT_RETRY_SLOW_ATTEMPT_MS = 15_000;

/** Gateway-class statuses. 507 is storage-class, not transient, and is excluded. */
export function isTransientUpstreamStatus(status: number): boolean {
  return status === 500 || status === 502 || status === 503 || status === 504
    || status === 520 || status === 521 || status === 522;
}

export function isConnectionResetError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // Aborts and timeouts are caller decisions / honest failures — never retryable.
  if (err.name === "AbortError" || err.name === "TimeoutError") return false;
  const code = (err as { code?: unknown }).code;
  if (code === "ECONNRESET" || code === "EPIPE") return true;
  const cause = (err as { cause?: unknown }).cause;
  const causeCode = cause && typeof cause === "object" ? (cause as { code?: unknown }).code : undefined;
  if (causeCode === "ECONNRESET" || causeCode === "EPIPE") return true;
  const msg = err.message.toLowerCase();
  return msg.includes("socket connection was closed unexpectedly")
    || msg.includes("connection reset by peer")
    || msg.includes("socket hang up");
}

function retryAfterDelayMs(headers: Headers): number | undefined {
  const raw = headers.get("retry-after")?.trim();
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(raw);
  if (!Number.isFinite(dateMs)) return undefined;
  return Math.max(0, dateMs - Date.now());
}

export interface RetryBackoffOptions {
  baseDelayMs: number;
  maxDelayMs: number;
  headers?: Headers;
}

export function retryBackoffDelayMs(attempt: number, opts: RetryBackoffOptions): number {
  const retryAfter = opts.headers ? retryAfterDelayMs(opts.headers) : undefined;
  if (retryAfter !== undefined) return Math.min(retryAfter, opts.maxDelayMs);
  const exp = Math.min(opts.baseDelayMs * (2 ** attempt), opts.maxDelayMs);
  return Math.floor(exp * (0.8 + Math.random() * 0.4));
}

function abortError(signal?: AbortSignal): unknown {
  return signal?.reason ?? new DOMException("The operation was aborted", "AbortError");
}

export async function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  if (signal?.aborted) throw abortError(signal);
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError(signal));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export interface RetryResponse {
  ok: boolean;
  status: number;
  headers: Headers;
  body: { cancel(reason?: unknown): Promise<void> } | null;
}

/** Cleanup only: a retry must never wait for, or fail because of, cancellation. */
function cancelResponseBodyBestEffort(res: RetryResponse): void {
  try {
    const cancellation = res.body?.cancel();
    if (cancellation) void cancellation.catch(() => {});
  } catch {
    // Ignore: the body is being discarded anyway.
  }
}

export interface GrokRetryOptions {
  signal?: AbortSignal;
  label?: string;
  attempts?: number;
}

async function fetchWithResetRetry<R extends RetryResponse>(
  doFetch: () => Promise<R>,
  opts: GrokRetryOptions,
): Promise<R> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < RESET_RETRY_MAX_ATTEMPTS; attempt++) {
    if (opts.signal?.aborted) throw abortError(opts.signal);
    try {
      return await doFetch();
    } catch (err) {
      if (!isConnectionResetError(err) || attempt === RESET_RETRY_MAX_ATTEMPTS - 1) throw err;
      lastErr = err;
      console.warn(`[grok] connection reset${opts.label ? ` (${opts.label})` : ""} — retrying (${attempt + 2}/${RESET_RETRY_MAX_ATTEMPTS})`);
      await sleepWithAbort(
        retryBackoffDelayMs(attempt, { baseDelayMs: RESET_RETRY_BASE_DELAY_MS, maxDelayMs: RESET_RETRY_MAX_DELAY_MS }),
        opts.signal,
      );
    }
  }
  throw lastErr;
}

/**
 * Runs `doFetch` with reset + transient-5xx retries.
 * `doFetch` MUST be replayable: it may be called more than once.
 */
export async function grokFetchWithRetry<R extends RetryResponse>(
  doFetch: () => Promise<R>,
  opts: GrokRetryOptions = {},
): Promise<R> {
  const attempts = Math.max(1, opts.attempts ?? TRANSIENT_RETRY_MAX_ATTEMPTS);
  let attemptStart = Date.now();
  let res = await fetchWithResetRetry(doFetch, opts);
  for (let attempt = 0; attempt < attempts - 1; attempt++) {
    if (res.ok || !isTransientUpstreamStatus(res.status)) return res;
    if (opts.signal?.aborted) return res;
    if (Date.now() - attemptStart > TRANSIENT_RETRY_SLOW_ATTEMPT_MS) return res;
    const delay = retryBackoffDelayMs(attempt, {
      baseDelayMs: TRANSIENT_RETRY_BASE_DELAY_MS,
      maxDelayMs: TRANSIENT_RETRY_MAX_DELAY_MS,
      headers: res.headers,
    });
    console.warn(`[grok] transient ${res.status}${opts.label ? ` (${opts.label})` : ""} — retrying (${attempt + 2}/${attempts})`);
    cancelResponseBodyBestEffort(res);
    await sleepWithAbort(delay, opts.signal);
    attemptStart = Date.now();
    res = await fetchWithResetRetry(doFetch, opts);
  }
  return res;
}
