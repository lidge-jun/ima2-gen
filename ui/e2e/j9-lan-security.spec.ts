import type { BrowserContext, Page, TestInfo } from "@playwright/test";
import { createServer as createHttpServer, request as httpRequest } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { assertJ6Isolation, expect, seedBrowser, startApp, test, type AppHandle } from "./fixtures/appServer";
import { issueAppHome, registerOwnedApp } from "./fixtures/appOwnership";
import { j6EvidenceIdentity } from "./fixtures/j6Selection";
import { trackingVideoBytes } from "./fixtures/jobTrackingMedia";

const TOKEN = "synthetic-j9-lan-token";
const DESKTOP = { width: 1440, height: 1000 };
type Evidence = Record<string, unknown>;
type NativeStreamWindow = Window & { j9Stream: EventSource; j9StreamState: { opened: boolean; ended: boolean } };

async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(async () => { await document.fonts.ready; });
  const file = `wp12-j9-${name}.png`;
  await page.screenshot({ path: info.outputPath(file) });
  return { file, viewport: page.viewportSize() };
}

async function seedMedia(home: string) {
  const { default: sharp } = await import("sharp");
  const raw = { create: { width: 2, height: 2, channels: 3 as const, background: { r: 32, g: 64, b: 96 } } };
  const png = await sharp(raw).png().toBuffer(), thumb = await sharp(raw).jpeg().toBuffer();
  const dir = join(home, "generated"); await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "j9-image.png"), png);
  await writeFile(join(dir, "j9-image.png.thumb.jpg"), thumb);
  await writeFile(join(dir, "j9-video.mp4"), trackingVideoBytes);
  // Precomputed synthetic thumbnails avoid unrelated ffmpeg work during startup.
  await writeFile(join(dir, "j9-video.mp4.thumb.jpg"), thumb);
}

async function withLan(page: Page, info: TestInfo, name: string,
  run: (app: AppHandle, evidence: Evidence) => Promise<void>,
  options: { publicOrigins?: readonly string[]; media?: boolean; locale?: "en" | "ko" } = {}) {
  assertJ6Isolation();
  const evidence: Evidence = { ...j6EvidenceIdentity(), scenario: name };
  let app: AppHandle | undefined;
  try {
    app = await startApp("minimax", { lan: { token: TOKEN, publicOrigins: options.publicOrigins ?? [] },
      ...(options.media ? { prepareRuntime: async ({ home }: { home: string }) => seedMedia(home) } : {}) });
    await seedBrowser(page, { dismissOnboarding: true, locale: options.locale ?? "en",
      generationDefaults: { promptMode: "direct", multimode: false } });
    await page.setViewportSize(DESKTOP);
    await run(app, evidence);
    app.guard.assertClean(); evidence.passed = true;
  } finally {
    let closed = false;
    try { await page.close(); await app?.close(); closed = true; }
    finally {
      evidence.resourcesClosed = closed;
      await writeFile(info.outputPath(`wp12-j9-${name}.json`), JSON.stringify(evidence, null, 2));
    }
  }
}

async function connected(page: Page, base: string) {
  await page.goto(`${base}/?token=${encodeURIComponent(TOKEN)}`);
  await expect(page.locator(".app")).toBeVisible();
  expect(new URL(page.url()).searchParams.has("token")).toBe(false);
  expect(new URL(page.url()).origin).toBe(base);
}

async function cookieProof(page: Page, secure: boolean) {
  const cookies = await page.context().cookies();
  const session = cookies.find(cookie => /^(?:__Host-)?ima2_lan_/.test(cookie.name));
  expect(session).toBeTruthy();
  expect(session!.httpOnly).toBe(true); expect(session!.secure).toBe(secure);
  expect(session!.sameSite).toBe("Strict"); expect(session!.path).toBe("/");
  expect(session!.value).not.toBe(TOKEN);
  expect(await page.evaluate(token => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]).includes(token), TOKEN)).toBe(false);
  expect(await page.evaluate(name => document.cookie.includes(name + "="), session!.name)).toBe(false);
  return { name: session!.name, httpOnly: session!.httpOnly, secure: session!.secure, sameSite: session!.sameSite };
}

async function nativeStream(page: Page) {
  await page.evaluate(() => {
    const view = window as unknown as NativeStreamWindow;
    const source = new EventSource("/api/events");
    view.j9Stream = source; view.j9StreamState = { opened: false, ended: false };
    source.onopen = () => { view.j9StreamState.opened = true; };
    source.onerror = () => { view.j9StreamState.ended = true; source.close(); };
  });
  await expect.poll(() => page.evaluate(() => (window as unknown as NativeStreamWindow).j9StreamState.opened)).toBe(true);
}

