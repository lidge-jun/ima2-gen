import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LAUNCHD_LABEL,
  SYSTEMD_UNIT,
  launchctlOutputIndicatesFailure,
  renderLaunchdPlist,
  renderSystemdUnit,
  serviceStateStale,
  type ServiceState,
} from "../lib/serviceTemplates.js";
import { escalateKill, isProcessAlive, type AdvertiseEntry } from "../../lib/processControl.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

function configDir(): string {
  return process.env.IMA2_CONFIG_DIR || join(homedir(), ".ima2");
}
function stateFile(): string {
  return join(configDir(), "service-state.json");
}
function logDir(): string {
  return join(configDir(), "logs");
}
function plistPath(): string {
  return join(homedir(), "Library", "LaunchAgents", `${LAUNCHD_LABEL}.plist`);
}
function unitPath(): string {
  return join(homedir(), ".config", "systemd", "user", SYSTEMD_UNIT);
}
function advertisePath(): string {
  return process.env.IMA2_ADVERTISE_FILE || join(configDir(), "server.json");
}

function readState(): ServiceState | null {
  try {
    return JSON.parse(readFileSync(stateFile(), "utf-8")) as ServiceState;
  } catch {
    return null;
  }
}

function currentPaths() {
  return { nodePath: process.execPath, serverJs: join(ROOT, "server.js") };
}

function renderInput() {
  const cur = currentPaths();
  return {
    nodePath: cur.nodePath,
    serverJs: cur.serverJs,
    rootDir: ROOT,
    pathEnv: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
    logDir: logDir(),
    configDir: process.env.IMA2_CONFIG_DIR,
  };
}

interface RunResult { ok: boolean; stdout: string; stderr: string; }

function run(cmd: string, args: string[]): RunResult {
  try {
    const stdout = execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, stdout, stderr: "" };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, stdout: err.stdout ?? "", stderr: err.stderr ?? err.message ?? "" };
  }
}

function guiDomain(): string {
  return `gui/${process.getuid?.() ?? 501}`;
}

function writeState(): void {
  const cur = currentPaths();
  const state: ServiceState = {
    version: 1,
    platform: process.platform,
    nodePath: cur.nodePath,
    serverJs: cur.serverJs,
    configDir: configDir(),
    installedAt: Date.now(),
  };
  mkdirSync(dirname(stateFile()), { recursive: true });
  writeFileSync(stateFile(), JSON.stringify(state, null, 2));
}

function readAdvertise(): AdvertiseEntry | null {
  try {
    return JSON.parse(readFileSync(advertisePath(), "utf-8")) as AdvertiseEntry;
  } catch {
    return null;
  }
}

async function waitForHealth(timeoutMs: number): Promise<{ ok: boolean; entry: AdvertiseEntry | null }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const entry = readAdvertise();
    if (entry?.url) {
      try {
        const r = await fetch(`${String(entry.url).replace(/\/$/, "")}/api/health`, { headers: { connection: "close" } });
        if (r.ok) return { ok: true, entry };
      } catch { /* keep polling */ }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return { ok: false, entry: readAdvertise() };
}

function reportProviderLiveness(entry: AdvertiseEntry | null): void {
  if (!entry) return;
  const oauth = (entry as { oauth?: { status?: string } }).oauth;
  const grok = (entry as { grok?: { live?: boolean } }).grok;
  if (oauth?.status && oauth.status !== "ready" && oauth.status !== "disabled") {
    console.log(`  Warning: GPT OAuth proxy status is "${oauth.status}" — check 'ima2 service logs'.`);
  }
  // grok.live only exists in the advertise payload, not /api/health (audit note).
  if (grok && grok.live === false) {
    console.log("  Warning: Grok proxy is not live under the service environment.");
    console.log("  If Grok worked in a terminal, the service PATH may be missing its binary.");
  }
}

// ── macOS (launchd) ──

async function macInstall(): Promise<boolean> {
  mkdirSync(logDir(), { recursive: true });
  mkdirSync(dirname(plistPath()), { recursive: true });
  writeFileSync(plistPath(), renderLaunchdPlist(renderInput()));
  const boot = await macBootstrapWithRetry();
  if (!boot.ok || launchctlOutputIndicatesFailure(boot.stderr)) {
    const legacy = run("/bin/launchctl", ["load", "-w", plistPath()]);
    if (!legacy.ok || launchctlOutputIndicatesFailure(legacy.stderr)) {
      console.error(`  launchctl could not load the service: ${boot.stderr || legacy.stderr || "unknown"}`);
      return false;
    }
  }
  writeState();
  return true;
}

