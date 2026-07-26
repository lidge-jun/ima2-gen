---
created: 2026-07-15
updated: 2026-07-15
tags: [ima2-gen, asset-gen, keying, ui, wp5]
status: diff-level 확정 (WP5)
---

# 021 — WP5: 클라이언트 이미지 color-key + threshold 슬라이더

결정(Q7): 키잉 품질은 자동 게이트가 아니라 유저 threshold 조절 UI로 보정.
이미지 키잉은 클라이언트 소유 (즉각 프리뷰), 서버는 저장만 (022).

## 전제 (코드 확인)

- 기존 flood-fill 배경제거: `ui/src/lib/canvas/backgroundRemoval.ts` — tolerance 판정 `:84-99`,
  PNG Blob 출력 `:252-279`. **연속영역(flood) 방식이라 전역 color-key와 의미 다름** (ASSUMPTION 15)
  — 참고만 하고 신규 모듈 작성. spill 억제 로직은 없음.
- 알파 감지: `ui/src/lib/canvas/alphaDetect.ts:10`.

## 파일 변경 맵

### NEW — `ui/src/lib/canvas/colorKey.ts` (~150줄)

```ts
export type ColorKeyParams = {
  keyColor: { r: number; g: number; b: number }; // 기본: 이미지 4모서리 중앙값 자동 샘플
  tolerance: number;   // 0-100, 기본 40 — YCbCr 색차 거리 기준
  softness: number;    // 0-50, 기본 10 — 경계 페더링 밴드(부분 알파)
  spill: number;       // 0-100, 기본 30 — 경계 밴드 green-채널 desaturation 강도
};
export function sampleKeyColor(img: ImageData): { r; g; b };            // 모서리 4점 중앙값
export function applyColorKey(src: ImageData, p: ColorKeyParams): ImageData; // 전역 판정(비연속 포함)
export function keyedImageToBlob(canvas: HTMLCanvasElement): Promise<Blob>;  // PNG(alpha)
```

구현 규칙: 픽셀 루프는 YCbCr 변환 후 크로마 거리로 판정(밝기 그림자에 강함),
tolerance 이내 → alpha 0, tolerance+softness 밴드 → 선형 부분 알파, 밴드 내
spill 억제(G를 max(R,B) 쪽으로 클램프). 1024² 이미지 기준 <50ms 목표
(단일 pass, Uint8ClampedArray 직접 조작, 라이브러리 없음).

### NEW — `ui/src/components/assetgen/KeyingPanel.tsx` (~180줄)

- 결과 카드에서 "배경 제거" 진입 → 좌 원본/우 키잉 프리뷰(체커보드 배경).
- 컨트롤: tolerance/softness/spill 3개 `.form-range` + 현재 값 표시, 키 색상 스와치
  (자동 샘플값, 클릭 시 스포이드 = 프리뷰 클릭 픽셀로 재설정), "기본값 재설정".
- 슬라이더 변경 → `requestAnimationFrame` 디바운스로 `applyColorKey` 재실행 (즉각 프리뷰).
- 하단: "알파 PNG 저장" (022의 업로드 API 호출 — WP5 시점엔 로컬 다운로드 버튼으로 대체,
  WP6에서 교체) + 취소.
- a11y: 슬라이더 라벨+값 연결, 키보드 조작, `prefers-reduced-motion` 무관(정적).

### MODIFY

| 파일 | 변경 |
|---|---|
| `ui/src/components/assetgen/AssetGenWorkspace.tsx` | 결과 카드에 "배경 제거" 버튼 (chroma-green 생성물에 기본 노출, white/black은 동일 진입 가능) → KeyingPanel 모달/패널 오픈 |
| `ui/src/store/storeTypes.ts` | `keyingTarget: GenerateItem \| null` + open/close 액션 |
| `ui/src/i18n/*.ts` | `keying.*` 라벨 (제거 강도/경계 부드러움/색 번짐 제거 등 — ux-writing-ko 준수, 기술용어 지양) |

### NEW — `ui/tests` 또는 `tests/color-key.test.ts` (~90줄)

colorKey는 DOM 비의존 순수 함수(ImageData shape mock)로 작성 → node:test 가능:
합성 픽셀 배열(그린 배경+빨간 사각형)에서 (1) 배경 alpha=0, (2) 피사체 alpha=255,
(3) 경계 밴드 부분 알파 존재, (4) spill 억제 후 경계 G≤max(R,B)+ε 검증.

## Accept criteria (WP5 C 게이트)

1. T2 크로마 이미지(020 산출물)에서 기본 파라미터로 배경 완전 제거 — 프리뷰 스크린샷(전/후) + 저장 PNG의 모서리 8점 alpha=0, 피사체 중심 alpha=255 픽셀 검증 스크립트.
2. tolerance 슬라이더 조작 → 프리뷰 즉시 갱신 (조작 전/후 스크린샷, 활성화 증거).
3. 스포이드로 키 색 재지정 동작.
4. `tests/color-key.test.ts` 통과 + typecheck + ui build.
5. white/black 프리셋 산출물에서도 키잉 동작 (키 색 자동 샘플이 흰/검정을 잡음).
6. **실패 경로 활성화** (감사 폴드): (a) 이미지 디코드 실패(깨진 blob 주입) → 패널이
   에러 상태 + 재시도/닫기 렌더 (dead-end 금지), (b) 0×0/빈 ImageData → applyColorKey가
   명시적 throw + UI 에러 상태, (c) cross-origin tainted canvas는 발생 경로 없음을 명시
   (모든 소스가 same-origin generatedDir) — 근거 주석. 각각 테스트/스크린샷으로 관측.
