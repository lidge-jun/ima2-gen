import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { homedir, tmpdir, userInfo } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { startStubUpstream, type StubHandle, type StubMode } from "./stubUpstream";
import type { Page } from "@playwright/test";

export type AppHandle = {
  baseUrl: string;
  stub: StubHandle;
  home: string;
  isolation?: J6Isolation;
  close(): Promise<void>;
};

export type J6Isolation = {
  checkout: string; osHome: string; runner: string; runId: string;
  dotenvAbsent: true; providerEnvironmentAbsent: true; authStoresAbsent: true;
  credentialMountsAbsent: true; autoStartDisabled: true;
  runnerPaths: { xdgConfigHome: string | null; azureExtensions: string | null };
};

function verifiedRunnerPath(key: string, value: string | undefined, osHome: string): boolean {
  const expected = key === "XDG_CONFIG_HOME" ? join(osHome, ".config")
    : key === "AZURE_EXTENSION_DIR" ? "/opt/az/azcliextensions" : null;
  if (!expected || value !== expected) return false;
  let metadata: ReturnType<typeof lstatSync>;
  try { metadata = lstatSync(expected); } catch (error) {
    return key === "XDG_CONFIG_HOME" && (error as NodeJS.ErrnoException).code === "ENOENT";
  }
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) return false;
  try { if (realpathSync(expected) !== expected) return false; } catch { return false; }
  return key === "XDG_CONFIG_HOME" || (metadata.uid === 0 && (metadata.mode & 0o022) === 0);
}

// WP02 is deliberately hosted-only; this is a preflight, NOT WP09's OS sandbox.
// Never read credential contents or repair an unsafe environment to make it pass.
export function assertJ6Isolation(): J6Isolation {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.RUNNER_ENVIRONMENT !== "github-hosted"
    || process.platform !== "linux" || !process.env.GITHUB_RUN_ID) {
    throw new Error("J6 BLOCKED: a disposable GitHub-hosted Linux runner is required");
  }
  const osHome = realpathSync(userInfo().homedir);
  const checkout = realpathSync(resolve(process.cwd(), ".."));
  if (osHome !== "/home/runner" || homedir() !== osHome || process.env.HOME !== osHome
    || checkout !== resolve(process.cwd(), "..")
    || !process.env.GITHUB_WORKSPACE || realpathSync(process.env.GITHUB_WORKSPACE) !== checkout
    || !checkout.startsWith(`${osHome}/work/`)) {
    throw new Error("J6 BLOCKED: checkout or actual OS home is not the disposable runner identity");
  }
  const unsafeEnv = Object.keys(process.env).filter((key) => !verifiedRunnerPath(key, process.env[key], osHome) && (
    /^(IMA2_|DOTENV_|OPENAI_|XAI_|GROK_|PROGROK_|CHATGPT_|GEMINI_|GOOGLE_|VERTEX_|ATLASCLOUD_|MINIMAX_|NOVELAI_|RUNWAY_|HIGGSFIELD_|AGY_|ANTHROPIC_|AWS_|AZURE_|PW_TEST_|PLAYWRIGHT_TEST_BASE_URL$|CODEX_HOME$|XDG_CONFIG_HOME$|NODE_OPTIONS$|NODE_PATH$|OAUTH_PORT$|HTTPS?_PROXY$|ALL_PROXY$)/i.test(key)
    || /(?:API_KEY|ACCESS_TOKEN|REFRESH_TOKEN|CLIENT_SECRET|CREDENTIALS|AUTH_TOKEN|COOKIE)/i.test(key)));
  if (unsafeEnv.length) throw new Error(`J6 BLOCKED: unsafe environment names: ${unsafeEnv.sort().join(", ")}`);
  const stores = [".ima2", ".codex", ".chatgpt-local", ".grok", ".progrok", ".gemini",
    ".antigravity", ".config/codex", ".config/gcloud", ".config/progrok", ".config/grok", ".aws", ".azure"];
  if ([osHome, checkout].some((root) => stores.some((entry) => existsSync(join(root, entry))))) {
    throw new Error("J6 BLOCKED: legacy configuration or auth store exists");
  }
  assertNoJ6Overrides(checkout);
  if (existsSync(join(checkout, "generated"))) throw new Error("J6 BLOCKED: legacy generated data exists");
  const mounts = readFileSync("/proc/self/mountinfo", "utf8");
  if (mounts.split("\n").some((line) => /\/(?:Users|\.ima2|\.codex|\.grok|\.gemini|\.aws|\.azure)(?:\/|\s)/.test(line))) {
    throw new Error("J6 BLOCKED: credential-bearing mount detected");
  }
  return { checkout, osHome, runner: "github-hosted/linux", runId: process.env.GITHUB_RUN_ID,
    dotenvAbsent: true, providerEnvironmentAbsent: true, authStoresAbsent: true,
    credentialMountsAbsent: true, autoStartDisabled: true,
    runnerPaths: { xdgConfigHome: process.env.XDG_CONFIG_HOME ?? null,
      azureExtensions: process.env.AZURE_EXTENSION_DIR ?? null } };
}

