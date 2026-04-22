export function snap16(n: number): number {
  return Math.round(n / 16) * 16;
}

export const SIZE_PRESETS_ROW1 = [
  { value: "1024x1024", label: "1024x1024", sub: "square" },
  { value: "1536x1024", label: "1536x1024", sub: "landscape" },
  { value: "1024x1536", label: "1024x1536", sub: "portrait" },
] as const;

export const SIZE_PRESETS_ROW2 = [
  { value: "2048x2048", label: "2048x2048", sub: "2K sq" },
  { value: "2048x1152", label: "2048x1152", sub: "2K land" },
  { value: "auto", label: "auto", sub: "model picks" },
] as const;

export const SIZE_PRESETS_ROW3 = [
  { value: "3840x2160", label: "3840x2160", sub: "4K land" },
  { value: "2160x3840", label: "2160x3840", sub: "4K port" },
  { value: "custom", label: "Custom", sub: "any ratio" },
] as const;
