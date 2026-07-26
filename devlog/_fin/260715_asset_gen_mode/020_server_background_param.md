---
created: 2026-07-15
updated: 2026-07-15
tags: [ima2-gen, asset-gen, server, provider, wp4]
status: diff-level 확정 (WP4)
---

# 020 — WP4: backgroundPreset 서버 계약 + provider 프롬프트 셰이핑

## 전제 (Mind 감사로 교정된 코드 사실)

- `routes/generate.ts:8-10`은 presetIds 정규화 후 위임만 함 — 검증은 파이프라인 내부에 둔다.
- 공유 프롬프트 조립점: `lib/generatePipeline.ts:106` `const generationPrompt = storyboardPrefix + prompt`.
- 단일 주입점은 불충분: Grok은 `planGrokImage`(`lib/grokImageAdapter.ts`, planner system `:63`)가,
  Responses는 `buildUserTextPrompt`(`lib/responsesImageAdapter.ts:301-304`)가 프롬프트를 재가공.
  → suffix 주입 + planner 제약 병행 (이중 방어).
- 사이드카 메타: `lib/generatePipeline.ts:332-356` 고정 `meta` 객체 — `backgroundPreset` 필드 신규.
- provider 분기: `lib/generatePipeline.ts:212-245` (gemini-api/agy/grok/responses).

## 파일 변경 맵

### NEW — `lib/backgroundPresets.ts` (~70줄)

```ts
export const BACKGROUND_PRESETS = ["chroma-green", "white", "black"] as const;
export type BackgroundPreset = (typeof BACKGROUND_PRESETS)[number];
export function parseBackgroundPreset(raw: unknown): BackgroundPreset | null | { error: string };
// null = 미지정(하위호환). 잘못된 문자열 = { error } → 400.
export function backgroundPromptSuffix(preset: BackgroundPreset, kind: "image" | "video"): string;
// chroma-green: "The entire background must be a completely uniform solid chroma key
//  green (#00FF00 family), perfectly flat like a professional green screen, with even
//  studio lighting and no shadows, gradients, or texture on the background."
// white/black: "pure seamless white/black studio background, no shadows on background"
// video variant: + "The background must remain static and uniform in every frame."
export function backgroundPlannerConstraint(preset: BackgroundPreset): string;
// planner용 1줄: "Hard constraint: the final prompt MUST explicitly require a completely
//  uniform solid <color> background ... Do not drop or weaken this requirement."
```

### NEW — `tests/background-presets.test.ts` (~120줄)

- enum 파싱: 유효 3종 / null / 오타 → error.
- suffix 조립: 프리셋×kind 스냅샷.
- 파이프라인 계약: 미지정 요청의 generationPrompt가 기존과 byte-동일 (회귀 고정).
- 400 계약: 잘못된 preset 값 → `INVALID_BACKGROUND_PRESET` 코드.

### MODIFY

| 파일 | 변경 |
|---|---|
| `lib/generatePipeline.ts` | (1) body에서 `backgroundPreset` 파싱 (`:60-73` 필드 추출부) — `parseBackgroundPreset`, error 시 `fail(400, { code: "INVALID_BACKGROUND_PRESET" })`. (2) `:106` `generationPrompt` 조립에 `preset ? " " + backgroundPromptSuffix(preset, "image") : ""` 결합. (3) `:201` `planGrokImage(...)` options에 `backgroundConstraint: preset ? backgroundPlannerConstraint(preset) : undefined` 전달. (4) `:332-356` meta 객체에 `backgroundPreset: preset ?? undefined` 추가 |
| `lib/grokImageAdapter.ts` | `planGrokImage` options에 `backgroundConstraint?: string` **신규 추가** (현재 options shape `:285-302`에는 없음 — 재사용이 아니라 확장, 감사 교정) — planner user content 텍스트 블록 말미에 제약 줄 삽입 (system `:63`은 공용이라 건드리지 않음) |
| `lib/responsesImageAdapter.ts:301-304` | `buildUserTextPrompt` 경유 시에도 suffix가 살아남는지 확인만 — generationPrompt에 이미 포함되므로 코드 변경 없음 예상; 감사에서 재검증 |
| `ui/src/store/storeAssetGenImpl.ts` | (WP2에서 이미 body에 포함) 변경 없음 — 서버가 이제 실제 반영 |
| `bin/commands/gen.ts` | `--bg <chroma-green\|white\|black>` 플래그 추가 (optional, body에 전달) — CLI/UI 계약 동일화 |

## 하위호환 계약

- `backgroundPreset` 미지정: 파이프라인 전 구간 기존 동작과 byte-동일 (테스트로 고정).
- 알 수 없는 값: 400 + enum 안내 (silent 무시 금지).
- agy/gemini-api 요청에 preset이 오면: suffix는 동일하게 적용 (프롬프트 기반이라 무해),
  단 UI는 노출하지 않음 (OUT).

## Accept criteria (WP4 C 게이트)

1. `tests/background-presets.test.ts` 통과 + 잘못된 값 400 (활성화 증거: 실제 curl 캡처).
2. 미지정 회귀: 기존 UI classic 생성 1건 실동작 (프롬프트 로그 비교).
3. 실생성 T2(GPT)/T3(Grok) 크로마 이미지 각 1건 — 8점 샘플 green-dominant ≥95% (001 프로토콜, 측정 스크립트 출력 캡처).
4. 사이드카 `<filename>.json`에 `backgroundPreset` 기록 확인.
5. `npm run typecheck` + `npm test` 통과. CLI `--bg` 헬프 노출 + `npm run build:cli` 후 JS 파리티.
