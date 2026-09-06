import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, realpath, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, relative, isAbsolute } from "node:path";
import { readFixtures } from "../ui/e2e/fixtures/j6Catalog.ts";

const stamp = () => new Date().toISOString();
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const uiRequire = createRequire(new URL("../ui/package.json", import.meta.url));
const seed = Object.entries({
  "ima2.locale": "en", "ima2.onboardingDismissed": "1", "ima2.uiMode": "classic",
  "ima2.workspaceProfile": "default", "ima2.activeSessionId": "wp02-session",
  "ima2.imageModel": "nai-diffusion-5-full", "ima2.videoDefaults": JSON.stringify({ model: false }),
  "ima2.generationDefaults": JSON.stringify({ provider: "nai", multimode: false }),
}).map(([name, value]) => ({ name, value }));

async function installedAssets(packageRoot) {
  const dist = await realpath(join(packageRoot, "ui/dist"));
  const manifest = JSON.parse(await readFile(join(dist, ".vite/manifest.json"), "utf8"));
  const entries = Object.values(manifest), paths = new Set(["index.html"]);
  for (const entry of entries) for (const file of [entry.file, ...(entry.css ?? [])]) {
    if (typeof file === "string" && /\.(js|css)$/.test(file)) paths.add(file);
  }
  const files = new Map();
  for (const file of paths) {
    const path = await realpath(join(dist, file)), within = relative(dist, path);
    assert(within && !within.startsWith("..") && !isAbsolute(within), "asset escapes installed dist");
    files.set(`/${file}`, await readFile(path));
  }
  const entryFiles = entries.filter((entry) => entry.isEntry).map((entry) => `/${entry.file}`);
  assert(entryFiles.length && [...files.keys()].some((file) => file.endsWith(".css")), "missing UI entry/CSS");
  return { files, entryFiles };
}

async function guardRequests(context, baseUrl, observation) {
  const fixtures = readFixtures({ mode: "ready" }, true);
  await context.route("**/*", async (route) => {
    const request = route.request(), url = new URL(request.url());
    try {
      assert(url.origin === baseUrl && !url.username && !url.password, "external request");
      assert.equal(request.method(), "GET", "browser mutation");
      if (["/api/health", "/api/auth/lan/session"].includes(url.pathname)) return await route.continue();
      if (url.pathname === "/api/events") return await route.fulfill({ status: 204, body: "" });
      if (url.pathname === "/api/history") return await route.fulfill({ json: url.searchParams.has("groupBy")
        ? { sessions: [], loose: [], total: 0, nextCursor: null } : { items: [], total: 0, nextCursor: null } });
      if (Object.hasOwn(fixtures, url.pathname)) return await route.fulfill({ json: fixtures[url.pathname] });
      assert(!/^\/api(?:\/|$)/i.test(url.pathname), "unknown API");
      await route.continue();
    } catch (error) {
      observation.errors.push(`${request.method()} ${url.pathname}: ${error.message}`);
      await route.abort("blockedbyclient").catch(() => {});
    }
  });
  await context.routeWebSocket(/.*/, async (socket) => {
    observation.errors.push("unexpected WebSocket");
    try { await socket.close(); } catch (error) { observation.errors.push(error.message); }
  });
}

function observeAssets(context, baseUrl, assets, observation) {
  const pending = [];
  context.on("response", (response) => {
    const kind = response.request().resourceType();
    if (!["document", "script", "stylesheet"].includes(kind)) return;
    pending.push((async () => {
      const url = new URL(response.url()), path = url.pathname === "/" ? "/index.html" : url.pathname;
      assert.equal(url.origin, baseUrl); assert(response.ok(), `asset HTTP ${response.status()}`);
      const expected = assets.files.get(path); assert(expected, `unmanifested loaded asset ${path}`);
      const bytes = await response.body(); assert(bytes.equals(expected), `installed asset mismatch: ${path}`);
      observation.assets.push({ path, bytes: bytes.length, sha256: digest(bytes), observedAt: stamp() });
    })().catch((error) => observation.errors.push(error.message)));
  });
  return pending;
}

async function reachable(locator, expect, requireHit = true) {
  await locator.scrollIntoViewIfNeeded(); await expect(locator).toBeInViewport();
  const metrics = await locator.evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    const hit = document.elementFromPoint(x + width / 2, y + height / 2);
    return { x, y, width, height, hit: hit !== null && element.contains(hit),
      clientHeight: element.clientHeight, scrollHeight: element.scrollHeight,
      clientWidth: element.clientWidth, scrollWidth: element.scrollWidth };
  });
  assert(metrics.width > 0 && metrics.height > 0 && (!requireHit || metrics.hit), "control clipped or obscured");
  return metrics;
}

