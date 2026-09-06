import { pinnedHttpGet, PinnedGetFailure, type PinnedHttpResponse as PinnedImageResponse } from "./pinnedHttpGet.js";
import { detectImageMimeFromB64 } from "./refs.js";
import { grokFetchWithRetry, type RetryResponse } from "./grokUpstreamRetry.js";
import {
  resolveImageDownloadTarget, type GrokImageDownloadPolicy,
} from "./grokImageDownloadPolicy.js";

const MAX_IMAGE_DOWNLOAD_BYTES = 50 * 1024 * 1024;
const MAX_IMAGE_REDIRECTS = 5;
const IMAGE_REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

interface PinnedRetryResponse extends RetryResponse { source: PinnedImageResponse }

class ImageDownloadFailure extends Error {
  constructor(message: string, readonly status = 502, readonly code = "GROK_IMAGE_DOWNLOAD_FAILED") {
    super(message);
  }
}

class ImageBodyFailure extends Error {
  constructor(readonly reason: "too-large" | "empty") { super(reason); }
}

function cancelPinnedImageResponse(response: PinnedImageResponse): Promise<void> {
  try { void Promise.resolve(response.cancel()).catch(() => {}); } catch { /* cleanup only */ }
  return Promise.resolve(); // Never await an advisory cleanup promise.
}

function toRetryResponse(source: PinnedImageResponse): PinnedRetryResponse {
  const headers = new Headers();
  const retryAfter = source.headers.get("retry-after");
  if (retryAfter !== null) headers.set("retry-after", retryAfter);
  return { ok: source.status >= 200 && source.status < 300, status: source.status,
    headers, source, body: { cancel: () => cancelPinnedImageResponse(source) } };
}

async function fetchPinnedImageWithRetry(
  url: URL, policy: GrokImageDownloadPolicy, signal: AbortSignal,
): Promise<PinnedImageResponse> {
  let active: PinnedImageResponse | undefined;
  try {
    const result = await grokFetchWithRetry(async () => {
      const target = await resolveImageDownloadTarget(url, policy, signal);
      signal.throwIfAborted();
      active = await pinnedHttpGet(target, signal);
      return toRetryResponse(active);
    }, { signal, label: "image-download" });
    signal.throwIfAborted();
    return result.source;
  } catch (error) {
    if (active) void cancelPinnedImageResponse(active);
    throw error;
  }
}

async function readBoundedImageBody(
  response: PinnedImageResponse, options: { maxBytes: number; signal: AbortSignal },
): Promise<Buffer> {
  const onAbort = () => { void cancelPinnedImageResponse(response); };
  options.signal.addEventListener("abort", onAbort, { once: true });
  try {
    options.signal.throwIfAborted();
    if (Number(response.headers.get("content-length")) > options.maxBytes) {
      throw new ImageBodyFailure("too-large");
    }
    if (!response.body) throw new ImageBodyFailure("empty");
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of response.body) {
      options.signal.throwIfAborted();
      total += chunk.byteLength;
      if (total > options.maxBytes) {
        void cancelPinnedImageResponse(response);
        throw new ImageBodyFailure("too-large");
      }
      chunks.push(Buffer.from(chunk));
    }
    options.signal.throwIfAborted();
    if (!total) throw new ImageBodyFailure("empty");
    return Buffer.concat(chunks, total);
  } catch (error) {
    void cancelPinnedImageResponse(response);
    throw error;
  } finally {
    options.signal.removeEventListener("abort", onAbort);
  }
}

async function downloadImageHops(url: URL, policy: GrokImageDownloadPolicy, signal: AbortSignal) {
  const trustedOrigin = policy.trustedProxyOrigin ? new URL(policy.trustedProxyOrigin).origin : undefined;
  let trusted = trustedOrigin !== undefined && url.origin === trustedOrigin;
  let currentUrl = url;
  for (let redirects = 0; ; redirects++) {
    signal.throwIfAborted();
    const effectiveHopPolicy = trusted ? { trustedProxyOrigin: trustedOrigin } : {};
    const response = await fetchPinnedImageWithRetry(currentUrl, effectiveHopPolicy, signal);
    try {
      signal.throwIfAborted();
      if (IMAGE_REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get("location");
        if (!location?.trim() || redirects >= MAX_IMAGE_REDIRECTS) {
          throw new ImageDownloadFailure("Image download redirect refused");
        }
        currentUrl = new URL(location, currentUrl);
        trusted = trusted && currentUrl.origin === trustedOrigin;
        continue;
      }
      if (response.status < 200 || response.status >= 300) {
        throw new ImageDownloadFailure(`Image download failed: HTTP ${response.status}`);
      }
      const buffer = await readBoundedImageBody(response, { maxBytes: MAX_IMAGE_DOWNLOAD_BYTES, signal });
      signal.throwIfAborted();
      const b64 = buffer.toString("base64");
      const mime = response.headers.get("content-type")?.split(";")[0]?.trim()
        || detectImageMimeFromB64(b64) || "image/png";
      return { buffer, b64, mime };
    } finally {
      void cancelPinnedImageResponse(response);
    }
  }
}

export async function downloadGrokImageUrl(
  url: string, signal?: AbortSignal, timeoutMs = 30_000, policy: GrokImageDownloadPolicy = {},
): Promise<{ buffer: Buffer; b64: string; mime: string }> {
  const controller = new AbortController();
  const combined = new AbortController();
  const onAbort = () => combined.abort(signal?.reason);
  const timer = setTimeout(() => { controller.abort(); combined.abort(controller.signal.reason); }, timeoutMs);
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    if (signal?.aborted) onAbort();
    combined.signal.throwIfAborted();
    const result = await downloadImageHops(new URL(url), policy, combined.signal);
    combined.signal.throwIfAborted();
    return result;
  } catch (error) {
    if (signal?.aborted) throw new ImageDownloadFailure("Generation canceled", 499, "GENERATION_CANCELED");
    if (controller.signal.aborted) throw new ImageDownloadFailure("Image download timed out", 504, "GROK_IMAGE_TIMEOUT");
    if (error instanceof ImageBodyFailure) {
      throw new ImageDownloadFailure(error.reason === "too-large"
        ? "Image download exceeds 50MB limit" : "Image download was empty");
    }
    if (error instanceof ImageDownloadFailure) throw error;
    if (error instanceof PinnedGetFailure) throw new ImageDownloadFailure(error.message);
    // Never publish raw DNS/socket errors, URL parse errors or signed URL credentials.
    throw new ImageDownloadFailure("Image download failed");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