async function mediaProof(page: Page) {
  const proof = await page.evaluate(async () => {
    const image = new Image(); image.src = "/generated/j9-image.png"; await image.decode();
    const video = document.createElement("video"); video.preload = "metadata";
    const loaded = new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error("Native video failed"));
    });
    video.src = "/generated/j9-video.mp4"; video.load();
    try {
      await loaded;
      const range = await fetch("/generated/j9-video.mp4", { headers: { Range: "bytes=0-11" } });
      const head = await fetch("/generated/j9-image.png", { method: "HEAD" });
      return { image: [image.naturalWidth, image.naturalHeight], video: [video.videoWidth, video.videoHeight],
        rangeStatus: range.status, range: [...new Uint8Array(await range.arrayBuffer())],
        cache: range.headers.get("cache-control"), headStatus: head.status, headBytes: (await head.arrayBuffer()).byteLength };
    } finally { video.pause(); video.removeAttribute("src"); video.load(); }
  });
  expect(proof.image).toEqual([2, 2]); expect(proof.video).toEqual([64, 64]);
  expect(proof.rangeStatus).toBe(206); expect(proof.range).toEqual([...trackingVideoBytes.subarray(0, 12)]);
  expect(proof.cache).toBe("private, no-store, max-age=0");
  expect(proof.headStatus).toBe(200); expect(proof.headBytes).toBe(0);
  return proof;
}

async function revokeWithoutClearingBrowserCookie(page: Page, base: string) {
  const cookie = (await page.context().cookies()).find(item => /^ima2_lan_/.test(item.name));
  expect(cookie).toBeTruthy();
  // Separate native client: Set-Cookie clears no browser cookie here. The next
  // browser status request presents the same stale cookie as after server expiry.
  const result = await fetch(`${base}/api/auth/lan/session`, { method: "DELETE",
    headers: { Origin: base, Cookie: `${cookie!.name}=${cookie!.value}` } });
  expect(result.status).toBe(204); await result.arrayBuffer();
  expect((await page.context().cookies()).find(item => item.name === cookie!.name)?.value).toBe(cookie!.value);
}

async function signIn(page: Page) {
  await expect(page.getByRole("heading", { name: "Connect to your studio" })).toBeVisible();
  await page.getByLabel("LAN token", { exact: true }).fill(TOKEN);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.locator(".app")).toBeVisible();
}

test("J9 native HTTP bootstrap, cookies, SSE, media and same-origin reload", async ({ page }, info) => {
  await withLan(page, info, "http", async (app, evidence) => {
    let tokenInApiUrl = false, tokenHeaderOutsideBootstrap = false;
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/")) {
        tokenInApiUrl ||= url.searchParams.has("token");
        tokenHeaderOutsideBootstrap ||= !!request.headers()["x-ima2-token"] && url.pathname !== "/api/auth/lan/session";
      }
    });
    await connected(page, app.baseUrl);
    evidence.cookie = await cookieProof(page, false);
    await nativeStream(page); evidence.media = await mediaProof(page);
    await page.reload(); await expect(page.locator(".app")).toBeVisible();
    expect(new URL(page.url()).hostname).toBe("localhost");
    expect(tokenInApiUrl).toBe(false); expect(tokenHeaderOutsideBootstrap).toBe(false);
    evidence.reloadOriginPreserved = true;
    evidence.screenshot = await capture(page, info, "http-connected");
  }, { media: true });
});

test("J9 Korean mobile sign-in rejects wrong tokens and clears the field", async ({ page }, info) => {
  await withLan(page, info, "signin-ko", async (app, evidence) => {
    await page.setViewportSize({ width: 320, height: 740 }); await page.goto(app.baseUrl);
    await expect(page.getByRole("heading", { name: "스튜디오에 연결" })).toBeVisible();
    await page.getByLabel("LAN 토큰", { exact: true }).fill("synthetic-wrong-token");
    await page.getByRole("button", { name: "연결", exact: true }).click();
    await expect(page.locator("#lan-sign-in-error")).toBeVisible();
    await expect(page.locator("#lan-token")).toHaveValue("");
    expect(await page.locator(".app").count()).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    evidence.screenshot = await capture(page, info, "signin-ko-mobile");
  }, { locale: "ko" });
});

