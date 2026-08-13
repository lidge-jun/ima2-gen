import { createRequire } from "module";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { buildHardeningDoctorLines } from "../lib/doctor-checks.js";
import { buildStorageDoctorLines } from "../lib/storage-doctor.js";
import { detectCodexAuth } from "../../lib/codexDetect.js";
import { resolvePackageBin } from "../../lib/packageCli.js";
import { runImageDoctorProbe } from "../../lib/responsesDoctor.js";
import { config as runtimeConfig } from "../../config.js";
import { exitFlushed } from "../lib/output.js";
import { buildProviderDoctorLines, verifyConfiguredKeys } from "../lib/doctor-providers.js";
import { buildMediaDoctorLines } from "../lib/doctor-media.js";
import { buildDoctorBundle } from "../lib/doctor-bundle.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");
const requireFromRoot = createRequire(join(ROOT, "package.json"));
const CONFIG_FILE = runtimeConfig.storage.configFile;
const LEGACY_CONFIG_FILE = join(ROOT, ".ima2", "config.json");

let pkg = { version: "?", name: "ima2-gen" };
try {
  pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
} catch {}

function loadConfig() {
  if (existsSync(CONFIG_FILE)) {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
  }
  if (existsSync(LEGACY_CONFIG_FILE)) {
    try { return JSON.parse(readFileSync(LEGACY_CONFIG_FILE, "utf-8")); } catch {}
  }
  return {};
}

function missingRuntimeDeps() {
  const deps = ["express", "better-sqlite3", "openai", "openai-oauth", "progrok/package.json", "@openai/codex/package.json", "zod"];
  const missing = deps.filter((dep) => {
    try {
      requireFromRoot.resolve(dep);
      return false;
    } catch {
      return true;
    }
  }).map((dep) => dep.endsWith("/package.json") ? dep.slice(0, -"/package.json".length) : dep);
  for (const [packageName, binName] of [["openai-oauth", "openai-oauth"], ["@openai/codex", "codex"]]) {
    try {
      resolvePackageBin(packageName, binName);
    } catch {
      if (!missing.includes(packageName)) missing.push(packageName);
    }
  }
  return missing;
}

function valueAfter(args: string[], name: string) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] || null;
}

function showImageProbeHelp() {
  console.log(`
  Usage: ima2 doctor image-probe [options]

  Runs live, sanitized Responses probes for EMPTY_RESPONSE diagnosis.
  The output never includes prompt text, auth tokens, URLs with credentials, or base64 image data.

  Options:
    --json                 Emit machine-readable JSON
    --matrix               Add current-payload web_search/tool_choice probes
    --provider <api|oauth> Override configured provider
    --model <model>        Override image-capable Responses model
    --size <size>          Default: 1024x1024
    --quality <quality>    Default: low
    --moderation <value>   Default: low
    --prompt <text>        Override built-in cat prompt
    --oauth-url <url>      Override GPT OAuth proxy URL
    --timeout-ms <ms>      Per-probe timeout
`);
}

export function showDoctorHelp() {
  console.log(`
  Usage: ima2 doctor [image-probe] [options]

  Diagnose environment, storage, dependencies, and authentication.
  Run 'ima2 doctor image-probe --help' for live image probe options.
`);
}

async function imageProbe(args: string[]) {
  if (args.includes("-h") || args.includes("--help")) {
    showImageProbeHelp();
    return;
  }
  console.error("Warning: ima2 doctor image-probe performs live billed image generation.");
  const fileConfig = loadConfig();
  const result = await runImageDoctorProbe({
    provider: valueAfter(args, "--provider") || fileConfig.provider || "oauth",
    apiKey: typeof fileConfig.apiKey === "string" ? fileConfig.apiKey : undefined,
    oauthUrl: valueAfter(args, "--oauth-url") || undefined,
    model: valueAfter(args, "--model") || runtimeConfig.imageModels?.default || "gpt-5.6-luna",
    size: valueAfter(args, "--size") || "1024x1024",
    quality: valueAfter(args, "--quality") || "low",
    moderation: valueAfter(args, "--moderation") || "low",
    prompt: valueAfter(args, "--prompt") || undefined,
    matrix: args.includes("--matrix"),
    timeoutMs: Number(valueAfter(args, "--timeout-ms")) || undefined,
    ctx: { config: runtimeConfig },
  });
  if (args.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
    exitFlushed(result.summary.ok ? 0 : 1);
  }
  console.log(`\n  ${pkg.name} v${pkg.version} — Image Probe\n`);
  console.log(`  Provider: ${result.provider}`);
  console.log(`  Model: ${result.model}`);
  console.log(`  Prompt: ${result.promptId} (${result.promptChars} chars, redacted)`);
  for (const probe of result.probes) {
    const mark = probe.ok ? "✓" : "✗";
    const reason = probe.diagnosticReason ? ` — ${probe.diagnosticReason}` : "";
    console.log(`  ${mark} ${probe.id}${reason}`);
    console.log(
      `      status=${probe.response.httpStatus ?? "n/a"} events=${probe.response.eventCount} images=${probe.response.imageResultCount} textChars=${probe.response.textOutputChars}`,
    );
  }
  console.log(`\n  ${result.summary.passed} passed, ${result.summary.failed} failed\n`);
  exitFlushed(result.summary.ok ? 0 : 1);
}

