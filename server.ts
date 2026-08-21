import "dotenv/config";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { readFile } from "fs/promises";
import {
  existsSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
  readFileSync as fsReadFileSync,
} from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { onShutdown } from "./bin/lib/platform.js";
import { ensureDefaultSession } from "./lib/sessionStore.js";
import { startGrokProxy } from "./lib/grokProxyLauncher.js";
import { startOAuthProxy } from "./lib/oauthLauncher.js";
import { migrateGeneratedStorage } from "./lib/storageMigration.js";
import { purgeStaleJobs } from "./lib/inflight.js";
import { configureLogger, logError } from "./lib/logger.js";
import { createRequestLogger } from "./lib/requestLogger.js";
import { configureApiCachePolicy } from "./lib/apiCachePolicy.js";
import { configureRoutes } from "./routes/index.js";
import { config } from "./config.js";
import { getServerPort, listenWithPortFallback } from "./lib/runtimePorts.js";
import { shutdownServerAndMcp, startMcpRestoreAfterListen } from "./lib/mcp/shutdown.js";
import type { RuntimeContext, RuntimeContextOverrides, ApiKeySource } from "./lib/runtimeContext.js";

import { closeDb } from "./lib/db.js";
import { stopAgentQueueWorker } from "./lib/agentQueueWorker.js";
import { reapCardNewsJobs } from "./lib/cardNewsJobStore.js";
import { reapTerminalJobs } from "./lib/inflight.js";
import { errInfo } from "./lib/errInfo.js";
import { timingSafeEqual } from "node:crypto";
import {
  cleanupExpiredMcpTempReferences,
  MCP_TEMP_REFERENCE_JSON_BODY_LIMIT_BYTES,
  MCP_TEMP_REFERENCE_SWEEP_INTERVAL_MS,
} from "./lib/mcpTempReferenceStore.js";

type BootRuntimeContext = RuntimeContext & {
  markGrokProxyPort: (info?: { url?: string; port?: number }) => void;
  markOAuthReady: (info?: { url?: string; port?: number }) => void;
  markOAuthFailed: () => void;
};

type ApiKeyLoadResult = { apiKey: string | null; apiKeySource: ApiKeySource };

const rootDir = dirname(fileURLToPath(import.meta.url));

async function loadApiKey(): Promise<ApiKeyLoadResult> {
  if (process.env.OPENAI_API_KEY) {
    return { apiKey: process.env.OPENAI_API_KEY, apiKeySource: "env" };
  }
  const candidates = [
    config.storage.configFile,
    join(rootDir, ".ima2", "config.json"),
  ];
  for (const cfgPath of candidates) {
    if (!existsSync(cfgPath)) continue;
    try {
      const cfg = JSON.parse(await readFile(cfgPath, "utf-8")) as { apiKey?: string };
      if (cfg.apiKey) return { apiKey: cfg.apiKey, apiKeySource: "config" };
    } catch {}
  }
  return { apiKey: null, apiKeySource: "none" };
}

async function loadXaiApiKey(): Promise<ApiKeyLoadResult> {
  if (process.env.XAI_API_KEY) {
    return { apiKey: process.env.XAI_API_KEY, apiKeySource: "env" };
  }
  const candidates = [
    config.storage.configFile,
    join(rootDir, ".ima2", "config.json"),
  ];
  for (const cfgPath of candidates) {
    if (!existsSync(cfgPath)) continue;
    try {
      const cfg = JSON.parse(await readFile(cfgPath, "utf-8")) as { xaiApiKey?: string };
      if (cfg.xaiApiKey) return { apiKey: cfg.xaiApiKey, apiKeySource: "config" };
    } catch {}
  }
  return { apiKey: null, apiKeySource: "none" };
}

async function loadGeminiApiKey(): Promise<ApiKeyLoadResult> {
  if (process.env.GEMINI_API_KEY) {
    return { apiKey: process.env.GEMINI_API_KEY, apiKeySource: "env" };
  }
  const candidates = [
    config.storage.configFile,
    join(rootDir, ".ima2", "config.json"),
  ];
  for (const cfgPath of candidates) {
    if (!existsSync(cfgPath)) continue;
    try {
      const cfg = JSON.parse(await readFile(cfgPath, "utf-8")) as { geminiApiKey?: string };
      if (cfg.geminiApiKey) return { apiKey: cfg.geminiApiKey, apiKeySource: "config" };
    } catch {}
  }
  return { apiKey: null, apiKeySource: "none" };
}

