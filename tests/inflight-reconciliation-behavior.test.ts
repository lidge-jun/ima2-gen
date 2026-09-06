import assert from "node:assert/strict";
import { test } from "node:test";
import { getEventListeners } from "node:events";
import { withJobTrackingUi, type JobTrackingUiFixture } from "./_jobTrackingUiFixture.ts";
import type { PersistedInFlight, ServerInFlightJob, ServerTerminalJob } from "../ui/src/store/storeTypes.ts";

type ResponseJobs = { jobs: ServerInFlightJob[]; terminalJobs: ServerTerminalJob[] };
const local = (id: string, patch: Partial<PersistedInFlight> = {}): PersistedInFlight =>
  ({ id, kind: "classic", prompt: "local prompt", startedAt: 900_000, ...patch });
const active = (id: string, patch: Partial<ServerInFlightJob> = {}): ServerInFlightJob =>
  ({ requestId: id, kind: "classic", startedAt: 1234, prompt: "server prompt", phase: "streaming", ...patch });
const terminal = (id: string, patch: Partial<ServerTerminalJob> = {}): ServerTerminalJob =>
  ({ ...active(id), status: "error", finishedAt: 999_000, durationMs: 997_766,
    errorCode: "JOB_TRACKING_TIMEOUT", httpStatus: 504, ...patch });

function seed(f: JobTrackingUiFixture, jobs: PersistedInFlight[]) {
  f.runtime.useAppStore.setState({ uiMode: "classic", locale: "en", activeSessionId: null,
    inFlight: jobs, activeGenerations: jobs.length });
  f.runtime.saveInFlight(jobs);
}
function assertJobs(f: JobTrackingUiFixture, ids: string[]) {
  const state = f.runtime.useAppStore.getState();
  assert.deepEqual(state.inFlight.map((job) => job.id).sort(), [...ids].sort());
  assert.equal(state.activeGenerations, ids.length);
  assert.deepEqual(f.runtime.loadInFlight({ includeExpired: true }).map((job) => job.id).sort(), [...ids].sort());
  assert.ok(f.requests.every((request) => request.method === "GET"), "recovery cannot submit generation");
}
function begin(f: JobTrackingUiFixture, mode: "poll" | "reconcile"): Promise<void> {
  if (mode === "reconcile") return f.track(f.runtime.useAppStore.getState().reconcileInflight());
  f.runtime.useAppStore.getState().startInFlightPolling();
  const timer = [...f.timers].find(([, value]) => value.kind === "interval" && value.delay === 1500);
  assert.ok(timer);
  return f.track(f.runTimer(timer[0]));
}
function heldInflight(f: JobTrackingUiFixture) {
  const held = f.defer<ResponseJobs>();
  f.route("GET", "/api/inflight", async () => {
    try { return Response.json(await held.promise); } catch (error) { throw error; }
  });
  f.route("GET", "/api/history", () => Response.json({ items: [] }));
  return held;
}

test("shared fixture loads real store, safe error exports, AssetGen, Sprite and graph mapper without I/O", async () => {
  await withJobTrackingUi(async (f) => {
    assert.equal(f.runtime.useAppStore.getState().activeGenerations, 0);
    for (const name of ["generateAssetGenImpl", "generateSpriteAnchorImpl", "generateSpriteRowsImpl", "mapSessionToGraph"] as const)
      assert.equal(typeof f.runtime[name], "function");
    assert.equal(f.runtime.JOB_TRACKING_TIMEOUT_MESSAGE,
      "Job tracking expired; upstream completion is unknown. Inspect history before retrying.");
    assert.deepEqual(f.requests, []);
  });
});

test("fixture denial survives a caught unassigned request and restores global fetch", async () => {
  const originalFetch = globalThis.fetch;
  await assert.rejects(withJobTrackingUi(async (f) => {
    await f.runtime.useAppStore.getState().reconcileInflight();
  }), /unexpected operations survive product catches/);
  assert.equal(globalThis.fetch, originalFetch);
});

test("fixture drains abandoned deferred operations and cancels owned timers", async () => {
  await withJobTrackingUi(async (f) => {
    const held = f.defer<Response>();
    f.route("GET", "/api/inflight", () => held.promise);
    void f.track(f.runtime.useAppStore.getState().reconcileInflight());
    f.runtime.useAppStore.getState().startInFlightPolling();
    assert.equal(f.timers.size, 1);
  });
});

