import { t } from "../i18n";

export function snap16(n: number): number {
  return Math.round(n / 16) * 16;
}

export const IMAGE_SIZE_STEP = 16;
export const IMAGE_SIZE_MAX_EDGE = 3840;
export const IMAGE_SIZE_MIN_PIXELS = 655_360;
export const IMAGE_SIZE_MAX_PIXELS = 8_294_400;
export const IMAGE_SIZE_MAX_RATIO = 3;
export const MAX_CUSTOM_SIZE_SLOTS = 3;

export const CUSTOM_SIZE_MIN = IMAGE_SIZE_STEP;
export const CUSTOM_SIZE_MAX = IMAGE_SIZE_MAX_EDGE;
export const CUSTOM_SIZE_MAX_RATIO = IMAGE_SIZE_MAX_RATIO;
export const CUSTOM_SIZE_MAX_PIXELS = IMAGE_SIZE_MAX_PIXELS;

export type CustomSizeAdjustmentReason =
  | "min"
  | "max"
  | "ratio"
  | "pixels"
  | "snap"
  | "maxEdge"
  | "minPixels"
  | "maxPixels";

export type CustomSizeNormalizationResult = {
  requestedW: number;
  requestedH: number;
  w: number;
  h: number;
  adjusted: boolean;
  reasons: CustomSizeAdjustmentReason[];
};

export function floor16(n: number): number {
  return Math.floor(n / 16) * 16;
}

export function ceil16(n: number): number {
  return Math.ceil(n / 16) * 16;
}

export function clampCustomSide(n: number): number {
  return Math.min(CUSTOM_SIZE_MAX, Math.max(CUSTOM_SIZE_MIN, n));
}

