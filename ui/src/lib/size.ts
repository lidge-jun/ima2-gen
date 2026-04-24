export function snap16(n: number): number {
  return Math.round(n / 16) * 16;
}

// GPT Image sizing constraints:
// - both dims multiple of 16
// - max side < 3840
// - ratio ≤ 3:1
// - pixel count ∈ [655,360, 8,294,400]
// User rule: min side ≥ 1024

export type SizePresetItem = {
  value: string;
  label: string;
  sub: string;
};

export const SIZE_GROUP_SQUARE: ReadonlyArray<SizePresetItem> = [
  { value: "1024x1024", label: "1024×1024", sub: "1:1" },
  { value: "2048x2048", label: "2048×2048", sub: "2K 1:1" },
];

export const SIZE_GROUP_LANDSCAPE: ReadonlyArray<SizePresetItem> = [
  { value: "1536x1024", label: "1536×1024", sub: "3:2" },
  { value: "1360x1024", label: "1360×1024", sub: "4:3" },
  { value: "1824x1024", label: "1824×1024", sub: "16:9" },
  { value: "2048x1152", label: "2048×1152", sub: "2K 16:9" },
  { value: "3824x2160", label: "3824×2160", sub: "4K 16:9" },
];

export const SIZE_GROUP_PORTRAIT: ReadonlyArray<SizePresetItem> = [
  { value: "1024x1536", label: "1024×1536", sub: "2:3" },
  { value: "1024x1360", label: "1024×1360", sub: "3:4" },
  { value: "1024x1824", label: "1024×1824", sub: "9:16" },
  { value: "1152x2048", label: "1152×2048", sub: "2K 9:16" },
  { value: "2160x3824", label: "2160×3824", sub: "4K 9:16" },
];

export const SIZE_GROUP_AUTO: ReadonlyArray<SizePresetItem> = [
  { value: "auto", label: "자동", sub: "모델 추천" },
  { value: "custom", label: "직접 입력", sub: "자유 설정" },
];

export type SizeCategory = "square" | "landscape" | "portrait" | "auto";

export const SIZE_CATEGORIES: ReadonlyArray<{
  id: SizeCategory;
  label: string;
  icon: "square" | "landscape" | "portrait" | "custom";
  items: ReadonlyArray<SizePresetItem>;
}> = [
  { id: "square", label: "정사각", icon: "square", items: SIZE_GROUP_SQUARE },
  { id: "landscape", label: "가로", icon: "landscape", items: SIZE_GROUP_LANDSCAPE },
  { id: "portrait", label: "세로", icon: "portrait", items: SIZE_GROUP_PORTRAIT },
  { id: "auto", label: "자유", icon: "custom", items: SIZE_GROUP_AUTO },
];

export function categoryForPreset(value: string): SizeCategory {
  for (const cat of SIZE_CATEGORIES) {
    if (cat.items.some((it) => it.value === value)) return cat.id;
  }
  return "auto";
}
