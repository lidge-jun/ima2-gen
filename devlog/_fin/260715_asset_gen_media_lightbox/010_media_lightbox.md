---
title: 결과 이미지 확대와 비디오 재생 팝업
date: 2026-07-15
tags: [ima2-gen, asset-gen, lightbox, frontend]
status: implemented
---

# 010 — 결과 이미지 확대와 비디오 재생 팝업

## Scope

### IN

- Asset Gen 결과 card의 media-only trigger.
- render-local selected item state와 전용 image/video lightbox.
- Escape/backdrop/close, focus trap/restore, body scroll lock.
- image fit/2x zoom, video native controls/autoplay, responsive containment.
- 한국어/영어 라벨, source-contract regression test, browser screenshots.

### OUT

- server route, provider, generation/persistence/history/global gallery.
- asset card action 의미, keying/retry API, thumbnail ordering.
- 새 npm dependency, icon library, router/hash contract.

## Diff-level file map

### NEW — ui/src/components/assetgen/AssetMediaLightbox.tsx

- item: GenerateItem | null, onClose: () => void만 받는 focused component를 만든다.
- useCallback으로 identity가 안정된 close를 만들고 useAgentDialogFocus(Boolean(item), close)로 dialog 최초 focus, Tab cycle, Escape close, trigger focus restoration을 재사용한다. close button을 panel의 첫 focusable node로 둔다. trigger가 이미 unmount된 cleanup에서는 optional focus 호출이 조용히 무효화되는 기존 hook 동작을 유지한다.
- open effect는 현재 document.body.style.overflow를 저장하고 hidden으로 잠근 뒤 cleanup에서 원래 값을 복원한다. activation: asset 하나를 열어 body overflow가 hidden이고 닫으면 baseline 값으로 복귀함을 browser에서 확인한다.
- backdrop은 full-viewport button, panel은 role=dialog, aria-modal=true, aria-labelledby를 가진다. backdrop/close button/Escape는 같은 stable callback을 호출한다.
- image는 기본 isZoomed=false에서 contain으로 렌더한다. toggle button은 aria-pressed와 다음 행동을 뜻하는 zoom in/out locale label을 가지며 확대 상태에서는 stage 크기를 바꾸지 않고 media width만 200%로 만든다. stage는 overflow:auto, overscroll-behavior:contain, touch-action:pan-x pan-y를 가진다. item 교체/close 후 재open 시 state를 기본 fit으로 초기화한다.
- video는 dialog 안에서만 controls autoPlay muted playsInline preload=metadata로 렌더한다. autoplay는 best-effort이고 native controls의 수동 재생이 항상 fallback이다. item.thumb가 있으면 poster로 쓰고 없으면 fake poster를 만들지 않는다. close 시 component unmount로 playback을 중지한다. tile에서는 controls/autoplay/loop를 제거한다.
- isVideo는 기존 동작과 동일하게 item.mediaType === video일 때만 true다. optional/unknown mediaType은 image fallback으로 렌더하고 image locale label을 쓴다.
- prompt는 dialog의 visible title에 한 번만 노출한다. trim한 prompt가 비어 있으면 image/video별 localized fallback을 title로 사용해 aria-labelledby가 항상 유효하다.
- close icon은 dependency 없는 inline SVG를 사용하고 aria-hidden=true로 둔다.

### MODIFY — ui/src/components/assetgen/AssetGenWorkspace.tsx

- React useState와 GenerateItem type을 import하고 previewItem을 nearest owner의 render-local state로 둔다.
- card의 raw image/video를 assetgen-tile__media button으로 감싼다. button의 accessible name은 image/video별 locale key를 사용한다.
- trigger 내부 media와 bottom-right hint를 렌더한다. video thumbnail은 muted playsInline preload=metadata이며 controls/autoplay/loop는 제거하고 item.thumb가 있을 때만 poster를 사용한다.
- 기존 keyed badge, caption, keying button, retry button의 condition/order/callback은 유지한다.
- workspace 끝에 AssetMediaLightbox를 렌더한다.

### MODIFY — ui/src/styles/assetgen-workspace.css

- raw tile media selector를 assetgen-tile__media 하위로 좁히고 button reset, pointer cursor, focus-visible ring을 추가한다.
- desktop pointer에서는 hover와 keyboard focus에서 assetgen-tile__open-hint를 강조하고 layout size는 변하지 않는다. 800px 이하 touch layout에서는 hint를 항상 보이게 해 hover 의존성을 없앤다. prefers-reduced-motion: reduce에서 transition을 제거한다.
- assetgen-lightbox layer를 추가한다: fixed inset 0, z-index 260으로 현재 검색된 app overlay 최대 245보다 위에 둔다. backdrop, safe-area-aware panel, min-height:0 internal stage, close/zoom controls를 앱 token으로 구성한다.
- image fit은 max-width/max-height/object-fit contain; zoom은 stage overflow auto와 is-zoomed selector로 결정한다. keyed image는 checkerboard stage를 유지한다.
- video는 max-width 100%, max-height와 object-fit contain, off-black background를 사용한다.
- 480px 이하에서는 overlay padding을 max(8px, env(safe-area-inset-*)), panel width/height를 available 100dvw/100dvh 안으로 제한한다. close/zoom은 min-inline-size/min-block-size 44px, stage는 min-height:0과 overscroll containment를 가져 media/title이 clipping 없이 축소된다.
- keyed item은 image 자체가 아니라 lightbox stage에 기존 checkerboard를 적용해 alpha 픽셀 뒤로 배경이 보이게 한다.

