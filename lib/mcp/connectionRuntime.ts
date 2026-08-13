import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { legacyEndpointForProvider, type ServerOAuthProvider } from "./oauthProvider.js";
import { inspectTokenRecord, type McpTokenInspection } from "./tokenStore.js";
import type { McpConnectionStatus } from "./types.js";

export interface ProviderSession {
  state: McpConnectionStatus["state"];
  client?: Client;
  transport?: StreamableHTTPClientTransport;
  authorizationUrl?: string;
  detail?: string;
  connectedAt?: string;
  toolCount?: number;
  snapshotDiff?: { drifted: string[]; missing: string[]; added: string[] };
  identity?: McpConnectionIdentity;
  expectedClose?: boolean;
}

export interface PendingAuth {
  provider: string;
  generation: number;
  transport: StreamableHTTPClientTransport;
  expiresAt: number;
}

export interface McpConnectionManagerOptions {
  enabledProviders: string[];
  tokenDir: string;
  getOrigin: () => string;
  now?: () => number;
  pendingAuthTtlMs?: number;
  restoreTimeoutMs?: number;
  reconnectDelayMs?: number;
  transportFactory?: (endpoint: string, authProvider: ServerOAuthProvider) => StreamableHTTPClientTransport;
  clientFactory?: () => Client;
}

export function publicStatus(provider: string, session?: ProviderSession): McpConnectionStatus {
  if (!session) return { provider, state: "disconnected" };
  return {
    provider,
    state: session.state,
    ...(session.authorizationUrl ? { authorizationUrl: session.authorizationUrl } : {}),
    ...(session.detail ? { detail: session.detail } : {}),
    ...(session.toolCount !== undefined ? { toolCount: session.toolCount } : {}),
    ...(session.connectedAt ? { connectedAt: session.connectedAt } : {}),
    ...(session.snapshotDiff ? { snapshotDiff: session.snapshotDiff } : {}),
  };
}

export function addCandidate<T>(map: Map<string, Set<T>>, provider: string, value: T): void {
  const set = map.get(provider) ?? new Set<T>();
  set.add(value);
  map.set(provider, set);
}

export function removeCandidate<T>(map: Map<string, Set<T>>, provider: string, value: T): void {
  const set = map.get(provider);
  set?.delete(value);
  if (set?.size === 0) map.delete(provider);
}

export function inspectRestore(
  tokenDir: string,
  provider: string,
  endpoint: string,
  origin: string,
): McpTokenInspection {
  return inspectTokenRecord(tokenDir, provider, {
    provider,
    endpoint,
    redirectOrigin: origin,
    legacyEndpoint: legacyEndpointForProvider(provider),
  });
}

export interface McpConnectionIdentity {
  generation: number;
  epoch: number;
}

export function sameConnection(
  left: McpConnectionIdentity | null | undefined,
  right: McpConnectionIdentity | null | undefined,
): boolean {
  return Boolean(left && right && left.generation === right.generation && left.epoch === right.epoch);
}

export function markSessionInvalid(
  session: ProviderSession | undefined,
  identity: McpConnectionIdentity | null,
  error: unknown,
): void {
  if (!(error instanceof UnauthorizedError) && !/unauthorized|connection closed/i.test(String((error as Error)?.message))) return;
  if (!sameConnection(session?.identity, identity)) return;
  session!.state = "offline";
  session!.detail = "MCP_SESSION_INVALID";
}

/** Pinned @modelcontextprotocol/sdk 1.29 retry-exhaustion contract. */
export function isTerminalTransportError(error: unknown): boolean {
  return String((error as Error)?.message ?? error).startsWith("Maximum reconnection attempts (");
}

export async function runBounded<T>(
  values: readonly T[],
  limit: number,
  worker: (value: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const next = async (): Promise<void> => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      const value = values[index];
      if (value === undefined) continue;
      await worker(value);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, () => next()));
}
