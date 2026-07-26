---
title: 키잉 전후 비교와 파생 결과 카드
date: 2026-07-15
tags: [ima2-gen, asset-gen, keying, frontend]
status: implemented
---

# 010 — 키잉 전후 비교와 파생 결과 카드

## Scope

### IN

- 키잉 패널의 원본/배경 제거 2-up 비교.
- 이미지 저장 응답과 비디오 `keying-done` 이벤트를 `assetGenItems`에 반영.
- 파생 카드 checkerboard·상태 배지, 파생 카드의 중복 키잉 버튼 제거.
- 한국어/영어 라벨, source-contract 회귀 테스트, 실제 렌더 QA.

### OUT

- 서버 route, 키잉 수학, 생성 provider, assets DB/schema, 히스토리 구조.
- 기존 원본 자동 귀속 및 저장 실패 재시도 동작.
- `skills/`, oauth fallback, home composer 등 병렬 변경.

## Diff-level file map

### MODIFY — `ui/src/store/storeTypes.ts`

- `AppState`의 asset-gen 액션 구간에 `addAssetGenDerivedItem: (item: GenerateItem) => void`를 추가한다.
- before: 외부 컴포넌트가 `assetGenItems`에 파생 결과를 추가할 공식 경로 없음.
- after: 키잉 저장 경계가 완성된 `GenerateItem` 하나를 목록 앞에 삽입할 수 있음.

### MODIFY — `ui/src/store/useAppStore.ts`

- `setKeyingTarget` 옆에 `addAssetGenDerivedItem: (item) => set(state => ({ assetGenItems: [item, ...state.assetGenItems] }))`를 배치한다.
- 서버 상태를 복제하지 않고 현재 세션의 결과 프레젠테이션만 갱신한다.

### MODIFY — `ui/src/components/assetgen/KeyingPanel.tsx`

- keyed canvas 단일 stage를 `figure` 2개로 교체한다: 원본 `<img>`와 checkerboard keyed `<canvas>`.
- 로딩 중에는 결과 stage에 짧은 상태 텍스트를 보여 주고, 오류는 비교 영역 전체의 기존 recovery 상태를 유지한다.
- 파일 경로를 받은 뒤 기존 source를 복사하되 다음 값을 명시적으로 덮어쓰는 작은 `makeDerivedItem` helper를 추가한다: `filename=filePath`, `image=url=/generated/${encodeURIComponent(filePath)}`, `mediaType`은 이미지 저장이면 `image`, 비디오 done이면 `video`, `kind="edit"`, `requestId="derived:${filePath}"`, `createdAt=Date.now()`. 서버가 파생 파일을 generated root에 저장하므로 encoded 단일 filename URL 계약을 사용한다.
- 이미지 `uploadDerivedAsset` 성공과 비디오 `keying-done`에서 각각 `addAssetGenDerivedItem`을 호출한 뒤 기존 toast/close 순서를 유지한다.
- 조건 경로 활성화: 이미지 저장 성공 응답과 비디오 SSE done payload에 non-empty string `filePath`가 존재할 때 카드 추가. 비디오 payload가 잘못되어 `filePath`가 없거나 빈 문자열이면 기존 저장 완료 처리만 유지하고 잘못된 카드를 만들지 않는다.
- 원본 `<img>`는 `alt={t("keying.originalAlt")}`, keyed canvas는 기존 `previewAlt`를 유지한다. source 이미지의 load/error가 두 preview의 공통 입력이므로 부분 실패 상태는 만들지 않고, source load 실패 시 비교 영역 전체를 기존 error recovery로 바꾼다.
- `loadState="loading"` 동안 두 figure의 고정 aspect-ratio stage는 유지한다. 왼쪽 source `<img>`는 브라우저가 로드하는 즉시 보일 수 있고, 오른쪽에는 `previewLoading` 상태 문구를 표시해 빈 checkerboard로 오인하지 않게 한다.

### MODIFY — `ui/src/components/assetgen/AssetGenWorkspace.tsx`

- `item.kind === "edit"`을 keyed 결과로 분류한다.
- 파생 tile에 `is-keyed` class와 “배경 제거됨” 배지를 주고, 다시 키잉하는 버튼과 원본 저장 실패 retry를 숨긴다.
- 원본 카드와 생성 흐름은 그대로 둔다.

### MODIFY — `ui/src/styles/assetgen-workspace.css`

