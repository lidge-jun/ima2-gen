import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("canvas-mode contract", () => {
  it("has canvas types", () => {
    const types = readSource("ui/src/types/canvas.ts");
    assert.match(types, /export type CanvasTool/);
    assert.match(types, /export interface NormalizedPoint/);
  });

  it("has canvas-mode CSS", () => {
    const css = readSource("ui/src/styles/canvas-mode.css");
    assert.match(css, /\.canvas--mode-open/);
    assert.match(css, /\.canvas-mode-topbar/);
    assert.match(css, /\.canvas-mode-close/);
  });

  it("has CanvasModeShell component", () => {
    const shell = readSource("ui/src/components/canvas-mode/CanvasModeShell.tsx");
    assert.match(shell, /export function CanvasModeShell/);
    assert.match(shell, /canvasOpen/);
    assert.match(shell, /closeCanvas/);
    assert.match(shell, /Escape/);
  });

  it("has canvas state in store", () => {
    const store = readSource("ui/src/store/useAppStore.ts");
    assert.match(store, /canvasOpen: boolean/);
    assert.match(store, /canvasZoom: number/);
    assert.match(store, /openCanvas/);
    assert.match(store, /closeCanvas/);
  });

  it("has double-click handler on image", () => {
    const canvas = readSource("ui/src/components/Canvas.tsx");
    assert.match(canvas, /onDoubleClick/);
    assert.match(canvas, /openCanvas/);
  });

  it("has canvas button in ResultActions", () => {
    const actions = readSource("ui/src/components/ResultActions.tsx");
    assert.match(actions, /canvasOpen/);
    assert.match(actions, /openCanvas/);
    assert.match(actions, /canvas\.open/);
  });

  it("applies canvas mode class to main canvas", () => {
    const canvas = readSource("ui/src/components/Canvas.tsx");
    assert.match(canvas, /canvas--mode-open/);
  });

  it("imports canvas-mode CSS in main", () => {
    const main = readSource("ui/src/main.tsx");
    assert.match(main, /canvas-mode\.css/);
  });

  it("has i18n keys for canvas", () => {
    const en = readSource("ui/src/i18n/en.json");
    const ko = readSource("ui/src/i18n/ko.json");
    assert.match(en, /"open": "Open Canvas"/);
    assert.match(en, /"close": "Close Canvas"/);
    assert.match(ko, /"open": "캔버스 열기"/);
    assert.match(ko, /"close": "캔버스 닫기"/);
  });
});
