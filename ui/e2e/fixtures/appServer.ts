import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { startStubUpstream, type StubHandle, type StubMode } from "./stubUpstream";
import type { Page } from "@playwright/test";

export type AppHandle = {
  baseUrl: string;
  stub: StubHandle;
  home: string;
  close(): Promise<void>;
};

export function assertStubOnlyCalls(stub: StubHandle): void {
  if (stub.externalAttempts.length > 0) {
    throw new Error("non-loopback stub host: " + stub.externalAttempts.join(","));
  }
}

export async function seedBrowser(
  page: Pick<Page, "addInitScript">,
  options: { provider?: "minimax" | "oauth"; dismissOnboarding?: boolean; imageModel?: string } = {},
): Promise<void> {
  const provider = options.provider ?? "minimax";
  const dismissOnboarding = options.dismissOnboarding ?? false;
  // The generate route validates the model against the provider lane, so the
  // seeded provider must come with a model that lane accepts. Without this the
  // stored GPT default reaches /api/generate and it fails closed with a 400
  // before any stub upstream call happens.
  const imageModel = options.imageModel ?? (provider === "minimax" ? "image-01" : "gpt-5.6-luna");
  await page.addInitScript((payload) => {
    const next = JSON.parse(payload) as { provider: string; dismissOnboarding: boolean; imageModel: string };
    if (next.dismissOnboarding) localStorage.setItem("ima2.onboardingDismissed", "1");
    localStorage.setItem("ima2.generationDefaults", JSON.stringify({ provider: next.provider }));
    localStorage.setItem("ima2.imageModel", next.imageModel);
  }, JSON.stringify({ provider, dismissOnboarding, imageModel }));
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
  options: { provider?: "minimax" | "oauth"; home?: string; withoutMinimaxKey?: boolean } = {},
): Promise<AppHandle> {
  const stub = await startStubUpstream(mode);
  const home = options.home ?? mkdtempSync(join(tmpdir(), "ima2-e2e-"));
  const provider = options.provider ?? (mode === "oauth-expired" ? "oauth" : "minimax");
  // J1 proves the first-run key-entry path, so it needs a home that genuinely
  // has no MiniMax credential. Every other journey starts pre-keyed.
  const withoutMinimaxKey = options.withoutMinimaxKey ?? false;
  writeFileSync(join(home, "config.json"), JSON.stringify({
    provider,
    ...(withoutMinimaxKey ? {} : { minimaxApiKey: "e2e-minimax-key" }),
    oauth: { disableAutoStart: true },
    grokProvider: { disableAutoStart: true },
  }));
  const stubPort = new URL(stub.url).port;
  const env = {
    ...process.env,
    IMA2_CONFIG_DIR: home,
    IMA2_DB_PATH: join(home, "sessions.db"),
    IMA2_GENERATED_DIR: join(home, "generated"),
    IMA2_PORT: "0",
    IMA2_NO_OAUTH_PROXY: "1",
    IMA2_NO_GROK_PROXY: "1",
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
  const line = await waitForLog(child, /Image Gen running at (http:\/\/[^\s]+)/);
  const baseUrl = /Image Gen running at (http:\/\/[^\s]+)/.exec(line)?.[1];
  if (!baseUrl) {
    child.kill();
    await stub.close();
    throw new Error(`could not parse server url from ${line}`);
  }
  return {
    baseUrl,
    stub,
    home,
    close: async () => {
      child.kill("SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 200));
      await stub.close();
    },
  };
}