for (const mode of ["reconcile", "poll"] as const) {
  test(`${mode}: held inflight keeps old-timestamp additions and memory wins storage`, async () => {
    await withJobTrackingUi(async (f) => {
      const old = local("old"); seed(f, [old]); const held = heldInflight(f); const work = begin(f, mode);
      const added = local("added", { startedAt: 1, prompt: "new memory" });
      f.runtime.saveInFlight([local("old"), { ...added, prompt: "old storage" }]);
      f.runtime.useAppStore.setState({ inFlight: [old, added], activeGenerations: 2 });
      held.resolve({ jobs: [], terminalJobs: [] }); await work;
      assertJobs(f, ["added"]);
      assert.equal(f.runtime.useAppStore.getState().inFlight.find((job) => job.id === "added")?.prompt, "new memory");
      assert.equal(f.runtime.useAppStore.getState().toastLog.length, 0);
    });
  });

  for (const response of ["active", "terminal", "absent"] as const) {
    test(`${mode}: same-ID same-timestamp replacement rejects stale ${response}`, async () => {
      await withJobTrackingUi(async (f) => {
        const original = local("same"); seed(f, [original]); const held = heldInflight(f); const work = begin(f, mode);
        const replacement = { ...original };
        f.runtime.useAppStore.setState({ inFlight: [replacement] });
        held.resolve({ jobs: response === "active" ? [active("same")] : [],
          terminalJobs: response === "terminal" ? [terminal("same")] : [] });
        await work; assertJobs(f, ["same"]);
        assert.equal(f.runtime.useAppStore.getState().inFlight[0], replacement);
        assert.equal(f.runtime.useAppStore.getState().toastLog.length, 0);
      });
    });
  }

  for (const revision of ["startedAt", "prompt", "phase", "composerPrompt"] as const) {
  test(`${mode}: in-place ${revision} revision survives stale terminal`, async () => {
    await withJobTrackingUi(async (f) => {
      const original = local("same"); seed(f, [original]); const held = heldInflight(f); const work = begin(f, mode);
      if (revision === "startedAt") original.startedAt = 1;
      else original[revision] = "edited during fetch";
      held.resolve({ jobs: [], terminalJobs: [terminal("same")] }); await work;
      assertJobs(f, ["same"]); assert.equal(f.runtime.useAppStore.getState().inFlight[0], original);
      assert.equal(f.runtime.useAppStore.getState().toastLog.length, 0);
    });
  });
  }

  test(`${mode}: aged stored terminal and concurrent current addition settle independently`, async () => {
    await withJobTrackingUi(async (f) => {
      const old = local("aged", { startedAt: 1 }); seed(f, [old]);
      const held = heldInflight(f); const work = begin(f, mode);
      const added = local("current", { startedAt: 999_999 });
      f.runtime.useAppStore.setState({ inFlight: [old, added], activeGenerations: 2 });
      held.resolve({ jobs: [], terminalJobs: [terminal("aged")] }); await work;
      assertJobs(f, ["current"]);
      assert.deepEqual(f.runtime.useAppStore.getState().toastLog.map((toast) => toast.message),
        ["Job tracking expired; upstream completion is unknown. Inspect history before retrying."]);
      await begin(f, mode); assert.equal(f.runtime.useAppStore.getState().toastLog.length, 1);
    });
  });

  test(`${mode}: removed IDs cannot resurrect; terminal-only IDs never become spinners`, async () => {
    await withJobTrackingUi(async (f) => {
      seed(f, [local("gone")]); const held = heldInflight(f); const work = begin(f, mode);
      f.runtime.useAppStore.setState({ inFlight: [], activeGenerations: 0 }); f.runtime.saveInFlight([]);
      held.resolve({ jobs: [active("gone")], terminalJobs: [terminal("never-local")] }); await work;
      assertJobs(f, []); assert.equal(f.runtime.useAppStore.getState().toastLog.length, 0);
    });
  });

  for (const switchTo of ["session", "mode"] as const) {
    test(`${mode}: ${switchTo} switch discards response before any write or warning`, async () => {
      await withJobTrackingUi(async (f) => {
        seed(f, [local("old", { kind: "node", sessionId: "A" })]);
        f.runtime.useAppStore.setState({ uiMode: "node", activeSessionId: "A" });
        const held = heldInflight(f); const work = begin(f, mode);
        f.runtime.useAppStore.setState(switchTo === "session" ? { activeSessionId: "B" } : { uiMode: "classic" });
        const before = f.runtime.useAppStore.getState(), writes = f.storage.writes.length;
        held.resolve({ jobs: [], terminalJobs: [terminal("old", { kind: "node", meta: { sessionId: "A" } })] });
        await work; assert.equal(f.runtime.useAppStore.getState(), before); assert.equal(f.storage.writes.length, writes);
      });
    });
  }

  test(`${mode}: fetch failure preserves expired memory/storage and history cannot TTL prune`, async () => {
    await withJobTrackingUi(async (f) => {
      seed(f, [local("expired", { startedAt: 1 })]);
      f.route("GET", "/api/inflight", () => { throw new Error("owned network failure"); });
      f.route("GET", "/api/history", () => Response.json({ items: [] }));
      const before = f.runtime.useAppStore.getState(), writes = f.storage.writes.length;
      await begin(f, mode); assertJobs(f, ["expired"]);
      assert.equal(f.runtime.useAppStore.getState(), before); assert.equal(f.storage.writes.length, writes);
    });
  });
}

