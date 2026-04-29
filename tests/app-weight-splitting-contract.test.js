import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path) {
  return readFileSync(join(root, path), "utf8");
}

function visitStaticImports(manifest, chunk, seen = new Set()) {
  if (!chunk || seen.has(chunk.file)) return seen;
  seen.add(chunk.file);
  for (const importId of chunk.imports ?? []) {
    visitStaticImports(manifest, manifest[importId], seen);
  }
  return seen;
}

test("release builds use manifest and opt-in sourcemaps", () => {
  const viteConfig = readSource("ui/vite.config.ts");

  assert.match(viteConfig, /manifest:\s*true/);
  assert.match(viteConfig, /sourcemap:\s*process\.env\.VITE_SOURCEMAP === "1"/);
  assert.doesNotMatch(viteConfig, /sourcemap:\s*true/);
});

test("default app path lazy-loads non-classic heavy surfaces", () => {
  const app = readSource("ui/src/App.tsx");

  assert.match(app, /const LazyNodeCanvas = lazy\(\(\) =>\s*import\("\.\/components\/NodeCanvas"\)/);
  assert.match(app, /const LazySettingsWorkspace = lazy\(\(\) =>\s*import\("\.\/components\/SettingsWorkspace"\)/);
  assert.match(app, /const LazyCardNewsWorkspace = lazy\(\(\) =>\s*import\("\.\/components\/card-news\/CardNewsWorkspace"\)/);
  assert.match(app, /const LazyPromptLibraryPanel = lazy\(\(\) =>\s*import\("\.\/components\/PromptLibraryPanel"\)/);
  assert.match(app, /<Suspense fallback=\{<WorkspaceFallback \/>}/);
  assert.match(app, /<Canvas \/>/);
  assert.match(app, /<LazyNodeCanvas \/>/);
  assert.match(app, /<LazyCardNewsWorkspace \/>/);
  assert.doesNotMatch(app, /import \{ NodeCanvas \}/);
  assert.doesNotMatch(app, /import \{ SettingsWorkspace \}/);
  assert.doesNotMatch(app, /import \{ CardNewsWorkspace \}/);
  assert.doesNotMatch(app, /import \{ PromptLibraryPanel \}/);
});

test("prompt library and import subflows are loaded on demand", () => {
  const rightPanel = readSource("ui/src/components/RightPanel.tsx");
  const promptLibrary = readSource("ui/src/components/PromptLibraryPanel.tsx");
  const promptImport = readSource("ui/src/components/PromptImportDialog.tsx");

  assert.match(rightPanel, /const LazyPromptLibraryPanel = lazy\(\(\) =>\s*import\("\.\/PromptLibraryPanel"\)/);
  assert.match(rightPanel, /<LazyPromptLibraryPanel variant="embedded" \/>/);
  assert.doesNotMatch(rightPanel, /import \{ PromptLibraryPanel \}/);

  assert.match(promptLibrary, /const LazyPromptImportDialog = lazy\(\(\) =>\s*import\("\.\/PromptImportDialog"\)/);
  assert.match(promptLibrary, /importOpen \? \(/);
  assert.match(promptLibrary, /<LazyPromptImportDialog/);
  assert.doesNotMatch(promptLibrary, /import \{ PromptImportDialog \}/);

  assert.match(promptImport, /const LazyPromptImportDiscoverySection = lazy\(\(\) =>/);
  assert.match(promptImport, /const LazyPromptImportFolderSection = lazy\(\(\) =>/);
  assert.match(promptImport, /<LazyPromptImportDiscoverySection/);
  assert.match(promptImport, /<LazyPromptImportFolderSection/);
  assert.doesNotMatch(promptImport, /import \{ PromptImportDiscoverySection \}/);
  assert.doesNotMatch(promptImport, /import \{ PromptImportFolderSection \}/);
});

test("canvas mode-only widgets are lazy-loaded from the default viewer", () => {
  const canvas = readSource("ui/src/components/Canvas.tsx");

  assert.match(canvas, /const LazyCanvasAnnotationLayer = lazy\(\(\) =>/);
  assert.match(canvas, /const LazyCanvasMemoOverlay = lazy\(\(\) =>/);
  assert.match(canvas, /const LazyCanvasToolbar = lazy\(\(\) =>/);
  assert.match(canvas, /const LazyCanvasViewportMiniMap = lazy\(\(\) =>/);
  assert.match(canvas, /const LazyCanvasZoomControl = lazy\(\(\) =>/);
  assert.doesNotMatch(canvas, /import \{ CanvasAnnotationLayer \}/);
  assert.doesNotMatch(canvas, /import \{ CanvasMemoOverlay \}/);
  assert.doesNotMatch(canvas, /import \{ CanvasToolbar \}/);
  assert.doesNotMatch(canvas, /import \{ CanvasViewportMiniMap \}/);
  assert.doesNotMatch(canvas, /import \{ CanvasZoomControl \}/);
});

test("built output splits mode and prompt-import chunks when dist exists", () => {
  const manifestPath = join(root, "ui/dist/.vite/manifest.json");
  assert.ok(existsSync(manifestPath), "build manifest must exist; run npm run ui:build before bundle verification");

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const keys = Object.keys(manifest).join("\n");
  const assetsDir = join(root, "ui/dist/assets");
  const jsFiles = readdirSync(assetsDir).filter((file) => file.endsWith(".js"));
  const entries = Object.values(manifest).filter((chunk) => chunk.isEntry);
  assert.equal(entries.length, 1, `expected one Vite entry chunk, got ${entries.length}`);
  const staticInitialFiles = visitStaticImports(manifest, entries[0]);
  const dynamicImports = new Set(entries.flatMap((chunk) => chunk.dynamicImports ?? []));

  assert.match(keys, /src\/components\/NodeCanvas\.tsx/);
  assert.match(keys, /src\/components\/card-news\/CardNewsWorkspace\.tsx/);
  assert.match(keys, /src\/components\/PromptLibraryPanel\.tsx/);
  assert.match(keys, /src\/components\/PromptImportDialog\.tsx/);
  assert.match(keys, /src\/components\/canvas-mode\/CanvasToolbar\.tsx/);
  assert.match(keys, /src\/components\/canvas-mode\/CanvasZoomControl\.tsx/);
  assert.match(keys, /src\/components\/canvas-mode\/CanvasViewportMiniMap\.tsx/);
  assert.ok(jsFiles.length > 1, "build should emit multiple JS chunks after lazy splitting");
  assert.ok(
    jsFiles.some((file) => file.startsWith("NodeCanvas-")),
    "NodeCanvas should be emitted as its own lazy chunk",
  );
  assert.ok(
    jsFiles.some((file) => file.startsWith("CanvasToolbar-")),
    "CanvasToolbar should be emitted as its own canvas-mode lazy chunk",
  );
  assert.ok(
    dynamicImports.has("src/components/NodeCanvas.tsx"),
    "NodeCanvas should be reachable through a dynamic import from the entry",
  );
  assert.ok(
    dynamicImports.has("src/components/card-news/CardNewsWorkspace.tsx"),
    "CardNewsWorkspace should be reachable through a dynamic import from the entry",
  );
  assert.ok(
    dynamicImports.has("src/components/PromptLibraryPanel.tsx"),
    "PromptLibraryPanel should be reachable through a dynamic import from the entry",
  );
  assert.ok(
    !staticInitialFiles.has(manifest["src/components/NodeCanvas.tsx"]?.file),
    "NodeCanvas chunk should not be part of the entry's static import graph",
  );
  assert.ok(
    !staticInitialFiles.has(manifest["src/components/card-news/CardNewsWorkspace.tsx"]?.file),
    "CardNewsWorkspace chunk should not be part of the entry's static import graph",
  );
  assert.ok(
    !staticInitialFiles.has(manifest["src/components/PromptLibraryPanel.tsx"]?.file),
    "PromptLibraryPanel chunk should not be part of the entry's static import graph",
  );
});
