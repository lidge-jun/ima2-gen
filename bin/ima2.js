#!/usr/bin/env node
import { createInterface } from "readline/promises";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn, execSync } from "child_process";
import { networkInterfaces, homedir } from "os";
import { openUrl, resolveBin } from "./lib/platform.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const HOME = homedir();
// Config lives in $IMA2_CONFIG_DIR (tests) or ~/.ima2 to match server.js and
// ~/.ima2/server.json advertise path. Legacy installs that stored config at
// <packageRoot>/.ima2/config.json will be migrated on first write.
const CONFIG_DIR = process.env.IMA2_CONFIG_DIR || join(HOME, ".ima2");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const LEGACY_CONFIG_FILE = join(ROOT, ".ima2", "config.json");

// Load package.json for version
let pkg = { version: "?", name: "ima2-gen" };
try {
  pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
} catch {}

function loadConfig() {
  if (existsSync(CONFIG_FILE)) {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
  }
  // One-time read from legacy location so users who set up on <1.0.4 don't lose auth.
  if (existsSync(LEGACY_CONFIG_FILE)) {
    try { return JSON.parse(readFileSync(LEGACY_CONFIG_FILE, "utf-8")); } catch {}
  }
  return {};
}

function saveConfig(config) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

async function setup() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log("\n  ima2-gen — GPT Image 2 Generator\n");
  console.log("  Choose authentication method:\n");
  console.log("    1) API Key  — paste your OpenAI API key (paid)");
  console.log("    2) OAuth    — login with ChatGPT account (free)\n");

  const choice = await rl.question("  Enter 1 or 2: ");
  const config = loadConfig();

  if (choice.trim() === "1") {
    const key = await rl.question("  OpenAI API Key: ");
    if (!key.startsWith("sk-")) {
      console.log("  Invalid API key format. Expected sk-...");
      rl.close();
      process.exit(1);
    }
    config.provider = "api";
    config.apiKey = key.trim();
    saveConfig(config);
    console.log("\n  API key saved. Starting server...\n");
  } else {
    config.provider = "oauth";
    delete config.apiKey;
    saveConfig(config);
    console.log("\n  Starting OAuth login...\n");

    // Check if codex auth exists
    const hasAuth =
      existsSync(join(HOME, ".codex", "auth.json")) ||
      existsSync(join(HOME, ".chatgpt-local", "auth.json"));

    if (!hasAuth) {
      console.log("  Running 'codex login' — follow the browser prompt.\n");
      try {
        execSync(`${resolveBin("npx")} @openai/codex login`, { stdio: "inherit" });
      } catch {
        console.log("\n  Login failed or cancelled. You can retry with 'ima2 serve'.\n");
        rl.close();
        process.exit(1);
      }
    } else {
      console.log("  Existing OAuth session found.\n");
    }

    saveConfig(config);
    console.log("  OAuth configured. Starting server...\n");
  }

  rl.close();
  return config;
}

async function serve() {
  let config = loadConfig();

  if (!config.provider) {
    config = await setup();
  }

  // Ensure ui/dist exists — if missing, auto-build (dev) or error (installed pkg)
  const distIndex = join(ROOT, "ui", "dist", "index.html");
  if (!existsSync(distIndex)) {
    const hasUiSrc = existsSync(join(ROOT, "ui", "package.json"));
    if (hasUiSrc) {
      console.log("\n  ui/dist missing — running 'npm run build' first...\n");
      try {
        execSync(`${resolveBin("npm")} run build`, { stdio: "inherit", cwd: ROOT });
      } catch {
        console.log("\n  Build failed. Try: cd ui && npm install && npm run build\n");
        process.exit(1);
      }
    } else {
      console.log("\n  ui/dist not found and ui/ source is missing.");
      console.log("  This installation appears broken. Reinstall: npm i -g ima2-gen\n");
      process.exit(1);
    }
  }

  const env = { ...process.env };

  if (config.provider === "api" && config.apiKey) {
    env.OPENAI_API_KEY = config.apiKey;
  }

  const serverPath = join(ROOT, "server.js");
  const child = spawn("node", [serverPath], {
    stdio: "inherit",
    env,
    cwd: ROOT,
  });

  child.on("exit", (code) => process.exit(code));

  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
}

async function showStatus() {
  const config = loadConfig();
  console.log(`\n  ${pkg.name} v${pkg.version}\n`);
  console.log(`  Config file: ${CONFIG_FILE}`);
  console.log(`  Exists: ${existsSync(CONFIG_FILE) ? "yes" : "no"}\n`);

  if (config.provider) {
    console.log(`  Provider: ${config.provider}`);
    if (config.provider === "api") {
      const key = config.apiKey || "";
      console.log(`  API Key: ${key ? key.slice(0, 8) + "..." + key.slice(-4) : "not set"}`);
    }
    console.log("");
  } else {
    console.log("  Status: not configured");
    console.log("  Run 'ima2 setup' to configure.\n");
  }

  // Check OAuth auth files
  const hasCodexAuth = existsSync(join(HOME, ".codex", "auth.json"));
  const hasChatgptAuth = existsSync(join(HOME, ".chatgpt-local", "auth.json"));
  console.log(`  OAuth sessions:`);
  console.log(`    ~/.codex/auth.json          ${hasCodexAuth ? "✓" : "✗"}`);
  console.log(`    ~/.chatgpt-local/auth.json  ${hasChatgptAuth ? "✓" : "✗"}`);
  console.log("");
}