function heldHistory(f: JobTrackingUiFixture, jobs: ServerInFlightJob[] = []) {
  const entered = f.defer<void>(), held = f.defer<{ items: unknown[] }>();
  f.route("GET", "/api/inflight", () => Response.json({ jobs, terminalJobs: [] }));
  f.route("GET", "/api/history", async () => {
    try { entered.resolve(); return Response.json(await held.promise); } catch (error) { throw error; }
  });
  return { entered, held };
}

for (const change of ["addition", "replacement", "revision", "removal", "unchanged"] as const) {
  test(`poll history await: ${change} preserves request-local TTL eligibility`, async () => {
    await withJobTrackingUi(async (f) => {
      const job = local("prefetch", { startedAt: 999_000 }); seed(f, [job]);
      const { entered, held } = heldHistory(f); const work = begin(f, "poll"); await entered.promise;
      f.setNow(1_200_000);
      let expected = ["prefetch"];
      if (change === "addition") {
        const added = local("added", { startedAt: 1 });
        f.runtime.useAppStore.setState({ inFlight: [job, added], activeGenerations: 2 });
        f.runtime.saveInFlight([job, added]); expected = ["added"];
      } else if (change === "replacement") {
        f.runtime.useAppStore.setState({ inFlight: [{ ...job }] });
      } else if (change === "revision") { job.composerPrompt = "edited during history"; }
      else if (change === "removal") {
        f.runtime.useAppStore.setState({ inFlight: [], activeGenerations: 0 }); f.runtime.saveInFlight([]); expected = [];
      } else expected = [];
      held.resolve({ items: [] }); await work; assertJobs(f, expected);
      assert.equal(f.runtime.useAppStore.getState().toastLog.length, 0);
    });
  });
}

test("poll history await: first-await additions never become TTL eligible", async () => {
  await withJobTrackingUi(async (f) => {
    seed(f, [local("old")]); const inflight = heldInflight(f);
    const entered = f.defer<void>(), history = f.defer<{ items: unknown[] }>();
    f.route("GET", "/api/history", async () => {
      try { entered.resolve(); return Response.json(await history.promise); } catch (error) { throw error; }
    });
    const work = begin(f, "poll"); const added = local("added", { startedAt: 1 });
    f.runtime.useAppStore.setState({ inFlight: [...f.runtime.useAppStore.getState().inFlight, added], activeGenerations: 2 });
    inflight.resolve({ jobs: [], terminalJobs: [] }); await entered.promise;
    f.setNow(2_000_000); history.resolve({ items: [] }); await work; assertJobs(f, ["added"]);
  });
});

