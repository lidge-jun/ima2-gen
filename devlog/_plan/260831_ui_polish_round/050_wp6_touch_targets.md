---
created: 2026-08-31
tags: [ima2-gen, devlog, ui, a11y, touch]
---

# 050 - wp6: 탭 타깃 하한

> 감사 3라운드 F11/F12/F13으로 재작성. 인터랙티브 판정을 셀렉터 이름이 아니라
> **TSX가 실제로 렌더하는 요소**로 바꿨고, 논리 속성(min-block-size)과 at-rule
> 중첩을 포함하는 PostCSS 파싱으로 다시 셌다. 자기완결 문서.

## 기준

- WCAG 2.5.8 Target Size (Minimum) = **AA, 24x24 CSS px**.
- WCAG 2.5.5 Target Size (Enhanced) = **AAA, 44x44**.
- 기존 tests/a11y-touch-target-contract.test.ts는 **아이콘 전용 컨트롤에만**
  44px을 요구한다. 44px은 외부 AA 요구가 아니라 내부 정책이며 적용 범위가 좁다.

하한 두 개를 쓴다. **인터랙티브 요소는 24px 이상, 아이콘 전용 컨트롤은 44px
히트박스.** D5 밀도에서 전부 44px로 부풀리면 한 화면 정보량이 줄어 반복 작업
동작 수가 오히려 늘어난다.

## 측정 방법과 그 한계 (감사 F11 수용)

이전 판의 "110개"는 주석 제거 후 직접 만든 중괄호 분할기로 센 값이고, at-rule
중첩과 논리 속성을 놓쳤다. PostCSS로 다시 파싱해 논리 속성
(block-size/inline-size/min-*)까지 넣으면 **117개**가 나온다. 감사는 같은
방식으로 118개를 보고했다.

이 1개 차이를 억지로 맞추지 않는다. 총계는 "인터랙티브해 보이는 셀렉터 이름"
정규식에 따라 흔들리는 값이고, 그래서 **총계는 오라클로 쓰지 않는다.** 테스트가
쓰는 오라클은 아래 확정 목록이다. 총계는 참고 수치로만 남긴다.

at-rule 안에 있어서 이전 판이 놓쳤던 6개:

| 위치 | 셀렉터 | 크기 | at-rule |
|---|---|---|---|
| ui/src/styles/controls.css:245 | webkit slider thumb | 22 | max-width 720px |
| ui/src/styles/controls.css:250 | moz range thumb | 22 | max-width 720px |
| ui/src/styles/gallery-modal.css:79 | .gallery__chain-btn | 36 | max-width 800px |
| ui/src/styles/responsive-layout.css:61 | 모바일 모델 셀렉트 | 42w | max-width 800px |
| ui/src/styles/responsive-layout.css:154 | .compose-sheet__handle | 5x48 | max-width 800px |
| ui/src/styles/responsive-mobile.css:214 | .right-panel-toggle | 40 | max-width 800px |

모바일 재정의가 데스크톱 값보다 **작아지는** 경우가 여기 섞여 있다
(.gallery__chain-btn 32 -> 36은 커지고, .right-panel-toggle은 40x40으로
폭이 오히려 정상화된다). 모바일에서 타깃이 작아지는 규칙은 우선 조치 대상이다.

논리 속성이라 이전 판이 통째로 놓친 것:

| 위치 | 셀렉터 | 크기 | 판정 |
|---|---|---|---|
| ui/src/styles/sprite-curator.css:30 | .sprite-rail__actions button | min-block-size 26 | **아이콘 전용, 신규 위반** |
| ui/src/styles/sprite-curator.css:8 | .sprite-curator button/select/input | min-block-size 36 | 텍스트 라벨, AA 통과 |
| ui/src/styles/assetgen-workspace.css:128 | 라이트박스 컨트롤 | 44/44 | 이미 통과 |

ui/src/components/assetgen/SpriteFrameRail.tsx:71의 삭제 버튼은 라벨이
문자 하나(x)이고 aria-label로만 의미를 전달하므로 아이콘 전용이다.

