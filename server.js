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
import { configureRoutes } from "./routes/index.js";
import { config } from "./config.js";

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

export function buildApp(ctx) {
  const app = express();
  app.use(express.json({ limit: ctx.config.server.bodyLimit }));
  app.use(express.static(join(ctx.rootDir, "ui", "dist")));
  app.use("/generated", express.static(ctx.config.storage.generatedDir, {
    maxAge: ctx.config.storage.staticMaxAge,
    immutable: true,
  }));
  configureRoutes(app, ctx);
  return app;
}

function advertise(ctx) {
  try {
    mkdirSync(dirname(ctx.config.storage.advertiseFile), { recursive: true });
    writeFileSync(
      ctx.config.storage.advertiseFile,
      JSON.stringify({
        port: Number(ctx.config.server.port),
        pid: process.pid,
        startedAt: ctx.startedAt,
        version: ctx.packageVersion,
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
  return {
    rootDir,
    config,
    oauthPort,
    oauthUrl: `http://127.0.0.1:${oauthPort}`,
    hasApiKey: !!apiKey,
    apiKey,
    apiKeySource: loadedKey.apiKeySource,
    openai,
    startedAt: overrides.startedAt ?? Date.now(),
    packageVersion: overrides.packageVersion ?? readPackageVersion(),
  };
}

export async function startServer(overrides = {}) {
  const ctx = await createRuntimeContext(overrides);
  await migrateGeneratedStorage(ctx);
  const app = buildApp(ctx);
  const oauthChild =
    overrides.oauthChild !== undefined
      ? overrides.oauthChild
      : !ctx.config.oauth.autoStart
        ? null
        : startOAuthProxy({
            oauthPort: ctx.oauthPort,
            restartDelayMs: ctx.config.oauth.restartDelayMs,
          });

  onShutdown(() => {
    unadvertise(ctx);
    try { oauthChild?.kill(); } catch {}
  });
  process.on("exit", () => unadvertise(ctx));

  const server = app.listen(ctx.config.server.port, () => {
    console.log(`Image Gen running at http://localhost:${ctx.config.server.port}`);
    console.log(`Provider policy: OAuth only (API key hard-disabled). OAuth proxy port ${ctx.oauthPort}.`);
    advertise(ctx);
    try {
      const s = ensureDefaultSession();
      console.log(`[db] default session: ${s.id} (${s.title})`);
    } catch (err) {
      console.error("[db] bootstrap failed:", err.message);
    }
  });

  server.on("error", (err) => {
    if (err?.code === "EADDRINUSE") {
      console.error(`[server] Port ${ctx.config.server.port} is already in use. Stop the existing image_gen server before starting another dev server.`);
      process.exit(1);
    }
    console.error("[server] Failed to start:", err?.message || err);
    process.exit(1);
  });

  return { app, server, oauthChild, ctx };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startServer();
}