async function loadAtlasCloudApiKey(): Promise<ApiKeyLoadResult> {
  if (process.env.ATLASCLOUD_API_KEY) {
    return { apiKey: process.env.ATLASCLOUD_API_KEY, apiKeySource: "env" };
  }
  const candidates = [
    config.storage.configFile,
    join(rootDir, ".ima2", "config.json"),
  ];
  for (const cfgPath of candidates) {
    if (!existsSync(cfgPath)) continue;
    try {
      const cfg = JSON.parse(await readFile(cfgPath, "utf-8")) as { atlasCloudApiKey?: string };
      if (cfg.atlasCloudApiKey) return { apiKey: cfg.atlasCloudApiKey, apiKeySource: "config" };
    } catch {}
  }
  return { apiKey: null, apiKeySource: "none" };
}

async function loadMinimaxApiKey(): Promise<ApiKeyLoadResult> {
  if (process.env.MINIMAX_API_KEY) {
    return { apiKey: process.env.MINIMAX_API_KEY, apiKeySource: "env" };
  }
  const candidates = [
    config.storage.configFile,
    join(rootDir, ".ima2", "config.json"),
  ];
  for (const cfgPath of candidates) {
    if (!existsSync(cfgPath)) continue;
    try {
      const cfg = JSON.parse(await readFile(cfgPath, "utf-8")) as { minimaxApiKey?: string };
      if (cfg.minimaxApiKey) return { apiKey: cfg.minimaxApiKey, apiKeySource: "config" };
    } catch {}
  }
  return { apiKey: null, apiKeySource: "none" };
}

type VertexKeyLoadResult = { json: string | null; projectId: string | null; source: ApiKeySource };

async function loadVertexKey(): Promise<VertexKeyLoadResult> {
  const envJson = process.env.VERTEX_SERVICE_ACCOUNT_JSON;
  if (envJson) {
    try {
      const parsed = JSON.parse(envJson);
      return { json: envJson, projectId: parsed.project_id || null, source: "env" };
    } catch {
      return { json: null, projectId: null, source: "none" };
    }
  }
  const candidates = [
    config.storage.configFile,
    join(rootDir, ".ima2", "config.json"),
  ];
  for (const cfgPath of candidates) {
    if (!existsSync(cfgPath)) continue;
    try {
      const cfg = JSON.parse(await readFile(cfgPath, "utf-8")) as { vertexServiceAccountJson?: string };
      if (cfg.vertexServiceAccountJson) {
        const parsed = JSON.parse(cfg.vertexServiceAccountJson);
        return { json: cfg.vertexServiceAccountJson, projectId: parsed.project_id || null, source: "config" };
      }
    } catch {}
  }
  return { json: null, projectId: null, source: "none" };
}

async function loadGeminiAuthMode(): Promise<string | undefined> {
  const candidates = [
    config.storage.configFile,
    join(rootDir, ".ima2", "config.json"),
  ];
  for (const cfgPath of candidates) {
    if (!existsSync(cfgPath)) continue;
    try {
      const cfg = JSON.parse(await readFile(cfgPath, "utf-8")) as { geminiAuthMode?: string };
      if (cfg.geminiAuthMode === "vertex" || cfg.geminiAuthMode === "apikey") return cfg.geminiAuthMode;
    } catch {}
  }
  return undefined;
}

async function createOpenAI(apiKey: string | null | undefined) {
  if (!apiKey) return null;
  const OpenAI = (await import("openai")).default;
  return new OpenAI({ apiKey });
}

function readPackageVersion(): string {
  try {
    return (JSON.parse(fsReadFileSync(join(rootDir, "package.json"), "utf-8")) as { version?: string }).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function setUiStaticHeaders(res: Response, filePath: string) {
  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.endsWith("/index.html")) {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return;
  }
  if (normalized.includes("/assets/")) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  }
}

