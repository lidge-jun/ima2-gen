import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path) {
  return readFileSync(join(root, path), "utf8");
}

const MIN = 1024;
const MAX = 3824;
const MAX_RATIO = 3;
const MAX_PIXELS = 8_294_400;

function snap16(n) {
  return Math.round(n / 16) * 16;
}

function floor16(n) {
  return Math.floor(n / 16) * 16;
}

function ceil16(n) {
  return Math.ceil(n / 16) * 16;
}

function clamp(n) {
  return Math.min(MAX, Math.max(MIN, n));
}

function parseSide(value, fallback) {
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function fitRatio(w, h) {
  if (w > h * MAX_RATIO) return { w, h: clamp(ceil16(w / MAX_RATIO)), reason: "ratio" };
  if (h > w * MAX_RATIO) return { w: clamp(ceil16(h / MAX_RATIO)), h, reason: "ratio" };
  return { w, h, reason: null };
}

function fitPixels(w, h) {
  if (w * h <= MAX_PIXELS) return { w, h, reason: null };
  const scale = Math.sqrt(MAX_PIXELS / (w * h));
  let nextW = clamp(floor16(w * scale));
  let nextH = clamp(floor16(h * scale));
  while (nextW * nextH > MAX_PIXELS) {
    if (nextW >= nextH) nextW = clamp(nextW - 16);
    else nextH = clamp(nextH - 16);
  }
  return { w: nextW, h: nextH, reason: "pixels" };
}

function normalizePair(rawW, rawH, fallbackW, fallbackH) {
  const reasons = [];
  const requestedW = parseSide(rawW, fallbackW);
  const requestedH = parseSide(rawH, fallbackH);
  let w = snap16(requestedW);
  let h = snap16(requestedH);
  if (w !== requestedW || h !== requestedH) reasons.push("snap");
  if (w < MIN || h < MIN) reasons.push("min");
  if (w > MAX || h > MAX) reasons.push("max");
  w = clamp(w);
  h = clamp(h);
  let fitted = fitRatio(w, h);
  if (fitted.reason) reasons.push(fitted.reason);
  ({ w, h } = fitted);
  fitted = fitPixels(w, h);
  if (fitted.reason) reasons.push(fitted.reason);
  ({ w, h } = fitted);
  fitted = fitRatio(w, h);
  if (fitted.reason && !reasons.includes(fitted.reason)) reasons.push(fitted.reason);
  ({ w, h } = fitted);
  return { w, h, adjusted: w !== requestedW || h !== requestedH, reasons };
}

describe("custom size input contract", () => {
  it("keeps keyboard draft changes out of committed store state", () => {
    const source = readSource("ui/src/components/SizePicker.tsx");

    assert.match(source, /useState\(String\(customW\)\)/);
    assert.match(source, /useState\(String\(customH\)\)/);
    assert.match(source, /setDraftW\(e\.target\.value\.replace\(\/\\D\/g, ""\)\)/);
    assert.match(source, /setDraftH\(e\.target\.value\.replace\(\/\\D\/g, ""\)\)/);
    assert.doesNotMatch(source, /onChange=\{\(e\) => setCustomSize\(parseInt/);
  });

  it("uses text inputs with numeric keyboard hints instead of number inputs", () => {
    const source = readSource("ui/src/components/SizePicker.tsx");

    assert.match(source, /type="text"/);
    assert.match(source, /inputMode="numeric"/);
    assert.match(source, /pattern="\[0-9\]\*"/);
    assert.doesNotMatch(source, /type="number"/);
  });

  it("commits requested custom dimensions on blur and Enter without normalizing", () => {
    const source = readSource("ui/src/components/SizePicker.tsx");

    assert.match(source, /function commitCustomSize\(\)/);
    assert.match(source, /onBlur=\{commitCustomSize\}/);
    assert.match(source, /if \(e\.key === "Enter"\)/);
    assert.match(source, /parseRequestedCustomSide\(draftW, customW\)/);
    assert.doesNotMatch(source, /normalizeCustomSizePair\(draftW, draftH, customW, customH\)/);
  });

  it("keeps requested custom sizes in the store until generation time", () => {
    const source = readSource("ui/src/store/useAppStore.ts");

    assert.match(source, /parseRequestedCustomSide\(w, state\.customW\)/);
    assert.match(source, /parseRequestedCustomSide\(h, state\.customH\)/);
    assert.doesNotMatch(source, /const next = normalizeCustomSizePair\(w, h, state\.customW, state\.customH\)/);
    assert.doesNotMatch(source, /setCustomSize: \(w, h\) => set\(\{ customW: snap16\(w\)/);
  });

  it("documents pair-level custom size constraints in the helper", () => {
    const source = readSource("ui/src/lib/size.ts");

    assert.match(source, /export const CUSTOM_SIZE_MIN = 1024/);
    assert.match(source, /export const CUSTOM_SIZE_MAX = 3824/);
    assert.match(source, /export const CUSTOM_SIZE_MAX_RATIO = 3/);
    assert.match(source, /export const CUSTOM_SIZE_MAX_PIXELS = 8_294_400/);
    assert.match(source, /export type CustomSizeAdjustmentReason/);
    assert.match(source, /export function normalizeCustomSizePairDetailed/);
    assert.match(source, /export function normalizeCustomSizePair/);
  });

  it("gates both classic and node generation before creating in-flight work", () => {
    const source = readSource("ui/src/store/useAppStore.ts");

    assert.match(source, /customSizeConfirm: CustomSizeConfirmState/);
    assert.match(source, /continuation:\s*\n\s*\| \{ kind: "classic" \}/);
    assert.match(source, /\| \{ kind: "node"; clientId: ClientNodeId \}/);
    assert.match(source, /getCustomSizeConfirmation\(s, \{ kind: "classic" \}\)/);
    assert.match(source, /getCustomSizeConfirmation\(get\(\), \{ kind: "node", clientId \}\)/);
    assert.match(source, /runGenerate: \(sizeOverride\?: string\) => Promise<void>/);
    assert.match(source, /runGenerateNode: \(clientId: ClientNodeId, sizeOverride\?: string\) => Promise<void>/);
    assert.match(source, /await get\(\)\.runGenerate\(adjustedSize\)/);
    assert.match(source, /await get\(\)\.runGenerateNode\(pending\.continuation\.clientId, adjustedSize\)/);
  });

  it("renders an accessible blocking confirm modal above other overlays", () => {
    const modal = readSource("ui/src/components/CustomSizeConfirmModal.tsx");
    const app = readSource("ui/src/App.tsx");
    const css = readSource("ui/src/index.css");
    const backdropRule = /\.custom-size-confirm-backdrop\s*\{[^}]*\}/s.exec(css)?.[0] ?? "";

    assert.match(app, /<CustomSizeConfirmModal \/>/);
    assert.match(modal, /role="dialog"/);
    assert.match(modal, /aria-modal="true"/);
    assert.match(modal, /aria-labelledby="custom-size-confirm-title"/);
    assert.match(modal, /aria-describedby="custom-size-confirm-body"/);
    assert.match(modal, /if \(e\.key === "Escape"\) cancel\(\)/);
    assert.match(modal, /cancelRef\.current\?\.focus\(\)/);
    assert.match(backdropRule, /z-index:\s*230/);
  });

  it("has localized size confirmation copy", () => {
    const ko = readSource("ui/src/i18n/ko.json");
    const en = readSource("ui/src/i18n/en.json");

    for (const source of [ko, en]) {
      assert.match(source, /"sizeConfirm"/);
      assert.match(source, /"requested"/);
      assert.match(source, /"adjusted"/);
      assert.match(source, /"approve"/);
      assert.match(source, /"reasonRatio"/);
      assert.match(source, /"reasonPixels"/);
    }
  });

  it("allows custom inputs to shrink inside the narrow right panel", () => {
    const source = readSource("ui/src/index.css");
    const rule = /\.custom-size-input\s*\{[^}]*\}/s.exec(source)?.[0] ?? "";

    assert.match(rule, /flex:\s*1/);
    assert.match(rule, /min-width:\s*0/);
  });

  it("mirrors expected custom size normalization examples", () => {
    assert.deepEqual(normalizePair("900", "2048", 1920, 1088), {
      w: 1024,
      h: 2048,
      adjusted: true,
      reasons: ["snap", "min"],
    });
    assert.deepEqual(normalizePair("1024", "3824", 1920, 1088), {
      w: 1280,
      h: 3824,
      adjusted: true,
      reasons: ["ratio"],
    });
    assert.deepEqual(normalizePair("3824", "1024", 1920, 1088), {
      w: 3824,
      h: 1280,
      adjusted: true,
      reasons: ["ratio"],
    });
    assert.deepEqual(normalizePair("3824", "3824", 1920, 1088), {
      w: 2880,
      h: 2880,
      adjusted: true,
      reasons: ["pixels"],
    });
    assert.deepEqual(normalizePair("", "", 2048, 2048), {
      w: 2048,
      h: 2048,
      adjusted: false,
      reasons: [],
    });
  });
});
