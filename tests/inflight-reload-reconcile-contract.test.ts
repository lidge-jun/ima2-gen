import { test } from "node:test";
import assert from "node:assert/strict";
import { withJobTrackingUi, type JobTrackingUiFixture } from "./_jobTrackingUiFixture.ts";
import type { PersistedInFlight, ServerInFlightJob, ServerTerminalJob } from "../ui/src/store/storeTypes.ts";

const warnings = {
  en: "Job tracking expired; upstream completion is unknown. Inspect history before retrying.",
  ko: "작업 추적 시간이 만료되어 제공자 측 완료 여부를 알 수 없습니다. 다시 시도하기 전에 기록을 확인하세요.",
  "zh-Hans": "任务跟踪已超时，无法确认服务提供方是否已完成。重试前请先检查历史记录。",
  "zh-Hant": "工作追蹤已逾時，無法確認服務提供方是否已完成。重試前請先檢查歷史紀錄。",
} as const;
const local = (id: string, patch: Partial<PersistedInFlight> = {}): PersistedInFlight =>
  ({ id, kind: "classic", prompt: "local prompt", startedAt: 999_000, ...patch });
const server = (id: string, patch: Partial<ServerInFlightJob> = {}): ServerInFlightJob =>
  ({ requestId: id, kind: "classic", prompt: "server prompt", startedAt: 1234, phase: "streaming", ...patch });
const expired = (id: string, patch: Partial<ServerTerminalJob> = {}): ServerTerminalJob =>
  ({ ...server(id), status: "error", finishedAt: 999_000, durationMs: 997_766,
    errorCode: "JOB_TRACKING_TIMEOUT", httpStatus: 504, meta: { message: "POISON", prompt: "SECRET" }, ...patch });

function responses(f: JobTrackingUiFixture, jobs: ServerInFlightJob[], terminalJobs: ServerTerminalJob[] = []) {
  f.route("GET", "/api/inflight", (request) => {
    const query = new URL(request.url).searchParams;
    assert.equal(query.get("includeTerminal"), "1");
    const matches = (job: ServerInFlightJob) => job.kind === query.get("kind")
      && (!query.get("sessionId") || job.meta?.sessionId === query.get("sessionId"));
    return Response.json({ jobs: jobs.filter(matches), terminalJobs: terminalJobs.filter(matches) });
  });
  f.route("GET", "/api/history", () => Response.json({ items: [] }));
}
async function run(f: JobTrackingUiFixture, mode: "poll" | "reconcile"): Promise<void> {
  try {
    if (mode === "reconcile") { await f.runtime.useAppStore.getState().reconcileInflight(); return; }
    f.runtime.useAppStore.getState().startInFlightPolling();
    const timer = [...f.timers].find(([, value]) => value.kind === "interval");
    assert.ok(timer); await f.runTimer(timer[0]);
  } catch (error) { throw error; }
}