export function isLoopbackHost(host: string | undefined): boolean {
  const normalized = String(host || "").trim().toLowerCase();
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "localhost";
}

export function assertLanAccessConfiguration(host: string | undefined, token: string | undefined): void {
  if (isLoopbackHost(host) || token) return;
  const message = `[server.security] Refusing non-loopback host ${host || "<empty>"}: set IMA2_LAN_TOKEN to enable LAN access.`;
  console.error(message);
  throw new Error(message);
}

function tokenMatches(actual: unknown, expected: string): boolean {
  if (typeof actual !== "string") return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function createLanApiGuard(host: string | undefined, token: string | undefined) {
  const requiredToken = isLoopbackHost(host) ? "" : String(token || "");
  return function lanApiGuard(req: Request, res: Response, next: NextFunction) {
    if (!requiredToken || !req.path.startsWith("/api")) return next();
    // OAuth redirect endpoints are conventionally unauthenticated: the provider's
    // browser redirect cannot carry x-ima2-token. Security boundary for this single
    // path is the single-use unguessable OAuth state + PKCE (030 WP3 audit round 2);
    // an invalid state is rejected with 400 before any token exchange.
    if (req.path === "/api/mcp/oauth/callback") return next();
    const supplied = req.get("x-ima2-token") ?? req.query.token;
    if (tokenMatches(supplied, requiredToken)) return next();
    return res.status(401).json({
      error: { code: "LAN_TOKEN_REQUIRED", message: "A valid IMA2 LAN token is required" },
    });
  };
}

export function buildApp(ctx: RuntimeContext) {
  const app = express();
  configureApiCachePolicy(app);
  configureLogger({ level: ctx.config.log.level });
  app.use(createRequestLogger());
  app.use(createLanApiGuard(ctx.config.server.host, ctx.config.server.lanToken));
  app.use("/api/mcp/temp-references", express.json({ limit: MCP_TEMP_REFERENCE_JSON_BODY_LIMIT_BYTES }));
  app.use(express.json({ limit: ctx.config.server.bodyLimit }));
  app.use(express.static(join(ctx.rootDir, "ui", "dist"), {
    setHeaders: setUiStaticHeaders,
  }));
  app.use("/assets", (_req, res) => {
    res.status(404).type("text/plain").send("Asset not found");
  });
  app.use("/generated", (req, res, next) => {
    if (req.path.endsWith(".json")) return res.status(404).type("text/plain").send("Generated metadata is not public");
    return next();
  }, express.static(ctx.config.storage.generatedDir, {
    maxAge: ctx.config.storage.staticMaxAge,
    immutable: true,
  }));
  configureRoutes(app, ctx);
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const info = errInfo(error);
    const candidateStatus = Number(info.status);
    const operational = Boolean((error as any)?.isOperational)
      || (Number.isInteger(candidateStatus) && candidateStatus >= 400 && candidateStatus < 500);
    const status = operational ? candidateStatus : 500;
    if (!operational) logError("server", "unhandled:error", error);
    res.status(status).json({
      error: {
        code: operational && info.code ? info.code : "INTERNAL_ERROR",
        message: operational ? info.message : "Internal server error",
      },
    });
  });
  return app;
}

function runtimeHostUrl(host: string | undefined): string {
  if (!host || host === "0.0.0.0" || host === "::") return "localhost";
  return host;
}

/**
 * Pure payload builder, exported so the liveness contract is testable without
 * booting a server or spawning a real progrok child.
 *
 * The grok section only carries an endpoint while a supervised child is actually
 * listening. Publishing `actualPort`/`url` for a dead child is a claim the file
 * cannot back up, so those go null and `configuredPort` stays for diagnostics.
 */
