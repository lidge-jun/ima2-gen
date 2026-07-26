# WP4 - dropdown·token·gradient 클리닝

## 방향

한 skin이 한 behavior를 뜻하지 않는다. form listbox는 기존
`ui/src/components/controls/Select.tsx`를 재사용하고, element suggestion/menu action은
각 behavior를 유지한 채 panel skin만 `controls.css`의 near-opaque 표면에 맞춘다.

## 변경 지도

### Prompt Builder dropdown - MODIFY

- `ui/src/components/prompt-builder/PromptBuilderModelMenu.tsx`
  - hand-rolled open/blur/listbox를 삭제.
  - existing `Select<PromptBuilderModel>`로 교체.
  - Luna-first items, `portal` when clipping risk exists, aria label 유지.
- `ui/src/styles/prompt-builder.css`
  - custom trigger/menu/option rules 삭제.
  - scope sizing만 `.prompt-builder__model-picker .ctl-select*`로 유지.
  - builder panel이 `overflow: hidden`이므로 shared Select는 `portal`로 렌더.

### shared dropdown skin - MODIFY

- `ui/src/styles/controls.css`
  - list surface를 near-opaque solid `var(--surface)`로 바꾸고 blur 제거.
  - panel radius는 existing `var(--radius)` scale, one shadow.
  - item radius는 existing inner tier, option 최소 높이 44px, trigger의
    focus-visible outline을 명시한다.
- `ui/src/components/controls/Select.tsx`
  - Home/End도 Arrow 이동과 같이 disabled option을 건너뛰게 한다.
  - portal 폭은 `window.innerWidth - gutter * 2`를 상한으로 잡아 320px와
    200% reflow에서도 음수 left나 viewport overflow가 없게 한다.
  - 기존 Enter/Space/Arrow/Escape/Tab/typeahead와 portal API는 바꾸지 않는다.
- `ui/src/styles/element-mention.css`
  - same solid surface/radius/shadow language.
  - hardcoded amber `#d58a32`, `#b86f20`, `#fff`를
    `var(--amber)`, color-mix, `var(--on-scrim)`로 교체.
- `ResultActions`의 `details`는 menu/listbox가 아닌 action disclosure이므로
  behavior는 유지한다. `ui/src/styles/right-panel.css`의 panel skin을 같은
  표면/radius로 맞추고 menu item을 최소 44px 및 명시적 focus-visible로 만든다.

### gradient budget - MODIFY

- `ui/src/index.css`: `body::before` ambient radial 2개 -> 1개.
- `ui/src/styles/prompt-builder.css`: opaque functional panel의 top wash 제거,
  `var(--surface)` solid로 교체.
- `prompt-builder__thinking`: loading state를 의미하는 motion은 dot animation이
  이미 담당하므로 decorative radial gradient를 flat `var(--control-bg)`로 교체.
- `gallery-modal.css` video placeholder gradient는 media placeholder depth를
  표현하므로 유지 후보지만 C에서 실제 렌더를 보고 solid가 동등하면 제거.
- `ui/src/styles/gallery-modal.css`의 storage notice top wash는 불투명 기능
  패널의 장식이므로 제거하고 solid surface로 바꾼다.
- canvas checkerboard/repeating gradients는 투명도/공간 의미를 encode하므로 대상 밖.

### radius/color cleanup - MODIFY

- 감사 지점인 `ui/src/styles/assetgen-workspace.css:47-56`,
  `ui/src/styles/gallery-modal.css:362`,
  `ui/src/styles/element-mention.css:25-30`만 existing token/calc로 치환.
  - asset media의 `#0a0a0a`, `#fff`, 정의되지 않은 `--danger` fallback은
    `var(--bg)`, `var(--on-scrim)`, `var(--red)`로 통일한다.
  - Prompt Builder scope-remove의 hardcoded red 두 개도 `var(--red)`와
    color-mix로 통일한다.
- 390px 한국어 렌더에서 붙어 보인 `.assetgen-workflow-tabs`는 실제 소유자인
  `ui/src/styles/sprite-recipe.css`에서 gap, 44px target, selected/focus 상태를
  주고 `ui/src/components/assetgen/AssetGenWorkspace.tsx`에서 tab ref,
  roving `tabIndex`, Arrow/Home/End 이동을 기존 `useTablistKeys`로 연결한다.
- 전역 radius 숫자 일괄 codemod는 시각 계층을 무너뜨리므로 하지 않는다.

## 회귀·접근성

- Select keyboard: Enter/Space/Arrow/Home/End/Escape/Tab, selection 후 focus return.
- portaled list는 mobile compose sheet 위에 유지.
- element mention typing/arrow/enter/escape와 mobile sheet tap path 유지.
- reduced motion, focus-visible, 44px option target 확인.

## 검증 지도

- `tests/prompt-studio-ui-contract.test.js`: Prompt Builder가 hand-rolled 상태와
  CSS를 제거하고 shared `Select` + `portal`을 쓰는지 고정.
- `tests/provider-ui-polish-contract.test.js`,
  `tests/mcp-settings-states-contract.test.ts`: shared Select의 기존
  aria-activedescendant/typeahead 계약 회귀 방지.