async function standardDoctor(args: string[] = []) {
  console.log(`\n  ${pkg.name} v${pkg.version} — Doctor\n`);

  let ok = 0;
  let fail = 0;

  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1).split(".")[0]);
  if (nodeMajor >= 20) {
    console.log(`  ✓ Node.js ${nodeVersion} (>= 20)`);
    ok++;
  } else {
    console.log(`  ✗ Node.js ${nodeVersion} (requires >= 20)`);
    fail++;
  }

  if (existsSync(join(ROOT, "package.json"))) {
    console.log("  ✓ package.json found");
    ok++;
  } else {
    console.log("  ✗ package.json missing");
    fail++;
  }

  const missingDeps = missingRuntimeDeps();
  if (missingDeps.length === 0) {
    console.log("  ✓ runtime dependencies resolvable");
    ok++;
  } else {
    console.log(`  ✗ missing runtime dependencies: ${missingDeps.join(", ")}`);
    fail++;
  }

  if (existsSync(join(ROOT, ".env"))) {
    console.log("  ✓ .env file exists");
    ok++;
  } else {
    console.log("  ⚠ .env file not found (optional — copy from .env.example)");
  }

  const fileConfig = loadConfig();
  if (fileConfig.provider) {
    console.log(`  ✓ Configured: ${fileConfig.provider}`);
    ok++;
  } else {
    console.log("  ⚠ Not configured — run 'ima2 setup'");
  }

  const advPath = runtimeConfig.storage.advertiseFile;
  const adv = existsSync(advPath) ? JSON.parse(readFileSync(advPath, "utf-8")) : null;
  console.log(`  ℹ Preferred backend port: ${runtimeConfig.server.port}`);
  if (adv?.backend || adv?.port) {
    console.log(`  ℹ Backend actual URL: ${adv?.backend?.url || adv?.url || `http://localhost:${adv.port}`}`);
    if (adv?.oauth) console.log(`  ℹ GPT OAuth actual URL: ${adv.oauth.url} (${adv.oauth.status || "unknown"})`);
  }

  const hardeningLines = await buildHardeningDoctorLines({
    root: ROOT,
    configFile: CONFIG_FILE,
    fileConfig,
  });
  for (const line of hardeningLines) {
    const prefix =
      line.kind === "pass" ? "✓"
      : line.kind === "fail" ? "✗"
      : line.kind === "warn" ? "⚠"
      : "ℹ";
    console.log(`  ${prefix} ${line.text}`);
    if (line.kind === "pass") ok++;
    if (line.kind === "fail") fail++;
  }

  const storageLines = await buildStorageDoctorLines({
    rootDir: ROOT,
    config: runtimeConfig,
  });
  console.log("");
  for (const line of storageLines) console.log(line);

  const auth = detectCodexAuth();
  if (fileConfig.provider === "oauth" && !auth.proxyReady) {
    console.log(
      auth.authed
        ? "  ✗ Codex is keyring-authenticated, but GPT OAuth needs a file-backed session; run 'ima2 login'"
        : "  ✗ GPT OAuth has no file-backed Codex session; run 'ima2 login'",
    );
    fail++;
  } else if (auth.proxyReady) {
    console.log("  ✓ GPT OAuth file-backed Codex session is ready");
    ok++;
  }

  const providerLines = buildProviderDoctorLines(fileConfig as Record<string, unknown>);
  console.log("");
  console.log("  Providers");
  for (const line of providerLines) {
    const prefix = line.kind === "pass" ? "✓" : line.kind === "fail" ? "✗" : line.kind === "warn" ? "⚠" : "ℹ";
    console.log(`    ${prefix} ${line.text}`);
    if (line.kind === "pass") ok++;
    if (line.kind === "fail") fail++;
  }
  if (args.includes("--verify-keys")) {
    const verified = await verifyConfiguredKeys(fileConfig as Record<string, unknown>);
    for (const line of verified) {
      const prefix = line.kind === "pass" ? "✓" : "✗";
      console.log(`    ${prefix} ${line.text}`);
      if (line.kind === "pass") ok++;
      if (line.kind === "fail") fail++;
    }
  }
  const mediaLines = await buildMediaDoctorLines();
  for (const line of mediaLines) {
    const prefix = line.kind === "pass" ? "✓" : line.kind === "warn" ? "⚠" : "ℹ";
    console.log(`  ${prefix} ${line.text}`);
    if (line.kind === "pass") ok++;
  }
  if (args.includes("--bundle")) {
    const bundle = buildDoctorBundle({ version: pkg.version, providerLines });
    if (args.includes("--json")) {
      console.log(JSON.stringify(bundle, null, 2));
      exitFlushed(fail > 0 ? 1 : 0);
    }
    console.log("");
    console.log("  Bundle");
    console.log(`    ${JSON.stringify(bundle)}`);
  }
  console.log(`
  ${ok} passed, ${fail} failed
`);
  exitFlushed(fail > 0 ? 1 : 0);
}

export async function doctor(args: string[] = []) {
  if (args.includes("-h") || args.includes("--help")) {
    if (args[0] === "image-probe") showImageProbeHelp();
    else showDoctorHelp();
    return;
  }
  if (args[0] === "image-probe") {
    await imageProbe(args.slice(1));
    return;
  }
  await standardDoctor(args);
}