export function buildAdvertisePayload(ctx: RuntimeContext) {
  const grokLive = ctx.grokProxyLive === true;
  return {
    port: Number(ctx.serverActualPort || ctx.config.server.port),
    url: ctx.serverUrl,
    pid: process.pid,
    startedAt: ctx.startedAt,
    version: ctx.packageVersion,
    adminNonce: ctx.adminNonce,
    backend: {
      configuredPort: Number(ctx.serverConfiguredPort || ctx.config.server.port),
      actualPort: Number(ctx.serverActualPort || ctx.config.server.port),
      url: ctx.serverUrl,
    },
    oauth: {
      configuredPort: Number(ctx.oauthPort),
      actualPort: Number(ctx.oauthActualPort || ctx.oauthPort),
      url: ctx.oauthUrl,
      status: ctx.oauthReadyState,
    },
    grok: {
      configuredPort: Number(ctx.grokPort),
      actualPort: grokLive ? Number(ctx.grokActualPort || ctx.grokPort) : null,
      url: grokLive ? ctx.grokUrl : null,
      live: grokLive,
    },
  };
}

function advertise(ctx: RuntimeContext) {
  // Proxy readiness can arrive before the backend has bound. Publishing that
  // intermediate state makes consumers treat the configured port as live.
  if (!ctx.serverActualPort) return;
  try {
    mkdirSync(dirname(ctx.config.storage.advertiseFile), { recursive: true });
    writeFileSync(
      ctx.config.storage.advertiseFile,
      JSON.stringify(buildAdvertisePayload(ctx)),
    );
  } catch (e) {
    const err = errInfo(e);
    console.warn("[advertise] skipped:", err.message);
  }
}

function unadvertise(ctx: RuntimeContext) {
  try {
    if (!existsSync(ctx.config.storage.advertiseFile)) return;
    const cur = JSON.parse(fsReadFileSync(ctx.config.storage.advertiseFile, "utf-8")) as { pid?: number };
    if (cur.pid === process.pid) unlinkSync(ctx.config.storage.advertiseFile);
  } catch {}
}

type StartServerOverrides = RuntimeContextOverrides & {
  startedAt?: number;
  packageVersion?: string;
  oauthChild?: { stop?: () => void; kill?: () => void } | null;
};

export async function createRuntimeContext(overrides: StartServerOverrides = {}): Promise<BootRuntimeContext> {
  const loadedKey =
    overrides.apiKey !== undefined
      ? {
          apiKey: overrides.apiKey,
          apiKeySource: overrides.apiKeySource ?? (overrides.apiKey ? "env" : "none"),
        }
      : await loadApiKey();
  const loadedXaiKey = await loadXaiApiKey();
  const loadedGeminiKey = await loadGeminiApiKey();
  const loadedAtlasCloudKey = await loadAtlasCloudApiKey();
  const loadedMinimaxKey = await loadMinimaxApiKey();
  const loadedVertexKey = await loadVertexKey();
  const geminiAuthMode = await loadGeminiAuthMode();
  const apiKey = loadedKey.apiKey;
  const openai = overrides.openai ?? await createOpenAI(apiKey);
  const oauthPort = config.oauth.proxyPort;
  const grokPort = config.grokProvider.proxyPort;
  let resolveOAuthReady: (value: string | null) => void = () => {};
  const oauthReadyPromise = new Promise<string | null>((resolve) => {
    resolveOAuthReady = resolve;
  });
  const ctx: BootRuntimeContext = {
    rootDir,
    config,
    serverConfiguredPort: config.server.port,
    serverActualPort: undefined,
    serverUrl: `http://${runtimeHostUrl(config.server.host)}:${config.server.port}`,
    grokPort,
    grokActualPort: grokPort,
    grokUrl: `http://${config.grokProvider.proxyHost}:${grokPort}/v1`,
    oauthPort,
    oauthActualPort: oauthPort,
    oauthUrl: `http://127.0.0.1:${oauthPort}`,
    oauthReadyState: config.oauth.autoStart ? "starting" : "disabled",
    hasApiKey: !!apiKey,
    apiKey: apiKey ?? undefined,
    apiKeySource: loadedKey.apiKeySource as ApiKeySource,
    openai,
    startedAt: overrides.startedAt ?? Date.now(),
    packageVersion: overrides.packageVersion ?? readPackageVersion(),
    adminNonce: randomUUID(),
    xaiApiKey: loadedXaiKey.apiKey ?? undefined,
    xaiApiKeySource: loadedXaiKey.apiKeySource as ApiKeySource,
    hasXaiApiKey: !!loadedXaiKey.apiKey,
    geminiApiKey: loadedGeminiKey.apiKey ?? undefined,
    geminiApiKeySource: loadedGeminiKey.apiKeySource as ApiKeySource,
    hasGeminiApiKey: !!loadedGeminiKey.apiKey,
    atlasCloudApiKey: loadedAtlasCloudKey.apiKey ?? undefined,
    atlasCloudApiKeySource: loadedAtlasCloudKey.apiKeySource as ApiKeySource,
    hasAtlasCloudApiKey: !!loadedAtlasCloudKey.apiKey,
    minimaxApiKey: loadedMinimaxKey.apiKey ?? undefined,
    minimaxApiKeySource: loadedMinimaxKey.apiKeySource as ApiKeySource,
    hasMinimaxApiKey: !!loadedMinimaxKey.apiKey,
    vertexServiceAccountJson: loadedVertexKey.json ?? undefined,
    vertexProjectId: loadedVertexKey.projectId ?? undefined,
    hasVertexKey: !!loadedVertexKey.json,
    geminiAuthMode,
    oauthReadyPromise: oauthReadyPromise as unknown as Promise<void>,
    markGrokProxyPort: ({ url, port }: { url?: string; port?: number } = {}) => {
      if (port) ctx.grokActualPort = port;
      if (url) ctx.grokUrl = url;
      else if (port) ctx.grokUrl = `http://${ctx.config.grokProvider.proxyHost}:${port}/v1`;
    },
    markOAuthReady: ({ url, port }: { url?: string; port?: number } = {}) => {
      if (url) ctx.oauthUrl = url;
      if (port) ctx.oauthActualPort = port;
      ctx.oauthReadyState = "ready";
      resolveOAuthReady(ctx.oauthUrl);
    },
    markOAuthFailed: () => {
      ctx.oauthReadyState = "failed";
      resolveOAuthReady(null);
    },
  };
  if (!config.oauth.autoStart) ctx.markOAuthReady({ url: ctx.oauthUrl, port: ctx.oauthPort });
  if (loadedVertexKey.json) {
    try {
      const { initVertexAuth } = await import("./lib/vertexAuth.js");
      initVertexAuth(loadedVertexKey.json);
    } catch { /* vertex init failure is non-fatal */ }
  }
  return ctx;
}

