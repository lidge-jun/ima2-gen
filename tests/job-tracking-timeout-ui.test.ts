import assert from "node:assert/strict";
import test from "node:test";
import { withJobTrackingUi, type JobTrackingUiFixture, type UiRequest } from "./_jobTrackingUiFixture.ts";
import type { GraphNode } from "../ui/src/store/storeTypes.ts";
import type { ClientNodeId } from "../ui/src/lib/graph.ts";
import type { SessionFull } from "../ui/src/lib/api-sessions.ts";
import { createHash } from "node:crypto";
import { trackingVideoBytes, trackingVideoSha256 } from "../ui/e2e/fixtures/jobTrackingMedia.ts";
import { createServer, get as httpGet, type IncomingMessage } from "node:http";
import { startTrackingStream } from "../ui/e2e/fixtures/jobTrackingStream.ts";
type StreamRoute = Parameters<Awaited<ReturnType<typeof startTrackingStream>>["routeEvents"]>[0];

const warnings = {
  en: "Job tracking expired; upstream completion is unknown. Inspect history before retrying.",
  ko: "작업 추적 시간이 만료되어 제공자 측 완료 여부를 알 수 없습니다. 다시 시도하기 전에 기록을 확인하세요.",
  "zh-Hans": "任务跟踪已超时，无法确认服务提供方是否已完成。重试前请先检查历史记录。",
  "zh-Hant": "工作追蹤已逾時，無法確認服務提供方是否已完成。重試前請先檢查歷史紀錄。",
} as const;
const poison = "SECRET token prompt request-id must never be displayed";
const wrapped = { code: "UNKNOWN", rawCode: "JOB_TRACKING_TIMEOUT", error: poison, errorClass: "AUTH_EXPIRED" };
const json = (body: unknown, status = 200) => Response.json(body, { status });
const posts = (f: JobTrackingUiFixture) => f.requests.filter((r) => r.method === "POST");
const toasts = (f: JobTrackingUiFixture) => f.runtime.useAppStore.getState().toastLog.map((t) => t.message);
function prepare(f: JobTrackingUiFixture) {
  f.route("GET", "/api/inflight", () => json({ jobs: [], terminalJobs: [] }));
  f.route("GET", "/api/history", () => json({ items: [] }));
  f.runtime.ensureConnected(); f.openStream();
}
function admission(f: JobTrackingUiFixture, path: string) {
  const received = f.defer<UiRequest>();
  f.route("POST", path, (request) => { received.resolve(request); return json(request.body, 202); });
  return received.promise;
}
function requestId(request: UiRequest): string {
  const body = request.body as { requestId: string };
  assert.equal(typeof body.requestId, "string"); return body.requestId;
}
function videoNode(): GraphNode {
  return { id: "video-node", type: "imageNode", position: { x: 0, y: 0 }, data: {
    clientId: "video-node" as ClientNodeId, serverNodeId: null, parentServerNodeId: null,
    prompt: "synthetic video", imageUrl: null, status: "empty", pendingRequestId: null, pendingPhase: null,
  } };
}
function noWatcher(f: JobTrackingUiFixture) {
  assert.ok([...f.timers.values()].every((timer) => timer.delay !== f.runtime.JOB_STREAM_TIMEOUT_MS));
}

for (const [locale, warning] of Object.entries(warnings)) {
  test(`canonical parser, handler and AssetGen state: ${locale}`, () => withJobTrackingUi(async (f) => {
    prepare(f); const { runtime: r } = f; r.useAppStore.setState({ locale: locale as keyof typeof warnings });
    for (const code of ["JOB_TRACKING_TIMEOUT", "UNKNOWN", "UNREGISTERED_WRAPPER"]) {
      const error = r.parseSseErrorPayload({ ...wrapped, code });
      assert.deepEqual([error.code, error.status, error.phase, error.rawCode, error.errorClass],
        ["JOB_TRACKING_TIMEOUT", 504, "timed_out", undefined, undefined]);
      assert.equal(error.message, warnings.en);
      assert.deepEqual(r.handleError(error, r.useAppStore.getState()), { code: "JOB_TRACKING_TIMEOUT", message: warning });
      assert.equal(r.buildNodeErrorInfo(error).retryable, false);
    }
    const accepted = admission(f, "/api/generate");
    r.useAppStore.setState({ assetGenPrompt: "synthetic asset", assetGenProvider: "api" });
    const work = f.track(r.useAppStore.getState().generateAssetGen());
    f.emit("error", { ...wrapped, requestId: requestId(await accepted) });
    await work;
    assert.equal(r.useAppStore.getState().assetGenLastError, warning);
    assert.ok(toasts(f).every((message) => message === warning));
    assert.equal(r.useAppStore.getState().assetGenItems.length, 0);
    assert.equal(posts(f).length, 1); noWatcher(f);
  }));
}

