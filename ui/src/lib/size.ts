export function snap16(n: number): number {
  return Math.round(n / 16) * 16;
}

export const SIZE_PRESETS_ROW1 = [
  { value: "1024x1024", label: "1024²", sub: "1:1" },
  { value: "1536x1024", label: "1536x1024", sub: "3:2" },
  { value: "1024x1536", label: "1024x1536", sub: "2:3" },
] as const;

export const SIZE_PRESETS_ROW2 = [
  { value: "1024x576", label: "1024x576", sub: "16:9" },
  { value: "576x1024", label: "576x1024", sub: "9:16" },
  { value: "1024x768", label: "1024x768", sub: "4:3" },
] as const;

export const SIZE_PRESETS_ROW3 = [
  { value: "768x1024", label: "768x1024", sub: "3:4" },
  { value: "2048x2048", label: "2048²", sub: "2K 1:1" },
  { value: "2048x1152", label: "2048x1152", sub: "2K 16:9" },
] as const;

export const SIZE_PRESETS_ROW4 = [
  { value: "1152x2048", label: "1152x2048", sub: "2K 9:16" },
  { value: "3840x2160", label: "3840x2160", sub: "4K 16:9" },
  { value: "2160x3840", label: "2160x3840", sub: "4K 9:16" },
] as const;

export const SIZE_PRESETS_ROW5 = [
  { value: "auto", label: "auto", sub: "model" },
  { value: "custom", label: "Custom", sub: "free" },
] as const;