## C. 아이콘 전용 위반 - TSX로 요소를 확인한 것만

각 행은 CSS 크기 + 그 클래스를 렌더하는 TSX 요소를 함께 확인했다.

| CSS 위치 | 렌더 위치 | 요소 | 현재 | 방법 |
|---|---|---|---|---|
| ui/src/styles/assets-workspace.css:47 | ui/src/components/assets/AssetElementToggle.tsx:77 | button | 36x36 | 실제 크기 44 |
| ui/src/styles/agent-workspace-sidebar.css:118 | ui/src/components/agent/AgentModelSelector.tsx:58 | button | 28x24 | ::after |
| ui/src/styles/composer-flow.css:12 | ui/src/components/PromptComposer.tsx:256 | button | 22x22 | ::after |
| ui/src/styles/progress-composer.css:483 | ui/src/components/PromptComposer.tsx:276 | button | 22x22 | ::after |
| ui/src/styles/canvas-annotations.css:287 | ui/src/components/canvas-mode/CanvasStylePopover.tsx:68 | button | 22x22 | ::after |
| ui/src/styles/canvas-annotations.css:144 | ui/src/components/canvas-mode/CanvasToolbar.tsx:185 | button | 26w | ::after |
| ui/src/styles/right-panel.css:26 | ui/src/components/RightPanel.tsx:95 | button | 40x20 | 실제 폭 확대 |
| ui/src/styles/toast-modal.css:401 | ui/src/components/ResultMetadataModal.tsx:254 | button | 30x30 | ::after |
| ui/src/styles/viewer-workflow.css:57 | ui/src/components/viewer/ViewerControls.tsx:35 | button | 28x28 | ::after |
| ui/src/styles/sidebar-history.css:39 | ui/src/components/history/SidebarHistory.tsx:96 | button | 26x30 | ::after |
| ui/src/styles/sidebar.css:394 | ui/src/components/SettingsButton.tsx:12 | button | 32x32 | ::after |
| ui/src/styles/node-workspace.css:405 | ui/src/components/ImageNode.tsx:429 | button | 30w | ::after |
| ui/src/styles/canvas-background-cleanup.css:149 | ui/src/components/canvas-mode/CanvasZoomControl.tsx:22 | button | 30w | ::after |
| ui/src/styles/element-mention.css:30 | ui/src/components/ElementMentionChip.tsx:35 | button | 30w | **래퍼** (아래) |
| ui/src/styles/agent-workspace-panels.css:478 | ui/src/components/agent/AgentResultThumb.tsx:19 | button | 30x30 | 실제 크기 (아래) |
| ui/src/styles/sprite-curator.css:30 | ui/src/components/assetgen/SpriteFrameRail.tsx:71 | button | 26 | ::after |
| ui/src/styles/agent-stage.css:167 | ui/src/components/agent/AgentRightSidebar.tsx:120 | header 내 button | 36x36 | ::after |
| ui/src/styles/canvas-annotations.css:464 | ui/src/components/canvas-mode/CanvasBackgroundControl.tsx:19 | input[type=color] | 22x22 | **실제 크기** (아래) |

## 방법을 행마다 다르게 쓰는 이유 (감사 F13 수용)

::after 히트박스는 만능이 아니다. 세 가지 예외가 있다.

**input[type=color]는 ::after를 신뢰할 수 없다.** 대체 렌더링되는 폼 컨트롤이라
브라우저가 의사요소를 만들지 않을 수 있다.
ui/src/styles/canvas-annotations.css:464는 실제 width/height를 키우거나
래퍼 라벨을 44px로 만든다.

**overflow: hidden 안에서는 잘린다.**
ui/src/components/ElementMentionChip.tsx:35의 버튼은
ui/src/styles/element-mention.css:21에서 overflow: hidden인 칩 안에 있다.
::after를 44px로 늘려도 칩 경계에서 잘리므로 히트 영역이 실제로 늘지 않는다.
칩 자체의 높이를 키우거나 삭제 버튼을 칩 밖 래퍼로 옮긴다.