test("envelope and genuine known code precedence; unrelated timeouts remain distinct", () => withJobTrackingUi(async (f) => {
  const r = f.runtime;
  const error = r.parseSseErrorPayload({ ...wrapped, envelope: { terminal: true, phase: "failed",
    error: { code: "INVALID_REQUEST", message: "ordinary invalid input" } } });
  assert.equal(error.code, "INVALID_REQUEST"); assert.equal(error.message, "ordinary invalid input");
  assert.notEqual(r.resolveErrorSpec(error).code, "JOB_TRACKING_TIMEOUT");
  for (const code of ["AGY_TIMEOUT", "MCP_JOB_TIMEOUT", "AUTH_CHATGPT_EXPIRED"]) {
    assert.notEqual(r.resolveErrorSpec({ code, message: "timeout" }).code, "JOB_TRACKING_TIMEOUT");
  }
  const canonical = r.parseSseErrorPayload({ code: "INVALID_REQUEST", error: poison,
    envelope: { terminal: true, error: { code: "JOB_TRACKING_TIMEOUT", message: poison } } });
  assert.equal(canonical.message, warnings.en); assert.equal(canonical.phase, "timed_out");
}));

async function videoAttempt(f: JobTrackingUiFixture, outcome: "tracking" | "ordinary" | "cancel" | "success") {
  const accepted = admission(f, "/api/video/generate");
  const work = f.track(f.runtime.useAppStore.getState().runVideoGenerate("video-node"));
  const request = await accepted;
  const pending = f.runtime.useAppStore.getState().graphNodes[0].data;
  assert.equal(pending.errorInfo, null); assert.equal(pending.error, undefined);
  const id = requestId(request);
  if (outcome === "success") f.emit("done", { requestId: id, filename: "synthetic.mp4", url: "/generated/synthetic.mp4", mediaType: "video" });
  else f.emit("error", { requestId: id, ...(outcome === "tracking" ? wrapped
    : { code: outcome === "cancel" ? "GENERATION_CANCELED" : "INVALID_REQUEST", error: "ordinary failure" }) });
  await work; noWatcher(f);
}

test("same-node video lifetime clears tracking error on every new attempt and outcome", () => withJobTrackingUi(async (f) => {
  prepare(f); const store = f.runtime.useAppStore;
  store.setState({ locale: "ko", graphNodes: [videoNode()], activeSessionId: "video-session", activeSessionGraphVersion: 1 });
  f.route("PUT", "/api/sessions/video-session/graph", () => json({ graphVersion: 2 }));
  for (const next of ["ordinary", "success", "cancel"] as const) {
    await videoAttempt(f, "tracking");
    const failure = store.getState().graphNodes[0].data;
    assert.equal(failure.errorInfo?.message, warnings.ko); assert.equal(failure.errorInfo?.retryable, false);
    await videoAttempt(f, next);
    assert.equal(store.getState().graphNodes[0].data.errorInfo, null);
    if (next !== "ordinary") assert.equal(store.getState().graphNodes[0].data.error, undefined);
  }
  assert.equal(posts(f).length, 6);
}));

