import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { createInterface } from "readline/promises";
import { parseArgs } from "../lib/args.js";
import { out, die, color, json } from "../lib/output.js";
import { config as runtimeConfig } from "../../config.js";

const CONFIG_FILE = runtimeConfig.storage.configFile;
const CONFIG_DIR  = runtimeConfig.storage.configDir;

const HELP = `
  ima2 config <subcommand> [options]

  Subcommands:
    path                          Print config file path
    ls [--effective] [--json]     List file layer (or merged effective config with --effective)
    get <key> [--json]            Get a dotted key from effective config (redacts secrets)
    set <key> <value> [-y]        Write a key to the file layer
    rm <key>                      Remove a key from the file layer

  Keys use dot notation, e.g.: imageModels.default, log.level, features.cardNews

  Options:
    --effective     Use effective (merged env+file+defaults) config for ls/get
    --json          Output raw JSON
    -y, --yes       Skip confirmation prompts
`;

const FLAGS = {
  effective: { type: "boolean" },
  json:      { type: "boolean" },
  yes:       { short: "y", type: "boolean" },
  help:      { short: "h", type: "boolean" },
};

// Keys config set is allowed to write
const KNOWN_KEYS = new Set([
  "imageModels.default",
  "imageModels.reasoningEffort",
  "log.level",
  "features.cardNews",
  "cardNewsPlanner.enabled",
  "cardNewsPlanner.model",
  "cardNewsPlanner.timeoutMs",
  "cardNewsPlanner.deterministicFallback",
  "comfy.defaultUrl",
  "comfy.uploadTimeoutMs",
  "comfy.maxUploadBytes",
  "storage.generatedDir",
  "storage.generatedDirName",
  "server.port",
  "server.host",
  "server.bodyLimit",
  "oauth.proxyPort",
  "oauth.statusTimeoutMs",
  "oauth.restartDelayMs",
  "limits.maxRefCount",
  "limits.maxParallel",
  "history.defaultPageSize",
  "history.maxPageCap",
]);

// Auth keys live in the same file but must go through setup/login
const AUTH_KEYS = new Set(["provider", "apiKey"]);

const REDACT_PATTERN = /token|secret|apikey|password/i;
const ALWAYS_REDACT  = new Set(["provider", "apiKey", "oauth.token", "oauth.refreshToken"]);

// Env var that overrides each writable key
const KEY_TO_ENV: Record<string, string> = {
  "imageModels.default":              "IMA2_IMAGE_MODEL_DEFAULT",
  "imageModels.reasoningEffort":      "IMA2_REASONING_EFFORT",
  "log.level":                        "IMA2_LOG_LEVEL",
  "features.cardNews":                "IMA2_CARD_NEWS",
  "server.port":                      "IMA2_PORT",
  "server.host":                      "IMA2_HOST",
  "server.bodyLimit":                 "IMA2_BODY_LIMIT",
  "oauth.proxyPort":                  "IMA2_OAUTH_PROXY_PORT",
  "storage.generatedDir":             "IMA2_GENERATED_DIR",
  "cardNewsPlanner.enabled":          "IMA2_CARD_NEWS_PLANNER",
  "cardNewsPlanner.model":            "IMA2_CARD_NEWS_PLANNER_MODEL",
  "cardNewsPlanner.timeoutMs":        "IMA2_CARD_NEWS_PLANNER_TIMEOUT_MS",
  "limits.maxParallel":               "IMA2_MAX_PARALLEL",
  "limits.maxRefCount":               "IMA2_MAX_REF_COUNT",
  "history.defaultPageSize":          "IMA2_HISTORY_PAGE_SIZE",
};

function redactValue(key: string, value: any): any {
  if (ALWAYS_REDACT.has(key) || REDACT_PATTERN.test(key)) {
    return value ? "<redacted>" : value;
  }
  return value;
}

function loadFileCfg(): Record<string, any> {
  if (!existsSync(CONFIG_FILE)) return {};
  try { return JSON.parse(readFileSync(CONFIG_FILE, "utf-8")); }
  catch { return {}; }
}

function saveFileCfg(cfg: Record<string, any>) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

function getNestedKey(obj: any, dotKey: string): any {
  const parts = dotKey.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
}

function setNestedKey(obj: any, dotKey: string, value: any): void {
  const parts = dotKey.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null || typeof cur[parts[i]] !== "object") cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function deleteNestedKey(obj: any, dotKey: string): boolean {
  const parts = dotKey.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur == null || typeof cur !== "object") return false;
    cur = cur[parts[i]];
  }
  if (cur == null || typeof cur !== "object") return false;
  const last = parts[parts.length - 1];
  if (!(last in cur)) return false;
  delete cur[last];
  return true;
}