### MODIFY — ui/src/i18n/en.json, ui/src/i18n/ko.json

- assetGen.previewImage, previewVideo, previewDialogTitle, closePreview, zoomIn, zoomOut, openHintImage, openHintVideo를 동일 구조로 추가한다.

### NEW — tests/asset-gen-media-lightbox-contract.test.js

- workspace가 media-only button과 local item state를 사용하고 keying/retry callback을 그대로 분리하는지 고정한다.
- lightbox의 semantic dialog, reused focus hook, stable close callback, body overflow cleanup, 세 close 경로, image zoom state, video muted best-effort autoplay/native controls/unmount contract를 고정한다.
- CSS desktop/mobile containment, focus-visible, checkerboard, reduced-motion과 양 locale key를 고정한다.

### GENERATED — docs/migration/runtime-test-inventory.md

- 신규 contract test가 inventory contract로 분류되도록 기존 generator를 실행한다. 생성 파일에 unrelated concurrent delta가 있으면 overwrite하지 않고 현재 generator 결과만 검토한다.

### ADD — devlog/_plan/260715_asset_gen_media_lightbox/001_parallel_uiux_feedback.md

- 세 luna-low read-only 보고서의 공통점, 충돌, 수용/반박, A reviewer verdict를 기록한다.

### ADD — devlog/_plan/260715_asset_gen_media_lightbox/011_verification.md

- static gate, desktop/mobile rendered evidence, keyboard/console observation, pessimistic record, terminal outcome을 기록한다.

## Acceptance criteria

1. image tile media를 클릭하면 fit-to-screen 이미지 dialog가 열리고 toggle을 한 번 누르면 확대, 다시 누르면 fit으로 복귀한다.
2. video tile media를 클릭하면 card 내부 재생과 충돌 없이 큰 muted native-controls player가 열리고 autoplay를 best-effort로 시도한다. 정책상 멈춰도 native play가 보이며, 닫으면 DOM에서 video가 사라져 재생이 끝난다.
3. keying/retry/caption은 dialog를 열지 않으며 기존 callback을 유지한다. source contract는 media button과 sibling action을 분리하고, browser에서는 배경 제거 버튼을 눌러 lightbox가 아니라 keying dialog가 열리는 activation을 확인한다. saveFailures item의 retry는 기존 sibling callback source path를 고정한다.
4. dialog는 role/name/modal semantics, initial focus, Tab cycle, Escape/backdrop/close button, trigger focus restoration을 가진다.
5. open 중 body/document scroll을 잠그고 fixed backdrop이 nested result scroll의 pointer/wheel target을 가린다. close/unmount에서 이전 overflow 값이 복구되고 backdrop wheel 전후 assetgen-results.scrollTop이 변하지 않는다.
6. keyed transparent image는 card와 dialog에서 checkerboard로 읽힌다.
7. 1280x720과 390x844에서 panel/media/control/title이 viewport와 safe area를 넘지 않고 44px close/zoom target, visible focus, zoom stage overscroll containment가 있다.
8. targeted source tests, root typecheck, UI build, inventory가 exit 0이며 실제 popup-open screenshot과 console 0-error evidence가 남는다.

## Audit resolutions

- native video controls는 browser-managed shadow UI라 custom selector가 내부 control을 열거하지 않는다. close button이 처음/마지막 custom focus node이고 document-level Escape는 video focus에서도 닫는다. C에서 keyboard path를 관찰하고 이 native boundary를 과장 없이 기록한다.
- autoplay는 muted best-effort, native manual-play fallback으로 정했다.
- 390x844 zoom은 fixed stage 크기 + overflow auto + overscroll containment로 page-scroll leakage를 막는다.
- z-index는 검색된 app overlay 최대 245보다 높은 260을 쓴다. keying과 lightbox는 같은 workspace의 mutually exclusive local state가 아니므로 media trigger가 keying 뒤에 가려지는 실제 stacking도 확인한다.
- empty prompt와 unknown mediaType은 image/video localized fallback title/name을 사용한다.
- 001은 000-009 연구 범위, 011은 010-019 Phase 1 verification 범위이므로 repo/user numbering 규칙에 맞다.

## As-built

- AssetMediaLightbox는 116줄의 local component로 구현했고 GenerateItem 하나와 close callback만 받는다.
- media button만 preview를 열며 caption, keying, retry는 sibling action으로 남는다.
- image는 keyed stage checkerboard 위 fit 상태로 열리고, 확대 시 fixed stage 안에서 2배 media만 스크롤된다.
- video는 tile controls 없이 popup에서 muted autoplay, native controls, metadata preload로 재생된다.
- semantic dialog, close-first focus, Tab trap, Escape, backdrop, close button, trigger focus restoration, body/root overflow cleanup을 기존 focus hook과 local effect로 제공한다.
- CSS render loop에서 intrinsic square image가 fit 상태에도 stage보다 커지는 결함을 발견했고, non-zoom image/video를 stage에 absolute inset 0으로 고정해 scrollWidth/Height가 client와 같도록 수정했다.