- 키잉 패널 폭을 2-up 비교에 맞게 넓히고 `.keying-panel__compare`, `.keying-panel__preview`, `.keying-panel__preview-label`을 추가한다.
- `.keying-panel__compare { grid-template-columns: repeat(2, minmax(0, 1fr)) }`와 각 figure/stage의 `min-width: 0`으로 두 stage를 동일 크기로 만든다. 원본은 neutral background, 결과는 기존 checkerboard를 유지한다.
- `.assetgen-tile.is-keyed` media에 checkerboard를 적용하고 badge를 배치한다.
- 패널 body 자체에 `overflow-y: auto`를 허용한다. 좁은 화면에서도 2열 비교를 유지하되 gap/label/panel padding을 줄인다. 320px viewport에서 panel outer width 288px, content width 264px, gap 6px, preview column 129px 이상을 목표로 하고 canvas/img는 `width/max-width: 100%`로 축소한다.

### MODIFY — `ui/src/i18n/ko.json`, `ui/src/i18n/en.json`

- `keying.original`, `keying.originalAlt`, `keying.removed`, `keying.previewLoading`, `keying.resultBadge`를 양쪽 locale에 같은 구조로 추가한다.

### NEW — `tests/asset-gen-keying-preview-contract.test.js`

- KeyingPanel이 original image + keyed canvas + 양쪽 label을 렌더하는지 source contract로 고정한다.
- 이미지 upload 성공과 video done 양쪽이 `addAssetGenDerivedItem`을 호출하는지, `filePath` 없는 SSE가 guard되는지, 파생 URL/mediaType/requestId가 명시적으로 고유하게 만들어지는지 고정한다.
- workspace의 `is-keyed`/badge/재키잉 제외와 CSS checkerboard/2-up 규칙, 양 locale key를 고정한다.

### GENERATED — `docs/migration/runtime-test-inventory.md`

- `node scripts/classify-tests.mjs`로 신규 contract-only 테스트 목록을 갱신한다.

## Acceptance criteria

1. 키잉 대화상자를 열면 원본과 “배경 제거” 결과가 같은 화면, 같은 크기로 보인다. 제거 결과의 투명 픽셀은 checkerboard로 식별된다.
2. slider 또는 eyedropper 변경 시 오른쪽 결과만 즉시 다시 그려지고 왼쪽 원본은 변하지 않는다.
3. 이미지 “프로젝트에 저장” 성공 시 패널이 닫힌 뒤 keyed PNG 카드가 결과 목록 맨 앞에 보이며 “배경 제거됨” 배지와 checkerboard를 가진다.
4. 비디오 `keying-done`의 `filePath`가 있는 실제 이벤트에서 alpha WebM 카드가 동일하게 추가된다. `filePath` 없는 이벤트 fixture에서는 카드가 추가되지 않아 깨진 URL을 만들지 않는다. 모든 파생 카드는 `/generated/<encoded filePath>` URL과 `derived:<filePath>` request ID를 가져 원본/다른 파생 카드와 key가 충돌하지 않는다.
5. 파생 카드에는 “배경 제거” 버튼과 원본 자동 저장 retry가 나타나지 않는다.
6. 1280x720, 390x844, 320x844에서 비교 영역·controls·actions가 가로로 잘리지 않는다. 세로 공간이 부족하면 dialog 내부만 스크롤된다. 키보드 Escape와 기존 버튼 경로는 유지되고 원본 image/keyed canvas 각각 접근 가능한 이름을 가진다.
7. `node --test tests/asset-gen-keying-preview-contract.test.js`, `npm run typecheck`, `cd ui && npm run build`, `npm run test:inventory`가 exit 0이다.

## SoT sync

- 이 보완은 기존 `devlog/_fin/260715_asset_gen_mode/021_client_keying.md`와 `022_keying_persistence.md`의 구현 후속이다. 일반 아키텍처/API 계약은 바뀌지 않으므로 `structure/01-file-function-map.md`와 `docs/API.md`는 변경하지 않는다.
- D에서 이 문서를 as-built 상태로 갱신하고 유닛을 `_fin/`으로 이동한다.

## C audit amendment

- `001_c_audit_repair.md`의 감사 결과에 따라 image load effect cancellation, video SSE subscription target/unmount cleanup, progress/error payload 타입 guard, 이미지 save `filePath` runtime guard, store filename dedup을 같은 슬라이스의 경계 hardening으로 추가한다.

## As-built

- 원본 `<img>`와 keyed `<canvas>`를 같은 크기의 2-up stage로 렌더한다.
- 이미지/비디오 저장 완료는 `derived:<filePath>` identity와 `/generated/<encoded filePath>` URL로 결과 목록 맨 앞에 삽입된다.
- keyed 카드는 checkerboard와 “배경 제거됨” 배지를 가지며 재키잉·원본 저장 retry를 노출하지 않는다.
- target 전환/닫기 중 발생하는 stale image load, `toBlob`, upload promise, video POST/SSE callback은 현재 target 소유권을 확인한다.
- malformed progress/error/done payload와 빈 image save `filePath`는 성공으로 오인하지 않는다.
- store는 동일 filename 파생 카드를 중복 삽입하지 않는다.