**이미 ::after를 쓰는 셀렉터.** 구현 직전에 각 셀렉터의 기존 ::before/::after
사용을 확인하고, 있으면 ::before로 바꾸거나 래퍼를 쓴다.

## E. 예외 — 정책 충돌로 44px을 포기하는 곳 (감사 4·5라운드 F7)

| CSS 위치 | 렌더 위치 | 요소 | 현재 | 처분 |
|---|---|---|---|---|
| ui/src/styles/agent-workspace.css:444 | ui/src/components/agent/AgentSessionList.tsx:50 | button x2 | **28w x 24h** | 24px AA 유지, 44px 예외 |

치수는 폭 28px, 높이 24px입니다: `ui/src/styles/agent-workspace.css:445`가
`width: 28px`이고 `ui/src/styles/agent-workspace.css:446`이 `height: 24px`
입니다. 두 축을 각각 단언해서 어느 한 축이 24px 아래로 내려가면 실패하게 합니다.

ui/src/styles/agent-workspace.css:438의 .agent-session-row__actions는
`display: grid`에 열 지정이 없어 **단일 열**이다. 즉 rename/delete 버튼이
**세로로 쌓인다**(앞선 판에 "가로로 나란히"라고 적은 건 틀렸다). 따라서 두 버튼에
44px을 주려면 44 + 4(gap) + 44 = **92px 높이**가 필요한데, 세션 행 자체가
썸네일 42px 기준의 좁은 행이다.

래퍼에 패딩을 주는 방법도 안 된다. 래퍼는 클릭 대상이 아니라서 버튼 히트 영역이
늘지 않는다.

선택지 셋:

1. 두 버튼을 44x44로 키우고 행 높이를 92px 이상으로. 세션 목록 밀도가 두 배 이상
   나빠진다(D5 위반).
2. 케밥 메뉴 하나(44x44)로 합치고 rename/delete를 메뉴 항목으로. 밀도는 지키지만
   상호작용이 한 단계 늘고, 이건 레이아웃/상호작용 재설계라 이 유닛 범위 밖이다.
3. 24px AA만 만족시키고 44px 내부 정책에서 근거와 함께 예외 처리.

**결정: 3번.** 이 유닛은 토큰/일관성 수리다. 두 버튼은 28w x 24h로 이미 WCAG 2.5.8
AA를 통과한다. 예외 이유는 **"단일 열 그리드에 세로로 쌓인 액션 2개. 44px 두 개는
92px 높이를 요구해 세션 행 밀도와 충돌. 케밥 메뉴 전환은 상호작용 재설계라 범위
밖"**으로 기재한다. 2번은 후속 유닛 후보로 남긴다.

C표는 이 행을 제외한 **18개**다.

**.agent-result-thumb--compact는 면제가 아니다.** 이전 판이 썸네일로 보고
비인터랙티브로 분류했지만 ui/src/components/agent/AgentResultThumb.tsx:19가
button으로 렌더한다. 30x30 이미지 버튼이므로 실제 크기를 키운다.

## A. 비인터랙티브 - 대상 아님 (TSX 확인)

| CSS 위치 | 렌더 위치 | 요소 | 이유 |
|---|---|---|---|
| ui/src/styles/progress-composer.css:463 | ui/src/components/PromptComposer.tsx:249 | span aria-hidden | 장식 |
| ui/src/styles/prompt-builder-messages.css:178 | ui/src/components/prompt-builder/PromptBuilderAttachments.tsx:20 | span | 컨테이너 |
| ui/src/styles/canvas-annotations.css:252 | ui/src/components/canvas-mode/CanvasStylePopover.tsx:47 | 트리거 내부 span | 부모가 버튼 |
| ui/src/styles/canvas-accordion.css:286 | ui/src/components/controls/Select.tsx:355 | 트리거 내부 caret | 부모가 버튼 |
| ui/src/styles/assetgen-workspace.css:15 | ui/src/components/assetgen/BackgroundPresetPicker.tsx:42 | 버튼 내부 span | 부모가 버튼 |
| ui/src/styles/element-detail.css:7 | ui/src/components/assets/ElementRefGrid.tsx:93 | 텍스트 button | 라벨 있음, AA만 |
| ui/src/styles/form-controls.css:300 | - | 배지 | 비인터랙티브 |