async function doctor() {
  console.log(`\n  ${pkg.name} v${pkg.version} — Doctor\n`);

  let ok = 0;
  let fail = 0;

  // Node version
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1).split(".")[0]);
  if (nodeMajor >= 18) {
    console.log(`  ✓ Node.js ${nodeVersion} (>= 18)`);
    ok++;
  } else {
    console.log(`  ✗ Node.js ${nodeVersion} (requires >= 18)`);
    fail++;
  }

  // package.json exists
  if (existsSync(join(ROOT, "package.json"))) {
    console.log("  ✓ package.json found");
    ok++;
  } else {
    console.log("  ✗ package.json missing");
    fail++;
  }

  // node_modules
  if (existsSync(join(ROOT, "node_modules"))) {
    console.log("  ✓ node_modules installed");
    ok++;
  } else {
    console.log("  ✗ node_modules missing — run 'npm install'");
    fail++;
  }

  // .env
  if (existsSync(join(ROOT, ".env"))) {
    console.log("  ✓ .env file exists");
    ok++;
  } else {
    console.log("  ⚠ .env file not found (optional — copy from .env.example)");
  }

  // Config
  const config = loadConfig();
  if (config.provider) {
    console.log(`  ✓ Configured: ${config.provider}`);
    ok++;
  } else {
    console.log("  ⚠ Not configured — run 'ima2 setup'");
  }

  // Port availability (simple check)
  const port = process.env.PORT || 3333;
  console.log(`  ℹ Default port: ${port}`);

  console.log(`\n  ${ok} passed, ${fail} failed\n`);
  process.exit(fail > 0 ? 1 : 0);
}

function openBrowser() {
  const port = process.env.PORT || 3333;
  const url = `http://localhost:${port}`;
  const res = openUrl(url);
  if (res.ok) {
    console.log(`\n  Opening ${url} ...\n`);
  } else {
    console.log(`\n  Could not open browser. Visit: ${url}\n`);
  }
}

function showHelp() {
  console.log(`
  ${pkg.name} v${pkg.version} — GPT Image 2 Generator

  Usage: ima2 <command> [options]

  Server commands:
    serve          Start the image generation server
    setup, login   Configure API key or OAuth (interactive)
    status         Show current configuration status
    doctor         Diagnose environment and setup
    open           Open web UI in browser
    reset          Reset configuration

  Client commands (require a running 'ima2 serve'):
    gen <prompt>   Generate image(s) from prompt  (ima2 gen --help)
    edit <file>    Edit an existing image         (ima2 edit --help)
    ls             List recent history            (ima2 ls --help)
    show <name>    Show one history item          (ima2 show --help)
    ps             List active jobs               (ima2 ps --help)
    ping           Ping running server / check health

  Options:
    -v, --version  Show version
    -h, --help     Show help

  Examples:
    ima2 serve                       Start server
    ima2 gen "a shiba in space"      Generate from CLI
    ima2 gen "merge" --ref a.png --ref b.png -q high -o out.png
    ima2 ls -n 10                    Last 10 generations
    ima2 ping                        Health check
`);
}

// ── CLI ──
const args = process.argv.slice(2);
const command = args[0];

if (args.includes("-v") || args.includes("--version")) {
  console.log(pkg.version);
  process.exit(0);
}

if ((!command || args.includes("-h") || args.includes("--help"))
    && !["gen", "edit", "ls", "show", "ps", "ping"].includes(command)) {
  showHelp();
  process.exit(command ? 0 : 1);
}

switch (command) {
  case "serve":
    serve();
    break;
  case "setup":
  case "login":
    setup().then(() => console.log("  Done. Run 'ima2 serve' to start."));
    break;
  case "status":
    showStatus();
    break;
  case "doctor":
    doctor();
    break;
  case "open":
    openBrowser();
    break;
  case "reset":
    if (existsSync(CONFIG_FILE)) {
      writeFileSync(CONFIG_FILE, "{}");
      console.log("  Config reset. Run 'ima2 serve' to reconfigure.");
    } else {
      console.log("  No config to reset.");
    }
    break;
  case "gen":
  case "edit":
  case "ls":
  case "show":
  case "ps":
  case "ping": {
    const { setCliVersion } = await import("./lib/client.js");
    setCliVersion(pkg.version);
    const mod = await import(`./commands/${command}.js`);
    await mod.default(args.slice(1));
    break;
  }
  default:
    console.log(`  Unknown command: "${command}"`);
    console.log("  Run 'ima2 --help' for usage.\n");
    process.exit(1);
}
