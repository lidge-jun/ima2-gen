import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readSourceTree } from "./_readTree.mjs";
import { withJobTrackingUi } from "./_jobTrackingUiFixture.ts";

test("UI maps proxy and network errors to card surfaces", () => {
  const source = readFileSync("ui/src/lib/errorCodes.ts", "utf-8");
  assert.match(source, /NETWORK_FAILED:\s*\{ surface: "card", cardKey: "errorCard\.networkFailed"/);
  assert.match(source, /OAUTH_UNAVAILABLE:\s*\{ surface: "card", cardKey: "errorCard\.oauthUnavailable"/);
  assert.match(source, /INVALID_REQUEST:\s*\{ surface: "card", cardKey: "errorCard\.invalidRequest"/);
  assert.match(source, /EMPTY_RESPONSE:\s*\{ surface: "card", cardKey: "errorCard\.emptyResponse"/);
  assert.match(source, /STREAM_PARSE_FAILED:\s*\{ surface: "card", cardKey: "errorCard\.streamParseFailed"/);
  assert.match(source, /WEB_SEARCH_ONLY_RESPONSE:\s*\{ surface: "card", cardKey: "errorCard\.webSearchOnlyResponse"/);
  assert.match(source, /IMAGE_TOOL_FAILED:\s*\{ surface: "card", cardKey: "errorCard\.imageToolFailed"/);
  assert.match(source, /invalid_value/);
  assert.match(source, /minimum pixel budget/);
  assert.doesNotMatch(source, /content generation refused[^}]+MODERATION_REFUSED/s);
});

test("node API preserves status on JSON and SSE errors", () => {
  const source = readFileSync("ui/src/lib/nodeApi.ts", "utf-8");
  assert.match(source, /export type NodeErrorResponse = \{[\s\S]*status\?: number;/);
  assert.match(source, /e\.status = .*res\.status/);
  assert.match(source, /e\.code = /);
});

test("UI surfaces server terminal generation errors from inflight polling", () => {
  const store = readSourceTree("ui/src/store/useAppStore.ts");
  const api = readSourceTree("ui/src/lib/api.ts");

  assert.match(api, /Multimode generation failed/);
  assert.match(api, /e\.code = data\.code;/);
  assert.match(api, /cancelInflight/);
  assert.match(store, /includeTerminal: true/);
  assert.match(store, /terminalJobError/);
  // Terminal delivery and removal are asserted through the real polling action below.
  assert.doesNotMatch(store, /if \(cur\.length === 0\) \{\s*await get\(\)\.reconcileInflight\(\);/);
});

test("polling delivers a terminal error once and removes its stored spinner", () => withJobTrackingUi(async (f) => {
  const store = f.runtime.useAppStore;
  const local = { id: "owned-terminal", prompt: "owned", startedAt: 1 };
  store.setState({ locale: "en", inFlight: [local], activeGenerations: 1 });
  f.runtime.saveInFlight([local]);
  f.route("GET", "/api/inflight", () => Response.json({ jobs: [], terminalJobs: [{
    requestId: local.id, kind: "classic", status: "error", startedAt: 1, finishedAt: 999_999,
    durationMs: 999_998, phase: "queued", phaseAt: 1, errorCode: "JOB_TRACKING_TIMEOUT", httpStatus: 504,
  }] }));
  f.route("GET", "/api/history", () => Response.json({ items: [] }));
  store.getState().startInFlightPolling();
  const timer = [...f.timers].find(([, value]) => value.kind === "interval")!;
  await f.runTimer(timer[0]);
  assert.deepEqual(store.getState().toastLog.map(item => item.message), [
    "Job tracking expired; upstream completion is unknown. Inspect history before retrying.",
  ]);
  assert.equal(store.getState().activeGenerations, 0);
  assert.deepEqual(f.runtime.loadInFlight({ includeExpired: true }), []);
  await f.runTimer(timer[0]);
  assert.equal(store.getState().toastLog.length, 1);
}));

test("invalid request and open-folder feedback i18n keys exist", () => {
  const en = readFileSync("ui/src/i18n/en.json", "utf-8");
  const ko = readFileSync("ui/src/i18n/ko.json", "utf-8");
  assert.match(en, /"openGeneratedDirOpened"/);
  assert.match(ko, /"openGeneratedDirOpened"/);
  assert.match(en, /"invalidRequest"/);
  assert.match(ko, /"invalidRequest"/);
  assert.match(en, /"emptyResponse"/);
  assert.match(ko, /"emptyResponse"/);
  assert.match(en, /"streamParseFailed"/);
  assert.match(ko, /"streamParseFailed"/);
  assert.match(en, /"webSearchOnlyResponse"/);
  assert.match(ko, /"webSearchOnlyResponse"/);
  assert.match(en, /"imageToolFailed"/);
  assert.match(ko, /"imageToolFailed"/);
});

test("LAN transport and admission epochs share the existing fixture auth owner", async (context) => {
  await withJobTrackingUi(async (f) => {
    const r = f.runtime;
    const lanBody = { error: { code: "LAN_TOKEN_REQUIRED", message: "untrusted server detail" } };
    let authEvents = 0;
    const observeAuth = () => { authEvents += 1; };
    window.addEventListener(r.LAN_AUTH_REQUIRED_EVENT, observeAuth);
    const surfaces = { showToast: () => assert.fail("LAN failure became a toast"),
      showErrorCard: () => assert.fail("LAN failure became a provider card") };
    f.route("POST", "/api/auth/lan/session", () => new Response(null, { status: 204 }));
    f.route("GET", "/api/auth/lan/session", () => Response.json({ mode: "lan", authenticated: true, expiresAt: 9_000_000 }));
    f.route("GET", "/api/history", () => Response.json({ items: [] }));
    try {
      await context.test("ordinary provider401 stays typed; external/data/blob media does not activate LAN gate", async () => {
        f.route("GET", "/api/inflight", () => Response.json({
          error: { code: "AUTH_API_KEY_INVALID", message: "ordinary provider" },
        }, { status: 401 }));
        await assert.rejects(r.fetchInflightScopes([{ kind: "classic" }]),
          { code: "AUTH_API_KEY_INVALID", status: 401, message: "ordinary provider" });
        const urls = ["https://external.invalid/api/image", "data:text/plain,fixture", "blob:http://wp07.invalid/fixture"];
        let index = 0;
        const mocked = context.mock.method(globalThis, "fetch", async (url: string, options?: RequestInit) => {
          assert.equal(url, urls[index++]); assert.equal(options, undefined);
          return Response.json(lanBody, { status: 401 });
        });
        try {
          for (const url of urls) await assert.rejects(r.compressReferenceSource(url), /reference fetch failed: 401/);
          assert.equal(index, 3); assert.equal(authEvents, 0);
        } finally { mocked.mock.restore(); }
      });

      await context.test("nested401 locks once; delayed401 and locked-period errors cannot relock after login", async () => {
        const held = f.defer<Response>();
        f.route("GET", "/api/inflight", () => held.promise);
        const older = f.track(r.fetchInflightScopes([{ kind: "classic" }])
          .then(() => assert.fail("expected denial"), error => error));
        f.route("GET", "/generated/expired.png", () => Response.json(lanBody, { status: 401 }));
        const first = await r.compressReferenceSource("/generated/expired.png")
          .then(() => assert.fail("expected denial"), error => error);
        assert.equal(first.code, "LAN_TOKEN_REQUIRED"); assert.equal(first.status, 401);
        assert.equal(first.authEpoch, 0); assert.doesNotMatch(first.message, /untrusted/);
        assert.equal(authEvents, 1); assert.equal(r.isLanSessionLocked(), true);
        const requests = f.requests.length;
        const blocked = await r.compressReferenceSource("/generated/owned.png")
          .then(() => assert.fail("expected locked guard"), error => error);
        const blockedExtension = await r.postVideoExtendStream({ requestId: "locked", sourceVideoId: "owned.mp4", provider: "grok" },
          new AbortController().signal).then(() => assert.fail("expected locked guard"), error => error);
        assert.equal(f.requests.length, requests);
        await r.createLanSession("synthetic-fixture-token");
        held.resolve(Response.json(lanBody, { status: 401 }));
        for (const error of [first, blocked, blockedExtension, await older]) r.handleError(error, surfaces);
        assert.equal(r.isLanSessionLocked(), false); assert.equal(authEvents, 1);
        assert.equal(r.resolveErrorSpec({ code: "LAN_TOKEN_REQUIRED", errorClass: "AUTH_EXPIRED", message: "sign in again" }).code,
          "LAN_TOKEN_REQUIRED");
      });

      await context.test("capacity wait cannot POST again after auth loss and explicit login", async () => {
        let posts = 0;
        f.route("POST", "/api/generate", () => { posts += 1;
          return Response.json({ code: "TOO_MANY_JOBS" }, { status: 429, headers: { "Retry-After": "1" } }); });
        r.useAppStore.setState({ assetGenPrompt: "synthetic asset", assetGenProvider: "api" });
        const work = f.track(r.useAppStore.getState().generateAssetGen());
        for (let turn = 0; turn < 50 && ![...f.timers.values()].some(timer => timer.delay === 1000); turn++) await Promise.resolve();
        const delay = [...f.timers].find(([, timer]) => timer.delay === 1000); assert.ok(delay);
        r.requireLanAuthentication(); await r.createLanSession("synthetic-fixture-token");
        await f.runTimer(delay[0]); await work;
        assert.equal(posts, 1); assert.equal(r.isLanSessionLocked(), false);
        assert.equal(r.useAppStore.getState().toastLog.length + r.useAppStore.getState().errorCardLog.length, 0);
      });

      await context.test("resolved OPEN waiter cannot submit across an auth-loss continuation", async () => {
        r.ensureConnected(); f.openStream();
        const requests = f.requests.length;
        const work = f.track(r.postVideoExtendStream({ requestId: "old-waiter", sourceVideoId: "owned.mp4", provider: "grok" },
          new AbortController().signal).then(() => assert.fail("expected epoch rejection"), error => error));
        r.requireLanAuthentication();
        const error = await work; assert.equal(error.code, "LAN_TOKEN_REQUIRED");
        assert.equal(f.requests.length, requests);
        await r.createLanSession("synthetic-fixture-token");
        r.handleError(error, surfaces); assert.equal(r.isLanSessionLocked(), false);
      });

      await context.test("accepted extension retains signal, subscription and cursor across auth loss", async () => {
        r.ensureConnected(); f.openStream();
        const admitted = f.defer<void>();
        const controller = new AbortController();
        f.route("POST", "/api/video/extend", request => {
          assert.equal(request.signal, controller.signal);
          assert.equal(request.headers.get("Content-Type"), "application/json");
          assert.equal(request.headers.has("X-Ima2-Token"), false);
          admitted.resolve();
          return Response.json({ requestId: "accepted", sourceVideoId: "owned.mp4", workflow: "last-frame-i2v" }, { status: 202 });
        });
        const work = f.track(r.postVideoExtendStream({ requestId: "accepted", sourceVideoId: "owned.mp4", provider: "grok" }, controller.signal));
        await admitted.promise;
        f.emit("phase", { requestId: "accepted", phase: "running" }, "41");
        const deadline = [...f.timers].find(([, timer]) => timer.delay === r.JOB_STREAM_TIMEOUT_MS); assert.ok(deadline);
        r.requireLanAuthentication();
        assert.equal(controller.signal.aborted, false); assert.ok(f.timers.has(deadline[0]));
        await r.createLanSession("synthetic-fixture-token");
        r.ensureConnected(); f.openStream();
        assert.ok(f.ledger.events.includes("stream:create:/api/events?lastEventId=41"));
        f.emit("done", { requestId: "accepted", filename: "accepted.mp4" }, "42");
        assert.equal((await work).filename, "accepted.mp4");
        assert.equal(f.requests.filter(request => request.url.endsWith("/api/video/extend")).length, 1);
        assert.equal(f.requests.some(request => request.method === "DELETE"), false);
      });
      await context.test("observation401 reaches the gate; abort and ordinary response contracts survive", async () => {
        const controller = new AbortController();
        f.route("GET", "/api/mcp/providers", request => {
          assert.equal(request.signal, controller.signal);
          return Response.json({ providers: [] });
        });
        assert.deepEqual(await r.readMcpProviderObservation(controller.signal), { providers: [] });
        f.route("GET", "/api/mcp/providers", () => Response.json(lanBody, { status: 401 }));
        await assert.rejects(r.readMcpProviderObservation(), { code: "LAN_TOKEN_REQUIRED", status: 401 });
        const requests = f.requests.length;
        controller.abort();
        await assert.rejects(r.readMcpProviderObservation(controller.signal), { name: "AbortError" });
        assert.equal(f.requests.length, requests);
      });
    } finally { window.removeEventListener(r.LAN_AUTH_REQUIRED_EVENT, observeAuth); }
  });
});

test("extension UI owner survives auth unmount and retains pending work, cursor and deadline", () => withJobTrackingUi(async (f) => {
  const r = f.runtime, owner = r.videoExtensionOwner;
  r.ensureConnected(); f.openStream();
  const accepted = f.defer<void>();
  f.route("POST", "/api/video/extend", () => {
    accepted.resolve();
    return Response.json({ requestId: "retained-view", sourceVideoId: "owned.mp4", workflow: "last-frame-i2v" }, { status: 202 });
  });
  const payload = { requestId: "retained-view", sourceVideoId: "owned.mp4", provider: "grok" as const };
  let firstRenders = 0, remountedRenders = 0;
  const detach = owner.subscribe(() => firstRenders++);
  const work = f.track(owner.start(payload)!);
  await accepted.promise;
  f.emit("phase", { requestId: payload.requestId, phase: "running" }, "71");
  const deadline = [...f.timers].find(([, timer]) => timer.delay === r.JOB_STREAM_TIMEOUT_MS)!;
  r.requireLanAuthentication(); detach(); owner.releaseView();
  const priorRenders = firstRenders;
  assert.ok(f.timers.has(deadline[0]));
  assert.deepEqual(owner.getSnapshot(), { source: "owned.mp4", status: "pending" });
  f.route("POST", "/api/auth/lan/session", () => new Response(null, { status: 204 }));
  f.route("GET", "/api/auth/lan/session", () => Response.json({ mode: "lan", authenticated: true, expiresAt: 9_000_000 }));
  await r.createLanSession("synthetic-fixture-token");
  owner.releaseView(); // Delayed React cleanup after reauth must still retain the old owner.
  const detachRemount = owner.subscribe(() => remountedRenders++);
  assert.equal(owner.start({ ...payload, requestId: "must-not-resubmit" }), null);
  r.ensureConnected(); f.openStream();
  assert.ok(f.ledger.events.includes("stream:create:/api/events?lastEventId=71"));
  f.emit("done", { requestId: payload.requestId, filename: "retained.mp4" }, "72");
  assert.equal((await work).filename, "retained.mp4");
  assert.equal(owner.getSnapshot().status, "idle");
  assert.equal(firstRenders, priorRenders); assert.equal(remountedRenders, 1);
  assert.equal(f.timers.has(deadline[0]), false);
  assert.equal(f.requests.filter(request => request.method === "POST" && request.url.endsWith("/api/video/extend")).length, 1);
  assert.equal(f.requests.some(request => request.method === "DELETE"), false);
  detachRemount(); owner.releaseView();
}));

test("extension UI owner keeps explicit cancel, ordinary errors and tracking expiry distinct", () => withJobTrackingUi(async (f) => {
  const r = f.runtime, owner = r.videoExtensionOwner;
  r.ensureConnected(); f.openStream();
  f.route("POST", "/api/video/extend", request => Response.json({ ...(request.body as object), workflow: "last-frame-i2v" }, { status: 202 }));
  for (const outcome of ["cancel", "unmount", "tracking", "ordinary"] as const) {
    const requestId = `owner-${outcome}`;
    f.route("DELETE", `/api/inflight/${requestId}`, () => Response.json({ aborted: true }));
    const work = f.track(owner.start({ requestId, sourceVideoId: `${outcome}.mp4`, provider: "grok" })!
      .then(() => assert.fail("expected terminal error"), error => error));
    for (let turn = 0; turn < 20; turn++) await Promise.resolve();
    if (outcome === "cancel") owner.cancel();
    else if (outcome === "unmount") owner.releaseView();
    else f.emit("error", { requestId, code: outcome === "tracking" ? "JOB_TRACKING_TIMEOUT" : "INVALID_REQUEST", error: "Synthetic failure" });
    const error = await work;
    assert.equal(owner.getSnapshot().status, outcome === "cancel" || outcome === "unmount" ? "idle"
      : outcome === "tracking" ? "tracking-expired" : "error");
    if (outcome === "cancel" || outcome === "unmount") assert.equal(error.name, "AbortError");
    else assert.equal(error.code, outcome === "tracking" ? "JOB_TRACKING_TIMEOUT" : "INVALID_REQUEST");
    if (outcome === "tracking") assert.equal(owner.start({ requestId: "no-retry", sourceVideoId: "tracking.mp4", provider: "grok" }), null);
  }
  assert.equal(f.requests.filter(request => request.method === "DELETE").length, 2);
  assert.equal(f.requests.filter(request => request.method === "POST").length, 4);
}));

test("extension UI owner rejects unsent pre-lock work and keeps the original paused deadline", () => withJobTrackingUi(async (f) => {
  const r = f.runtime, owner = r.videoExtensionOwner;
  const unsent = f.track(owner.start({ requestId: "unsent-owner", sourceVideoId: "owned.mp4", provider: "grok" })!
    .then(() => assert.fail("expected auth error"), error => error));
  r.requireLanAuthentication(); owner.releaseView();
  f.route("POST", "/api/auth/lan/session", () => new Response(null, { status: 204 }));
  f.route("GET", "/api/auth/lan/session", () => Response.json({ mode: "lan", authenticated: true, expiresAt: 9_000_000 }));
  await r.createLanSession("synthetic-fixture-token");
  r.ensureConnected(); f.openStream();
  const waiter = [...f.timers].find(([, timer]) => timer.delay === 50)!;
  await f.runTimer(waiter[0]);
  assert.equal((await unsent).code, "LAN_TOKEN_REQUIRED");
  assert.equal(owner.getSnapshot().status, "idle");
  assert.equal(f.requests.some(request => request.url.endsWith("/api/video/extend")), false);
  f.route("POST", "/api/video/extend", request => Response.json({ ...(request.body as object), workflow: "last-frame-i2v" }, { status: 202 }));
  const pending = f.track(owner.start({ requestId: "deadline-owner", sourceVideoId: "owned.mp4", provider: "grok" })!
    .then(() => assert.fail("expected deadline"), error => error));
  for (let turn = 0; turn < 20; turn++) await Promise.resolve();
  const deadline = [...f.timers].find(([, timer]) => timer.delay === r.JOB_STREAM_TIMEOUT_MS)!;
  r.requireLanAuthentication(); owner.releaseView();
  await f.runTimer(deadline[0]);
  assert.match((await pending).message, /stream timed out/);
  // Local stream deadline preserves the existing ordinary timeout error;
  // only a typed server JOB_TRACKING_TIMEOUT forbids same-source retry.
  assert.equal(owner.getSnapshot().status, "error");
  assert.equal(f.requests.some(request => request.method === "DELETE"), false);
}));
