---
created: 2026-07-15
updated: 2026-07-15
tags: [ima2-gen, asset-gen, sheet, design-only, wp10]
status: 설계 문서 (구현 없음 — 유저 결정 Q9: 후속 phase, 설계는 지금)
---

# 040 — WP10: 아이콘 시트 생성 설계 (구현 없음)

**이 문서는 설계만 확정한다. 구현은 후속 유닛/phase의 P가 이 문서를 재검증 후 착수.**

## 목적

한 번의 생성으로 스타일 일관된 아이콘 세트를 얻는다: 그리드 시트 생성 →
자동 crop → 개별 에셋(투명 PNG) 일괄 등록. `260715_icon_pipeline`(CLI)의
sheet/crop 로직과 공유한다 — UI와 CLI가 같은 `lib/` 모듈을 쓰는 것이 계약.

## 설계 (구현 시 검증할 diff-level 스케치)

### 공유 모듈 — `lib/sheetCrop.ts` (NEW 예정, icon_pipeline과 공동 소유)

```ts
export type SheetSpec = { cols: number; rows: number; cellNames: string[] };
export function cropSheet(srcAbs: string, spec: SheetSpec, outDir: string): Promise<string[]>;
// sharp.metadata + extract 균등 분할 (grokVideoCanvas.ts:14-24 패턴 일반화)
// + 셀별 투명 여백 trim(sharp.trim, 배경이 이미 키잉된 경우) 
export function estimateGrid(srcAbs: string): Promise<{ cols: number; rows: number } | null>;
// v1: gutter 균일색 라인 스캔 휴리스틱; 실패 시 null → 유저가 grid 수동 입력
```

### 서버 — `routes/assetSheet.ts` (NEW 예정)

```
POST /api/assets/sheet { prompt, icons: string[], grid?: {cols,rows}, backgroundPreset, projectId }
  → 생성(020 경로, 시트 프롬프트 조립: "arranged in a NxM grid, equal cells, ...")
  → cropSheet → 셀별 클라이언트 키잉? 아니오 — 시트는 배치라 서버 sharp color-key 사용
    (ASSUMPTION 18: 서버 키잉은 배치/시트 전용) → 개별 알파 PNG + derivedFrom=시트 원본
  → asset 일괄 등록 (이름 = icons[i])
```

### UI — AssetGenWorkspace에 "시트" 서브모드

아이콘 이름 목록 입력(줄 단위) + grid 자동/수동 + 프리뷰(시트 → 분할선 오버레이 →
셀 확인 후 확정). KeyingPanel의 threshold를 배치 파라미터로 1회 지정.

## 구현 시 선결 조건 (후속 P가 확인)

1. `lib/backgroundPresets.ts`(020 출하됨)·`routes/assetDerived.ts`(022 출하됨) 존재 — 서버 배치
   color-key만 신규. **주목**: `ui/src/lib/canvas/colorKey.ts`(021 출하됨)는 DOM 비의존
   순수 픽셀 모듈이라 서버 배치 키잉의 1순위 재사용 후보 — 공용 위치(`lib/` 이동 또는
   공유 임포트)를 후속 P가 결정. 검증은 `npm run verify:chroma`(032 출하됨) 재사용.
2. icon_pipeline 유닛과 crop 모듈 소유권 합의 (중복 구현 금지).
   **소유권 확정 (감사 폴드, 2026-07-15)**: crop/키잉 로직의 소유자는 ima2 코어
   `lib/sheetCrop.ts` 단일 모듈이다. UI 시트는 서버 라우트가 이 lib을 호출하고,
   icon CLI는 로컬 프로세스에서 같은 lib을 임포트한다 — "서버 vs 로컬"은 실행
   위치의 차이일 뿐 구현은 하나. icon_pipeline 핸드오프(010_cli_design)의 로컬
   처리 서술과 모순되지 않도록, icon 구현 P가 이 소유권 문장을 자기 문서에 반영한다.
3. 시트 셀 경계의 생성 불안정성(셀 침범) 대비: 프리뷰-확인 단계 필수 (자동 전량 등록 금지).
4. 시트 생성 프리셋은 chroma-green 고정 권장 — WP4-WP9 실측에서 흰 배경보다 키잉
   마진이 크고(그린 8/8 순수), 셀 gutter 감지도 균일 그린에서 안정적.

## 2026-07-15 구현 학습 반영 (WP10 — 참조 아티팩트는 작업 트리 기준, 커밋 전)

- 파생 등록 계약은 `routes/assetDerived.ts`의 `kind` 확장(`keyed-png` → +`sheet-cell-png`)으로
  수렴 — 신규 라우트 불필요.
- 키 색상은 서버 자동 샘플(`sampleVideoKeyColor` 패턴, WP9 회귀 수정 참조)을 시트
  crop 후 셀별로 적용.

## 이 문서의 완료 기준 (WP10 C)

- 구현 없음 — 문서 자체가 산출물. 감사에서 (a) 020/021/022/030 확정 설계와의 정합,
  (b) icon_pipeline 핸드오프 문서와의 경계 명확성만 검증.
