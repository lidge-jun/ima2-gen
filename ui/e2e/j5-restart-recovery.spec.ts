import type { Page, Request, TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import type { GenerationRequestLogEntry } from "../../lib/generationRequestLog";
import type { HistoryPage } from "../src/lib/api-history";
import type { getInflight } from "../src/lib/api-inflight";
import { expect, seedBrowser, startApp, test, type AppHandle } from "./fixtures/appServer";
import { j6EvidenceIdentity, requestObject } from "./fixtures/j6Selection";

const PROMPT = "a red cube";
const CANCEL_PROMPT = "a blue cube to cancel";
// Direct generation retains the existing server-side exact-size instruction (J3).
const SIZE_HINT = " IMPORTANT: the output image MUST be square, 1024x1024 pixels. Do not produce a portrait or landscape image.";
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };
type Submission = { path: string; body: Record<string, unknown> };
type Inflight = Awaited<ReturnType<typeof getInflight>>;
type Artifact = { requestId: string; filename: string; url: string };

async function readAppJson<T>(page: Page, path: string): Promise<T> {
  try {
    return await page.evaluate(async (pathname) => {
      const response = await fetch(pathname);
      if (!response.ok) throw new Error(`Journey read failed: ${pathname} (${response.status})`);
      return response.json();
    }, path);
  } catch (error) { throw error; }
}

async function renderedArtifact(page: Page, artifact: Artifact) {
  try {
    const image = page.locator("img.result-img:visible");
    await expect(image).toHaveCount(1);
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => ({
      filename: decodeURIComponent(new URL(node.currentSrc || node.src).pathname).slice("/generated/".length),
      generated: new URL(node.currentSrc || node.src).pathname.startsWith("/generated/"),
      loaded: node.complete && node.naturalWidth > 0 && node.naturalHeight > 0,
    }))).toEqual({ filename: artifact.filename, generated: true, loaded: true });
    return await image.evaluate((node: HTMLImageElement) => ({
      src: node.currentSrc, width: node.naturalWidth, height: node.naturalHeight,
    }));
  } catch (error) { throw error; }
}

async function capture(page: Page, info: TestInfo, name: string) {
  try {
    await page.evaluate(async () => { await document.fonts.ready; });
    const filename = `wp12-${name}.png`;
    const path = info.outputPath(filename);
    await page.screenshot({ path });
    await info.attach(filename, { path, contentType: "image/png" });
    return { filename, viewport: page.viewportSize() };
  } catch (error) { throw error; }
}

async function generateArtifact(page: Page, app: AppHandle, submissions: Submission[]): Promise<Artifact> {
  try {
    await page.locator(".composer:visible .composer__textarea").fill(PROMPT);
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await expect.poll(() => submissions.length).toBe(1);
    expect(submissions[0]).toMatchObject({ path: "/api/generate", body: {
      provider: "minimax", model: "image-01", prompt: PROMPT, async: true,
    } });
    const requestId = submissions[0]!.body.requestId;
    if (typeof requestId !== "string" || !requestId) throw new Error("Missing generation requestId");
    await expect.poll(async () => (await readAppJson<Inflight>(page, "/api/inflight?includeTerminal=1"))
      .terminalJobs?.find((job) => job.requestId === requestId)?.status).toBe("completed");
    const history = await readAppJson<HistoryPage>(page, `/api/history?requestId=${encodeURIComponent(requestId)}`);
    expect(history.items).toHaveLength(1);
    const item = history.items[0]!;
    expect(item).toMatchObject({ requestId, prompt: PROMPT, provider: "minimax", model: "image-01" });
    const terminal = (await readAppJson<Inflight>(page, "/api/inflight?includeTerminal=1"))
      .terminalJobs?.find((job) => job.requestId === requestId);
    expect(terminal?.meta).toMatchObject({ filenames: [item.filename], imageCount: 1 });
    expect(app.stub.generationRequests).toEqual([{ path: "/v1/image_generation",
      body: expect.objectContaining({ model: "image-01", prompt: PROMPT + SIZE_HINT }) }]);
    expect(app.stub.generationReplies).toBe(1);
    const artifact = { requestId, filename: item.filename, url: item.url };
    await renderedArtifact(page, artifact);
    app.guard.assertClean();
    return artifact;
  } catch (error) { throw error; }
}

