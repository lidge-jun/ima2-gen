/**
 * Grok transport runtime: where a Grok request goes and which credential it carries.
 *
 * Both Grok lanes call https://api.x.ai directly. They differ only in where the bearer
 * comes from: `grok` uses the xAI OAuth session in ~/.progrok/auth.json (lib/xaiAuth.ts),
 * `grok-api` uses the configured XAI_API_KEY. The bundled progrok proxy that used to sit
 * in front of the `grok` lane is no longer on the request path.
 *
 * MUST stay a leaf: imports only lib/xaiAuth.js and types. No config, routes, or adapters.
 */
import type { RouteRuntimeContext } from "./runtimeContext.js";
import { getGrokAccessToken, type XaiTokenRetryDeps } from "./xaiAuth.js";

export type GrokLane = "grok" | "grok-api";

export type GrokCredential =
  | { kind: "api-key"; key: string }
  | { kind: "oauth"; token: string };

export function getGrokDirectBaseUrl(): string {
  return "https://api.x.ai";
}

export function grokAuthHeaders(credential: GrokCredential): Record<string, string> {
  const bearer = credential.kind === "api-key" ? credential.key : credential.token;
  return { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` };
}

export function getGrokEndpoint(
  path = "/v1/images/generations",
  credential: GrokCredential,
): { url: string; headers: Record<string, string> } {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return { url: `${getGrokDirectBaseUrl()}${normalizedPath}`, headers: grokAuthHeaders(credential) };
}

export interface ResolveGrokCredentialOptions {
  forceRefresh?: boolean;
  /** The OAuth token that just got a 401; skips the refresh when the file already moved on. */
  rejectedAccessToken?: string;
  signal?: AbortSignal;
  deps?: XaiTokenRetryDeps;
}

function grokCredentialError(code: string, status: number, message: string): Error & { code: string; status: number } {
  return Object.assign(new Error(message), { code, status });
}

/**
 * The single place a Grok lane turns into a bearer. For `grok` this may refresh the OAuth
 * session, so it is async; GrokAuthError (GROK_AUTH_REQUIRED / GROK_AUTH_REFRESH_FAILED)
 * propagates unchanged. For `grok-api` a missing key is GROK_API_KEY_MISSING, the same code
 * the execution admission check emits.
 */
export async function resolveGrokCredential(
  ctx: RouteRuntimeContext,
  lane: GrokLane,
  opts: ResolveGrokCredentialOptions = {},
): Promise<GrokCredential> {
  if (lane === "grok-api") {
    const key = typeof ctx.xaiApiKey === "string" ? ctx.xaiApiKey.trim() : "";
    if (!key) throw grokCredentialError("GROK_API_KEY_MISSING", 401, "Grok API key is required for grok-api");
    return { kind: "api-key", key };
  }
  const token = await getGrokAccessToken({
    ...(opts.forceRefresh !== undefined ? { forceRefresh: opts.forceRefresh } : {}),
    ...(opts.rejectedAccessToken !== undefined ? { rejectedAccessToken: opts.rejectedAccessToken } : {}),
    ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
    ...(opts.deps !== undefined ? { deps: opts.deps } : {}),
    ...(ctx.grokAuthHomeDir !== undefined ? { homeDir: ctx.grokAuthHomeDir } : {}),
  });
  return { kind: "oauth", token };
}

/**
 * Runs `doFetch` with a fresh credential and, on a 401 from an OAuth bearer, refreshes
 * exactly once and replays. Nesting is fixed: this wrapper sits OUTSIDE grokFetchWithRetry
 * (the 5xx/reset retrier), which cannot rebuild headers itself. grokUpstreamRetry stays a
 * leaf and never sees credentials. A 401 arrives before any generation is billed, so the
 * single replay is safe even for the non-idempotent image and video-start calls.
 */
export async function fetchWithGrokAuth<R extends { status: number }>(
  ctx: RouteRuntimeContext,
  lane: GrokLane,
  doFetch: (credential: GrokCredential) => Promise<R>,
  opts: Pick<ResolveGrokCredentialOptions, "signal" | "deps"> = {},
): Promise<R> {
  const first = await resolveGrokCredential(ctx, lane, opts);
  const res = await doFetch(first);
  if (res.status !== 401 || first.kind !== "oauth") return res;
  const second = await resolveGrokCredential(ctx, lane, { ...opts, forceRefresh: true, rejectedAccessToken: first.token });
  return doFetch(second);
}
