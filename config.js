// config.js — centralized runtime configuration (0.09.12).
//
// Single source of truth for ports, limits, paths, and tunables. All server,
// lib, and script code should import `config` (or named legacy constants) from
// here rather than reading `process.env` directly.
//
// Priority: env var > ${IMA2_CONFIG_DIR}/config.json > built-in default.
// `config.json` is loaded once at module import. Mutating the file at runtime
// requires a server restart (same as env vars).
//
// Keep this module dependency-free aside from node:* built-ins to avoid
// circular imports with lib/*.

import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";

const env = process.env;
const packageRoot = dirname(fileURLToPath(import.meta.url));
const configDir = env.IMA2_CONFIG_DIR || join(homedir(), ".ima2");

// ── Optional config.json layer ─────────────────────────────────────────
// Users can drop `${configDir}/config.json` to override defaults without
// setting env vars. Shape: same as the `config` object below (partial).
function loadConfigJson() {
  const candidates = [
    join(configDir, "config.json"),
    join(packageRoot, ".ima2", "config.json"),
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    try {
      const raw = readFileSync(p, "utf-8");
      return JSON.parse(raw);
    } catch {
      // ignore malformed config.json; env+defaults still apply
    }
  }
  return {};
}
const fileCfg = loadConfigJson();

function firstDefined(...vals) {
  return vals.find((v) => v !== undefined && v !== "");
}
function pickInt(envVal, fileVal, fallback) {
  const candidate = firstDefined(envVal, fileVal);
  if (candidate === undefined) return fallback;
  const n = Number(candidate);
  return Number.isFinite(n) ? n : fallback;
}
function pickStr(envVal, fileVal, fallback) {
  return firstDefined(envVal, fileVal) ?? fallback;
}
function pickBool(envVal, fileVal, fallback) {
  const v = firstDefined(envVal, fileVal);
  if (v === undefined) return fallback;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

export function defaultLogLevelForEnv(runtimeEnv = env) {
  return runtimeEnv.IMA2_DEV === "1" ? "debug" : "warn";
}

export const config = {
  server: {
    // Accept both IMA2_PORT and legacy PORT.
    port: pickInt(firstDefined(env.IMA2_PORT, env.PORT), fileCfg.server?.port, 3333),
    host: pickStr(env.IMA2_HOST, fileCfg.server?.host, "127.0.0.1"),
    bodyLimit: pickStr(env.IMA2_BODY_LIMIT, fileCfg.server?.bodyLimit, "50mb"),
  },
  limits: {
    maxRefB64Bytes: pickInt(env.IMA2_MAX_REF_B64_BYTES, fileCfg.limits?.maxRefB64Bytes, 7 * 1024 * 1024),
    maxRefCount: pickInt(env.IMA2_MAX_REF_COUNT, fileCfg.limits?.maxRefCount, 5),
    maxParallel: pickInt(env.IMA2_MAX_PARALLEL, fileCfg.limits?.maxParallel, 8),
    graphMaxNodes: pickInt(env.IMA2_GRAPH_MAX_NODES, fileCfg.limits?.graphMaxNodes, 500),
    graphMaxEdges: pickInt(env.IMA2_GRAPH_MAX_EDGES, fileCfg.limits?.graphMaxEdges, 1000),
  },
  history: {
    defaultPageSize: pickInt(
      env.IMA2_HISTORY_PAGE_SIZE,
      fileCfg.history?.defaultPageSize ?? fileCfg.limits?.historyDefaultPageSize,
      50,
    ),
    maxPageCap: pickInt(
      env.IMA2_HISTORY_MAX_PAGE,
      fileCfg.history?.maxPageCap ?? fileCfg.limits?.historyMaxPageCap,
      500,
    ),
  },
  oauth: {
    // Accept both IMA2_OAUTH_PROXY_PORT and legacy OAUTH_PORT.
    proxyPort: pickInt(firstDefined(env.IMA2_OAUTH_PROXY_PORT, env.OAUTH_PORT), fileCfg.oauth?.proxyPort, 10531),
    // IMA2_NO_OAUTH_PROXY=1 disables auto-start; default is auto-start enabled.
    autoStart: !pickBool(env.IMA2_NO_OAUTH_PROXY, fileCfg.oauth?.disableAutoStart, false),
    statusTimeoutMs: pickInt(env.IMA2_OAUTH_STATUS_TIMEOUT_MS, fileCfg.oauth?.statusTimeoutMs, 3000),
    restartDelayMs: pickInt(env.IMA2_OAUTH_RESTART_DELAY_MS, fileCfg.oauth?.restartDelayMs, 5000),
    researchSuffix: pickStr(
      env.IMA2_RESEARCH_SUFFIX,
      fileCfg.oauth?.researchSuffix,
      "\n\nIf the subject matter requires factual accuracy (faces, products, places, recent events), search the web for accurate visual references first, then generate.",
    ),
    validModeration: new Set(
      Array.isArray(fileCfg.oauth?.validModeration) && fileCfg.oauth.validModeration.length
        ? fileCfg.oauth.validModeration
        : ["auto", "low"],
    ),
  },
  storage: {
    configDir,
    packageRoot,
    generatedDir: pickStr(env.IMA2_GENERATED_DIR, fileCfg.storage?.generatedDir, join(configDir, "generated")),
    trashDir: pickStr(env.IMA2_TRASH_DIR, fileCfg.storage?.trashDir, join(configDir, "generated", ".trash")),
    generatedDirName: pickStr(env.IMA2_GENERATED_DIRNAME, fileCfg.storage?.generatedDirName, "generated"),
    trashDirName: pickStr(env.IMA2_TRASH_DIRNAME, fileCfg.storage?.trashDirName, ".trash"),
    dbPath: pickStr(env.IMA2_DB_PATH, fileCfg.storage?.dbPath, join(configDir, "sessions.db")),
    configFile: join(configDir, "config.json"),
    advertiseFile: pickStr(env.IMA2_ADVERTISE_FILE, fileCfg.storage?.advertiseFile, join(configDir, "server.json")),
    staticMaxAge: pickStr(env.IMA2_STATIC_MAX_AGE, fileCfg.storage?.staticMaxAge, "1y"),
  },
  ids: {
    generatedHexBytes: pickInt(env.IMA2_GENERATED_HEX_BYTES, fileCfg.ids?.generatedHexBytes, 4),
    nodeHexBytes: pickInt(env.IMA2_NODE_HEX_BYTES, fileCfg.ids?.nodeHexBytes, 5),
  },
  inflight: {
    ttlMs: pickInt(env.IMA2_INFLIGHT_TTL_MS, fileCfg.inflight?.ttlMs, 10 * 60 * 1000),
    reapMs: pickInt(env.IMA2_INFLIGHT_REAP_MS, fileCfg.inflight?.reapMs, 60 * 1000),
    terminalTtlMs: pickInt(env.IMA2_INFLIGHT_TERMINAL_TTL_MS, fileCfg.inflight?.terminalTtlMs, 30 * 1000),
  },
  trash: {
    ttlMs: pickInt(env.IMA2_TRASH_TTL_MS, fileCfg.trash?.ttlMs, 10_000),
  },
  styleSheet: {
    maxPrefix: pickInt(env.IMA2_STYLE_SHEET_MAX_PREFIX, fileCfg.styleSheet?.maxPrefix, 4000),
    model: pickStr(env.IMA2_STYLE_MODEL, fileCfg.styleSheet?.model, "gpt-5.4-mini"),
  },
  imageModels: {
    default: pickStr(env.IMA2_IMAGE_MODEL_DEFAULT, fileCfg.imageModels?.default, "gpt-5.4-mini"),
    valid: new Set(["gpt-5.5", "gpt-5.4", "gpt-5.4-mini"]),
    unsupported: new Set(["gpt-5.3-codex-spark"]),
  },
  log: {
    level: pickStr(env.IMA2_LOG_LEVEL, fileCfg.log?.level, defaultLogLevelForEnv(env)),
    pretty: env.NODE_ENV !== "production",
  },
  features: {
    cardNews: pickBool(env.IMA2_CARD_NEWS, fileCfg.features?.cardNews, env.IMA2_DEV === "1"),
  },
  cardNewsPlanner: {
    enabled: pickBool(env.IMA2_CARD_NEWS_PLANNER, fileCfg.cardNewsPlanner?.enabled, true),
    model: pickStr(env.IMA2_CARD_NEWS_PLANNER_MODEL, fileCfg.cardNewsPlanner?.model, "gpt-5.4-mini"),
    timeoutMs: pickInt(env.IMA2_CARD_NEWS_PLANNER_TIMEOUT_MS, fileCfg.cardNewsPlanner?.timeoutMs, 60_000),
    deterministicFallback: pickBool(
      env.IMA2_CARD_NEWS_PLANNER_FALLBACK,
      fileCfg.cardNewsPlanner?.deterministicFallback,
      false,
    ),
  },
  dev: {
    viteDevMode: pickBool(env.VITE_IMA2_DEV, fileCfg.dev?.viteDevMode, false),
  },
};

export default config;

// ── Backward-compatible flat re-exports (used by lib/inflight.js & earlier
//    call sites). Prefer `import { config } from "./config.js"` going forward.
export const PORT = config.server.port;
export const OAUTH_PORT = config.oauth.proxyPort;
export const OAUTH_URL = `http://127.0.0.1:${config.oauth.proxyPort}`;
export const CONFIG_DIR = config.storage.configDir;
export const CONFIG_FILE = config.storage.configFile;
export const ADVERTISE_FILE = config.storage.advertiseFile;
export const DB_FILE = config.storage.dbPath;
export const GENERATED_DIR = config.storage.generatedDir;
export const BODY_LIMIT = config.server.bodyLimit;
export const MAX_REF_B64_BYTES = config.limits.maxRefB64Bytes;
export const MAX_REFS = config.limits.maxRefCount;
export const MAX_N = config.limits.maxParallel;
export const INFLIGHT_TTL_MS = config.inflight.ttlMs;
export const INFLIGHT_REAP_MS = config.inflight.reapMs;
export const INFLIGHT_TERMINAL_TTL_MS = config.inflight.terminalTtlMs;
export const STYLE_SHEET_MAX_PREFIX = config.styleSheet.maxPrefix;
export const LOG_LEVEL = config.log.level;
export const NO_OAUTH_PROXY = !config.oauth.autoStart;
export const DEV_MODE = config.dev.viteDevMode;
export const CARD_NEWS_ENABLED = config.features.cardNews;
