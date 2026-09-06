import { expect, type Browser, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertJ6Isolation, j6RunnerPathDiagnostics } from "./appServer";
import { installIsolatedComponentTransport, type IsolatedAsset, type IsolatedTraffic } from "./isolatedComponentTransport";
import type { ManagerScenario } from "./comfyManagerComponent";

const ORIGIN = "http://127.0.0.1:49153";
const UI = fileURLToPath(new URL("../../", import.meta.url));
export type ManagerCase = { page: Page; observations: Array<{ name: string; value: unknown }> };
export async function preflightManager(info: TestInfo) {
  try {
    const isolation = assertJ6Isolation();
    await writeFile(info.outputPath("wp08c-preflight.json"), JSON.stringify({ passed: true, isolation }));
    return isolation;
  } catch (error) {
    await writeFile(info.outputPath("wp08c-preflight.json"), JSON.stringify({ passed: false, reason: String(error), runnerPathDiagnostics: j6RunnerPathDiagnostics() }));
    throw error;
  }
}
export async function buildManagerFixtureBundle() {
  try {
    const result = await build({ entryPoints: [join(UI, "e2e/fixtures/comfyManagerComponent.tsx")], absWorkingDir: UI,
      bundle: true, write: false, platform: "browser", format: "iife", target: "es2022", jsx: "automatic",
      logLevel: "silent", metafile: true, define: { "process.env.NODE_ENV": '"production"', "import.meta.env": '{"DEV":false,"PROD":true}' },
      plugins: [{ name: "manager-api-module-only", setup(builder) {
        builder.onResolve({ filter: /^\.\/api-core$/ }, (args) =>
          resolve(args.importer) === resolve(UI, "src/lib/api-comfy.ts") ? { path: "manager-json-api", namespace: "manager-api" } : undefined);
        builder.onLoad({ filter: /.*/, namespace: "manager-api" }, () => ({
          contents: "export async function jsonFetch(path,init){return window.wp08cApi(path,init);}", loader: "js",
        }));
      } }],
    });
    const inputs = Object.keys(result.metafile.inputs).sort();
    for (const owner of ["src/lib/laneCatalog.ts", "src/lib/api-comfy.ts"]) {
      expect(inputs.filter((input) => resolve(UI, input) === resolve(UI, owner))).toHaveLength(1);
    }
    expect(inputs.filter((input) => input.startsWith("manager-api:"))).toHaveLength(1);
    expect(result.outputFiles).toHaveLength(1);
    const body = result.outputFiles[0].text;
    return { body, sha256: createHash("sha256").update(body).digest("hex"), inputs };
  } catch (error) { throw new Error("Manager component bundle failed", { cause: error }); }
}
async function assetsFor(compiled: string) {
  try {
    const assets = new Map<string, IsolatedAsset>();
    const names = (await readdir(join(UI, "dist/assets"))).filter((name) => /^index-[\w-]+\.css$/.test(name));
    if (names.length !== 1) throw new Error("Manager needs freshly built CSS");
    const css = await readFile(join(UI, "dist/assets", names[0]));
    assets.set(ORIGIN + "/component.css", { contentType: "text/css", body: css });
    assets.set(ORIGIN + "/component.js", { contentType: "text/javascript", body: compiled });
    for (const name of await readdir(join(UI, "dist/fonts"))) if (/^[\w-]+\.woff2$/.test(name)) {
      assets.set(ORIGIN + "/fonts/" + name, { contentType: "font/woff2", body: await readFile(join(UI, "dist/fonts", name)) });
    }
    assets.set(ORIGIN + "/", { contentType: "text/html", body: '<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="data:,"><link rel="stylesheet" href="/component.css"></head><body><main id="root" style="max-width:900px;padding:24px"></main><script src="/component.js"></script></body></html>' });
    return { assets, cssSha256: createHash("sha256").update(css).digest("hex") };
  } catch (error) { throw new Error("Manager synthetic assets failed", { cause: error }); }
}
export async function observeManager(fixture: ManagerCase, name: string) {
  const value = await fixture.page.evaluate(() => window.wp08c.snapshot());
  fixture.observations.push({ name, value });
  return value;
}
async function closeManager(context: BrowserContext, info: TestInfo, observations: ManagerCase["observations"]) {
  const cleanup = { unmounted: false, pagesClosed: false, contextClosed: false, errors: [] as string[] };
  try {
    const page = context.pages()[0];
    if (page && !page.isClosed()) {
      try {
        observations.push({ name: "before-unmount", value: await page.evaluate(() => window.wp08c.snapshot()) });
        await page.screenshot({ path: info.outputPath("wp08c-manager-final.png") });
        await page.evaluate(() => window.wp08c.unmount()); cleanup.unmounted = true;
        const after = await page.evaluate(() => window.wp08c.snapshot());
        observations.push({ name: "after-unmount", value: after });
        expect(after.resource.phase).toBe("idle"); expect(after.pending).toBe(false); expect(after.violations).toEqual([]);
      } catch (error) { cleanup.errors.push(String(error)); }
      await page.close(); cleanup.pagesClosed = true;
    }
  } finally {
    try { await context.close(); cleanup.contextClosed = true; }
    catch (error) { cleanup.errors.push(String(error)); }
  }
  return cleanup;
}
export async function withManager(browser: Browser, info: TestInfo, scenario: ManagerScenario, run: (fixture: ManagerCase) => Promise<void>) {
  const isolation = await preflightManager(info);
  const traffic: IsolatedTraffic = { attempts: [], unexpected: [], routes: [] };
  const observations: ManagerCase["observations"] = [];
  const pageErrors: string[] = [];
  let context: BrowserContext | undefined, compiled: Awaited<ReturnType<typeof buildManagerFixtureBundle>> | undefined;
  let assets: Awaited<ReturnType<typeof assetsFor>> | undefined, cleanup: Awaited<ReturnType<typeof closeManager>> | undefined;
  let failure: unknown;
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: UI, encoding: "utf8" }).trim();
  try {
    compiled = await buildManagerFixtureBundle(); assets = await assetsFor(compiled.body);
    context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1280, height: 1000 } });
    await installIsolatedComponentTransport(context, assets.assets, [], traffic);
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") pageErrors.push(message.text()); });
    await page.goto(ORIGIN + "/"); await page.evaluate((input) => window.wp08c.mount(input), scenario);
    await expect(page.locator("#a")).toHaveAttribute("data-phase", "ready");
    await expect(page.locator("#b")).toHaveAttribute("data-phase", "ready");
    await page.evaluate(async () => { await document.fonts.ready; });
    await run({ page, observations });
  } catch (error) { failure = error; }
  finally {
    if (context) cleanup = await closeManager(context, info, observations);
    const bundleMetadata = compiled && { sha256: compiled.sha256, inputs: compiled.inputs };
    assets?.assets.clear(); compiled = undefined;
    await writeFile(info.outputPath("wp08c-manager-evidence.json"), JSON.stringify({ scenario, sha, isolation,
      runId: process.env.GITHUB_RUN_ID, bundle: bundleMetadata, cssSha256: assets?.cssSha256, observations,
      traffic, pageErrors, cleanup, noServerStarted: true, noProviderCalls: true, failure: failure ? String(failure) : null }, null, 2));
  }
  if (failure) throw failure;
  expect(cleanup).toEqual({ unmounted: true, pagesClosed: true, contextClosed: true, errors: [] });
  expect(pageErrors).toEqual([]); expect(traffic.unexpected).toEqual([]); expect(traffic.attempts).toEqual([]);
  expect(traffic.routes.every((route) => route.outcome === "fulfilled-synthetic" && route.method === "GET")).toBe(true);
}
