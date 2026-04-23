// config.js — centralized runtime constants and env parsing.
// Goal: single source of truth for ports, limits, and tunables (0.09.12 scope).
// All server/bin/scripts should import from here rather than hardcoding.

import { homedir } from "node:os";
import { join } from "node:path";

function intEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function strEnv(name, fallback) {
  const raw = process.env[name];
  return raw !== undefined && raw !== "" ? raw : fallback;
}

function boolEnv(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

export const PORT = intEnv("IMA2_PORT", intEnv("PORT", 3333));
export const OAUTH_PORT = intEnv("OAUTH_PORT", 10531);
export const OAUTH_URL = `http://127.0.0.1:${OAUTH_PORT}`;

export const CONFIG_DIR = strEnv("IMA2_CONFIG_DIR", join(homedir(), ".ima2"));
export const CONFIG_FILE = join(CONFIG_DIR, "config.json");
export const ADVERTISE_FILE = join(CONFIG_DIR, "server.json");
export const DB_FILE = join(CONFIG_DIR, "sessions.db");
export const GENERATED_DIR = join(CONFIG_DIR, "generated");

export const BODY_LIMIT = strEnv("IMA2_BODY_LIMIT", "50mb");
export const MAX_REF_B64_BYTES = intEnv("IMA2_MAX_REF_B64_BYTES", 7 * 1024 * 1024);
export const MAX_REFS = intEnv("IMA2_MAX_REFS", 5);
export const MAX_N = intEnv("IMA2_MAX_N", 8);

export const INFLIGHT_TTL_MS = intEnv("IMA2_INFLIGHT_TTL_MS", 10 * 60 * 1000);
export const INFLIGHT_REAP_MS = intEnv("IMA2_INFLIGHT_REAP_MS", 60 * 1000);

export const STYLE_SHEET_MAX_PREFIX = intEnv("IMA2_STYLE_SHEET_MAX_PREFIX", 4000);

export const LOG_LEVEL = strEnv("IMA2_LOG_LEVEL", "info");

export const NO_OAUTH_PROXY = boolEnv("IMA2_NO_OAUTH_PROXY", false);
export const DEV_MODE = boolEnv("VITE_IMA2_DEV", false);

export const VERSION = strEnv("IMA2_VERSION", "0.09.x-dev");