function assertNoJ6Overrides(checkout: string): void {
  const dirs = new Set([checkout, join(checkout, "ui"), homedir()]);
  for (let parent = dirname(checkout); parent !== dirname(parent); parent = dirname(parent)) dirs.add(parent);
  for (const dir of dirs) {
    if (readdirSync(dir).some((name) => /^\.env(?:\.|$)/.test(name)
      && !/\.(?:example|sample|template)$/.test(name))) {
      throw new Error(`J6 BLOCKED: dotenv override in ${dir}`);
    }
  }
  if (lstatSync(checkout).isSymbolicLink()) throw new Error("J6 BLOCKED: linked checkout");
}

function j6ChildEnvironment(): NodeJS.ProcessEnv {
  // Allowlist inheritance: HOME is passed unchanged, never pointed at a temp dir.
  return Object.fromEntries(["PATH", "HOME", "LANG", "LC_ALL", "TMPDIR", "SYSTEMROOT"]
    .flatMap((key) => process.env[key] === undefined ? [] : [[key, process.env[key]]]));
}

async function stopJ6Child(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolveExit, reject) => {
    const kill = setTimeout(() => child.kill("SIGKILL"), 5_000);
    const deadline = setTimeout(() => { cleanup(); reject(new Error("J6 child exit unproven")); }, 10_000);
    const cleanup = () => { clearTimeout(kill); clearTimeout(deadline); child.off("exit", done); };
    const done = () => { cleanup(); resolveExit(); };
    child.once("exit", done);
    child.kill("SIGTERM");
  });
}

export function assertStubOnlyCalls(stub: StubHandle): void {
  if (stub.externalAttempts.length > 0) {
    throw new Error("non-loopback stub host: " + stub.externalAttempts.join(","));
  }
}

export async function seedBrowser(
  page: Pick<Page, "addInitScript">,
  options: {
    provider?: "minimax" | "oauth";
    dismissOnboarding?: boolean;
    imageModel?: string;
    /**
     * Extra generation defaults merged into the seeded blob. Some regressions
     * only exist in state a user reaches by moving between lanes and reloading,
     * which the app then restores verbatim; seeding it directly reproduces that
     * without driving the whole journey first.
     */
    generationDefaults?: Record<string, unknown>;
  } = {},
): Promise<void> {
  const provider = options.provider ?? "minimax";
  const dismissOnboarding = options.dismissOnboarding ?? false;
  // The generate route validates the model against the provider lane, so the
  // seeded provider must come with a model that lane accepts. Without this the
  // stored GPT default reaches /api/generate and it fails closed with a 400
  // before any stub upstream call happens.
  const imageModel = options.imageModel ?? (provider === "minimax" ? "image-01" : "gpt-5.6-luna");
  const generationDefaults = options.generationDefaults ?? {};
  await page.addInitScript((payload) => {
    const next = JSON.parse(payload) as {
      provider: string;
      dismissOnboarding: boolean;
      imageModel: string;
      generationDefaults: Record<string, unknown>;
    };
    if (next.dismissOnboarding) localStorage.setItem("ima2.onboardingDismissed", "1");
    localStorage.setItem(
      "ima2.generationDefaults",
      JSON.stringify({ provider: next.provider, ...next.generationDefaults }),
    );
    localStorage.setItem("ima2.imageModel", next.imageModel);
  }, JSON.stringify({ provider, dismissOnboarding, imageModel, generationDefaults }));
}

