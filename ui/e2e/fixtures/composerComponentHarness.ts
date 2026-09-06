import { expect, type Browser, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { installIsolatedComponentTransport } from "./isolatedComponentTransport";
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertJ6Isolation, j6RunnerPathDiagnostics } from "./appServer";
import type { ComposerObservation, ComposerSeed, TransportAttempt } from "./composerComponent";
import type { AssetItem } from "../../src/store/storeTypes";

// Synthetic document origin only: nothing listens, starts or binds on this port.
const ORIGIN = "http://127.0.0.1:49152";
const CATALOG = `${ORIGIN}/api/assets?kind=element&limit=500`;
const UI = fileURLToPath(new URL("../../", import.meta.url));
const ELEMENTS: AssetItem[] = ["Cedar", "Willow"].map((name) => ({
  id: `wp08-${name.toLowerCase()}`, name, kind: "element", filePath: null,
  folderId: null, notes: null, tags: [], metadata: { elementKind: "character", refs: [] },
  createdAt: 1, updatedAt: 1,
}));
type Asset = { contentType: string; body: string | Buffer };
type Traffic = { attempts: TransportAttempt[]; unexpected: string[];
  routes: Array<{ method: string; url: string; outcome: string }>; pageErrors: string[] };
type Evidence = {
  checkpoints: Array<{ name: string; observation: ComposerObservation }>;
  metrics: Array<{ name: string; value: unknown }>;
};
export type ComposerCase = Evidence & { page: Page };

export async function preflightComposer(info: TestInfo) {
  try {
    const isolation = assertJ6Isolation();
    await writeFile(info.outputPath("wp08-input-preflight.json"), JSON.stringify({ passed: true, isolation }, null, 2));
    return isolation;
  } catch (error) {
    await writeFile(info.outputPath("wp08-input-preflight.json"), JSON.stringify({ passed: false,
      reason: String(error), runnerPathDiagnostics: j6RunnerPathDiagnostics() }, null, 2));
    throw error;
  }
}

async function bundleComponent() {
  try {
    const result = await build({
      entryPoints: [join(UI, "e2e/fixtures/composerComponent.tsx")], absWorkingDir: UI,
      bundle: true, write: false, platform: "browser", format: "iife", target: "es2022",
      jsx: "automatic", logLevel: "silent", metafile: true,
      define: { "process.env.NODE_ENV": '"production"', "import.meta.env": '{"DEV":false,"PROD":true}' },
    });
    if (result.outputFiles.length !== 1) throw new Error("WP08 expected one in-memory JS bundle");
    const body = result.outputFiles[0].text;
    return { body, sha256: createHash("sha256").update(body).digest("hex"),
      inputs: Object.keys(result.metafile.inputs).sort() };
  } catch (error) { throw new Error("WP08 component bundle failed", { cause: error }); }
}

async function syntheticAssets(assets: Map<string, Asset>, bundle: string) {
  try {
    // Main/CI builds exact-head UI first. Consume its real stylesheet and fonts;
    // no app entry, server child, CSS facsimile, or provider is executed here.
    const cssNames = (await readdir(join(UI, "dist/assets"))).filter((name) => /^index-[\w-]+\.css$/.test(name));
    if (cssNames.length !== 1) throw new Error("WP08 needs the single freshly-built index CSS");
    const css = await readFile(join(UI, "dist/assets", cssNames[0]));
    assets.set(`${ORIGIN}/component.css`, { contentType: "text/css", body: css });
    assets.set(`${ORIGIN}/component.js`, { contentType: "text/javascript", body: bundle });
    for (const name of await readdir(join(UI, "dist/fonts"))) {
      if (!/^[\w-]+\.woff2$/.test(name)) continue;
      assets.set(`${ORIGIN}/fonts/${name}`, { contentType: "font/woff2",
        body: await readFile(join(UI, "dist/fonts", name)) });
    }
    assets.set(CATALOG, { contentType: "application/json",
      body: JSON.stringify({ assets: ELEMENTS, nextCursor: null }) });
    assets.set(`${ORIGIN}/`, { contentType: "text/html", body: `<!doctype html>
      <html lang="en" data-theme="dark"><head><meta charset="utf-8">
      <link rel="icon" href="data:,"><link rel="stylesheet" href="/component.css"></head>
      <body><main id="root" style="width:min(760px,70vw);height:640px;margin:24px;display:flex;flex-direction:column"></main>
      <script src="/component.js"></script></body></html>` });
    return { css: cssNames[0], cssSha256: createHash("sha256").update(css).digest("hex"),
      build: "Main/hosted CI owns npm run ui:build; this harness only reads its CSS" };
  } catch (error) { throw new Error("WP08 synthetic assets unavailable", { cause: error }); }
}


export async function checkpoint(fixture: ComposerCase, name: string) {
  try {
    const observation = await fixture.page.evaluate(() => {
      if (!window.wp08) throw new Error("WP08 controller missing");
      return window.wp08.snapshot();
    });
    fixture.checkpoints.push({ name, observation });
    return observation;
  } catch (error) { throw new Error(`WP08 checkpoint ${name} failed`, { cause: error }); }
}

