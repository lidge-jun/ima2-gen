import type OpenAI from "openai";
import { config as runtimeConfigDefault } from "../config.js";

export type AppConfig = typeof runtimeConfigDefault;
export type ApiKeySource = "env" | "oauth" | "config" | "none" | undefined;
export type OAuthReadyState = "starting" | "ready" | "failed" | "disabled" | undefined;

export interface RuntimeContext {
  apiKey: string | undefined;
  apiKeySource: ApiKeySource;
  config: AppConfig;
  hasApiKey: boolean;
  oauthActualPort: number | undefined;
  oauthPort: number;
  oauthReadyPromise: Promise<void> | null;
  oauthReadyState: OAuthReadyState;
  oauthUrl: string;
  openai: OpenAI | null;
  packageVersion: string;
  rootDir: string;
  serverActualPort: number | undefined;
  serverConfiguredPort: number;
  serverUrl: string;
  startedAt: number;
}

/** A partial used during boot when only some fields are known, or by callers
 *  threading ctx through layered APIs (oauth/responses adapters). */
export type RuntimeContextOverrides = Partial<RuntimeContext>;

/** Looser ctx shape for route registration helpers and tests, where callers
 *  often pass minimal nested config fixtures. Behaviour-preserving under the
 *  current non-strict-null tsconfig. */
export type RouteRuntimeContext =
  & Omit<Partial<RuntimeContext>, "config">
  & { config?: { [K in keyof AppConfig]?: Partial<AppConfig[K]> } };

/** Normalize a possibly-Partial RouteRuntimeContext into a strict RuntimeContext.
 *
 *  - Production routes/lib receive a fully-populated ctx at runtime, so missing
 *    fields here only happen in tests that pass minimal fixtures.
 *  - Missing config nests fall back to the real `runtimeConfig` import so deep
 *    consumers (storage paths, ports) keep working under tests.
 *
 *  Use this at the top of any function that crosses from `RouteRuntimeContext`
 *  into deep typed code. Per GPT Pro's P05 review: RouteRuntimeContext stays
 *  boundary-only; deep lib code should operate on strict RuntimeContext. */
export function requireRuntimeContext(ctx: RouteRuntimeContext | undefined): RuntimeContext {
  const baseConfig: AppConfig = (ctx?.config && Object.keys(ctx.config).length > 0
    ? (ctx.config as AppConfig)
    : runtimeConfigDefault);
  return {
    apiKey: ctx?.apiKey,
    apiKeySource: ctx?.apiKeySource,
    config: baseConfig,
    hasApiKey: ctx?.hasApiKey ?? false,
    oauthActualPort: ctx?.oauthActualPort,
    oauthPort: ctx?.oauthPort ?? baseConfig.oauth?.proxyPort ?? 11782,
    oauthReadyPromise: ctx?.oauthReadyPromise ?? null,
    oauthReadyState: ctx?.oauthReadyState,
    oauthUrl: ctx?.oauthUrl ?? `http://127.0.0.1:${baseConfig.oauth?.proxyPort ?? 11782}`,
    openai: ctx?.openai ?? null,
    packageVersion: ctx?.packageVersion ?? "0.0.0",
    rootDir: ctx?.rootDir ?? process.cwd(),
    serverActualPort: ctx?.serverActualPort,
    serverConfiguredPort: ctx?.serverConfiguredPort ?? baseConfig.server?.port ?? 11783,
    serverUrl: ctx?.serverUrl ?? `http://localhost:${ctx?.serverActualPort ?? baseConfig.server?.port ?? 11783}`,
    startedAt: ctx?.startedAt ?? Date.now(),
  };
}

/** Stub-friendly default for tests. Do NOT use in production boot paths. */
export function createTestRuntimeContext(over: RuntimeContextOverrides = {}): RuntimeContext {
  const now = Date.now();
  const base: RuntimeContext = {
    apiKey: undefined,
    apiKeySource: undefined,
    config: {} as AppConfig,
    hasApiKey: false,
    oauthActualPort: undefined,
    oauthPort: 11782,
    oauthReadyPromise: null,
    oauthReadyState: undefined,
    oauthUrl: "http://127.0.0.1:11782",
    openai: null,
    packageVersion: "0.0.0-test",
    rootDir: process.cwd(),
    serverActualPort: undefined,
    serverConfiguredPort: 11783,
    serverUrl: "http://127.0.0.1:11783",
    startedAt: now,
  };
  return { ...base, ...over };
}