async function cancelHeld(page: Page, app: AppHandle, submissions: Submission[], info: TestInfo, artifact: Artifact) {
  const held = app.stub.holdNextGeneration();
  try {
    await page.locator(".composer:visible .composer__textarea").fill(CANCEL_PROMPT);
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await held.submitted;
    expect(submissions).toHaveLength(2);
    const requestId = submissions[1]!.body.requestId;
    if (typeof requestId !== "string" || !requestId) throw new Error("Missing cancellation requestId");
    expect(requestId).not.toBe(artifact.requestId);
    expect(submissions[1]).toMatchObject({ path: "/api/generate", body: {
      provider: "minimax", model: "image-01", prompt: CANCEL_PROMPT, async: true,
    } });
    expect(app.stub.generationRequests).toHaveLength(2);
    expect(app.stub.generationRequests[1]).toMatchObject({ path: "/v1/image_generation",
      body: { model: "image-01", prompt: CANCEL_PROMPT + SIZE_HINT } });
    expect(app.stub.generationReplies).toBe(1);
    await page.locator(".inflight-badge--popup:visible").click();
    const cancel = page.getByRole("button", { name: `Cancel generation: ${CANCEL_PROMPT}`, exact: true });
    await expect(cancel).toBeVisible();
    await expect(page.locator(".inflight-popup[data-positioned=true]")).toHaveCSS("opacity", "1");
    const heldScreenshot = await capture(page, info, "held-desktop");
    const [response] = await Promise.all([
      page.waitForResponse((res) => res.request().method() === "DELETE"
        && new URL(res.url()).pathname === `/api/inflight/${encodeURIComponent(requestId)}`),
      cancel.click(),
    ]);
    expect(response.ok()).toBe(true);
    expect(await response.json()).toMatchObject({ requestId });
    held.release();
    // The tombstone precedes adapter shutdown; the pipeline's finally log is
    // the drain cue before checking for a late persisted success.
    await expect.poll(async () => (await readAppJson<{ items: GenerationRequestLogEntry[] }>(page, "/api/generation-requests"))
      .items.find((entry) => entry.requestId === requestId)).toMatchObject({ succeeded: 0, error: "GENERATION_CANCELED" });
    await expect(cancel).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Generate", exact: true })).toBeEnabled();
    const state = await readAppJson<Inflight>(page, "/api/inflight?includeTerminal=1");
    expect(state.jobs).toEqual([]);
    expect(state.terminalJobs?.find((job) => job.requestId === requestId)).toMatchObject({ status: "canceled", errorCode: "GENERATION_CANCELED" });
    const history = await readAppJson<HistoryPage>(page, "/api/history");
    expect(history.items.map((item) => item.filename)).toEqual([artifact.filename]);
    await renderedArtifact(page, artifact);
    app.guard.assertClean();
    return { requestId, terminal: { status: "canceled", errorCode: "GENERATION_CANCELED" }, heldScreenshot,
      screenshot: await capture(page, info, "canceled-desktop"), repliesAfterRelease: app.stub.generationReplies };
  } finally { held.release(); }
}

async function verifyRestart(page: Page, app: AppHandle, artifact: Artifact, info: TestInfo) {
  try {
    await page.goto(app.baseUrl); // The existing seed initializes this new origin once.
    const history = await readAppJson<HistoryPage>(page, "/api/history");
    expect(history.items).toHaveLength(1);
    expect(history.items[0]).toMatchObject({ ...artifact, prompt: PROMPT, provider: "minimax", model: "image-01" });
    const image = await renderedArtifact(page, artifact);
    await expect(page.locator(".result-prompt__text")).toHaveText(PROMPT);
    const desktop = await capture(page, info, "restored-desktop");
    await page.setViewportSize(MOBILE);
    await expect(page.locator(".app")).toHaveAttribute("data-mobile", "1");
    await renderedArtifact(page, artifact);
    const mobile = await capture(page, info, "restored-mobile");
    expect(app.stub.generationRequests).toEqual([]);
    expect(app.stub.generationReplies).toBe(0);
    app.guard.assertClean();
    return { image, desktop, mobile, guardClean: true,
      upstreamRequests: app.stub.generationRequests, replies: app.stub.generationReplies };
  } catch (error) { throw error; }
}

test("J5 same isolated home preserves generated artifact and canceled work after restart", async ({ page }, info) => {
  const submissions: Submission[] = [];
  const evidence: Record<string, unknown> = { ...j6EvidenceIdentity() };
  const observe = (request: Request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST" && /^\/api\/(?:generate|edit|node\/generate|video\/generate)(?:\/|$)/.test(path)) {
      submissions.push({ path, body: requestObject(request.postDataJSON()) });
    }
  };
  page.on("request", observe);
  let app: AppHandle | undefined;
  try {
    app = await startApp("minimax");
    const home = app.home;
    await seedBrowser(page, { dismissOnboarding: true, generationDefaults: { promptMode: "direct", multimode: false } });
    await page.setViewportSize(DESKTOP);
    await page.goto(app.baseUrl);
    await page.locator(".nav-rail").getByRole("button", { name: "Create", exact: true }).click();
    const artifact = await generateArtifact(page, app, submissions);
    evidence.artifact = artifact;
    evidence.generated = await capture(page, info, "generated-desktop");
    evidence.cancellation = await cancelHeld(page, app, submissions, info, artifact);
    evidence.firstRun = { guardClean: true, upstreamRequestCount: app.stub.generationRequests.length, replies: app.stub.generationReplies };
    await page.goto("about:blank");
    await app.close();
    evidence.firstRunClosed = true;
    const submissionsBeforeRestart = submissions.length;
    app = await startApp("minimax", { home });
    evidence.restart = await verifyRestart(page, app, artifact, info);
    expect(submissions).toHaveLength(2);
    evidence.newSubmissionsAfterRestart = submissions.length - submissionsBeforeRestart;
    expect(evidence.newSubmissionsAfterRestart).toBe(0);
    evidence.passed = true;
  } finally {
    try { await page.close(); }
    finally {
      try { await app?.close(); evidence.resourcesClosed = true; }
      finally {
        page.off("request", observe);
        const path = info.outputPath("wp12-journey.json");
        const submissionIdentity = submissions.map(({ path: endpoint, body }) => ({
          endpoint, requestId: body.requestId, provider: body.provider, model: body.model,
        }));
        await writeFile(path, JSON.stringify({ ...evidence, submissions: submissionIdentity }, null, 2));
        await info.attach("wp12-journey.json", { contentType: "application/json",
          path });
      }
    }
  }
});