test("J9 refused cookie storage never loads private App requests", async ({ page }, info) => {
  await withLan(page, info, "cookie-blocked", async (app, evidence) => {
    let privateRequests = 0;
    page.on("request", request => {
      const path = new URL(request.url()).pathname;
      if (path.startsWith("/api/") && path !== "/api/auth/lan/session") privateRequests++;
    });
    await page.context().route(`${app.baseUrl}/api/auth/lan/session`, async route => {
      if (route.request().method() !== "POST") { await route.fallback(); return; }
      // A separate native client cannot populate Playwright's shared browser cookie jar.
      const response = await fetch(route.request().url(), { method: "POST", redirect: "error",
        headers: { Origin: app.baseUrl, "Content-Type": "application/json", "X-Ima2-Token": TOKEN }, body: "{}" });
      expect(response.status).toBe(204); expect(response.headers.get("set-cookie")).toBeTruthy();
      await response.arrayBuffer();
      expect((await page.context().cookies()).some(cookie => cookie.name.startsWith("ima2_lan_"))).toBe(false);
      await route.fulfill({ status: 204 });
    });
    await page.goto(app.baseUrl);
    await page.getByLabel("LAN token", { exact: true }).fill(TOKEN);
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText("Allow cookies for this studio, then connect again.");
    expect(privateRequests).toBe(0); expect(await page.locator(".app").count()).toBe(0);
    evidence.privateRequests = privateRequests;
    evidence.screenshot = await capture(page, info, "cookie-blocked");
  });
});

test("J9 stale cookie locks UI, preserves accepted work and resumes without submitting again", async ({ page }, info) => {
  await withLan(page, info, "reauth", async (app, evidence) => {
    await connected(page, app.baseUrl); await nativeStream(page);
    await page.clock.install({ time: new Date() });
    let posts = 0, reads = 0, cancels = 0;
    page.on("request", request => {
      const path = new URL(request.url()).pathname;
      if (path === "/api/generate" && request.method() === "POST") posts++;
      if (/^\/api\/(inflight|history)(?:\/|$)/.test(path) && request.method() === "GET") reads++;
      if (path.startsWith("/api/inflight/") && request.method() === "DELETE") cancels++;
    });
    const held = app.stub.holdNextGeneration();
    try {
      await page.locator(".nav-rail").getByRole("button", { name: "Create", exact: true }).click();
      await page.locator(".composer:visible .composer__textarea").fill("LAN accepted work");
      await page.getByRole("button", { name: "Generate", exact: true }).click(); await held.submitted;
      expect(posts).toBe(1);
      await revokeWithoutClearingBrowserCookie(page, app.baseUrl);
      await expect(page.getByRole("heading", { name: "Connect to your studio" })).toBeVisible();
      await expect.poll(() => page.evaluate(() => (window as unknown as NativeStreamWindow).j9StreamState.ended)).toBe(true);
      const before = reads; await page.clock.fastForward(6000); expect(reads).toBe(before);
      evidence.locked = await capture(page, info, "reauth-locked");
      await signIn(page); expect(posts).toBe(1); expect(cancels).toBe(0);
      held.release();
      await expect(page.locator("img.result-img:visible")).toBeVisible();
      expect(posts).toBe(1); expect(cancels).toBe(0);
      expect(await page.locator(".toast.error").allTextContents()).toEqual([]);
      evidence.after = await capture(page, info, "reauth-completed");
      evidence.posts = posts; evidence.cancels = cancels; evidence.upstreamRequests = app.stub.generationRequests.length;
    } finally { held.release(); }
  });
});

test("J9 capacity wait from an old auth period cannot submit after sign-in", async ({ page }, info) => {
  await withLan(page, info, "capacity", async (app, evidence) => {
    await connected(page, app.baseUrl); await page.clock.install({ time: new Date() });
    let posts = 0;
    await page.context().route(`${app.baseUrl}/api/generate`, async route => {
      posts++;
      await route.fulfill({ status: 429, headers: { "Content-Type": "application/json", "Retry-After": "5" },
        body: JSON.stringify({ code: "TOO_MANY_JOBS", error: "Synthetic capacity hold" }) });
    });
    await page.locator(".nav-rail").getByRole("button", { name: "Create", exact: true }).click();
    await page.locator(".composer:visible .composer__textarea").fill("Do not replay after auth loss");
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await expect.poll(() => posts).toBe(1);
    await revokeWithoutClearingBrowserCookie(page, app.baseUrl); await signIn(page);
    await page.clock.fastForward(6000);
    expect(posts).toBe(1); expect(app.stub.generationRequests).toEqual([]);
    await expect(page.locator(".app")).toBeVisible();
    expect(await page.locator(".toast.error").allTextContents()).toEqual([]);
    evidence.posts = posts; evidence.screenshot = await capture(page, info, "capacity-no-replay");
  });
});