async function closeComponent(context: BrowserContext, info: TestInfo, evidence: Evidence) {
  const cleanup = { unmounted: false, pageClosed: false, contextClosed: false, controllerRemoved: false,
    afterUnmount: null as ComposerObservation | null, errors: [] as string[] };
  try {
    const page = context.pages()[0];
    if (page && !page.isClosed()) {
      try {
        const observation = await page.evaluate(() => window.wp08?.snapshot() ?? null);
        if (observation) evidence.checkpoints.push({ name: "finally-before-unmount", observation });
        await page.screenshot({ path: info.outputPath("wp08-input-final.png") });
      } catch (error) { cleanup.errors.push(`capture: ${String(error)}`); }
      try {
        cleanup.afterUnmount = await page.evaluate(() => {
          if (!window.wp08) return null;
          window.wp08.unmount();
          const observation = window.wp08.snapshot(); delete window.wp08; return observation;
        });
        cleanup.unmounted = cleanup.afterUnmount !== null;
        cleanup.controllerRemoved = await page.evaluate(() => window.wp08 === undefined);
      } catch (error) { cleanup.errors.push(`unmount: ${String(error)}`); }
      try { await page.close(); cleanup.pageClosed = true; }
      catch (error) { cleanup.errors.push(`page close: ${String(error)}`); }
    }
  } finally {
    // Guards remain installed through BOTH unmount and page/context close.
    try { await context.close(); cleanup.contextClosed = true; }
    catch (error) { cleanup.errors.push(`context close: ${String(error)}`); }
  }
  return cleanup;
}

function assertTeardown(traffic: Traffic, seed: ComposerSeed, evidence: Evidence,
  cleanup: Awaited<ReturnType<typeof closeComponent>> | undefined) {
  expect(cleanup?.errors).toEqual([]);
  expect(cleanup?.unmounted).toBe(true); expect(cleanup?.contextClosed).toBe(true);
  expect(cleanup?.pageClosed).toBe(true); expect(cleanup?.controllerRemoved).toBe(true);
  expect(cleanup?.afterUnmount?.calls).toEqual(evidence.checkpoints.at(-1)?.observation.calls);
  expect(traffic.unexpected).toEqual([]); expect(traffic.pageErrors).toEqual([]);
  expect(traffic.attempts.filter((attempt) => !attempt.allowed)).toEqual([]);
  expect(traffic.attempts).toEqual(seed.surface === "home" ? []
    : [{ kind: "fetch", method: "GET", url: CATALOG, allowed: true }]);
  expect(traffic.routes.every((route) => route.outcome === "fulfilled-synthetic")).toBe(true);
  expect(traffic.routes.filter((route) => route.method !== "GET")).toEqual([]);
}

export async function withComposer(browser: Browser, info: TestInfo, seed: ComposerSeed,
  run: (fixture: ComposerCase) => Promise<void>): Promise<void> {
  const isolation = await preflightComposer(info); // Never bypass this, even for direct callers.
  const traffic: Traffic = { attempts: [], unexpected: [], routes: [], pageErrors: [] };
  const evidence: Evidence = { checkpoints: [], metrics: [] };
  const assets = new Map<string, Asset>();
  let context: BrowserContext | undefined;
  let bundle: Awaited<ReturnType<typeof bundleComponent>> | undefined;
  let styles: Awaited<ReturnType<typeof syntheticAssets>> | undefined;
  let cleanup: Awaited<ReturnType<typeof closeComponent>> | undefined;
  let failure: unknown;
  let sha: string | undefined;
  try {
    sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: UI, encoding: "utf8" }).trim();
    bundle = await bundleComponent(); styles = await syntheticAssets(assets, bundle.body);
    context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1280, height: 900 } });
    await installIsolatedComponentTransport(context, assets, [CATALOG], traffic);
    const page = await context.newPage();
    page.on("pageerror", (error) => traffic.pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") traffic.pageErrors.push(message.text()); });
    await page.goto(`${ORIGIN}/`);
    await page.evaluate((input) => { if (!window.wp08) throw new Error("WP08 entry missing"); window.wp08.mount(input); }, seed);
    await expect(page.locator("html")).toHaveAttribute("data-component-ready", "true");
    if (seed.surface !== "home") await expect(page.locator("html")).toHaveAttribute("data-catalog-ready", "true");
    await page.evaluate(async () => { await document.fonts.ready; });
    await run({ page, ...evidence });
  } catch (error) { failure = error; }
  finally {
    if (context) cleanup = await closeComponent(context, info, evidence);
    try { assertTeardown(traffic, seed, evidence, cleanup); }
    catch (error) { failure ??= error; }
    const bundleMetadata = bundle && { sha256: bundle.sha256, inputs: bundle.inputs };
    assets.clear(); bundle = undefined; context = undefined;
    await writeFile(info.outputPath("wp08-input-evidence.json"), JSON.stringify({ seed, isolation, sha,
      runId: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT,
      bundle: bundleMetadata, styles, traffic, evidence, cleanup, bundleAndAssetReferencesCleared: true,
      serverStarted: false, providerStarted: false, osSandbox: false,
      failure: failure ? String(failure) : null }, null, 2));
  }
  if (failure) throw failure;
}