for (const mode of ["reconcile", "poll"] as const) {
  for (const locale of ["en", "ko", "zh-Hans", "zh-Hant"] as const) {
    test(`${mode}: ${locale} restores aged terminal beside current memory, warns once, and never resubmits`, async () => {
      await withJobTrackingUi(async (f) => {
        const old = local("aged", { startedAt: 1 }), live = local("current");
        f.runtime.saveInFlight([old, { ...live, prompt: "stale storage" }]);
        f.runtime.useAppStore.setState({ uiMode: "classic", activeSessionId: null, locale,
          inFlight: [live], activeGenerations: 1 });
        assert.deepEqual(f.runtime.loadInFlight().map((job) => job.id), ["current"]);
        assert.deepEqual(f.runtime.loadInFlight({ includeExpired: true }).map((job) => job.id), ["aged", "current"]);
        responses(f, [server("current")], [expired("aged")]);
        await run(f, mode);
        assert.deepEqual(f.runtime.useAppStore.getState().inFlight.map((job) => job.id), ["current"]);
        assert.equal(f.runtime.useAppStore.getState().activeGenerations, 1);
        assert.equal(f.runtime.useAppStore.getState().inFlight[0].prompt, "local prompt");
        assert.deepEqual(f.runtime.useAppStore.getState().toastLog.map((toast) => toast.message), [warnings[locale]]);
        await run(f, mode);
        assert.equal(f.runtime.useAppStore.getState().toastLog.length, 1);
        assert.deepEqual(f.runtime.loadInFlight({ includeExpired: true }).map((job) => job.id), ["current"]);
        assert.ok(f.requests.every((request) => request.method === "GET"));
      });
    });
  }

  test(`${mode}: server-only node restoration preserves correlation, clears absent locals, and rejects other-session discovery`, async () => {
    await withJobTrackingUi(async (f) => {
      const other = local("other-session", { kind: "node", sessionId: "B", startedAt: 1 });
      const mcp = local("mcp", { kind: "mcp-action-upscale" });
      f.runtime.useAppStore.setState({ uiMode: "node", activeSessionId: "A", inFlight: [other, mcp], activeGenerations: 2 });
      f.runtime.saveInFlight([other, mcp]);
      responses(f, [server("node-new", { kind: "node", meta: { sessionId: "A", parentNodeId: "parent", clientNodeId: "client" } }),
        server("wrong-session", { kind: "node", meta: { sessionId: "B" } }), server("mcp", { kind: "mcp-action-upscale" })]);
      await run(f, mode);
      const state = f.runtime.useAppStore.getState();
      assert.deepEqual(state.inFlight.map((job) => job.id).sort(), ["mcp", "node-new"]);
      const node = state.inFlight.find((job) => job.id === "node-new");
      assert.deepEqual([node?.kind, node?.sessionId, node?.parentNodeId, node?.clientNodeId], ["node", "A", "parent", "client"]);
      assert.ok(f.requests.some((request) => new URL(request.url).searchParams.get("kind") === "mcp-action-upscale"));
      assert.equal(state.activeGenerations, 2);
      assert.deepEqual(f.runtime.loadInFlight({ includeExpired: true }).map((job) => job.id).sort(), ["mcp", "node-new"]);
    });
  });

  test(`${mode}: terminal scope is checked and canceled jobs settle silently`, async () => {
    await withJobTrackingUi(async (f) => {
      const jobs = [local("mismatch", { kind: "node", sessionId: "A", startedAt: 900_000 }), local("canceled", { kind: "node", sessionId: "A" })];
      f.runtime.useAppStore.setState({ uiMode: "node", activeSessionId: "A", inFlight: jobs, activeGenerations: 2 });
      f.runtime.saveInFlight(jobs);
      responses(f, []);
      // Deliberately malformed response: the A query contains a B terminal.
      // Keep it past absence grace so filtering it out would fail this test.
      f.route("GET", "/api/inflight", (request) => Response.json({ jobs: [], terminalJobs:
        new URL(request.url).searchParams.get("kind") === "node"
          ? [expired("mismatch", { kind: "node", meta: { sessionId: "B" } }),
            expired("canceled", { kind: "node", status: "canceled", meta: { sessionId: "A" } })] : [] }));
      await run(f, mode);
      assert.deepEqual(f.runtime.useAppStore.getState().inFlight.map((job) => job.id), ["mismatch"]);
      assert.equal(f.runtime.useAppStore.getState().toastLog.length, 0);
    });
  });

  test(`${mode}: active/terminal precedence and absence grace remain mode-specific`, async () => {
    await withJobTrackingUi(async (f) => {
      const boundary = mode === "poll" ? 5000 : 10_000;
      const jobs = [local("both"), local("boundary", { startedAt: 1_000_000 - boundary }),
        local("over", { startedAt: 1_000_000 - boundary - 1 })];
      f.runtime.useAppStore.setState({ uiMode: "classic", activeSessionId: null, inFlight: jobs, activeGenerations: 3 });
      f.runtime.saveInFlight(jobs); responses(f, [server("both")], [expired("both")]); await run(f, mode);
      assert.deepEqual(f.runtime.useAppStore.getState().inFlight.map((job) => job.id), mode === "poll" ? ["boundary"] : ["both"]);
      assert.equal(f.runtime.useAppStore.getState().toastLog.length, mode === "poll" ? 1 : 0);
    });
  });

  test(`${mode}: storage-only multimode scope, unknown aged IDs, and skewed server clocks`, async () => {
    await withJobTrackingUi(async (f) => {
      const memory = local("clock", { startedAt: 1000, phase: "planning", composerPrompt: "composer" });
      f.runtime.saveInFlight([memory, local("multi", { kind: "multimode", startedAt: 1 }), local("unknown", { startedAt: 1 })]);
      f.runtime.useAppStore.setState({ uiMode: "classic", activeSessionId: null, inFlight: [memory], activeGenerations: 1 });
      responses(f, [server("clock", { startedAt: 1010 }), server("multi", { kind: "multimode" })]); await run(f, mode);
      const state = f.runtime.useAppStore.getState();
      assert.deepEqual(state.inFlight.map((job) => job.id), ["clock", "multi"]);
      assert.ok(f.requests.some((request) => new URL(request.url).searchParams.get("kind") === "multimode"));
      assert.equal(state.inFlight[0].startedAt, mode === "poll" ? 1000 : 1010);
      assert.equal(state.inFlight[0].phase, mode === "poll" ? "streaming" : "planning");
      responses(f, [server("multi", { kind: "multimode" })], [expired("clock", { startedAt: 9_000_000 })]);
      await run(f, mode);
      assert.deepEqual(f.runtime.useAppStore.getState().inFlight.map((job) => job.id), ["multi"]);
      assert.equal(f.runtime.useAppStore.getState().toastLog.length, 1);
    });
  });
}