async function savedGraph(f: JobTrackingUiFixture): Promise<SessionFull> {
  const saved = f.defer<SessionFull>();
  f.route("PUT", "/api/sessions/video-session/graph", (request) => {
    saved.resolve({ id: "video-session", title: "Owned fixture", createdAt: 1, updatedAt: 1, graphVersion: 2,
      ...request.body as Pick<SessionFull, "nodes" | "edges"> });
    return json({ graphVersion: 2 });
  });
  const timer = [...f.timers].find(([, t]) => t.delay === 800);
  assert.ok(timer); await f.runTimer(timer[0]);
  const result = await saved.promise;
  await f.runtime.useAppStore.getState().flushGraphSave("manual");
  return result;
}

test("live Undo/Redo preserves admission reset through actual scheduled save/reload", () => withJobTrackingUi(async (f) => {
  prepare(f); const store = f.runtime.useAppStore;
  store.setState({ graphNodes: [videoNode()], activeSessionId: "video-session", activeSessionGraphVersion: 1 });
  await videoAttempt(f, "tracking");
  store.getState().addRootNode(); // records the settled tracking error through the public action
  const accepted = admission(f, "/api/video/generate");
  const work = f.track(store.getState().runVideoGenerate("video-node"));
  const id = requestId(await accepted);
  try {
  assert.equal(store.getState().undoGraph(), true);
  assert.equal(store.getState().redoGraph(), true);
  assert.equal(store.getState().undoGraph(), true);
  const live = store.getState().graphNodes[0].data;
  assert.equal(live.pendingRequestId, id); assert.equal(live.errorInfo, null); assert.equal(live.error, undefined);
  const restored = f.runtime.mapSessionToGraph(await savedGraph(f)).graphNodes[0].data;
  assert.equal(restored.status, "empty"); assert.equal(restored.recoveryRequestId, id);
  assert.equal(restored.errorInfo, null); assert.equal(restored.error, undefined);
  } finally {
    f.emit("error", { requestId: id, code: "GENERATION_CANCELED", error: "cancel" }); await work;
  }
  store.getState().recordGraphHistory("clear");
  store.setState({ graphNodes: [videoNode()] });
  // Nonbusy historical failures remain meaningful and must survive the same serialization.
  await videoAttempt(f, "tracking"); store.getState().recordGraphHistory("settled");
  store.setState({ graphNodes: [videoNode()] }); assert.equal(store.getState().undoGraph(), true);
  const settled = f.runtime.mapSessionToGraph(await savedGraph(f)).graphNodes[0].data;
  assert.equal(settled.errorInfo?.code, "JOB_TRACKING_TIMEOUT"); assert.equal(settled.errorInfo?.retryable, false);
}));

for (const outcome of ["tracking", "ordinary", "cancel", "success"] as const) {
  test(`animation result ${outcome} never reports false success`, () => withJobTrackingUi(async (f) => {
    prepare(f); const accepted = admission(f, "/api/video/generate");
    const work = f.track(f.runtime.useAppStore.getState().animateImage("owned.png", "synthetic motion"));
    const id = requestId(await accepted);
    if (outcome === "success") f.emit("done", { requestId: id, filename: "owned.mp4", url: "/generated/owned.mp4", mediaType: "video" });
    else f.emit("error", { requestId: id, ...(outcome === "tracking" ? wrapped
      : { code: outcome === "cancel" ? "GENERATION_CANCELED" : "INVALID_REQUEST", error: "ordinary failure" }) });
    assert.equal(await work, outcome === "success");
    assert.equal(f.runtime.useAppStore.getState().history.length, outcome === "success" ? 1 : 0);
    assert.equal(posts(f).length, 1); noWatcher(f);
  }));
}

function mcpRoutes(f: JobTrackingUiFixture) {
  f.route("GET", "/api/mcp/providers", () => json({ providers: [{ id: "fixture", status: { state: "connected" } }] }));
}
test("MCP callback canonicalizes error and preserves ordinary data.message; settles once", () => withJobTrackingUi(async (f) => {
  prepare(f); mcpRoutes(f); const errors: Error[] = [];
  for (const [id, payload, expected] of [["one", wrapped, warnings.en], ["two", { message: "ordinary MCP error" }, "ordinary MCP error"]] as const) {
    admission(f, "/api/mcp/generate");
    await f.runtime.startMcpGeneration({ provider: "fixture", kind: "image", prompt: "fixture", requestId: id },
      { onDone: () => assert.fail("unexpected done"), onError: (e) => errors.push(e) });
    f.emit("error", { ...payload, requestId: id }); f.emit("error", { requestId: id, message: poison });
    assert.equal(errors.at(-1)?.message, expected); noWatcher(f);
  }
  assert.equal(errors.length, 2); assert.equal(posts(f).length, 2);
}));