test("J9 accepted extension retains its ResultActions owner through native auth loss and reauth", async ({ page }, info) => {
  await withLan(page, info, "extension-reauth", async (app, evidence) => {
    type ExtensionWindow = Window & { j9ExtensionStreams: EventSource[] };
    await page.addInitScript(() => {
      const view = window as unknown as ExtensionWindow, NativeEventSource = window.EventSource;
      view.j9ExtensionStreams = [];
      // Keep native cookie/SSE transport; retain handles only to deliver a synthetic job terminal.
      window.EventSource = class extends NativeEventSource {
        constructor(url: string | URL, options?: EventSourceInit) {
          super(url, options); view.j9ExtensionStreams.push(this);
        }
      };
      localStorage.setItem("ima2.selectedFilename", "j9-video.mp4");
    });
    const item = { filename: "j9-video.mp4", url: "/generated/j9-video.mp4", image: "/generated/j9-video.mp4",
      mediaType: "video", format: "mp4", provider: "grok", model: "grok-imagine-video-1.5", prompt: "Synthetic extension", createdAt: 100 };
    await page.context().route(`${app.baseUrl}/api/history?*`, route => {
      const grouped = new URL(route.request().url()).searchParams.has("groupBy");
      return route.fulfill({ json: grouped ? { sessions: [], loose: [item], total: 1, nextCursor: null }
        : { items: [item], total: 1, nextCursor: null } });
    });
    let posts = 0, cancels = 0, requestId = "";
    page.on("request", request => {
      if (request.method() === "DELETE" && new URL(request.url()).pathname.startsWith("/api/inflight/")) cancels++;
    });
    await page.context().route(`${app.baseUrl}/api/video/extend`, async route => {
      expect(route.request().method()).toBe("POST");
      const payload = route.request().postDataJSON(); posts++; requestId = payload.requestId;
      expect(payload.sourceVideoId).toBe(item.filename);
      await route.fulfill({ status: 202, json: { requestId, sourceVideoId: item.filename, workflow: "last-frame-i2v" } });
    });
    await connected(page, app.baseUrl);
    await page.locator(".nav-rail").getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.locator(".result-actions")).toBeVisible();
    const extend = page.locator('.result-actions button[title="Continue this video from its last frame"]');
    await expect(page.locator(".history-thumb--video")).toHaveCount(1);
    await expect(extend).toBeEnabled();
    const acceptance = page.waitForResponse(response => new URL(response.url()).pathname === "/api/video/extend");
    await extend.click(); expect((await acceptance).status()).toBe(202);
    await expect(extend).toHaveAttribute("aria-busy", "true");
    await revokeWithoutClearingBrowserCookie(page, app.baseUrl);
    await expect(page.getByRole("heading", { name: "Connect to your studio" })).toBeVisible();
    await expect(page.locator(".result-actions")).toHaveCount(0);
    await signIn(page);
    await expect(extend).toBeDisabled(); await expect(extend).toHaveAttribute("aria-busy", "true");
    expect(posts).toBe(1); expect(cancels).toBe(0);
    await expect.poll(() => page.evaluate(() => (window as unknown as ExtensionWindow).j9ExtensionStreams
      .filter(source => source.readyState === EventSource.OPEN).length)).toBeGreaterThan(0);
    await page.evaluate(id => {
      const source = [...(window as unknown as ExtensionWindow).j9ExtensionStreams].reverse().find(stream => stream.readyState === EventSource.OPEN)!;
      source.dispatchEvent(new MessageEvent("done", { data: JSON.stringify({ requestId: id, filename: "j9-extended.mp4",
        url: "/generated/j9-video.mp4", mediaType: "video", provider: "grok", model: "grok-imagine-video-1.5",
        prompt: "Synthetic extension completed", userPrompt: "Synthetic extension", createdAt: Date.now() }) }));
    }, requestId);
    await expect(extend).toBeEnabled();
    await expect(page.locator(".history-thumb--video")).toHaveCount(2);
    expect(posts).toBe(1); expect(cancels).toBe(0); expect(app.stub.generationRequests).toEqual([]);
    expect(await page.locator(".toast.error").allTextContents()).toEqual([]);
    evidence.posts = posts; evidence.cancels = cancels;
    evidence.transport = "native LAN cookie, auth loss, EventSource and ResultActions remount";
    evidence.job = "synthetic 202 and terminal event; no provider generation";
    evidence.screenshot = await capture(page, info, "extension-reauth-completed");
  }, { media: true });
});