for (const switchTo of ["session", "mode"] as const) {
  test(`poll history await: ${switchTo} switch rejects history, selection and TTL writes`, async () => {
    await withJobTrackingUi(async (f) => {
      seed(f, [local("prefetch", { kind: "node", sessionId: "A", startedAt: 999_000 })]);
      f.runtime.useAppStore.setState({ uiMode: "node", activeSessionId: "A" });
      const { entered, held } = heldHistory(f); const work = begin(f, "poll"); await entered.promise;
      f.runtime.useAppStore.setState(switchTo === "session" ? { activeSessionId: "B" } : { uiMode: "classic" });
      const state = f.runtime.useAppStore.getState(), writes = f.storage.writes.length;
      f.setNow(2_000_000); held.resolve({ items: [{ filename: "stale.png", url: "/stale.png", createdAt: 1 }] });
      await work; assert.equal(f.runtime.useAppStore.getState(), state); assert.equal(f.storage.writes.length, writes);
    });
  });
}

test("poll history failure cannot prune and active IDs survive TTL even after metadata refresh", async () => {
  await withJobTrackingUi(async (f) => {
    seed(f, [local("active", { startedAt: 1 })]);
    const { entered, held } = heldHistory(f, [active("active")]);
    const work = begin(f, "poll"); await entered.promise; held.resolve({ items: [] }); await work;
    assertJobs(f, ["active"]); assert.equal(f.runtime.useAppStore.getState().inFlight[0].startedAt, 1);
    seed(f, [local("grace", { startedAt: 999_000 })]);
    const failed = heldHistory(f); const again = begin(f, "poll"); await failed.entered.promise;
    f.setNow(2_000_000); const before = f.runtime.useAppStore.getState(), writes = f.storage.writes.length;
    failed.held.reject(new Error("owned history failure")); await again;
    assert.equal(f.runtime.useAppStore.getState(), before); assert.equal(f.storage.writes.length, writes);
  });
});

test("poll history merges concurrent additions, deduplicates response, and preserves current selection", async () => {
  await withJobTrackingUi(async (f) => {
    seed(f, [local("prefetch", { startedAt: 999_000 })]);
    const { entered, held } = heldHistory(f); const work = begin(f, "poll"); await entered.promise;
    const selected = { filename: "selected.png", image: "/selected.png" };
    f.runtime.useAppStore.setState({ history: [selected], currentImage: selected });
    held.resolve({ items: [{ filename: "fresh.png", url: "/fresh.png" }, { filename: "fresh.png", url: "/fresh.png" },
      { filename: "selected.png", url: "/selected.png" }] }); await work;
    const state = f.runtime.useAppStore.getState();
    assert.deepEqual(state.history.map((item) => item.filename), ["fresh.png", "selected.png"]);
    assert.equal(state.currentImage, selected); assert.equal(state.loadedHistoryRetainLimit >= 2, true);
  });
});

test("overlapping polling ticks cannot restore a terminal removed by the newer tick", async () => {
  await withJobTrackingUi(async (f) => {
    seed(f, [local("terminal")]); const first = heldInflight(f); const older = begin(f, "poll");
    f.route("GET", "/api/inflight", () => Response.json({ jobs: [], terminalJobs: [terminal("terminal")] }));
    await begin(f, "poll"); assertJobs(f, []);
    first.resolve({ jobs: [active("terminal")], terminalJobs: [] }); await older;
    assertJobs(f, []); assert.equal(f.runtime.useAppStore.getState().toastLog.length, 1);
  });
});

test("polling reuses unchanged memory identity while retaining local prompt/composer/start time", async () => {
  await withJobTrackingUi(async (f) => {
    const job = local("active", { phase: "streaming", sessionId: null, parentNodeId: null,
      clientNodeId: null, composerPrompt: "local composer", startedAt: 1 });
    seed(f, [job]); const { entered, held } = heldHistory(f, [active("active")]);
    const work = begin(f, "poll"); await entered.promise;
    assert.equal(f.runtime.useAppStore.getState().inFlight[0], job);
    held.resolve({ items: [] }); await work;
    assert.equal(f.runtime.useAppStore.getState().inFlight[0], job);
    assert.deepEqual([job.prompt, job.composerPrompt, job.startedAt], ["local prompt", "local composer", 1]);
  });
});

