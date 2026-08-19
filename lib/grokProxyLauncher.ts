import { type ChildProcess, spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isWin } from "../bin/lib/platform.js";
import { config } from "../config.js";
import { findAvailablePort } from "./runtimePorts.js";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROGROK_LOGIN_COMMAND = ["progrok", "login"].join(" ");

type GrokProxyReadyInfo = {
  url: string;
  port: number;
  requestedPort: number;
};

type GrokProxyPortInfo = {
  host: string;
  port: number;
  requestedPort: number;
  url: string;
};

type GrokProxyOptions = {
  host?: string;
  port?: number;
  progrokBinPath?: string;
  restartDelayMs?: number;
  restartMaxAttempts?: number;
  restartMaxDelayMs?: number;
  restartHealthyMs?: number;
  onPortSelected?: (info: GrokProxyPortInfo) => void;
  onReady?: (info: GrokProxyReadyInfo) => void;
  onExit?: (info: { code: number | null }) => void;
};

/**
 * Supervisor lifecycle. `waiting-for-login` is deliberately NOT `gave-up`:
 * progrok exits 1 at startup when it finds no credentials, so retrying is
 * pointless *until a login happens* — but a login makes it worth exactly one
 * more try. Collapsing the two states is what made GUI login unrecoverable.
 */
export type GrokProxyState =
  | "stopped"
  | "gave-up-retryable"
  | "starting"
  | "ready"
  | "waiting-for-login"
  | "backoff"
  | "gave-up";

/** Only these states may spawn. Everything else makes `ensure()` a no-op. */
const SPAWNABLE: ReadonlySet<GrokProxyState> = new Set<GrokProxyState>([
  "stopped",
  "gave-up-retryable",
]);

/**
 * Opaque probe token. The status route captures one BEFORE its async fetch and
 * hands it back afterwards, so a response that outlived its child can never
 * promote a dead proxy to `ready`.
 */
export type GrokProbeToken = { readonly gen: number };

export interface GrokProxyHandle {
  readonly child: ChildProcess | null;
  readonly state: GrokProxyState;
  ensure(): Promise<GrokProxyState>;
  notifyCredentialsChanged(): void;
  probeToken(): GrokProbeToken;
  markProbedReady(token: GrokProbeToken, url: string): boolean;
  kill(signal?: NodeJS.Signals): void;
  stop(signal?: NodeJS.Signals): void;
}

/**
 * Bounded exponential restart. Exported so the policy is testable without spawning a
 * process: a fixed 2s retry loop spins forever on a permanently broken binary or port.
 */
export function restartPlan(
  attempt: number,
  opts: { baseMs: number; maxMs: number; maxAttempts: number },
): { delayMs: number; giveUp: boolean } {
  if (attempt >= opts.maxAttempts) return { delayMs: 0, giveUp: true };
  return { delayMs: Math.min(opts.baseMs * (2 ** attempt), opts.maxMs), giveUp: false };
}

function parseListeningUrl(line: string): { url: string; port: number } | null {
  const match = String(line || "").match(/https?:\/\/(?:127\.0\.0\.1|localhost):(\d+)\/v1/i);
  if (!match) return null;
  const port = Number(match[1]);
  return Number.isFinite(port) ? { url: match[0], port } : null;
}

export function isGrokProxyAuthRequiredMessage(line: string): boolean {
  const normalized = String(line || "").toLowerCase();
  return normalized.includes("not logged in")
    && (normalized.includes(PROGROK_LOGIN_COMMAND) || normalized.includes("ima2 grok login"));
}

export function normalizeGrokProxyMessage(line: string): string {
  const escaped = PROGROK_LOGIN_COMMAND.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return String(line || "").replace(new RegExp(`\`?${escaped}\`?`, "gi"), "`ima2 grok login`");
}

function localBinPath(): string {
  return join(rootDir, "node_modules", ".bin");
}

