import { request as httpRequest, type ClientRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { resolvePublicDownloadTarget } from "./grokImageDownloadPolicy.js";
import type { Readable } from "node:stream";

export interface PinnedHttpTarget {
  url: URL;
  addresses: readonly { address: string; family: 4 | 6 }[];
}

export interface PinnedHttpResponse {
  url: string;
  status: number;
  headers: { get(name: string): string | null };
  body: Readable | null;
  cancel(reason?: Error): void;
}

export class PinnedGetFailure extends Error {}

function pinnedLookup(target: PinnedHttpTarget): LookupFunction {
  const hostname = target.url.hostname.replace(/^\[|\]$/g, "");
  return (host, options, callback) => {
    const family = options.family === "IPv4" ? 4 : options.family === "IPv6" ? 6 : options.family || 0;
    const addresses = target.addresses.filter((address) => !family || address.family === family);
    const first = addresses[0];
    if (host !== hostname || !first || (family !== 0 && family !== 4 && family !== 6)) {
      callback(new PinnedGetFailure("Image download address selection failed"), []);
      return;
    }
    if (options.all) callback(null, addresses.map((address) => ({ ...address })));
    else callback(null, first.address, first.family);
  };
}

/** Own error-event handling independently of the already-settled header promise. */
class PinnedGetLifecycle {
  request: ClientRequest | undefined;
  response: IncomingMessage | undefined;
  stopped = false;
  private headersReceived = false;
  private readonly onAbort: () => void;

  constructor(
    private readonly signal: AbortSignal,
    private readonly requestUrl: string,
    private readonly resolve: (response: PinnedHttpResponse) => void,
    private readonly reject: (error: unknown) => void,
  ) {
    this.onAbort = () => {
      this.reject(signal.reason);
      this.cancel(signal.reason instanceof Error ? signal.reason : undefined);
    };
    signal.addEventListener("abort", this.onAbort, { once: true });
    if (signal.aborted) this.onAbort();
  }

  cancel = (reason?: Error): void => {
    if (this.stopped) return;
    this.stopped = true;
    this.signal.removeEventListener("abort", this.onAbort);
    this.response?.destroy(reason);
    this.request?.destroy(reason);
  };

  fail = (error: unknown): void => {
    this.reject(error); // Raw pre-header reset/EPIPE must reach the real retry classifier.
    this.cancel(error instanceof Error ? error : undefined);
  };

  attach(request: ClientRequest): void {
    this.request = request;
    request.on("error", this.fail);
    // Keep the response handler available for a late response even after abort.
    request.on("response", this.accept);
    request.once("close", () => {
      request.removeListener("error", this.fail);
      if (!this.headersReceived && !this.stopped) {
        this.fail(new PinnedGetFailure("Image download closed before response"));
      }
    });
    if (this.stopped) request.destroy();
  }

  private accept = (response: IncomingMessage): void => {
    const onError = (error: Error) => this.fail(error);
    response.on("error", onError);
    response.once("close", () => response.removeListener("error", onError));
    if (this.stopped || this.signal.aborted || this.headersReceived) {
      response.destroy();
      return;
    }
    this.response = response;
    this.headersReceived = true;
    this.resolve({
      url: this.requestUrl,
      status: response.statusCode ?? 0,
      headers: { get: (name) => {
        const value = response.headers[name.toLowerCase()];
        return Array.isArray(value) ? value.join(", ") : value ?? null;
      } },
      body: response,
      cancel: this.cancel,
    });
  };
}

export async function pinnedHttpGet(target: PinnedHttpTarget, signal: AbortSignal, options: { headers?: Record<string, string>; family?: 4 | 6 } = {}): Promise<PinnedHttpResponse> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const lifecycle = new PinnedGetLifecycle(signal, target.url.href, resolve, reject);
    try {
      if (lifecycle.stopped) return;
      const hostname = target.url.hostname.replace(/^\[|\]$/g, "");
      const request = target.url.protocol === "https:" ? httpsRequest : httpRequest;
      lifecycle.attach(request(target.url, {
        method: "GET", agent: false, signal,
        headers: { ...options.headers, Host: target.url.host },
        ...(options.family ? { family: options.family } : {}),
        lookup: pinnedLookup(target),
        ...(isIP(hostname) ? {} : { servername: hostname }),
      }));
      if (!lifecycle.stopped) lifecycle.request?.end();
    } catch (error) {
      lifecycle.fail(error);
    }
  });
}

const MAX_PUBLIC_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** Public consumers cannot opt into Grok's configured proxy exception. */
export async function publicPinnedHttpGet(
  rawUrl: string, signal: AbortSignal, validateUrl: (url: string) => void,
  headers?: Record<string, string>,
): Promise<PinnedHttpResponse> {
  let url = new URL(rawUrl);
  try {
    for (let hop = 0; ; hop++) {
      signal.throwIfAborted();
      validateUrl(url.href); // Includes scheme/allowhost, before DNS and every socket.
      const target = await resolvePublicDownloadTarget(url, signal);
      const response = await pinnedHttpGet(target, signal, headers ? { headers } : {});
      if (!REDIRECT_STATUSES.has(response.status)) return response;
      try {
        const location = response.headers.get("location");
        if (!location?.trim() || hop >= MAX_PUBLIC_REDIRECTS) throw new Error("PINNED_GET_REDIRECT_REFUSED");
        url = new URL(location, url);
      } finally { response.cancel(); }
    }
  } catch (error) { throw error; }
}

export class PinnedBodyTooLarge extends Error {
  constructor() { super("Remote file is too large"); }
}

/** Bound bytes while streaming, including absent or dishonest Content-Length. */
export async function readPinnedBody(response: PinnedHttpResponse, maxBytes: number): Promise<Buffer> {
  try {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new PinnedBodyTooLarge();
    if (Number(response.headers.get("content-length")) > maxBytes) throw new PinnedBodyTooLarge();
    const chunks: Buffer[] = [];
    let total = 0;
    if (response.body) for await (const chunk of response.body) {
      total += chunk.byteLength;
      if (total > maxBytes) throw new PinnedBodyTooLarge();
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks, total); // Empty text remains a valid import input.
  } catch (error) { throw error; }
  finally { response.cancel(); }
}