for (const mode of ["poll", "reconcile"] as const) {
  test(`${mode}: LAN401 retains records and draft, stops polling, and skips history`, () => withJobTrackingUi(async (f) => {
    seed(f, [local("accepted")]);
    const store = f.runtime.useAppStore;
    store.setState({ prompt: "retained draft" });
    store.getState().startInFlightPolling();
    f.route("GET", "/api/inflight", () => Response.json({ error: { code: "LAN_TOKEN_REQUIRED", message: "denied" } }, { status: 401 }));
    await begin(f, mode);
    assertJobs(f, ["accepted"]); assert.equal(store.getState().prompt, "retained draft");
    assert.equal(store.getState().toastLog.length + store.getState().errorCardLog.length, 0);
    assert.equal([...f.timers.values()].some(timer => timer.kind === "interval"), false);
    const requests = f.requests.length;
    store.getState().startInFlightPolling(); await store.getState().reconcileInflight();
    assert.equal(f.requests.length, requests);
    assert.ok(f.requests.every(request => new URL(request.url).pathname === "/api/inflight"));
  }));

  test(`${mode}: explicit stop invalidates held result even after polling restarts`, () => withJobTrackingUi(async (f) => {
    seed(f, [local("accepted")]);
    const held = heldInflight(f), work = begin(f, mode);
    f.runtime.stopInFlightPollingImpl();
    f.runtime.useAppStore.getState().startInFlightPolling();
    const writes = f.storage.writes.length;
    held.resolve({ jobs: [], terminalJobs: [terminal("accepted")] }); await work;
    assertJobs(f, ["accepted"]); assert.equal(f.storage.writes.length, writes);
    assert.equal(f.runtime.useAppStore.getState().toastLog.length, 0);
    assert.ok(f.requests.every(request => new URL(request.url).pathname === "/api/inflight"));
    f.runtime.stopInFlightPollingImpl();
  }));
}

test("poll history response cannot write after auth loss", () => withJobTrackingUi(async (f) => {
  seed(f, [local("accepted", { startedAt: 999_000 })]);
  const { entered, held } = heldHistory(f), work = begin(f, "poll"); await entered.promise;
  const store = f.runtime.useAppStore, writes = f.storage.writes.length;
  f.runtime.handleError({ code: "LAN_TOKEN_REQUIRED" }, store.getState());
  held.resolve({ items: [{ filename: "stale.png", url: "/generated/stale.png" }] }); await work;
  assertJobs(f, ["accepted"]); assert.deepEqual(store.getState().history, []);
  assert.equal(f.storage.writes.length, writes);
  assert.equal([...f.timers.values()].some(timer => timer.kind === "interval"), false);
}));

test("poll listener is removed on idle/stop and reauth resumes through existing reconcile", () => withJobTrackingUi(async (f) => {
  const r = f.runtime, store = r.useAppStore;
  const listeners = () => getEventListeners(window, r.LAN_AUTH_REQUIRED_EVENT).length;
  const initialListeners = listeners();
  f.route("GET", "/api/history", () => Response.json({ items: [] }));
  store.getState().startInFlightPolling(); store.getState().startInFlightPolling();
  assert.equal(listeners(), initialListeners + 1);
  const timer = [...f.timers].find(([, value]) => value.kind === "interval"); assert.ok(timer);
  await f.runTimer(timer[0]); await f.runTimer(timer[0]);
  assert.equal(listeners(), initialListeners); assert.equal(f.timers.has(timer[0]), false);

  seed(f, [local("retained")]);
  const held = heldInflight(f), work = begin(f, "poll");
  r.requireLanAuthentication();
  assert.equal(listeners(), initialListeners);
  f.route("POST", "/api/auth/lan/session", () => new Response(null, { status: 204 }));
  f.route("GET", "/api/auth/lan/session", () => Response.json({ mode: "lan", authenticated: true, expiresAt: 9_000_000 }));
  await r.createLanSession("synthetic-fixture-token");
  store.getState().startInFlightPolling();
  held.resolve({ jobs: [], terminalJobs: [terminal("retained")] }); await work;
  assert.deepEqual(store.getState().inFlight.map(job => job.id), ["retained"]);
  assert.equal(store.getState().toastLog.length, 0);
  f.route("GET", "/api/inflight", () => Response.json({ jobs: [active("retained")], terminalJobs: [] }));
  await store.getState().reconcileInflight();
  assert.equal(store.getState().inFlight[0].phase, "streaming");
  assert.ok(f.requests.every(request => request.method === "GET" || new URL(request.url).pathname === "/api/auth/lan/session"));
  r.stopInFlightPollingImpl(); r.stopInFlightPollingImpl();
  assert.equal(listeners(), initialListeners);
}));