for (const rejection of [false, true]) {
  test(`installed MCP generate action localized ${rejection ? "submit rejection" : "callback"}`, () => withJobTrackingUi(async (f) => {
    prepare(f); mcpRoutes(f); const store = f.runtime.useAppStore;
    store.setState({ locale: "zh-Hant", prompt: "fixture MCP" });
    f.runtime.setMcpProviderImpl("fixture", store.setState, store.getState);
    f.route("POST", "/api/mcp/generate", (request) => rejection ? json(wrapped, 504) : json(request.body, 202));
    await store.getState().generate();
    if (!rejection) f.emit("error", { ...wrapped, requestId: requestId(posts(f)[0]) });
    assert.deepEqual(toasts(f), [warnings["zh-Hant"]]); assert.equal(posts(f).length, 1); noWatcher(f);
  }));
}

for (const rows of [false, true]) {
  test(`Sprite ${rows ? "rows" : "anchor"} awaits cold OPEN, localizes once and unsubscribes`, () => withJobTrackingUi(async (f) => {
    const store = f.runtime.useAppStore; store.setState({ activeSpriteRecipeId: "sprite", locale: "en" });
    const accepted = admission(f, "/api/sprite-recipes/sprite/generate");
    const work = f.track(rows ? store.getState().generateSpriteRows(["idle"]) : store.getState().generateSpriteAnchor());
    assert.equal(posts(f).length, 0); f.openStream();
    const readyTick = [...f.timers].find(([, timer]) => timer.delay === 50);
    assert.ok(readyTick); await f.runTimer(readyTick[0]);
    const id = requestId(await accepted); await work;
    f.emit("error", { ...wrapped, requestId: id });
    f.emit("error", { requestId: id, message: poison });
    f.emit("partial", { requestId: id, stateKey: "idle", url: "late.png" });
    assert.equal(store.getState().spriteRecipeError, warnings.en);
    assert.equal(store.getState().spriteRecipeGenerating, false);
    assert.deepEqual(store.getState().spritePartialPreviews, {});
    assert.deepEqual(toasts(f), [warnings.en]); assert.equal(posts(f).length, 1);
  }));
}

test("Sprite rejected admission unsubscribes and ordinary terminal retains legacy message", () => withJobTrackingUi(async (f) => {
  prepare(f); const store = f.runtime.useAppStore; store.setState({ activeSpriteRecipeId: "sprite" });
  f.route("POST", "/api/sprite-recipes/sprite/generate", () => json({ error: "admission refused" }, 400));
  await store.getState().generateSpriteAnchor();
  f.emit("error", { requestId: requestId(posts(f)[0]), ...wrapped });
  assert.equal(store.getState().spriteRecipeError, "admission refused"); assert.equal(toasts(f).length, 0);
  admission(f, "/api/sprite-recipes/sprite/generate"); await store.getState().generateSpriteRows(["idle"]);
  f.emit("error", { requestId: requestId(posts(f)[1]), message: "ordinary sprite failure" });
  assert.equal(store.getState().spriteRecipeError, "ordinary sprite failure");
}));

