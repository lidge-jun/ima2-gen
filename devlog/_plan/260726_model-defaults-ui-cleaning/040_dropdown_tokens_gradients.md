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

### shared dropdown skin - MODIFY

- `ui/src/styles/controls.css`
  - list surface를 near-opaque solid `var(--surface)`로 바꾸고 blur 제거.
  - panel radius는 existing `var(--radius)` scale, one shadow.
  - item radius는 existing inner tier, focus-visible outline 추가.
- `ui/src/styles/element-mention.css`
  - same solid surface/radius/shadow language.
  - hardcoded amber `#d58a32`, `#b86f20`, `#fff`를
    `var(--amber)`, color-mix, `var(--on-scrim)`로 교체.
- `ResultActions`의 `details`는 menu/listbox가 아닌 action disclosure이므로
  behavior는 유지한다. owning CSS의 panel skin만 같은 표면을 쓴다.

### gradient budget - MODIFY

- `ui/src/index.css`: `body::before` ambient radial 2개 -> 1개.
- `ui/src/styles/prompt-builder.css`: opaque functional panel의 top wash 제거,
  `var(--surface)` solid로 교체.
- `prompt-builder__thinking`: loading state를 의미하는 motion은 dot animation이
  이미 담당하므로 decorative radial gradient를 flat `var(--control-bg)`로 교체.
- `gallery-modal.css` video placeholder gradient는 media placeholder depth를
  표현하므로 유지 후보지만 C에서 실제 렌더를 보고 solid가 동등하면 제거.
- canvas checkerboard/repeating gradients는 투명도/공간 의미를 encode하므로 대상 밖.

### radius/color cleanup - MODIFY

- 감사 지점인 `ui/src/styles/assetgen-workspace.css:47-56`,
  `ui/src/styles/gallery-modal.css:362`,
  `ui/src/styles/element-mention.css:25-30`만 existing token/calc로 치환.
- 전역 radius 숫자 일괄 codemod는 시각 계층을 무너뜨리므로 하지 않는다.

## 회귀·접근성

- Select keyboard: Enter/Space/Arrow/Home/End/Escape/Tab, selection 후 focus return.
- portaled list는 mobile compose sheet 위에 유지.
- element mention typing/arrow/enter/escape와 mobile sheet tap path 유지.
- reduced motion, focus-visible, 44px option target 확인.
