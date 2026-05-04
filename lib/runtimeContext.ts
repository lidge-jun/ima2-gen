import type OpenAI from "openai";
import type { config as runtimeConfig } from "../config.js";

export type AppConfig = typeof runtimeConfig;
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