- `tests/element-mention-ui-contract.test.js`: mention listbox 동작과 mobile
  sheet 경로 유지.
- `tests/asset-gen-keying-preview-contract.test.js`: 390px tab gap, selected/focus,
  tablist 키보드 연결을 추가 검증.
- 같은 테스트 묶음에서 portal 폭이 viewport 상한으로 clamp되는지,
  ResultActions 항목 44px/focus-visible, storage notice 장식 gradient 제거,
  checkerboard와 caption scrim 보존을 고정한다.
- 390/768/1440, 한국어, 200% reflow에서 Prompt Builder menu와 Asset Gen tabs를
  캡처하고 horizontal overflow, console error, clipping을 기록.
- 실제 브라우저 320/390/768/1024/1440에서 Prompt Builder trigger에
  Enter/Space를 보내 열림을 확인하고,
  Arrow/Home/End의 `aria-activedescendant`, Escape/Tab 닫힘, 선택 뒤 trigger focus,
  option의 `aria-selected`, portaled list의 `document.body` 소유와 sheet 상단
  z-index를 단계별로 기록한다. disabled fixture는 공용 Select 계약 테스트에서
  Home/End가 disabled option을 건너뛰는 소스 경로를 고정한다.

## B 실행 기록

- Prompt Builder는 Luna-first `Select<PromptBuilderModel>` + `portal`로 교체했고
  전용 open/blur/listbox 상태와 skin을 제거했다.
- shared Select는 320px에서도 좌우 12px gutter 안으로 clamp하며 Home/End가
  disabled option을 건너뛴다. 실제 키보드에서 Enter/Space/Arrow/Home/End,
  Escape/Tab, 선택 뒤 focus return과 `aria-*` 전이를 확인했다.
- Asset Gen tab CSS가 lazy Sprite chunk에서만 로드되어 첫 화면 target이 24px였던
  렌더 결함을 발견했다. `AssetGenWorkspace`가 CSS를 직접 import하도록 보정한 뒤
  한국어 390px에서 두 tab 모두 44px, gap 6px, roving tabindex를 확인했다.
- 320/390/768/1024/1440에서 shared portal 경계는 viewport 안, horizontal
  overflow 0, browser console error 0이었다. Prompt Builder는 제품 breakpoint상
  1024px 이상에서 렌더되며 1024/1440 양쪽에서 portal clipping이 없었다.

### 런타임 증거 재확인

- Prompt Builder(1440px): open `aria-expanded=true`,
  `aria-controls=_r_4_`, active `_r_4_-opt-0`, list는 `document.body` 직속,
  z-index 220, rect `x=1238 y=183 w=190 h=274`. ArrowDown은 `opt-1`,
  End는 `opt-5`, Home은 `opt-0`, Escape/Tab은 `aria-expanded=false`였다.
  End + Enter 선택은 `gpt-5.4-mini`, 선택 option의 `aria-selected=true`,
  선택 뒤 trigger focus return은 true, Home + Enter 복귀는 `gpt-5.6-luna`였다.
- 공용 portal(320/390/768/1024/1440): list rect는 각각
  `x=82.21875/136/511/129/129`, width 190, 모든 viewport에서 `inViewport=true`.
  `scrollWidth=clientWidth`도 5개 viewport 전부 일치했다.
- Asset Gen(한국어 390px): `일반 생성` rect `x=18 w=85.796875 h=44`,
  `스프라이트` rect `x=109.796875 w=95.203125 h=44`. ArrowRight는 두 번째 tab에
  `selected=true/tabIndex=0/focused=true`, Home은 첫 번째 tab, End는 두 번째
  tab으로 같은 상태를 이동시켰다. `scrollWidth=clientWidth=390`, console error 0.
- 공용 portal 위쪽 배치(1024×200, trigger `y=165.40625 h=22.59375`): list rect
  `x=500 y=12 w=190 h=153.40625`, `opensAbove=true`, `inViewport=true`,
  `max-height=153.406px`, grouped label 1개, console error 0. 이제 아래 공간이
  부족하면 렌더된 `scrollHeight`를 읽어 grouped-row를 포함한 실제 높이로
  위쪽 배치를 계산한다.
- Asset Gen(한국어 320px): 두 tab 모두 `h=44`, 폭은 각각 `w=139`,
  x는 `18/163`, `scrollWidth=clientWidth=320`, ArrowRight 선택·focus 전환은
  유지됐다. 좁은 화면에서 tab group은 전체 폭, tab은 `1 1 0`으로 축소된다.
- 첫 19:20 캡처는 초기 24px metric 이후 tab 키 입력이 lazy Sprite chunk를
  로드한 뒤 찍혀 이전 결함 화면의 증거가 아니었다. 재확인 캡처는
  `.codex/visualizations/.../wp4-render/`의 `provider-menu-en-320-rerun.png`,
  `assetgen-tabs-ko-390-rerun.png`, `prompt-builder-menu-en-1440-rerun.png`이고,
  각 hash는 `98e54a3f`, `2e18ee0c`, `a8248bbd` 접두어로 구분된다.
  320px tab 캡처는 `assetgen-tabs-ko-320-rerun.png`, hash 접두어 `50baa6b8`.
