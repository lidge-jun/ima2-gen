import assert from "node:assert/strict";
import test from "node:test";
import { catalogBody, withLaneCatalog } from "./_laneCatalogFixture";

test("catalog parser rejects malformed consumed fields with fixed identity, not empty readiness", async () => {
  await withLaneCatalog(async ({ api }) => {
    const row = { id: "cedar", label: "Cedar" };
    const lane = (image: unknown, status: unknown = "ready") => ({ ok: true, lanes: { comfy: { status, models: { image, video: [] } } } });
    for (const body of [null, [], {}, { ok: false, lanes: {} }, { ok: true, lanes: [] },
      { ok: true, lanes: { comfy: null } }, lane([], "bogus"), lane({}), lane([null]),
      lane([{ ...row, id: 1 }]), lane([{ ...row, label: " " }]), lane([{ ...row, description: {} }]),
      lane([{ ...row, lockReason: null }]), lane([{ ...row, executable: "yes" }]),
      { ok: true, lanes: { comfy: { status: "ready", reason: {}, models: { image: [], video: [] } } } }]) {
      assert.throws(() => api.parseLaneCatalog(body), (error: Error & { code?: string }) =>
        error.code === "MODEL_CATALOG_INVALID" && error.message === "Invalid model catalog response");
    }
    assert.deepEqual(api.parseLaneCatalog({ ok: true, lanes: {} }), {});
  });
});

test("catalog projection ignores unused DTO instructions while preserving safe unknown own lane IDs", async () => {
  await withLaneCatalog(async ({ api }) => {
    const body = JSON.parse('{"ok":true,"lanes":{"__proto__":{"status":"ready","models":{"image":[],"video":[]}},"constructor":{"status":"locked","models":{"image":[],"video":[]}}}}');
    const catalog = api.parseLaneCatalog(body);
    assert.deepEqual(Object.keys(catalog), ["__proto__", "constructor"]);
    assert.equal(Object.getPrototypeOf(catalog), Object.prototype);
    assert.ok(Object.hasOwn(catalog, "__proto__"));
    assert.deepEqual(api.parseLaneCatalog({ ok: true, lanes: { comfy: { status: "ready", reason: "observed",
      defaults: { image: "do-not-select" }, surfaces: { video: false },
      models: { image: [{ id: " keep ", label: " Label ", capabilities: { fake: true }, executable: true }], video: [] } } } }),
    { comfy: { status: "ready", reason: "observed", models: { image: [{ id: " keep ", label: " Label ", executable: true }], video: [] } } });
  });
});

test("first subscribers share one read; idle import and zero-subscriber refresh do no I/O", async () => {
  await withLaneCatalog(async ({ api, requests, subscribe, respond, flush, focus }) => {
    const initial = api.getLaneCatalogSnapshot(); assert.equal(initial.phase, "idle");
    await api.refreshLaneCatalog(); assert.equal(requests.length, 0);
    const a = subscribe(), b = subscribe(); assert.equal(requests.length, 1); assert.equal(focus.size, 1);
    const loading = api.getLaneCatalogSnapshot(); assert.equal(loading.phase, "loading");
    assert.equal(api.getLaneCatalogSnapshot(), loading);
    respond(0); await flush(); assert.equal(api.getLaneCatalogSnapshot().phase, "ready");
    assert.equal(typeof api.getLaneCatalogSnapshot().observedAt, "number");
    a(); assert.equal(focus.size, 1); b(); assert.equal(focus.size, 0);
    assert.equal(api.getLaneCatalogSnapshot().phase, "idle");
    subscribe(); assert.equal(requests.length, 2); assert.equal(api.getLaneCatalogSnapshot().phase, "loading");
  });
});

test("obsolete success and finally cannot replace a newer request or clear its abort controller", async () => {
  await withLaneCatalog(async ({ api, requests, subscribe, respond, flush }) => {
    const close = subscribe(); const newest = api.refreshLaneCatalog();
    assert.equal(requests[0].signal?.aborted, true); assert.equal(requests[1].signal?.aborted, false);
    respond(0, catalogBody("obsolete")); await flush(); assert.equal(api.getLaneCatalogSnapshot().phase, "loading");
    close(); assert.equal(requests[1].signal?.aborted, true);
    respond(1, catalogBody("late")); await newest; assert.equal(api.getLaneCatalogSnapshot().phase, "idle");
    assert.equal(api.getLaneCatalogSnapshot().catalog, null);
  });
});

test("new response wins over old success/error and refresh failures retain only stale identity", async () => {
  await withLaneCatalog(async ({ api, requests, subscribe, respond, flush }) => {
    subscribe(); const next = api.refreshLaneCatalog(); respond(1, catalogBody("new")); await next;
    const ready = api.getLaneCatalogSnapshot(); assert.equal(ready.catalog?.comfy.models.image[0].id, "new");
    requests[0].reject(new Error("obsolete failure")); await flush(); assert.equal(api.getLaneCatalogSnapshot(), ready);
    const failed = api.refreshLaneCatalog(); assert.equal(api.getLaneCatalogSnapshot().catalog, ready.catalog);
    requests[2].reject(new Error("private upstream message")); await assert.doesNotReject(() => failed);
    assert.deepEqual(api.getLaneCatalogSnapshot(), { ...ready, phase: "error", error: "request" });
  });
});

test("HTTP app-auth and invalid response errors are fixed observations, never rejected mutations", async () => {
  await withLaneCatalog(async ({ api, requests, subscribe, respond, flush }) => {
    subscribe(); respond(0); await flush();
    for (const [status, body, expected] of [[401, {}, "app-auth"], [403, {}, "app-auth"], [503, {}, "request"], [200, {}, "invalid"]] as const) {
      const pending = api.refreshLaneCatalog(); respond(requests.length - 1, body, status);
      await assert.doesNotReject(() => pending); assert.equal(api.getLaneCatalogSnapshot().error, expected);
      assert.equal(api.getLaneCatalogSnapshot().phase, "error");
    }
    const pending = api.refreshLaneCatalog(); requests.at(-1)!.resolve(new Response("{invalid-json", { status: 200 }));
    await pending; assert.equal(api.getLaneCatalogSnapshot().error, "invalid");
  });
});

test("focus refresh is shared and reentrant loading publication invalidates obsolete work before fetch", async () => {
  await withLaneCatalog(async ({ api, requests, subscribe, focus, respond, flush }) => {
    let nested = false;
    subscribe(() => { if (!nested && api.getLaneCatalogSnapshot().phase === "loading") { nested = true; void api.refreshLaneCatalog(); } });
    assert.equal(requests.length, 1, "the invalidated outer refresh must not fetch");
    respond(0); await flush(); assert.equal(api.getLaneCatalogSnapshot().phase, "ready");
    for (const listener of focus) {
      assert.equal(typeof listener, "function"); (listener as EventListener)(new Event("focus"));
    }
    assert.equal(requests.length, 2);
  });
});

test("last-unsubscribe invalidates loading publication and empty refresh clears retained observation", async () => {
  await withLaneCatalog(async ({ api, requests, subscribe, respond, flush }) => {
    let shouldClose = false, close = () => {};
    close = subscribe(() => { if (shouldClose && api.getLaneCatalogSnapshot().phase === "loading") close(); });
    respond(0); await flush(); shouldClose = true;
    await api.refreshLaneCatalog(); assert.equal(requests.length, 1);
    assert.equal(api.getLaneCatalogSnapshot().phase, "idle");
    await api.refreshLaneCatalog(); assert.deepEqual(api.getLaneCatalogSnapshot(), { phase: "idle", catalog: null, observedAt: null, error: null });
  });
});