export async function startGrokProxy(options: GrokProxyOptions = {}): Promise<GrokProxyHandle> {
  const host = options.host ?? config.grokProvider.proxyHost;
  const requestedPort = options.port ?? config.grokProvider.proxyPort;
  const restartDelayMs = options.restartDelayMs ?? config.grokProvider.restartDelayMs;
  const restartMaxAttempts = options.restartMaxAttempts ?? config.grokProvider.restartMaxAttempts;
  const restartMaxDelayMs = options.restartMaxDelayMs ?? config.grokProvider.restartMaxDelayMs;
  const restartHealthyMs = options.restartHealthyMs ?? config.grokProvider.restartHealthyMs;
  let currentChild: ChildProcess | null = null;
  let stopping = false;
  let restartTimer: NodeJS.Timeout | null = null;
  let authRequired = false;
  let restartAttempt = 0;
  let lastSpawnAt = 0;
  let state: GrokProxyState = "stopped";
  /** Bumped by every credential event, so a login racing an in-flight spawn is not lost. */
  let credentialGeneration = 0;
  /** Bumped by every spawn, so a late probe response can be matched to its child. */
  let spawnGeneration = 0;
  let inflight: Promise<GrokProxyState> | null = null;

  const scheduleRestart = () => {
    // A child that stayed up for a while counts as a healthy start, so an occasional
    // crash later does not inherit an exhausted budget.
    if (lastSpawnAt && Date.now() - lastSpawnAt >= restartHealthyMs) restartAttempt = 0;
    const plan = restartPlan(restartAttempt, {
      baseMs: restartDelayMs,
      maxMs: restartMaxDelayMs,
      maxAttempts: restartMaxAttempts,
    });
    if (plan.giveUp) {
      console.error(`[grok] progrok failed ${restartAttempt} times in a row; giving up. Fix the cause and restart ima2 serve to retry.`);
      state = "gave-up";
      return;
    }
    restartAttempt += 1;
    state = "backoff";
    console.log(`[grok] restarting in ${Math.round(plan.delayMs / 1000)}s (attempt ${restartAttempt}/${restartMaxAttempts})...`);
    restartTimer = setTimeout(() => {
      void spawnProxy();
    }, plan.delayMs);
  };

  const spawnProxy = async () => {
    let spawnSettled = false;
    let port: number;
    try {
      port = await findAvailablePort(requestedPort, { host });
    } catch (err) {
      const e = err as Error & { message?: string };
      console.error(`[grok] failed to select progrok port: ${e.message || e}`);
      if (!stopping) {
        scheduleRestart();
      }
      return;
    }
    // Shutdown can begin while the port lookup above is awaiting. Without this
    // re-check the woken continuation spawns a child nobody tracks or kills.
    if (stopping) {
      state = "stopped";
      return;
    }
    if (port !== requestedPort) {
      console.log(`[grok] requested port ${requestedPort}, actual port ${port}`);
    }
    options.onPortSelected?.({ host, port, requestedPort, url: `http://${host}:${port}/v1` });
    console.log(`Starting bundled progrok proxy for Grok images at http://${host}:${port}/v1 (managed by ima2 serve)...`);
    const progrokBin = options.progrokBinPath ?? join(localBinPath(), isWin ? "progrok.cmd" : "progrok");
    const child = spawn(progrokBin, ["proxy", "--host", host, "--port", String(port)], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: isWin,
      windowsHide: true,
      env: process.env,
    });
    currentChild = child;
    authRequired = false;
    lastSpawnAt = Date.now();
    spawnGeneration += 1;
    // Captured per spawn: a login arriving after this point invalidates this child.
    const spawnedAtCredentialGeneration = credentialGeneration;

    // A missing or unlaunchable binary emits `error` (and `close`) without ever emitting
    // `exit`, so the bounded restart must arm from here too — otherwise the backoff never
    // runs on the very failure it targets.
    child.on("error", (err) => {
      console.error(`[grok] failed to start progrok proxy: ${err.message}`);
      if (currentChild === child) currentChild = null;
      if (stopping || spawnSettled) return;
      spawnSettled = true;
      options.onExit?.({ code: null });
      scheduleRestart();
    });

    child.stdout?.on("data", (d) => {
      // Node can deliver buffered stdio after the exit event fires. Once the
      // exit handler has settled lifecycle state, late output must not overwrite it.
      if (spawnSettled) return;
      const msg = normalizeGrokProxyMessage(d.toString().trim());
      if (!msg) return;
      console.log(`[grok] ${msg}`);
      for (const line of msg.split(/\r?\n/)) {
        if (isGrokProxyAuthRequiredMessage(line)) authRequired = true;
        const ready = parseListeningUrl(line);
        if (!ready) continue;
        console.log(`[grok] ready for ima2 Grok provider at ${ready.url}`);
        state = "ready";
        options.onReady?.({ url: ready.url, port: ready.port, requestedPort });
      }
    });

    child.stderr?.on("data", (d) => {
      if (spawnSettled) return;
      const msg = normalizeGrokProxyMessage(d.toString().trim());
      if (msg) console.error(`[grok] ${msg}`);
      for (const line of msg.split(/\r?\n/)) {
        if (isGrokProxyAuthRequiredMessage(line)) authRequired = true;
      }
    });

    child.on("exit", (code) => {
      if (currentChild === child) currentChild = null;
      if (stopping || spawnSettled) return;
      spawnSettled = true;
      options.onExit?.({ code });
      if (authRequired && code !== 0) {
        // A login that landed while this child was starting means the child was
        // spawned against stale credentials. Its death is expected, not terminal.
        if (credentialGeneration !== spawnedAtCredentialGeneration) {
          authRequired = false;
          restartAttempt = 0;
          state = "gave-up-retryable";
          void ensure();
          return;
        }
        state = "waiting-for-login";
        console.error("[grok] Grok OAuth is not logged in. Run `ima2 grok login` to enable Grok images/video.");
        console.error("[grok] Continuing without auto-restarting the Grok proxy. GPT OAuth/API image generation can still run.");
        return;
      }
      console.log(`[grok] exited with code ${code}`);
      scheduleRestart();
    });
  };

  /**
   * Idempotent entry point. Order matters: the in-flight check must come FIRST so
   * concurrent callers share one spawn even when state is already `starting`.
   */
  async function ensure(): Promise<GrokProxyState> {
    if (stopping) return state;
    if (inflight) return inflight;
    if (!SPAWNABLE.has(state)) return state;
    state = "starting";
    inflight = spawnProxy()
      .then(() => state)
      .finally(() => { inflight = null; });
    return inflight;
  }

  state = "starting";
  await spawnProxy();
  if (state === "starting" && !currentChild) state = "stopped";

  return {
    get child() {
      return currentChild;
    },
    get state() {
      return state;
    },
    ensure,
    /**
     * The ONLY door back into a spawnable state. `gave-up` is left alone on
     * purpose: a login cannot fix a missing binary or an occupied port, and
     * re-arming it would let the 10s status poll spawn a child forever.
     */
    notifyCredentialsChanged() {
      credentialGeneration += 1;
      if (stopping) return;
      if (state !== "waiting-for-login") return;
      authRequired = false;
      restartAttempt = 0;
      state = "gave-up-retryable";
      void ensure();
    },
    probeToken(): GrokProbeToken {
      return { gen: spawnGeneration };
    },
    /**
     * A successful live probe is stronger evidence than stdout parsing, which only
     * recognizes 127.0.0.1/localhost. The token and child checks stop a response
     * that outlived its child from resurrecting a dead proxy on paper.
     */
    markProbedReady(token: GrokProbeToken, url: string): boolean {
      if (stopping) return false;
      if (token.gen !== spawnGeneration) return false;
      if (!currentChild) return false;
      if (state === "ready") return true;
      const port = Number(/:(\d+)/.exec(url)?.[1]) || requestedPort;
      state = "ready";
      options.onReady?.({ url, port, requestedPort });
      return true;
    },
    kill(signal: NodeJS.Signals = "SIGTERM") {
      stopping = true;
      state = "stopped";
      if (restartTimer) clearTimeout(restartTimer);
      try { currentChild?.kill(signal); } catch {}
    },
    stop(signal: NodeJS.Signals = "SIGTERM") {
      stopping = true;
      state = "stopped";
      if (restartTimer) clearTimeout(restartTimer);
      try { currentChild?.kill(signal); } catch {}
    },
  };
}
