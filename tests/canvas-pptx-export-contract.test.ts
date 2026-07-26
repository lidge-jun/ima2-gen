import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fitToSlide, memoPlacement } from "../ui/src/lib/canvas/pptxExport";

// Issue #28 acceptance, per devlog/_plan/_future/260430_issue28-canvas-pptx-export.

test("pptxgenjs is a declared UI dependency", () => {
  const pkg = JSON.parse(readFileSync("ui/package.json", "utf8"));
  assert.ok(pkg.dependencies?.pptxgenjs, "pptxgenjs must be installed for PPTX export");
});

test("the writer is loaded on demand, not in the initial bundle", () => {
  // ~1MB of deck-writing code should not cost users who never export PPTX.
  const src = readFileSync("ui/src/lib/canvas/pptxExport.ts", "utf8");
  assert.match(src, /await import\("pptxgenjs"\)/);
  assert.doesNotMatch(src, /^import .*pptxgenjs/m, "a static import would bundle it eagerly");
});

test("landscape and portrait both letterbox without cropping", () => {
  const wide = fitToSlide({ width: 1920, height: 1080 });
  assert.equal(Math.round(wide.w * 100) / 100, 10);
  assert.equal(Math.round(wide.x * 100) / 100, 0);

  const tall = fitToSlide({ width: 1024, height: 1536 });
  assert.equal(Math.round(tall.h * 1000) / 1000, 5.625);
  assert.ok(tall.x > 0, "a portrait image must sit centered with side bars");
  assert.ok(tall.w < 10, "it must not be stretched to fill the slide");
});

test("aspect ratio survives the fit", () => {
  for (const size of [{ width: 1024, height: 1024 }, { width: 1920, height: 1080 }, { width: 900, height: 1600 }]) {
    const fit = fitToSlide(size);
    const before = size.width / size.height;
    const after = fit.w / fit.h;
    assert.ok(Math.abs(before - after) < 0.001, `ratio drifted for ${size.width}x${size.height}`);
  }
});

test("memo coordinates map inside the placed image, not the raw slide", () => {
  const placement = fitToSlide({ width: 1024, height: 1536 });
  const memo = memoPlacement({ id: "m", x: 0.5, y: 0.5, text: "note", color: "#fff" }, placement);
  assert.ok(memo.x >= placement.x && memo.x <= placement.x + placement.w);
  assert.ok(memo.y >= placement.y && memo.y <= placement.y + placement.h);
});

test("memos stay editable text instead of being baked into the slide image", () => {
  const dispatcher = readFileSync("ui/src/lib/canvas/exportRenderer.ts", "utf8");
  assert.match(dispatcher, /renderMergedCanvasImage\(\{ \.\.\.input, memos: \[\] \}\)/);
  const src = readFileSync("ui/src/lib/canvas/pptxExport.ts", "utf8");
  assert.match(src, /slide\.addText\(/);
});

test("the toolbar exposes an export format action without requiring a saved version", () => {
  const menu = readFileSync("ui/src/components/canvas-mode/CanvasExportMenu.tsx", "utf8");
  assert.match(menu, /aria-haspopup="menu"/);
  assert.match(menu, /role="menuitem"/);
  assert.match(menu, /exportAs\.\$\{format\}|exportAs\./);

  const session = readFileSync("ui/src/components/canvas-mode/useCanvasModeSession.ts", "utf8");
  const exportFn = session.slice(session.indexOf("const handleExportCanvas"));
  assert.doesNotMatch(
    exportFn.slice(0, exportFn.indexOf("};")),
    /saveCanvasVersion/,
    "export must not require saving a canvas version first",
  );
});
