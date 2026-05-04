import "dotenv/config";
import express from "express";
import type { Response } from "express";
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
import { startOAuthProxy } from "./lib/oauthLauncher.js";
import { migrateGeneratedStorage } from "./lib/storageMigration.js";
import { purgeStaleJobs } from "./lib/inflight.js";
import { configureLogger } from "./lib/logger.js";
import { createRequestLogger } from "./lib/requestLogger.js";
import { configureRoutes } from "./routes/index.js";
import { config } from "./config.js";
import { getServerPort, listenWithPortFallback } from "./lib/runtimePorts.js";
import type { RuntimeContext, RuntimeContextOverrides, ApiKeySource } from "./lib/runtimeContext.js";

import { errInfo } from "./lib/errInfo.js";

type BootRuntimeContext = RuntimeContext & {
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

export function buildApp(ctx: RuntimeContext) {
  const app = express();
  configureLogger({ level: ctx.config.log.level });
  app.use(createRequestLogger());
  app.use(express.json({ limit: ctx.config.server.bodyLimit }));
  app.use(express.static(join(ctx.rootDir, "ui", "dist"), {
    setHeaders: setUiStaticHeaders,
  }));
  app.use("/assets", (_req, res) => {
    res.status(404).type("text/plain").send("Asset not found");
  });
  app.use("/generated", express.static(ctx.config.storage.generatedDir, {
    maxAge: ctx.config.storage.staticMaxAge,
    immutable: true,
  }));
  configureRoutes(app, ctx);
  return app;
}

function runtimeHostUrl(host: string | undefined): string {
  if (!host || host === "0.0.0.0" || host === "::") return "localhost";
  return host;
}

function advertise(ctx: RuntimeContext) {
  try {
    mkdirSync(dirname(ctx.config.storage.advertiseFile), { recursive: true });
    writeFileSync(
      ctx.config.storage.advertiseFile,
      JSON.stringify({
        port: Number(ctx.serverActualPort || ctx.config.server.port),
        url: ctx.serverUrl,
        pid: process.pid,
        startedAt: ctx.startedAt,
        version: ctx.packageVersion,
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
      }),
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
  const apiKey = loadedKey.apiKey;
  const openai = overrides.openai ?? await createOpenAI(apiKey);
  const oauthPort = config.oauth.proxyPort;
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
    oauthReadyPromise: oauthReadyPromise as unknown as Promise<void>,
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
  return ctx;
}

export async function startServer(overrides: StartServerOverrides = {}) {
  const ctx = await createRuntimeContext(overrides);
  await migrateGeneratedStorage(ctx);
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

  onShutdown(() => {
    unadvertise(ctx);
    try { oauthChild?.stop?.(); } catch {}
    try { oauthChild?.kill?.(); } catch {}
  });
  process.on("exit", () => unadvertise(ctx));

  const server = await listenWithPortFallback(app, ctx.config.server.port, {
    host: ctx.config.server.host,
    label: "server",
    onFallback: ({ requestedPort, actualPort }: { requestedPort: number; actualPort: number }) => {
      console.log(`[server.port] requested=${requestedPort} actual=${actualPort} reason=EADDRINUSE`);
    },
  });
  ctx.serverActualPort = getServerPort(server) || ctx.config.server.port;
  ctx.serverUrl = `http://${runtimeHostUrl(ctx.config.server.host)}:${ctx.serverActualPort}`;
  console.log(`Image Gen running at ${ctx.serverUrl}`);
  console.log(`Provider policy: OAuth and API-key Responses providers. OAuth proxy port ${ctx.oauthPort}.`);
  advertise(ctx);
  try {
    const s = ensureDefaultSession();
    console.log(`[db] default session: ${s.id} (${s.title})`);
  } catch (e) {
    const err = errInfo(e);
    console.error("[db] bootstrap failed:", err.message);
  }

  server.on("error", (err: NodeJS.ErrnoException) => {
    console.error("[server] Failed to start:", err?.message || err);
    process.exit(1);
  });

  return { app, server, oauthChild, ctx };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startServer();
}
