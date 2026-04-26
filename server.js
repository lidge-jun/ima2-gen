import "dotenv/config";
import express from "express";
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

const rootDir = dirname(fileURLToPath(import.meta.url));

async function loadApiKey() {
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
      const cfg = JSON.parse(await readFile(cfgPath, "utf-8"));
      if (cfg.apiKey) return { apiKey: cfg.apiKey, apiKeySource: "config" };
    } catch {}
  }
  return { apiKey: null, apiKeySource: "none" };
}

async function createOpenAI(apiKey) {
  if (!apiKey) return null;
  const OpenAI = (await import("openai")).default;
  return new OpenAI({ apiKey });
}

function readPackageVersion() {
  try {
    return JSON.parse(fsReadFileSync(join(rootDir, "package.json"), "utf-8")).version;
  } catch {
    return "0.0.0";
  }
}

function setUiStaticHeaders(res, filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.endsWith("/index.html")) {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return;
  }
  if (normalized.includes("/assets/")) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  }
}

export function buildApp(ctx) {
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

function runtimeHostUrl(host) {
  if (!host || host === "0.0.0.0" || host === "::") return "localhost";
  return host;
}

function advertise(ctx) {
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
    console.warn("[advertise] skipped:", e.message);
  }
}

function unadvertise(ctx) {
  try {
    if (!existsSync(ctx.config.storage.advertiseFile)) return;
    const cur = JSON.parse(fsReadFileSync(ctx.config.storage.advertiseFile, "utf-8"));
    if (cur.pid === process.pid) unlinkSync(ctx.config.storage.advertiseFile);
  } catch {}
}

export async function createRuntimeContext(overrides = {}) {
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
  const ctx = {
    rootDir,
    config,
    serverConfiguredPort: config.server.port,
    serverActualPort: null,
    serverUrl: `http://${runtimeHostUrl(config.server.host)}:${config.server.port}`,
    oauthPort,
    oauthActualPort: oauthPort,
    oauthUrl: `http://127.0.0.1:${oauthPort}`,
    oauthReadyState: config.oauth.autoStart ? "starting" : "disabled",
    hasApiKey: !!apiKey,
    apiKey,
    apiKeySource: loadedKey.apiKeySource,
    openai,
    startedAt: overrides.startedAt ?? Date.now(),
    packageVersion: overrides.packageVersion ?? readPackageVersion(),
  };
  let resolveOAuthReady;
  ctx.oauthReadyPromise = new Promise((resolve) => {
    resolveOAuthReady = resolve;
  });
  ctx.markOAuthReady = ({ url, port } = {}) => {
    if (url) ctx.oauthUrl = url;
    if (port) ctx.oauthActualPort = port;
    ctx.oauthReadyState = "ready";
    resolveOAuthReady(ctx.oauthUrl);
  };
  ctx.markOAuthFailed = () => {
    ctx.oauthReadyState = "failed";
    resolveOAuthReady(null);
  };
  if (!config.oauth.autoStart) ctx.markOAuthReady({ url: ctx.oauthUrl, port: ctx.oauthPort });
  return ctx;
}

export async function startServer(overrides = {}) {
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
            onReady: ({ url, port }) => {
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
    onFallback: ({ requestedPort, actualPort }) => {
      console.log(`[server.port] requested=${requestedPort} actual=${actualPort} reason=EADDRINUSE`);
    },
  });
  ctx.serverActualPort = getServerPort(server) || ctx.config.server.port;
  ctx.serverUrl = `http://${runtimeHostUrl(ctx.config.server.host)}:${ctx.serverActualPort}`;
  console.log(`Image Gen running at ${ctx.serverUrl}`);
  console.log(`Provider policy: OAuth only (API key hard-disabled). OAuth proxy port ${ctx.oauthPort}.`);
  advertise(ctx);
  try {
    const s = ensureDefaultSession();
    console.log(`[db] default session: ${s.id} (${s.title})`);
  } catch (err) {
    console.error("[db] bootstrap failed:", err.message);
  }

  server.on("error", (err) => {
    console.error("[server] Failed to start:", err?.message || err);
    process.exit(1);
  });

  return { app, server, oauthChild, ctx };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startServer();
}
