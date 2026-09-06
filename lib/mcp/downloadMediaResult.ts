// Hardened result download (050 WP5): HTTPS-only, per-hop private-IP rejection,
// streamed byte cap, content-type check. Returns a temp file path — the caller
// (routes/mcpMedia.ts) owns the atomic commit. Signed URLs are never persisted.
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { pinnedHttpGet, type PinnedHttpResponse, type PinnedHttpTarget } from "../pinnedHttpGet.js";
import { resolvePublicDownloadTarget } from "../grokImageDownloadPolicy.js";

const MAX_REDIRECTS = 5;
async function resolvePublicHttps(url: URL, signal: AbortSignal): Promise<PinnedHttpTarget> {
  if (url.protocol !== "https:") throw new Error(`MCP_DOWNLOAD_INSECURE:${url.protocol}`);
  try {
    return await resolvePublicDownloadTarget(url, signal, "ipv4first");
  } catch (error) {
    signal.throwIfAborted();
    if (!(error instanceof Error) || Reflect.get(error, "code") !== "GROK_IMAGE_DOWNLOAD_FAILED") throw error;
    throw new Error(`MCP_DOWNLOAD_PRIVATE_IP:${url.hostname}`);
  }
}

export async function assertPublicHttps(url: URL): Promise<void> {
  try { await resolvePublicHttps(url, new AbortController().signal); }
  catch (error) { throw error; }
}

export interface DownloadedMedia {
  tempPath: string;
  contentType: string;
  bytes: number;
  /** Query-stripped origin+path — the only URL form allowed into sidecars. */
  sanitizedUrl: string;
  cleanup: () => Promise<void>;
}

/** Transient right after task completion: network-level failures and
 *  403/5xx from CDN propagation are worth retrying; contract violations and
 *  permanent client errors are not. */
function isRetryableDownloadError(error: unknown): boolean {
  const message = String((error as Error)?.message ?? error);
  // v4-fallback timeout is the same ETIMEDOUT class as the RCA — keep retrying.
  if (message.startsWith("MCP_DOWNLOAD_TIMEOUT")) return true;
  if (message.startsWith("MCP_DOWNLOAD_FAILED:")) {
    const status = Number(message.split(":")[1]);
    return status === 403 || status >= 500;
  }
  if (message.startsWith("MCP_DOWNLOAD_") || message.startsWith("MCP_RESULT_")) return false;
  return true;
}

export async function downloadMediaResult(
  rawUrl: string,
  options: { kind: "image" | "video"; maxBytes?: number; timeoutMs?: number; attempts?: number; baseDelayMs?: number; v4Fallback?: boolean },
): Promise<DownloadedMedia> {
  const attempts = Math.max(1, options.attempts ?? 1);
  const baseDelayMs = options.baseDelayMs ?? 4_000;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await downloadMediaResultOnce(rawUrl, options);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isRetryableDownloadError(error)) throw error;
      const delay = baseDelayMs * attempt + Math.floor(Math.random() * 1_000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

async function downloadMediaResultOnce(
  rawUrl: string,
  options: { kind: "image" | "video"; maxBytes?: number; timeoutMs?: number; v4Fallback?: boolean },
): Promise<DownloadedMedia> {
  const maxBytes = options.maxBytes ?? (options.kind === "video" ? 800 * 1024 * 1024 : 40 * 1024 * 1024);
  let url = new URL(rawUrl);
  let response: PinnedHttpResponse | undefined;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      response = await openGet(url, options.timeoutMs ?? 120_000, options.v4Fallback !== false);
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        response.cancel();
        if (!location?.trim()) throw new Error("MCP_DOWNLOAD_REDIRECT_INVALID");
        url = new URL(location, url);
        continue;
      }
      break;
    }
    if (!response || response.status < 200 || response.status >= 300 || !response.body) {
      throw new Error(`MCP_DOWNLOAD_FAILED:${response?.status ?? "no-response"}`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    const expected = options.kind === "video" ? /^(video\/|application\/octet-stream)/ : /^image\//;
    if (!expected.test(contentType)) throw new Error(`MCP_RESULT_TYPE_MISMATCH:${contentType}`);
    if (Number(response.headers.get("content-length")) > maxBytes) throw new Error("MCP_DOWNLOAD_TOO_LARGE");
    return await writeMediaResult(response, url, contentType, maxBytes);
  } finally { response?.cancel(); }
}

async function writeMediaResult(response: PinnedHttpResponse, url: URL, contentType: string, maxBytes: number): Promise<DownloadedMedia> {
  const dir = await mkdtemp(join(tmpdir(), "ima2-mcp-dl-"));
  const tempPath = join(dir, "result");
  let bytes = 0;
  try {
    const capped = async function* () {
      for await (const chunk of response.body!) {
        bytes += chunk.byteLength;
        if (bytes > maxBytes) throw new Error("MCP_DOWNLOAD_TOO_LARGE");
        yield chunk;
      }
    };
    await pipeline(Readable.from(capped()), createWriteStream(tempPath));
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
  return {
    tempPath,
    contentType,
    bytes,
    sanitizedUrl: `${url.origin}${url.pathname}`,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}

/** Retain IPv4 preference and one optional network fallback without fresh DNS. */
async function openGet(url: URL, timeoutMs: number, v4Fallback: boolean) {
  let target: PinnedHttpTarget | undefined;
  try {
    return await timedGet(async (signal) => {
      target = await resolvePublicHttps(url, signal);
      return target;
    }, timeoutMs);
  } catch (error) {
    if (!v4Fallback || !target?.addresses.some(({ family }) => family === 4) || !isRetryableDownloadError(error)) throw error;
    return timedGet(async () => target!, timeoutMs, 4);
  }
}

async function timedGet(resolve: (signal: AbortSignal) => Promise<PinnedHttpTarget>, timeoutMs: number, family?: 4) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("MCP_DOWNLOAD_TIMEOUT")), timeoutMs);
  try {
    const target = await resolve(controller.signal);
    const response = await pinnedHttpGet(target, controller.signal, family ? { family } : {});
    return { ...response, cancel: (reason?: Error) => { clearTimeout(timer); response.cancel(reason); } };
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
}