export async function startServer(overrides: StartServerOverrides = {}) {
  const ctx = await createRuntimeContext(overrides);
  assertLanAccessConfiguration(ctx.config.server.host, ctx.config.server.lanToken);
  await migrateGeneratedStorage(ctx);
  try {
    await cleanupExpiredMcpTempReferences(ctx.config.storage.generatedDir);
  } catch (error) {
    console.warn("[mcp.temp-references] startup cleanup failed:", errInfo(error).message);
  }
  purgeStaleJobs();
  const app = buildApp(ctx);
  const oauthChild =
    overrides.oauthChild !== undefined
      ? overrides.oauthChild
      : !ctx.config.oauth.autoStart
        ? null
        : startOAuthProxy({
            oauthPort: ctx.oauthPort,
            restartDelayMs: ctx.config.oauth.restartDelayMs,
            onReady: ({ url, port }: { url: string; port: number }) => {
              ctx.markOAuthReady({ url, port });
              advertise(ctx);
            },
            onExit: () => ctx.markOAuthFailed(),
          });
  if (overrides.oauthChild !== undefined || !ctx.config.oauth.autoStart) {
    ctx.markOAuthReady({ url: ctx.oauthUrl, port: ctx.oauthPort });
  }
  const grokChild = ctx.config.grokProvider.autoStart
    ? await startGrokProxy({
        host: ctx.config.grokProvider.proxyHost,
        port: ctx.config.grokProvider.proxyPort,
        restartDelayMs: ctx.config.grokProvider.restartDelayMs,
        onPortSelected: ({ url, port }: { url: string; port: number }) => {
          ctx.markGrokProxyPort({ url, port });
          // Port selection is an intent to bind, not a successful bind.
          ctx.grokProxyLive = false;
          advertise(ctx);
        },
        onReady: ({ url, port }: { url: string; port: number }) => {
          ctx.markGrokProxyPort({ url, port });
          ctx.grokProxyLive = true;
          advertise(ctx);
        },
        onExit: () => {
          // Without this the advertise file keeps publishing the port of a child
          // that is already gone.
          ctx.grokProxyLive = false;
          advertise(ctx);
        },
      })
    : null;
  ctx.grokProxy = grokChild ?? undefined;

  let server: import("node:net").Server;
  let reapTimer: NodeJS.Timeout;
  let tempReferenceReapTimer: NodeJS.Timeout | undefined;

  onShutdown(async () => {
    unadvertise(ctx);
    try { oauthChild?.stop?.(); } catch {}
    try { oauthChild?.kill?.(); } catch {}
    try { grokChild?.stop?.(); } catch {}
    try { grokChild?.kill?.(); } catch {}
    stopAgentQueueWorker();
    clearInterval(reapTimer);
    if (tempReferenceReapTimer) clearInterval(tempReferenceReapTimer);
    await shutdownServerAndMcp({
      closeServer: () => new Promise<void>((resolve) => {
        if (server) server.close(() => resolve()); else resolve();
      }),
      shutdownMcp: () => ctx.mcpConnectionManager?.shutdown() ?? Promise.resolve(),
    });
    closeDb();
  });
  process.on("exit", () => unadvertise(ctx));

  server = await listenWithPortFallback(app, ctx.config.server.port, {
    host: ctx.config.server.host,
    label: "server",
    onFallback: ({ requestedPort, actualPort }: { requestedPort: number; actualPort: number }) => {
      console.log(`[server.port] requested=${requestedPort} actual=${actualPort} reason=EADDRINUSE`);
    },
  });
  ctx.serverActualPort = getServerPort(server) || ctx.config.server.port;
  ctx.serverUrl = `http://${runtimeHostUrl(ctx.config.server.host)}:${ctx.serverActualPort}`;
  void startMcpRestoreAfterListen(ctx).catch((error) => {
    console.warn(`[mcp.restore] code=${String((error as Error)?.message ?? error).split(":")[0]}`);
  });
  console.log(`Image Gen running at ${ctx.serverUrl}`);
  console.log(`Provider policy: GPT OAuth, API-key Responses, and Grok Images providers. GPT OAuth proxy port ${ctx.oauthPort}; Grok proxy port ${ctx.grokActualPort || ctx.grokPort}.`);
  advertise(ctx);
  try {
    const s = ensureDefaultSession();
    if (s) console.log(`[db] default session: ${s.id} (${s.title})`);
  } catch (e) {
    const err = errInfo(e);
    console.error("[db] bootstrap failed:", err.message);
  }

  // Background thumbnail backfill for updated users (recursive — covers video
  // series subdirectories like continuous_*/clip_NN.mp4, not just top level).
  (async () => {
    try {
      const { backfillThumbnails } = await import("./lib/thumbBackfill.js");
      const r = await backfillThumbnails(ctx.config.storage.generatedDir);
      if (r.created > 0) {
        console.log(`[thumbs] backfill: ${r.created} created, ${r.skipped} skipped, ${r.failed} failed (${r.total} media files)`);
        const { invalidateHistoryIndex } = await import("./lib/historyIndex.js");
        invalidateHistoryIndex();
      }
    } catch (e) {
      console.warn("[thumbs] backfill failed:", e instanceof Error ? e.message : e);
    }
  })();

  server.on("error", (err: NodeJS.ErrnoException) => {
    console.error("[server] Failed to start:", err?.message || err);
    process.exit(1);
  });

  reapTimer = setInterval(() => {
    reapTerminalJobs();
    reapCardNewsJobs();
  }, 60_000);
  reapTimer.unref?.();

  tempReferenceReapTimer = setInterval(() => {
    cleanupExpiredMcpTempReferences(ctx.config.storage.generatedDir).catch((error) => {
      console.warn("[mcp.temp-references] hourly cleanup failed:", errInfo(error).message);
    });
  }, MCP_TEMP_REFERENCE_SWEEP_INTERVAL_MS);
  tempReferenceReapTimer.unref?.();

  process.on("uncaughtException", (err) => {
    console.error("[fatal] uncaughtException:", err);
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    console.error("[fatal] unhandledRejection:", reason);
  });

  return { app, server, oauthChild, ctx };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startServer();
}
