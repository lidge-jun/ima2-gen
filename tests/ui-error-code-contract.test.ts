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