for (const shape of ["complete", "request-only", "wrong-source", "wrong-workflow", "wrong-request"] as const) {
  test(`extension202 ${shape} exercises actual stream acceptance parser`, () => withJobTrackingUi(async (f) => {
    prepare(f);
    f.route("POST", "/api/video/extend", (request) => {
      const body = request.body as { requestId: string; sourceVideoId: string };
      const accepted = shape === "request-only" ? { requestId: body.requestId } : {
        requestId: shape === "wrong-request" ? "wrong" : body.requestId,
        sourceVideoId: shape === "wrong-source" ? "other.mp4" : body.sourceVideoId,
        workflow: shape === "wrong-workflow" ? "wrong" : "last-frame-i2v",
      };
      return json(accepted, 202);
    });
    const work = f.track(f.runtime.postVideoExtendStream({ requestId: "extension", sourceVideoId: "owned.mp4", provider: "grok" }, new AbortController().signal));
    if (shape === "complete") {
      // Await the real submission/readiness chain; the terminal still comes exclusively from SSE.
      for (let turn = 0; turn < 20 && posts(f).length === 0; turn++) await Promise.resolve();
      assert.equal(posts(f).length, 1);
      f.emit("error", { requestId: "extension", ...wrapped });
      await assert.rejects(work, (error: Error & { code?: string }) => error.code === "JOB_TRACKING_TIMEOUT" && error.message === warnings.en);
    } else await assert.rejects(work, /invalid acceptance response/);
    assert.equal(posts(f).length, 1); noWatcher(f);
  }));
}

test("committed video fixture is tiny and matches the recorded generation digest", () => {
  assert.equal(trackingVideoBytes.byteLength, 1570);
  assert.ok(trackingVideoBytes.byteLength < 16 * 1024);
  assert.equal(createHash("sha256").update(trackingVideoBytes).digest("hex"), trackingVideoSha256);
});

test("AssetGen known-code conflict preserves ordinary message; Sprite done removes watcher", () => withJobTrackingUi(async (f) => {
  prepare(f); const store = f.runtime.useAppStore;
  const accepted = admission(f, "/api/generate"); store.setState({ assetGenPrompt: "owned" });
  const work = f.track(store.getState().generateAssetGen());
  f.emit("error", { requestId: requestId(await accepted), ...wrapped, code: "INVALID_REQUEST", error: "ordinary asset refusal" });
  await work; assert.equal(store.getState().assetGenLastError, "ordinary asset refusal");
  store.setState({ activeSpriteRecipeId: "sprite" });
  admission(f, "/api/sprite-recipes/sprite/generate");
  f.route("GET", "/api/sprite-recipes/sprite", () => json({ recipe: { id: "sprite", name: "owned" } }));
  await store.getState().generateSpriteAnchor(); const id = requestId(posts(f)[1]);
  f.emit("done", { requestId: id }); f.emit("error", { requestId: id, ...wrapped });
  assert.equal(store.getState().spriteRecipeGenerating, false); assert.equal(store.getState().spriteRecipeError, null);
  assert.ok(!toasts(f).includes(warnings.en));
}));

test("native HTTP fixture flushes headers before terminal and closes its owned listener", async () => {
  const app = createServer((_request, response) => response.writeHead(404).end());
  await new Promise<void>((resolve) => app.listen(0, "127.0.0.1", resolve));
  const address = app.address(); assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const stream = await startTrackingStream(origin);
  let response: IncomingMessage | undefined;
  try {
    let destination = "";
    // This double only captures Playwright's route rewrite; the HTTP client below is native.
    const route = { request: () => ({ method: () => "GET", url: () => `${origin}/api/events?lastEventId=0`, allHeaders: async () => ({}) }),
      continue: async (options: { url: string }) => { destination = options.url; }, abort: async () => assert.fail("unexpected route abort") } as unknown as StreamRoute;
    await stream.routeEvents(route);
    response = await new Promise<IncomingMessage>((resolve, reject) => { httpGet(destination, resolve).once("error", reject); });
    assert.equal(response.statusCode, 200); assert.equal(response.headers["content-type"], "text/event-stream");
    await stream.ready(); assert.equal(stream.connections[0].frames, 0);
    const data = new Promise<string>((resolve, reject) => { response!.once("data", (chunk) => resolve(String(chunk))); response!.once("error", reject); });
    stream.emit("error", { requestId: "native-fixture", code: "JOB_TRACKING_TIMEOUT" }, 7);
    assert.match(await data, /^id: 7\nevent: error\ndata:/);
    assert.equal(stream.connections[0].frames, 1);
  } finally {
    response?.destroy();
    await stream.close(); await stream.close();
    await new Promise<void>((resolve, reject) => app.close((error) => error ? reject(error) : resolve()));
  }
  assert.ok(stream.connections.every((connection) => connection.closed)); assert.deepEqual(stream.violations, []);
});