async function tlsProxy() {
  assertJ6Isolation();
  const home = await issueAppHome();
  const key = join(home, "key.pem"), cert = join(home, "cert.pem");
  try {
    await promisify(execFile)("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
      "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1", "-config", "/dev/null",
      "-keyout", key, "-out", cert], { cwd: home, env: { PATH: process.env.PATH, RANDFILE: join(home, "rand") }, timeout: 10_000 });
  } catch { throw new Error("J9 synthetic TLS fixture could not be generated"); }
  let target = "", closed = false;
  const proxy = createHttpsServer({ key: await readFile(key), cert: await readFile(cert) }, (request, response) => {
    if (!target) { response.writeHead(503).end(); return; }
    const upstream = httpRequest(target + request.url, { method: request.method, headers: request.headers }, result => {
      response.writeHead(result.statusCode ?? 502, result.headers); result.pipe(response);
    });
    upstream.on("error", () => { if (!response.headersSent) response.writeHead(502); response.end(); });
    response.on("close", () => upstream.destroy()); request.pipe(upstream);
  });
  await new Promise<void>((resolve, reject) => { proxy.once("error", reject); proxy.listen(0, "127.0.0.1", resolve); });
  const address = proxy.address(); if (!address || typeof address === "string") throw new Error("J9 proxy address missing");
  const origin = `https://localhost:${address.port}`;
  const close = async () => { if (closed) return; proxy.closeAllConnections(); await new Promise<void>(resolve => proxy.close(() => resolve())); closed = true; };
  return { origin, close, async connect(app: AppHandle) {
    target = app.baseUrl;
    await registerOwnedApp({ home, appOrigin: origin, stubOrigin: new URL(app.stub.url).origin,
      closeResources: close, exited: () => closed, verificationReported: () => closed,
      verify: () => { if (!closed) throw new Error("J9 proxy not closed"); } });
  } };
}

test("J9 native TLS cookie and media, hostile-origin refusal and explicit UI sign-out", async ({ browser }, info) => {
  const proxy = await tlsProxy();
  let context: BrowserContext | undefined;
  try {
    context = await browser.newContext({ ignoreHTTPSErrors: true, serviceWorkers: "block" });
    const page = await context.newPage();
    await withLan(page, info, "tls", async (app, evidence) => {
      await proxy.connect(app); await connected(page, proxy.origin);
      evidence.cookie = await cookieProof(page, true); await nativeStream(page); evidence.media = await mediaProof(page);
      let closed = false;
      const hostile = createHttpServer((_request, response) => response.end("<!doctype html><title>Owned foreign origin</title>"));
      await new Promise<void>(resolve => hostile.listen(0, "127.0.0.1", resolve));
      const address = hostile.address(); if (!address || typeof address === "string") throw new Error("J9 origin missing");
      const origin = `http://localhost:${address.port}`;
      const close = async () => { if (closed) return; hostile.closeAllConnections(); await new Promise<void>(resolve => hostile.close(() => resolve())); closed = true; };
      await registerOwnedApp({ home: app.home, appOrigin: origin, stubOrigin: new URL(app.stub.url).origin,
        closeResources: close, exited: () => closed, verificationReported: () => closed, verify: () => expect(closed).toBe(true) });
      try {
        await page.goto(origin);
        const observed = page.waitForResponse(response => new URL(response.url()).pathname === "/api/__j9_origin_probe");
        await page.evaluate(async base => { await fetch(base + "/api/__j9_origin_probe", { method: "POST", mode: "no-cors", credentials: "include" }); }, app.baseUrl);
        expect((await observed).status()).toBe(403); evidence.hostileOriginStatus = 403;
      } finally { await close(); }
      await page.goto(proxy.origin); await expect(page.locator(".app")).toBeVisible();
      evidence.screenshot = await capture(page, info, "tls-connected");
      await page.locator(".nav-rail").getByRole("button", { name: "Settings", exact: true }).click();
      await page.getByRole("button", { name: "Sign out of studio", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Connect to your studio" })).toBeVisible();
      evidence.signedOut = true; evidence.signout = await capture(page, info, "tls-signed-out");
    }, { publicOrigins: [proxy.origin], media: true });
  } finally {
    try { await context?.close(); } finally { await proxy.close(); }
  }
});
