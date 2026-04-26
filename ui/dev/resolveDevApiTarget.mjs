import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_TARGET = "http://localhost:3333";

function cleanUrl(value) {
  return typeof value === "string" && value.length ? value.replace(/\/$/, "") : null;
}

function readJson(path) {
  if (!path || !existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

export function resolveDevApiTarget(options = {}) {
  const env = options.env || process.env;
  const fallback = options.fallback || DEFAULT_TARGET;
  const explicit = cleanUrl(env.VITE_IMA2_API_TARGET || env.IMA2_DEV_API_TARGET);
  if (explicit) return { url: explicit, source: "env" };

  const advertiseFile =
    env.IMA2_ADVERTISE_FILE ||
    join(env.IMA2_CONFIG_DIR || join(homedir(), ".ima2"), "server.json");
  const adv = readJson(advertiseFile);
  const fromAdvertise =
    cleanUrl(adv?.backend?.url) ||
    cleanUrl(adv?.url) ||
    (adv?.port ? cleanUrl(`http://localhost:${adv.port}`) : null);
  if (fromAdvertise) return { url: fromAdvertise, source: "server.json" };

  return { url: fallback, source: "default" };
}