async function macBootout(): Promise<void> {
  run("/bin/launchctl", ["bootout", `${guiDomain()}/${LAUNCHD_LABEL}`]);
  // bootout is asynchronous: bootstrapping again while the old job is still
  // draining fails with "Bootstrap failed: 5: Input/output error" (hit live
  // during 040 verification — restart left the service unregistered). Wait for
  // the registration to actually disappear before letting a start proceed.
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && macRegistered()) {
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function macBootstrapWithRetry(): Promise<RunResult> {
  let last: RunResult = { ok: false, stdout: "", stderr: "never attempted" };
  for (let attempt = 0; attempt < 3; attempt++) {
    last = run("/bin/launchctl", ["bootstrap", guiDomain(), plistPath()]);
    const failed = !last.ok || launchctlOutputIndicatesFailure(last.stderr);
    if (!failed && macRegistered()) return { ...last, ok: true };
    await new Promise((r) => setTimeout(r, 1000));
    if (macRegistered()) return { ...last, ok: true };
  }
  return last;
}

function macRegistered(): boolean {
  const r = run("/bin/launchctl", ["print", `${guiDomain()}/${LAUNCHD_LABEL}`]);
  return r.ok;
}

// ── Linux (systemd user unit) ──

function linuxInstall(): boolean {
  mkdirSync(logDir(), { recursive: true });
  mkdirSync(dirname(unitPath()), { recursive: true });
  writeFileSync(unitPath(), renderSystemdUnit(renderInput()));
  const reload = run("systemctl", ["--user", "daemon-reload"]);
  if (!reload.ok) {
    console.error(`  systemctl daemon-reload failed: ${reload.stderr}`);
    return false;
  }
  const enable = run("systemctl", ["--user", "enable", "--now", SYSTEMD_UNIT]);
  if (!enable.ok) {
    console.error(`  systemctl enable --now failed: ${enable.stderr}`);
    return false;
  }
  writeState();
  return true;
}

// ── shared flows ──

async function stopLiveServer(): Promise<void> {
  const entry = readAdvertise();
  if (entry?.pid && isProcessAlive(Number(entry.pid))) {
    await escalateKill(Number(entry.pid));
    try { unlinkSync(advertisePath()); } catch { /* gone already */ }
  }
}

async function install(): Promise<void> {
  if (process.platform === "win32") {
    console.log("\n  Windows service management is not built in yet.");
    console.log("  Register manually with Task Scheduler: run at logon,");
    console.log(`  program: ${currentPaths().nodePath}`);
    console.log(`  arguments: ${currentPaths().serverJs}\n`);
    return;
  }
  // A manually-started server would fight the KeepAlive service over the port.
  await stopLiveServer();
  const ok = process.platform === "darwin" ? await macInstall() : linuxInstall();
  if (!ok) { process.exitCode = 1; return; }
  console.log(`\n  Service installed (${process.platform === "darwin" ? "launchd" : "systemd user unit"}).`);
  const health = await waitForHealth(12_000);
  if (health.ok) {
    console.log(`  Server is up at ${health.entry?.url} (pid ${health.entry?.pid}).`);
    reportProviderLiveness(health.entry);
  } else {
    console.log("  Service registered but the server has not answered /api/health yet.");
    console.log("  Inspect: ima2 service logs\n");
    process.exitCode = 1;
    return;
  }
  console.log("");
}

async function uninstall(): Promise<void> {
  if (process.platform === "darwin") {
    await macBootout();
    try { unlinkSync(plistPath()); } catch { /* absent is fine */ }
  } else if (process.platform === "linux") {
    run("systemctl", ["--user", "disable", "--now", SYSTEMD_UNIT]);
    try { unlinkSync(unitPath()); } catch { /* absent is fine */ }
    run("systemctl", ["--user", "daemon-reload"]);
  }
  try { unlinkSync(stateFile()); } catch { /* absent is fine */ }
  await stopLiveServer();
  console.log("\n  Service uninstalled. Server stopped.\n");
}

async function start(): Promise<void> {
  if (process.platform === "darwin") {
    if (!existsSync(plistPath())) {
      console.error("\n  No service installed. Run 'ima2 service install' first.\n");
      process.exitCode = 1;
      return;
    }
    const boot = await macBootstrapWithRetry();
    if (!boot.ok && !macRegistered()) {
      console.error(`\n  launchctl bootstrap failed: ${boot.stderr}\n`);
      process.exitCode = 1;
      return;
    }
  } else if (process.platform === "linux") {
    run("systemctl", ["--user", "start", SYSTEMD_UNIT]);
  }
  const health = await waitForHealth(12_000);
  console.log(health.ok ? `\n  Service started — ${health.entry?.url}\n` : "\n  Start issued; server not answering yet. See 'ima2 service logs'.\n");
}

async function stopSvc(): Promise<void> {
  // bootout (not kill): with KeepAlive, killing the pid just respawns it.
  if (process.platform === "darwin") await macBootout();
  else if (process.platform === "linux") run("systemctl", ["--user", "stop", SYSTEMD_UNIT]);
  await stopLiveServer();
  console.log("\n  Service stopped (registration removed until 'ima2 service start').\n");
}

async function status(): Promise<void> {
  const state = readState();
  const installedArtifact = process.platform === "darwin" ? plistPath() : unitPath();
  const artifactExists = existsSync(installedArtifact);
  console.log("\n  ima2 service status\n");
  console.log(`  Artifact: ${installedArtifact} ${artifactExists ? "✓" : "✗ (not installed)"}`);
  if (process.platform === "darwin") {
    console.log(`  launchd registration: ${macRegistered() ? "✓ loaded" : "✗ not loaded"}`);
  } else if (process.platform === "linux") {
    const st = run("systemctl", ["--user", "is-active", SYSTEMD_UNIT]);
    console.log(`  systemd unit: ${st.stdout.trim() || st.stderr.trim()}`);
    const linger = run("loginctl", ["show-user", process.env.USER || "", "--property=Linger"]);
    if (linger.ok && linger.stdout.includes("Linger=no")) {
      console.log("  Note: lingering is off — the service stops when you log out.");
      console.log("  Enable with: loginctl enable-linger $USER");
    }
  }
  if (state) {
    const stale = serviceStateStale(state, currentPaths());
    console.log(`  Installed: ${new Date(state.installedAt).toLocaleString()} (node ${state.nodePath})`);
    for (const issue of stale) console.log(`  Stale: ${issue} — run 'ima2 service repair'`);
  } else {
    console.log("  State file: none");
  }
  const entry = readAdvertise();
  if (entry?.pid && isProcessAlive(Number(entry.pid))) {
    console.log(`  Live server: pid ${entry.pid} at ${entry.url}`);
    reportProviderLiveness(entry);
  } else {
    console.log("  Live server: none");
  }
  console.log("");
}

function logs(args: string[]): void {
  const n = Math.max(1, Number(args[args.indexOf("-n") + 1]) || 50);
  if (process.platform === "linux") {
    const r = run("journalctl", ["--user", "-u", SYSTEMD_UNIT, "-n", String(n), "--no-pager"]);
    console.log(r.stdout || r.stderr);
    return;
  }
  for (const f of ["service.out.log", "service.err.log"]) {
    const p = join(logDir(), f);
    if (!existsSync(p)) continue;
    console.log(`\n── ${p} (last ${n} lines) ──`);
    const lines = readFileSync(p, "utf-8").split("\n");
    console.log(lines.slice(-n).join("\n"));
  }
  console.log("");
}

async function repair(): Promise<void> {
  if (!readState() && !existsSync(plistPath()) && !existsSync(unitPath())) {
    console.error("\n  Nothing to repair — no service installed.\n");
    process.exitCode = 1;
    return;
  }
  console.log("\n  Re-rendering service artifacts for the current paths...");
  if (process.platform === "darwin") await macBootout();
  else if (process.platform === "linux") run("systemctl", ["--user", "stop", SYSTEMD_UNIT]);
  await install();
}

const HELP = `
  ima2 service — run the server as a background service

  Subcommands:
    install     Register (launchd/systemd), start now + on login, auto-restart
    uninstall   Deregister, remove artifacts, stop the server
    start       Re-register a stopped service
    stop        Stop and deregister until 'start' (KeepAlive-safe)
    restart     stop + start
    status      Artifact / registration / state / live-server report
    logs [-n N] Show service logs (default 50 lines)
    repair      Re-render artifacts after node/npm path moves
`;

export async function service(args: string[] = []): Promise<void> {
  const sub = args[0];
  switch (sub) {
    case "install": await install(); break;
    case "uninstall": await uninstall(); break;
    case "start": await start(); break;
    case "stop": await stopSvc(); break;
    case "restart": await stopSvc(); await start(); break;
    case "status": await status(); break;
    case "logs": logs(args.slice(1)); break;
    case "repair": await repair(); break;
    default:
      console.log(HELP);
      if (sub && sub !== "-h" && sub !== "--help") process.exitCode = 1;
  }
}
