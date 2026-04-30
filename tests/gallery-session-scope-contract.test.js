import fs from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";

const modal = fs.readFileSync("ui/src/components/GalleryModal.tsx", "utf8");
const store = fs.readFileSync("ui/src/store/useAppStore.ts", "utf8");
const registry = fs.readFileSync("ui/src/store/persistenceRegistry.ts", "utf8");
const api = fs.readFileSync("ui/src/lib/api.ts", "utf8");

test("gallery sends sessionId when scope is current-session", () => {
  assert.match(modal, /galleryScope === "current-session"/);
  assert.match(modal, /sessionId: galleryScope/);
});

test("store persists galleryScope and galleryDefaultScope", () => {
  const combined = store + "\n" + registry;
  assert.match(combined, /ima2\.galleryScope/);
  assert.match(combined, /ima2\.galleryDefaultScope/);
  assert.match(store, /GALLERY_SCOPE_STORAGE_KEY|ima2\.galleryScope/);
  assert.match(store, /GALLERY_DEFAULT_SCOPE_STORAGE_KEY|ima2\.galleryDefaultScope/);
});

test("api forwards sessionId to grouped history", () => {
  assert.match(api, /getHistoryGrouped/);
  assert.match(api, /sessionId/);
});

test("store exports selectCurrentSessionId selector", () => {
  assert.match(store, /export function selectCurrentSessionId/);
});
