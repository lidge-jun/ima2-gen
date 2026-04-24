export type ChipGroup = {
  id: string;
  label: string;
  defaultOpen?: boolean;
  chips: ReadonlyArray<string>;
};

export const CHIP_GROUPS: ReadonlyArray<ChipGroup> = [
  {
    id: "mood",
    label: "무드·스타일",
    defaultOpen: true,
    chips: [
      "시네마틱", "자연광", "수묵화", "3D 렌더",
      "일러스트", "수채", "유화", "픽셀 아트",
    ],
  },
  {
    id: "portrait",
    label: "인물 톤",
    chips: [
      "인물 사진", "셀카", "전신", "얼굴 클로즈업",
      "반신", "자연스러운 포즈", "피부 보정 최소",
    ],
  },
  {
    id: "quality",
    label: "퀄리티",
    chips: [
      "고해상도", "디테일 풍부", "선명한 초점", "영화적 라이팅",
    ],
  },
  {
    id: "lens",
    label: "카메라·렌즈",
    chips: [
      "35mm 표준", "50mm 표준", "85mm 포트레이트", "광각", "접사",
    ],
  },
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isChipActive(prompt: string, token: string): boolean {
  if (!prompt) return false;
  const re = new RegExp(`(^|,\\s*)${escapeRegExp(token)}(?=\\s*(?:,|$))`);
  return re.test(prompt);
}

export function toggleChip(prompt: string, token: string): string {
  const trimmed = prompt.trim();
  if (isChipActive(trimmed, token)) {
    const re = new RegExp(`(^|,\\s*)${escapeRegExp(token)}(?=\\s*(?:,|$))`);
    const next = trimmed.replace(re, () => "");
    return next.replace(/^,\s*/, "").replace(/,\s*,/g, ",").trim();
  }
  if (!trimmed) return token;
  return `${trimmed}, ${token}`;
}
