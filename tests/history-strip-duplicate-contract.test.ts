import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readStoreBundle } from "./_storeBundle.mjs";
import { withJobTrackingUi } from "./_jobTrackingUiFixture.ts";

const root = process.cwd();

function readSource(path: string) {
  if (path === "ui/src/store/useAppStore.ts") return readStoreBundle();
  return readFileSync(join(root, path), "utf8");
}

test("history state dedupes generation and polling races by filename/image key", () => {
  const store = readSource("ui/src/store/useAppStore.ts");

  assert.match(store, /function withoutHistoryDuplicate\(/);
  assert.match(store, /const key = historyKey\(item\);[\s\S]*?history\.filter\(\(existing\) => historyKey\(existing\) !== key\)/);
  assert.match(store, /function findHistoryDuplicate\(/);
  assert.match(store, /function preserveHistoryMetadata\(/);
  // Actual polling concurrency/no-op behavior is exercised below, not variable spellings.
  assert.doesNotMatch(store, /const existing = get\(\)\.history;[\s\S]*?const fresh = arr\.filter/);
});

test("polling merges concurrent history once and keeps the history reference for an all-duplicate response", () => withJobTrackingUi(async (f) => {
  const store = f.runtime.useAppStore;
  const known = { filename: "known.png", image: "/known.png" };
  store.setState({ history: [known], currentImage: known,
    inFlight: [{ id: "owned", prompt: "owned", startedAt: 999_999 }], activeGenerations: 1 });
  const entered = f.defer<void>(), held = f.defer<Response>();
  f.route("GET", "/api/inflight", () => Response.json({ jobs: [], terminalJobs: [] }));
  f.route("GET", "/api/history", () => { entered.resolve(); return held.promise; });
  store.getState().startInFlightPolling();
  const timer = [...f.timers].find(([, value]) => value.kind === "interval")!;
  const work = f.track(f.runTimer(timer[0]));
  await entered.promise;
  const concurrent = { filename: "concurrent.png", image: "/concurrent.png" };
  store.setState({ history: [concurrent, known] });
  held.resolve(Response.json({ items: [known, concurrent,
    { filename: "fresh.png", url: "/fresh.png" }, { filename: "fresh.png", url: "/fresh.png" }] }));
  await work;
  assert.deepEqual(store.getState().history.map(item => item.filename), ["fresh.png", "concurrent.png", "known.png"]);
  assert.equal(store.getState().currentImage, known);
  const prior = store.getState().history;
  f.route("GET", "/api/history", () => Response.json({ items: prior }));
  await f.runTimer(timer[0]);
  assert.equal(store.getState().history, prior);
}));

test("addHistory paths upsert while preserving server-enriched metadata", () => {
  const store = readSource("ui/src/store/useAppStore.ts");

  assert.match(store, /requestId: incoming\.requestId \?\? existing\.requestId/);
  assert.match(store, /createdAt: incoming\.createdAt \?\? existing\.createdAt/);
  assert.match(store, /sessionId: incoming\.sessionId \?\? existing\.sessionId/);
  assert.match(store, /kind: incoming\.kind \?\? existing\.kind/);
  assert.match(store, /refsCount: incoming\.refsCount \?\? existing\.refsCount/);
  assert.match(store, /isFavorite: incoming\.isFavorite \?\? existing\.isFavorite/);
  assert.match(store, /const historyWithoutDuplicate = withoutHistoryDuplicate\(state\.history, merged\);/);
  assert.match(store, /const historyWithoutDuplicate = withoutHistoryDuplicate\(s\.history, merged\);/);
  assert.doesNotMatch(store, /\[withThumb, \.\.\.state\.history\]/);
});

test("classic and multimode completion preserve requestId without using it as identity", () => {
  const store = readSource("ui/src/store/useAppStore.ts");
  const types = readSource("ui/src/types.ts");

  assert.match(types, /export type GenerateSingleResponse = \{[\s\S]*?requestId\?: string \| null;/);
  assert.match(types, /export type GenerateMultiResponse = \{[\s\S]*?requestId\?: string \| null;/);
  assert.match(store, /requestId: res\.requestId \?\? flightId/);
  assert.match(store, /requestId: image\.requestId \?\? res\.requestId \?\? flightId/);
  assert.match(store, /function historyKey\(item: Pick<GenerateItem, "filename" \| "image">\): string \{[\s\S]*?return item\.filename \?\? item\.image;/);
  assert.doesNotMatch(store, /historyKey[\s\S]{0,120}requestId/);
});

test("history strip dedupes visible tiles and uses the same key for reconciliation", () => {
  const strip = readSource("ui/src/components/HistoryStrip.tsx");
  const navigation = readSource("ui/src/lib/galleryNavigation.ts");

  assert.match(navigation, /export function getGalleryItemKey/);
  assert.match(navigation, /export function uniqueGalleryItems/);
  assert.match(strip, /getGalleryItemKey/);
  assert.match(strip, /isGalleryVisibleItem/);
  assert.match(strip, /uniqueGalleryItems\(history\.filter\(isGalleryVisibleItem\)\)/);
  assert.match(strip, /const key = getGalleryItemKey\(item\);/);
  assert.match(strip, /key=\{key\}/);
  assert.doesNotMatch(strip, /function getHistoryItemKey/);
});
