export function snap16(n: number): number {
  return Math.round(n / 16) * 16;
}

// gpt-image-2 constraints:
// - both dims multiple of 16
// - max side < 3840
// - ratio ≤ 3:1
// - 655,360 ≤ pixels ≤ 8,294,400
// User rule (0.07): min side ≥ 1024
export const SIZE_PRESETS_ROW1 = [
  { value: "1024x1024", label: "1024²", sub: "1:1" },
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
  { value: "2048x2048", label: "2048²", sub: "2K 1:1" },
  { value: "2048x1152", label: "2048×1152", sub: "2K 16:9" },
] as const;

export const SIZE_PRESETS_ROW4 = [
  { value: "1152x2048", label: "1152×2048", sub: "2K 9:16" },
  { value: "3824x2160", label: "3824×2160", sub: "4K 16:9" },
  { value: "2160x3824", label: "2160×3824", sub: "4K 9:16" },
] as const;

export const SIZE_PRESETS_ROW5 = [
  { value: "auto", label: "auto", sub: "model" },
  { value: "custom", label: "Custom", sub: "free" },
] as const;
