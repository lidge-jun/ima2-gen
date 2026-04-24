import { t } from "../i18n";

export function snap16(n: number): number {
  return Math.round(n / 16) * 16;
}

export const CUSTOM_SIZE_MIN = 1024;
export const CUSTOM_SIZE_MAX = 3824;
export const CUSTOM_SIZE_MAX_RATIO = 3;
export const CUSTOM_SIZE_MAX_PIXELS = 8_294_400;

export type CustomSizeAdjustmentReason = "min" | "max" | "ratio" | "pixels" | "snap";

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
  if (n > CUSTOM_SIZE_MAX) pushReason(reasons, "max");
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
  if (w * h <= CUSTOM_SIZE_MAX_PIXELS) return { w, h };

  pushReason(reasons, "pixels");
  const scale = Math.sqrt(CUSTOM_SIZE_MAX_PIXELS / (w * h));
  let nextW = clampCustomSide(floor16(w * scale));
  let nextH = clampCustomSide(floor16(h * scale));

  while (nextW * nextH > CUSTOM_SIZE_MAX_PIXELS) {
    if (nextW >= nextH) {
      nextW = clampCustomSide(nextW - 16);
    } else {
      nextH = clampCustomSide(nextH - 16);
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
  { value: "3824x2160", label: "3824×2160", sub: "4K 16:9" },
  { value: "2160x3824", label: "2160×3824", sub: "4K 9:16" },
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