점(status/dot 계열 7개), svg 아이콘(6개), img 썸네일(5개), 진행 트랙(3개)은
전부 클릭 대상이 아니다. svg를 44px로 키우면 아이콘이 뭉개진다. 면제 목록에
**셀렉터 + 이유 문자열**로 등재한다.

ui/src/components/assetgen/BackgroundPresetPicker.tsx:42의 스와치는 부모
버튼이 히트박스를 갖는지 구현 시 확인한다. 부모가 24px 미만이면 부모를 고친다.

## B. 슬라이더/토글 - 의도된 얇은 트랙

| 위치 | 셀렉터 | 크기 | 근거 |
|---|---|---|---|
| ui/src/styles/controls.css:198 | webkit thumb | 18 | 트랙 밴드 32px |
| ui/src/styles/controls.css:217 | moz thumb | 18 | 같음 |
| ui/src/styles/controls.css:245 | webkit thumb (모바일) | 22 | 밴드 유지 확인 |
| ui/src/styles/controls.css:250 | moz thumb (모바일) | 22 | 같음 |
| ui/src/styles/controls.css:270 | .ctl-toggle__track | 17x30 | 라벨 전체가 클릭 영역 |
| ui/src/styles/controls.css:280 | .ctl-toggle__thumb | 11 | 트랙 내부 |
| ui/src/styles/responsive-layout.css:154 | .compose-sheet__handle | 5x48 | 드래그 핸들, 밴드 확인 |

## D. 텍스트 라벨 컨트롤 - 22px만 AA 미달

| 위치 | 셀렉터 | 현재 | 조치 |
|---|---|---|---|
| ui/src/styles/card-news-templates.css:67 | 배치 칩/렌더 모드 | 22 | min-height 24px |
| ui/src/styles/card-news-templates.css:287 | 카드뉴스 액션 버튼 | 22 | min-height 24px |

나머지 26~42px 텍스트 컨트롤은 24px AA를 통과하므로 건드리지 않는다.

## 테스트: tests/ui-touch-target-contract.test.ts

- C표 **18개** 각 셀렉터가 44px 히트 영역을 갖는지 단언. 방법이 행마다 다르므로
  "::after가 44px"이 아니라 **선언된 실제 크기 또는 등재된 확장 방식**을 확인한다.
- 면제 목록(A/B표)은 셀렉터 + 비어 있지 않은 이유 문자열을 요구.
- 목록 어디에도 없는 새 규칙이 24px 미만이면 실패. **at-rule 안과 논리 속성을
  포함해** 파싱한다(이번 라운드에 놓친 원인).
- 기존 tests/a11y-touch-target-contract.test.ts 4개 셀렉터 계약은 유지.
- 변형 증명 4개: 면제 이유를 지우면 실패, 히트 영역을 40px로 낮추면 실패, at-rule
  안에 20px 아이콘 버튼을 넣으면 실패, min-block-size로 20px을 쓰면 실패.

## 렌더 검증 (wp7으로 넘김)

정적 CSS만으로는 히트 영역이 실제로 잡히는지 알 수 없다. wp7에서
document.elementFromPoint로 각 C표 컨트롤의 네 모서리 안쪽을 찍어
**해당 버튼이 반환되는지** 확인한다. overflow 클리핑과 인접 히트박스 겹침은
이 방법으로만 잡힌다.

## 완료 조건

C표 18개 전부 44px 유효 히트 영역, 세션 액션 2개는 24px AA + 면제 근거,
D표 2건 24px 이상, 면제 전부 이유 기재, elementFromPoint로 겹침/클리핑 없음 확인,
npm test 무회귀.
