import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("canvas version frontend contract", () => {
  it("uses a save-aware dirty close path for both button and Escape", () => {
    const source = readSource("ui/src/components/Canvas.tsx");
    assert.match(source, /saveCanvasVersionAndUseReference = useCallback\(async \(\): Promise<GenerateItem \| null>/);
    assert.match(source, /handleCloseCanvas = async \(\): Promise<void>/);
    assert.match(source, /if \(!saved\) return/);
    assert.match(source, /event\.key === "Escape"[\s\S]*handleCloseCanvas/);
    assert.match(source, /onClick=\{\(\) => void handleCloseCanvas\(\)\}/);
  });

  it("tracks and resets canvas session state", () => {
    const source = readSource("ui/src/components/Canvas.tsx");
    assert.match(source, /canvasSourceImageRef/);
    assert.match(source, /canvasVersionItem/);
    assert.match(source, /canvasSaveState/);
    assert.match(source, /resetCanvasSession/);
    assert.match(source, /setCanvasVersionItem\(latestCanvasVersion\)/);
    assert.match(source, /annotations\.resetLocal\(\)/);
    assert.doesNotMatch(source, /previousImageKeyRef[\s\S]{0,500}annotations\.clear\(\)/);
  });

  it("saves the first canvas version then updates the same filename", () => {
    const source = readSource("ui/src/components/Canvas.tsx");
    assert.match(source, /canvasVersionItem\?\.filename/);
    assert.match(source, /updateCanvasVersion\(canvasVersionItem\.filename/);
    assert.match(source, /createCanvasVersion\(/);
    assert.match(source, /const savedItem = withSourcePrompt\(result\.item, source\)/);
    assert.match(source, /setCanvasVersionItem\(savedItem\)/);
  });

  it("reloads saved canvas versions without requiring refresh", () => {
    const source = readSource("ui/src/components/Canvas.tsx");
    assert.match(source, /function getCanvasDisplaySrc\(image: GenerateItem\): string/);
    assert.match(source, /function withSourcePrompt\(item: GenerateItem, source: GenerateItem \| null\): GenerateItem/);
    assert.match(source, /function findCanvasVersionForSource\(history: GenerateItem\[], source: GenerateItem \| null\): GenerateItem \| null/);
    assert.match(source, /canvasMergedAt=\$\{image\.canvasMergedAt\}/);
    assert.match(source, /const canvasDisplayImage = canvasOpen \? \(canvasVersionItem \?\? latestCanvasVersion \?\? currentImage\) : currentImage/);
    assert.match(source, /const imageSrc = canvasDisplayImage \? getCanvasDisplaySrc\(canvasDisplayImage\) : null/);
    assert.match(source, /key=\{\`\$\{canvasDisplayImage\?\.filename \?\? canvasDisplayImage\?\.url \?\? canvasDisplayImage\?\.image\}:\$\{canvasDisplayImage\?\.canvasMergedAt \?\? ""\}`\}/);
    assert.match(source, /src=\{imageSrc \?\? currentImage\.image\}/);
  });

  it("keeps canvas Continue Here prompt from the source image without large prompt headers", () => {
    const source = readSource("ui/src/components/Canvas.tsx");
    const api = readSource("ui/src/lib/api.ts");
    assert.match(source, /return \{ \.\.\.item, prompt: source\.prompt \}/);
    assert.match(source, /applyMergedCanvasImage\(savedItem\)/);
    assert.match(source, /attachCanvasVersionReference\(savedItem\)/);
    assert.doesNotMatch(api, /X-Ima2-Canvas-Prompt/);
  });

  it("attaches canvas references as compressed data URLs, not generated URLs", () => {
    const store = readSource("ui/src/store/useAppStore.ts");
    assert.match(store, /canvasReferenceImage/);
    assert.match(store, /attachCanvasVersionReference: async \(item\)/);
    assert.match(store, /compressReferenceSource\(\s*item\.image/);
    assert.match(store, /withoutPrevious/);
    assert.match(store, /MAX_REFERENCE_IMAGES/);
    assert.doesNotMatch(store, /referenceImages:\s*\[\s*item\.image/);
  });

  it("uses raw PNG blobs for canvas version API calls", () => {
    const api = readSource("ui/src/lib/api.ts");
    assert.match(api, /createCanvasVersion/);
    assert.match(api, /updateCanvasVersion/);
    assert.match(api, /image: Blob/);
    assert.match(api, /"Content-Type": "image\/png"/);
    assert.match(api, /body: payload\.image/);
    assert.doesNotMatch(api, /X-Ima2-Canvas-Prompt/);
    assert.doesNotMatch(api, /canvasPromptHeader/);
  });
});
