import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("canvas annotation persistence contract", () => {
  it("exposes annotation API client helpers with browser identity", () => {
    const api = readSource("ui/src/lib/api.ts");
    assert.match(api, /fetchCanvasAnnotations/);
    assert.match(api, /saveCanvasAnnotations/);
    assert.match(api, /deleteCanvasAnnotations/);
    assert.match(api, /jsonFetchWithBrowserId\(`\/api\/annotations/);
  });

  it("separates user clear from local reset in the hook", () => {
    const hook = readSource("ui/src/hooks/useCanvasAnnotations.ts");
    assert.match(hook, /isDirty/);
    assert.match(hook, /LOAD/);
    assert.match(hook, /MARK_SAVED/);
    assert.match(hook, /RESET_LOCAL/);
    assert.match(hook, /resetLocal/);
    assert.match(hook, /toPayload/);
  });

  it("loads source drafts and deletes them after baked save", () => {
    const canvas = readSource("ui/src/components/Canvas.tsx");
    assert.match(canvas, /fetchCanvasAnnotations/);
    assert.match(canvas, /saveCanvasAnnotations/);
    assert.match(canvas, /deleteCanvasAnnotations/);
    assert.match(canvas, /annotations\.load/);
    assert.match(canvas, /annotations\.markSaved/);
    assert.match(canvas, /deleteCanvasAnnotations\(source\.filename\)/);
  });

  it("has backend annotation routes and db upsert", () => {
    const routes = readSource("routes/annotations.js");
    const db = readSource("lib/db.js");
    assert.match(routes, /app\.get\("\/api\/annotations\/:filename"/);
    assert.match(routes, /app\.put\("\/api\/annotations\/:filename"/);
    assert.match(routes, /app\.delete\("\/api\/annotations\/:filename"/);
    assert.match(routes, /ON CONFLICT\(browser_id, filename\) DO UPDATE/);
    assert.match(db, /CREATE TABLE IF NOT EXISTS image_annotations/);
  });
});