function stripSets(v: any): any {
  if (v instanceof Set)  return [...v];
  if (Array.isArray(v))  return v.map(stripSets);
  if (v && typeof v === "object") {
    const r: any = {};
    for (const [k, val] of Object.entries(v)) r[k] = stripSets(val);
    return r;
  }
  return v;
}

function buildEffectiveConfig(): Record<string, any> {
  return stripSets(runtimeConfig);
}

function displayPath(p: string): string {
  const home = process.env.HOME || "";
  return home && p.startsWith(home) ? p.replace(home, "~") : p;
}

async function pathSub(_argv) {
  out(CONFIG_FILE);
}

async function lsSub(argv) {
  const args = parseArgs(argv, { flags: FLAGS });
  if (args.effective) {
    const eff = buildEffectiveConfig();
    if (args.json) { json(eff); return; }
    out(JSON.stringify(eff, null, 2));
  } else {
    const fileCfg = loadFileCfg();
    if (args.json) { json(fileCfg); return; }
    out(JSON.stringify(fileCfg, null, 2));
  }
}

async function getSub(argv) {
  const args = parseArgs(argv, { flags: FLAGS });
  const key = args.positional[0];
  if (!key) die(2, "key required. Usage: config get <dotted.key>");
  const eff = buildEffectiveConfig();
  const raw = getNestedKey(eff, key);
  const value = redactValue(key, raw);
  if (args.json) { json({ key, value }); return; }
  if (value === undefined) {
    out(color.dim(`(key not found: ${key})`));
  } else {
    out(typeof value === "object" ? JSON.stringify(value, null, 2) : String(value));
  }
}

async function setSub(argv) {
  const args = parseArgs(argv, { flags: FLAGS });
  const [key, rawValue] = args.positional;
  if (!key || rawValue === undefined) die(2, "usage: config set <key> <value>");

  if (AUTH_KEYS.has(key)) {
    die(2, `"${key}" is an auth key. Use 'ima2 setup' or 'ima2 login' to change authentication.`);
  }
  if (!KNOWN_KEYS.has(key)) {
    die(2, `unknown config key: "${key}". Run 'ima2 config ls --effective' to see the config structure.`);
  }

  // Parse value: try JSON, fall back to raw string
  let value: any = rawValue;
  try { value = JSON.parse(rawValue); } catch {}

  // Warn if env var is overriding this key
  const envVar = KEY_TO_ENV[key];
  if (envVar && process.env[envVar] !== undefined) {
    out(color.yellow(`warning: env ${envVar}=${process.env[envVar]} is currently overriding this value.`));
    out(`The file change will only apply after unsetting the env var and restarting the server.`);
  }

  // Confirm if writing a sensitive key
  if ((ALWAYS_REDACT.has(key) || REDACT_PATTERN.test(key)) && !args.yes) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ans = await rl.question(`warning: "${key}" is a sensitive credential. Write to config file? [y/N] `);
    rl.close();
    if (!ans.trim().toLowerCase().startsWith("y")) { out("Aborted."); process.exit(0); }
  }

  const fileCfg = loadFileCfg();
  setNestedKey(fileCfg, key, value);
  saveFileCfg(fileCfg);

  out(color.green("✓ ") + `wrote ${key}=${JSON.stringify(value)} to ${displayPath(CONFIG_FILE)}`);
  out(color.dim("note: server must be restarted to pick up config changes (run `ima2 serve`)"));
}

async function rmSub(argv) {
  const args = parseArgs(argv, { flags: FLAGS });
  const key = args.positional[0];
  if (!key) die(2, "key required. Usage: config rm <key>");

  if (AUTH_KEYS.has(key)) {
    die(2, `"${key}" is an auth key. Use 'ima2 setup' or 'ima2 login' to change authentication.`);
  }

  const fileCfg = loadFileCfg();
  const removed = deleteNestedKey(fileCfg, key);
  if (!removed) {
    out(color.dim(`(key not found in file layer: ${key})`));
    return;
  }
  saveFileCfg(fileCfg);
  out(color.green("✓ ") + `removed ${key} from ${displayPath(CONFIG_FILE)}`);
  out(color.dim("note: server must be restarted to pick up config changes (run `ima2 serve`)"));
}

type Sub = (argv: any[]) => Promise<void>;
const SUB: Record<string, Sub> = {
  path: pathSub,
  ls:   lsSub,
  get:  getSub,
  set:  setSub,
  rm:   rmSub,
};

export default async function configCmd(argv) {
  const sub = argv[0];
  if (!sub || sub === "--help" || sub === "-h") { out(HELP); return; }
  const handler = SUB[sub];
  if (!handler) die(2, `unknown subcommand: ${sub}\n${HELP}`);
  return handler(argv.slice(1));
}