function waitForLog(child: ChildProcess, needle: RegExp, timeoutMs = 20_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = "";
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${needle}`)), timeoutMs);
    const onData = (chunk: Buffer) => {
      buf += chunk.toString("utf8");
      const match = needle.exec(buf);
      if (match) {
        clearTimeout(timer);
        child.stdout?.off("data", onData);
        child.stderr?.off("data", onData);
        resolve(match[0]);
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
  });
}

export async function startApp(
  mode: StubMode = "minimax",
  options: { provider?: "minimax" | "oauth"; home?: string; withoutMinimaxKey?: boolean; j6?: boolean } = {},
): Promise<AppHandle> {
  const isolation = options.j6 ? assertJ6Isolation() : undefined;
  if (isolation && (options.home || mode !== "minimax")) throw new Error("J6 BLOCKED: custom home or upstream mode");
  const stub = await startStubUpstream(mode);
  const home = options.home ?? mkdtempSync(join(tmpdir(), "ima2-e2e-"));
  const provider = options.provider ?? (mode === "oauth-expired" ? "oauth" : "minimax");
  // J1 proves the first-run key-entry path, so it needs a home that genuinely
  // has no MiniMax credential. Every other journey starts pre-keyed.
  const withoutMinimaxKey = isolation ? true : options.withoutMinimaxKey ?? false;
  writeFileSync(join(home, "config.json"), JSON.stringify({
    provider,
    ...(withoutMinimaxKey ? {} : { minimaxApiKey: "e2e-minimax-key" }),
    oauth: { disableAutoStart: true },
    grokProvider: { disableAutoStart: true },
    ...(isolation ? { mcp: { enabledProviders: [] } } : {}),
  }));
  const stubPort = new URL(stub.url).port;
  const env = {
    ...(isolation ? j6ChildEnvironment() : process.env),
    IMA2_CONFIG_DIR: home,
    IMA2_DB_PATH: join(home, "sessions.db"),
    IMA2_GENERATED_DIR: join(home, "generated"),
    IMA2_PORT: "0",
    IMA2_NO_OAUTH_PROXY: "1",
    IMA2_NO_GROK_PROXY: "1",
    // pickStr ignores empty strings; a separator-only list survives it and parses to [].
    ...(isolation ? { IMA2_HOST: "127.0.0.1", IMA2_MCP_PROVIDERS: ",", VITE_IMA2_DEV: "0" } : {}),
    IMA2_MINIMAX_REGION: "global_en",
    IMA2_MINIMAX_GLOBAL_BASE_URL: stub.url,
    ...(withoutMinimaxKey ? {} : { MINIMAX_API_KEY: "e2e-minimax-key" }),
    ...(mode === "oauth-expired" ? { IMA2_OAUTH_PROXY_PORT: stubPort } : {}),
  };
  const child = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
    cwd: join(process.cwd(), ".."),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let line: string;
  try {
    line = await waitForLog(child, /Image Gen running at (http:\/\/[^\s]+)/);
  } catch (error) {
    try { if (isolation) await stopJ6Child(child); else child.kill(); }
    finally { await stub.close(); }
    throw error;
  }
  const baseUrl = /Image Gen running at (http:\/\/[^\s]+)/.exec(line)?.[1];
  if (!baseUrl) {
    try { if (isolation) await stopJ6Child(child); else child.kill(); }
    finally { await stub.close(); }
    throw new Error(`could not parse server url from ${line}`);
  }
  return {
    baseUrl,
    stub,
    home,
    ...(isolation ? { isolation } : {}),
    close: async () => {
      if (isolation) {
        try { await stopJ6Child(child); }
        finally { await stub.close(); }
        return;
      }
      child.kill("SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 200));
      await stub.close();
    },
  };
}