for (const scenario of ["nodeA-classic", "nodeA-nodeB", "classic-nodeB"] as const) {
  for (const settlement of ["absent", "terminal"] as const) {
    test(`storage-only ${scenario}: retains active, clears absent/terminal, then ${settlement} stops polling`, async () => {
      await withJobTrackingUi(async (f) => {
        const kind = scenario === "classic-nodeB" ? "classic" : "node";
        const sessionId = kind === "node" ? "A" : null;
        const uiMode = scenario === "nodeA-classic" ? "classic" : "node";
        const meta = { sessionId };
        const stored = ["active", "absent", "terminal"].map((id) => local(id, {
          kind: kind === "classic" && id !== "absent" ? undefined : kind, sessionId, startedAt: 1,
        }));
        f.runtime.saveInFlight(stored);
        const store = f.runtime.useAppStore;
        store.setState({ uiMode, activeSessionId: uiMode === "node" ? "B" : null,
          inFlight: [], activeGenerations: 0, locale: "en" });
        assert.deepEqual(f.runtime.loadInFlight(), []);
        const activeJobs = [server("active", { kind, meta }), server("unrelated", { kind, meta })];
        responses(f, activeJobs, [expired("terminal", { kind, meta })]);
        await run(f, "reconcile");
        assert.deepEqual(store.getState().inFlight.map((job) => job.id), ["active"]);
        assert.equal(store.getState().activeGenerations, 1);
        assert.deepEqual(f.runtime.loadInFlight({ includeExpired: true }).map((job) => job.id), ["active"]);
        assert.deepEqual(store.getState().toastLog.map((toast) => toast.message), [warnings.en]);
        const scopes = f.requests.map((request) => new URL(request.url).searchParams);
        assert.equal(scopes.filter((query) => query.get("kind") === kind && query.get("sessionId") === sessionId).length, 1);
        const timer = [...f.timers].find(([, value]) => value.kind === "interval"); assert.ok(timer);
        await f.runTimer(timer[0]);
        assert.deepEqual(store.getState().inFlight.map((job) => job.id), ["active"]);
        assert.equal(store.getState().activeGenerations, 1);
        responses(f, [], settlement === "terminal" ? [expired("active", { kind, meta })] : []);
        await f.runTimer(timer[0]);
        assert.deepEqual(store.getState().inFlight, []);
        assert.deepEqual(f.runtime.loadInFlight({ includeExpired: true }), []);
        assert.equal(store.getState().activeGenerations, 0);
        assert.equal(store.getState().toastLog.length, settlement === "terminal" ? 2 : 1);
        const inflightReads = f.requests.filter((request) => new URL(request.url).pathname === "/api/inflight").length;
        await f.runTimer(timer[0]); assert.ok(f.timers.has(timer[0]));
        await f.runTimer(timer[0]); assert.equal(f.timers.has(timer[0]), false);
        assert.equal(f.requests.filter((request) => new URL(request.url).pathname === "/api/inflight").length, inflightReads);
        assert.ok(f.requests.every((request) => request.method === "GET"));
      });
    });
  }
}

test("polling writes removal of stored-only terminal even when memory is already empty", async () => {
  await withJobTrackingUi(async (f) => {
    f.runtime.saveInFlight([local("stored", { startedAt: 1 })]);
    f.runtime.useAppStore.setState({ uiMode: "classic", activeSessionId: null, inFlight: [], activeGenerations: 1, locale: "en" });
    responses(f, [], [expired("stored")]); await run(f, "poll");
    assert.deepEqual(f.runtime.loadInFlight({ includeExpired: true }), []);
    assert.equal(f.runtime.useAppStore.getState().activeGenerations, 0);
    await run(f, "reconcile"); assert.equal(f.runtime.useAppStore.getState().toastLog.length, 1);
  });
});