async function exercise(page, mobile, observation, expect) {
  await expect(page.locator(".app")).toHaveAttribute("data-ui-mode", "classic");
  if (mobile) {
    await page.locator("button.mobile-app-bar__generate").click();
    await expect(page.locator("#mobile-generate-sheet")).toHaveAttribute("aria-hidden", "false");
    await expect(page.locator("#mobile-sheet-tab-prompt")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#mobile-generate-sheet")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  }
  const root = page.locator(mobile ? "#mobile-generate-sheet .composer:visible" : ".sidebar__scroll > .composer--sidebar");
  await expect(root).toBeVisible();
  const inputs = [root.locator(".composer__textarea"), root.locator(".negative-prompt__textarea")];
  const values = ["Published artifact landscape / 포지티브 초안", "low quality, @literal / 제외할 요소"];
  observation.panes = [];
  for (const [i, input] of inputs.entries()) {
    await expect(input).toBeVisible(); await input.fill(values[i]);
    const geometry = await reachable(input, expect);
    observation.panes.push({ value: await input.inputValue(), ...geometry });
    assert(geometry.height >= (mobile ? 160 : 72), "prompt pane below supported height");
  }
  observation.toolbar = [];
  const buttons = root.locator(".composer__toolbar button");
  for (const button of await buttons.all()) {
    if (!await button.isVisible()) continue;
    const enabled = await button.isEnabled(), geometry = await reachable(button, expect, enabled);
    if (enabled) await button.click({ trial: true });
    observation.toolbar.push({ text: await button.textContent(), enabled, ...geometry });
  }
  assert(observation.toolbar.length > 0, "no visible toolbar controls");
  for (const [i, input] of inputs.entries()) await expect(input).toHaveValue(values[i]);
  observation.page = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth }));
  assert(observation.page.scrollWidth <= observation.page.clientWidth + 1, "horizontal page overflow");
  await inputs[0].scrollIntoViewIfNeeded(); await page.evaluate(async () => { await document.fonts.ready; });
}

async function captureViewport(browser, options, assets, observation, expect) {
  let context, page, pending = [];
  try {
    context = await browser.newContext({ viewport: observation.viewport, serviceWorkers: "block",
      storageState: { cookies: [], origins: [{ origin: options.baseUrl, localStorage: seed }] } });
    context.setDefaultTimeout(10_000); context.setDefaultNavigationTimeout(15_000);
    await guardRequests(context, options.baseUrl, observation);
    pending = observeAssets(context, options.baseUrl, assets, observation);
    page = await context.newPage(); page.on("pageerror", (error) => observation.errors.push(error.message));
    await page.goto(options.baseUrl, { waitUntil: "load" });
    await exercise(page, observation.name === "mobile", observation, expect);
  } catch (error) { observation.errors.push(error.stack ?? error.message); }
  finally {
    try {
      if (page) {
        const png = await page.screenshot({ path: join(options.outputDir, `${observation.name}.png`), timeout: 10_000 });
        observation.screenshot = { file: `${observation.name}.png`, sha256: digest(png), capturedAt: stamp() };
      }
    } catch (error) { observation.errors.push(`screenshot: ${error.message}`); }
    finally {
      try { await context?.close(); observation.contextClosed = Boolean(context); }
      catch (error) { observation.errors.push(`context cleanup: ${error.message}`); }
    }
    await Promise.all(pending);
    if (!observation.assets.some((asset) => asset.path === "/index.html")) observation.errors.push("no verified HTML loaded");
    for (const path of assets.entryFiles) if (!observation.assets.some((asset) => asset.path === path)) observation.errors.push(`entry not loaded: ${path}`);
    if (!observation.assets.some((asset) => asset.path.endsWith(".css"))) observation.errors.push("no verified CSS loaded");
    observation.finishedAt = stamp();
  }
}

export async function inspectPublishedUi(options) {
  const { baseUrl, packageRoot, version, sourceSha, driverSha, artifactKind, publisher, outputDir } = options;
  const receipt = { artifactKind, productSha: sourceSha, driverSha, version, publisher,
    integrity: options.integrity, baseUrl, startedAt: stamp(), viewports: [], errors: [], browserClosed: false,
    fixtureScope: "J6 synthetic provider/status GETs; real health/auth/static; external, unknown API and mutations denied",
    interactionScope: "classic/default NovelAI; fill and preserve drafts; enabled toolbar trial only; no generation" };
  let browser;
  try {
    const url = new URL(baseUrl);
    assert(url.origin === baseUrl && url.hostname === "127.0.0.1" && url.protocol === "http:" && url.port && url.port !== "3333");
    assert(["candidate", "published"].includes(artifactKind));
    for (const sha of [sourceSha, driverSha]) assert.match(sha, /^[0-9a-f]{40}$/);
    if (artifactKind === "candidate") assert.equal(sourceSha, driverSha);
    else assert(publisher?.signatureVerified && publisher.gitHead === sourceSha && publisher.version === version
      && publisher.integrity === options.integrity && publisher.runId && publisher.runAttempt, "missing matching publisher proof");
    const installed = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
    assert.equal(installed.name, "ima2-gen"); assert.equal(installed.version, version); assert.equal(installed.gitHead, sourceSha);
    const healthResponse = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(10_000) });
    assert(healthResponse.ok); receipt.health = await healthResponse.json();
    assert.equal(receipt.health.ok, true); assert.equal(receipt.health.version, version);
    const assets = await installedAssets(packageRoot), { chromium, expect } = uiRequire("@playwright/test");
    browser = await chromium.launch({ headless: true });
    for (const [name, width, height] of [["desktop", 1157, 826], ["mobile", 390, 844]]) {
      const observation = { name, viewport: { width, height }, startedAt: stamp(), assets: [], errors: [] };
      receipt.viewports.push(observation); await captureViewport(browser, options, assets, observation, expect);
    }
  } catch (error) { receipt.errors.push(error.stack ?? error.message); }
  finally {
    try { if (browser) { await browser.close(); receipt.browserClosed = true; } }
    catch (error) { receipt.errors.push(`browser cleanup: ${error.message}`); }
    receipt.finishedAt = stamp();
    receipt.passed = receipt.browserClosed && receipt.viewports.length === 2 && !receipt.errors.length
      && receipt.viewports.every((view) => view.contextClosed && !view.errors.length);
    await writeFile(join(outputDir, "ui-proof.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  }
  assert(receipt.passed, `installed UI proof failed: ${JSON.stringify(receipt.errors.concat(receipt.viewports.flatMap((view) => view.errors)))}`);
  return receipt;
}
