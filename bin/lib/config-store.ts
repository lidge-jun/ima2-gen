import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { config as runtimeConfig } from "../../config.js";
import {
  AUTH_CONFIG_KEYS,
  KEY_TO_ENV,
  WRITABLE_CONFIG_KEYS,
  isSensitiveConfigKey as isSensitiveConfigKeyShared,
} from "../../lib/configKeys.js";

export { KEY_TO_ENV, WRITABLE_CONFIG_KEYS };

export const CONFIG_FILE = runtimeConfig.storage.configFile;
export const CONFIG_DIR = runtimeConfig.storage.configDir;

export const AUTH_KEYS = AUTH_CONFIG_KEYS;

export function isAuthConfigKey(key: string): boolean {
  return AUTH_CONFIG_KEYS.has(key);
}

export function isWritableConfigKey(key: string): boolean {
  return WRITABLE_CONFIG_KEYS.has(key);
}

export function isSensitiveConfigKey(key: string): boolean {
  return isSensitiveConfigKeyShared(key);
}

export function redactValue(key: string, value: unknown): unknown {
  if (isSensitiveConfigKey(key)) return value ? "<redacted>" : value;
  return value;
}

export function loadFileCfg(): Record<string, unknown> {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf-8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function loadCliDefaults(): { image?: string; video?: string } {
  const defaults = getNestedKey(loadFileCfg(), "defaults");
  if (!defaults || typeof defaults !== "object" || Array.isArray(defaults)) return {};
  const value = defaults as Record<string, unknown>;
  return {
    ...(typeof value.image === "string" ? { image: value.image } : {}),
    ...(typeof value.video === "string" ? { video: value.video } : {}),
  };
}

export function saveFileCfg(cfg: Record<string, unknown>): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

export function getNestedKey(obj: unknown, dotKey: string): unknown {
  const parts = dotKey.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

export function setNestedKey(obj: Record<string, unknown>, dotKey: string, value: unknown): void {
  const parts = dotKey.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part === undefined) return;
    const next = cur[part];
    if (next == null || typeof next !== "object" || Array.isArray(next)) cur[part] = {};
    const child = cur[part];
    if (child == null || typeof child !== "object" || Array.isArray(child)) return;
    cur = child as Record<string, unknown>;
  }
  const last = parts[parts.length - 1];
  if (last === undefined) return;
  cur[last] = value;
}

export function deleteNestedKey(obj: Record<string, unknown>, dotKey: string): boolean {
  const parts = dotKey.split(".");
  let cur: unknown = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur == null || typeof cur !== "object") return false;
    const part = parts[i];
    if (part === undefined) return false;
    cur = (cur as Record<string, unknown>)[part];
  }
  if (cur == null || typeof cur !== "object") return false;
  const last = parts[parts.length - 1];
  if (last === undefined || !(last in cur)) return false;
  delete (cur as Record<string, unknown>)[last];
  return true;
}

export function stripSets(value: unknown): unknown {
  if (value instanceof Set) return [...value].map(stripSets);
  if (Array.isArray(value)) return value.map(stripSets);
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) result[key] = stripSets(nested);
    return result;
  }
  return value;
}

export function buildEffectiveConfig(): Record<string, unknown> {
  return stripSets(runtimeConfig) as Record<string, unknown>;
}

export function parseConfigValue(rawValue: string): unknown {
  try {
    return JSON.parse(rawValue);
  } catch {
    return rawValue;
  }
}

export function envOverrideForKey(key: string): { envVar: string; value: string } | null {
  const envVar = KEY_TO_ENV[key];
  if (!envVar || process.env[envVar] === undefined) return null;
  return { envVar, value: String(process.env[envVar]) };
}

export function displayPath(p: string): string {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  return home && p.startsWith(home) ? p.replace(home, "~") : p;
}

export function restartNotice(): string {
  return "note: server must be restarted to pick up config changes (run `ima2 serve`)";
}