export function parseRequestedCustomSide(value: string | number, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pushReason(reasons: CustomSizeAdjustmentReason[], reason: CustomSizeAdjustmentReason): void {
  if (!reasons.includes(reason)) reasons.push(reason);
}

function snapCustomSide(n: number, reasons: CustomSizeAdjustmentReason[]): number {
  const snapped = snap16(n);
  if (snapped !== n) pushReason(reasons, "snap");
  return snapped;
}

function clampCustomSideWithReason(n: number, reasons: CustomSizeAdjustmentReason[]): number {
  if (n < CUSTOM_SIZE_MIN) pushReason(reasons, "min");
  if (n > IMAGE_SIZE_MAX_EDGE) pushReason(reasons, "maxEdge");
  return clampCustomSide(n);
}

function fitCustomRatio(w: number, h: number, reasons: CustomSizeAdjustmentReason[]): { w: number; h: number } {
  if (w > h * CUSTOM_SIZE_MAX_RATIO) {
    pushReason(reasons, "ratio");
    return { w, h: clampCustomSide(ceil16(w / CUSTOM_SIZE_MAX_RATIO)) };
  }
  if (h > w * CUSTOM_SIZE_MAX_RATIO) {
    pushReason(reasons, "ratio");
    return { w: clampCustomSide(ceil16(h / CUSTOM_SIZE_MAX_RATIO)), h };
  }
  return { w, h };
}

function fitCustomPixels(w: number, h: number, reasons: CustomSizeAdjustmentReason[]): { w: number; h: number } {
  if (w * h < IMAGE_SIZE_MIN_PIXELS) {
    pushReason(reasons, "minPixels");
    const scale = Math.sqrt(IMAGE_SIZE_MIN_PIXELS / (w * h));
    let nextW = clampCustomSide(ceil16(w * scale));
    let nextH = clampCustomSide(ceil16(h * scale));
    while (nextW * nextH < IMAGE_SIZE_MIN_PIXELS) {
      if (nextW <= nextH) {
        nextW = clampCustomSide(nextW + IMAGE_SIZE_STEP);
      } else {
        nextH = clampCustomSide(nextH + IMAGE_SIZE_STEP);
      }
    }
    return { w: nextW, h: nextH };
  }

  if (w * h <= IMAGE_SIZE_MAX_PIXELS) return { w, h };

  pushReason(reasons, "maxPixels");
  const scale = Math.sqrt(IMAGE_SIZE_MAX_PIXELS / (w * h));
  let nextW = clampCustomSide(floor16(w * scale));
  let nextH = clampCustomSide(floor16(h * scale));

  while (nextW * nextH > IMAGE_SIZE_MAX_PIXELS) {
    if (nextW >= nextH) {
      nextW = clampCustomSide(nextW - IMAGE_SIZE_STEP);
    } else {
      nextH = clampCustomSide(nextH - IMAGE_SIZE_STEP);
    }
  }

  return { w: nextW, h: nextH };
}

export function normalizeCustomSizePairDetailed(
  rawW: string | number,
  rawH: string | number,
  fallbackW: number,
  fallbackH: number,
): CustomSizeNormalizationResult {
  const reasons: CustomSizeAdjustmentReason[] = [];
  const requestedW = parseRequestedCustomSide(rawW, fallbackW);
  const requestedH = parseRequestedCustomSide(rawH, fallbackH);
  let w = clampCustomSideWithReason(snapCustomSide(requestedW, reasons), reasons);
  let h = clampCustomSideWithReason(snapCustomSide(requestedH, reasons), reasons);

  ({ w, h } = fitCustomRatio(w, h, reasons));
  ({ w, h } = fitCustomPixels(w, h, reasons));
  ({ w, h } = fitCustomRatio(w, h, reasons));

  return {
    requestedW,
    requestedH,
    w,
    h,
    adjusted: w !== requestedW || h !== requestedH,
    reasons,
  };
}

export function normalizeCustomSizePair(
  rawW: string | number,
  rawH: string | number,
  fallbackW: number,
  fallbackH: number,
): { w: number; h: number } {
  const result = normalizeCustomSizePairDetailed(rawW, rawH, fallbackW, fallbackH);
  return { w: result.w, h: result.h };
}

export type CustomRatioPreset = {
  id: "free" | "1:1" | "3:2" | "2:3" | "16:9" | "9:16" | "21:9" | "9:21";
  label: string;
  w: number;
  h: number;
};

export const CUSTOM_RATIO_PRESETS: readonly CustomRatioPreset[] = [
  { id: "free", label: "Free", w: 0, h: 0 },
  { id: "1:1", label: "1:1", w: 1, h: 1 },
  { id: "3:2", label: "3:2", w: 3, h: 2 },
  { id: "2:3", label: "2:3", w: 2, h: 3 },
  { id: "16:9", label: "16:9", w: 16, h: 9 },
  { id: "9:16", label: "9:16", w: 9, h: 16 },
  { id: "21:9", label: "21:9", w: 21, h: 9 },
  { id: "9:21", label: "9:21", w: 9, h: 21 },
] as const;

export function formatSize(w: number, h: number): string {
  return `${w}x${h}`;
}

export function describeAspect(w: number, h: number): string {
  if (w <= 0 || h <= 0) return "free";
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(w, h);
  return `${Math.round(w / d)}:${Math.round(h / d)}`;
}

export function sizeFromRatioPreset(
  ratio: CustomRatioPreset,
  base = 1024,
): { w: number; h: number } | null {
  if (ratio.id === "free") return null;
  const shortSide = base;
  const landscape = ratio.w >= ratio.h;
  const rawW = landscape ? Math.round((shortSide * ratio.w) / ratio.h) : shortSide;
  const rawH = landscape ? shortSide : Math.round((shortSide * ratio.h) / ratio.w);
  return normalizeCustomSizePair(rawW, rawH, rawW, rawH);
}

export type CustomSizeSlot = {
  id: string;
  w: number;
  h: number;
  label?: string;
  ratio?: string;
  updatedAt: number;
};

export function normalizeCustomSizeSlot(slot: CustomSizeSlot): CustomSizeSlot {
  const normalized = normalizeCustomSizePair(slot.w, slot.h, 2400, 1024);
  return {
    ...slot,
    w: normalized.w,
    h: normalized.h,
    label: slot.label || `${normalized.w}×${normalized.h}`,
  };
}

export function trimCustomSizeSlots(slots: CustomSizeSlot[]): CustomSizeSlot[] {
  return slots.slice(0, MAX_CUSTOM_SIZE_SLOTS).map(normalizeCustomSizeSlot);
}

export function upsertCustomSizeSlot(
  slots: CustomSizeSlot[],
  nextSlot: CustomSizeSlot,
): CustomSizeSlot[] {
  const normalized = normalizeCustomSizeSlot(nextSlot);
  const existingIndex = slots.findIndex((slot) => slot.id === normalized.id);
  if (existingIndex >= 0) {
    return trimCustomSizeSlots(slots.map((slot, index) => (index === existingIndex ? normalized : slot)));
  }
  if (slots.length >= MAX_CUSTOM_SIZE_SLOTS) return trimCustomSizeSlots(slots);
  return trimCustomSizeSlots([...slots, normalized]);
}

export function replaceCustomSizeSlot(
  slots: CustomSizeSlot[],
  slotId: string,
  nextSlot: CustomSizeSlot,
): CustomSizeSlot[] {
  const normalized = normalizeCustomSizeSlot({ ...nextSlot, id: slotId });
  return trimCustomSizeSlots(slots.map((slot) => (slot.id === slotId ? normalized : slot)));
}

// gpt-image-2 constraints:
// - both dims multiple of 16
// - max side <= 3840
// - ratio <= 3:1
// - pixel count between 655,360 and 8,294,400
// User rule: min side >= 1024
export const SIZE_PRESETS_ROW1 = [
  { value: "1024x1024", label: "1024×1024", sub: "1:1" },
  { value: "1536x1024", label: "1536×1024", sub: "3:2" },
  { value: "1024x1536", label: "1024×1536", sub: "2:3" },
] as const;

export const SIZE_PRESETS_ROW2 = [
  { value: "1360x1024", label: "1360×1024", sub: "4:3" },
  { value: "1024x1360", label: "1024×1360", sub: "3:4" },
  { value: "1824x1024", label: "1824×1024", sub: "16:9" },
] as const;

export const SIZE_PRESETS_ROW3 = [
  { value: "1024x1824", label: "1024×1824", sub: "9:16" },
  { value: "2048x2048", label: "2048×2048", sub: "2K 1:1" },
  { value: "2048x1152", label: "2048×1152", sub: "2K 16:9" },
] as const;

export const SIZE_PRESETS_ROW4 = [
  { value: "1152x2048", label: "1152×2048", sub: "2K 9:16" },
  { value: "3840x2160", label: "3840×2160", sub: "4K 16:9" },
  { value: "2160x3840", label: "2160×3840", sub: "4K 9:16" },
] as const;

export function getSizePresetsRow5(): ReadonlyArray<{
  value: "auto" | "custom";
  label: string;
  sub: string;
}> {
  return [
    { value: "auto", label: t("size.autoLabel"), sub: t("size.autoSub") },
    { value: "custom", label: t("size.customLabel"), sub: t("size.customSub") },
  ];
}
