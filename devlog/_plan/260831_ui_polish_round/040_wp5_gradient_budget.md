---
created: 2026-08-31
tags: [ima2-gen, devlog, ui, gradients]
---

# 040 - wp5: 그라디언트 분류와 예산

> 감사 3라운드 F6/F7/F8/F9/F10으로 재작성. 개수 단위를 **그라디언트 함수 호출**
> 하나로 통일하고, shimmer 소비자를 6개로 정정하고, 매니페스트를 전수로 만들고,
> wp4와의 소유 경계를 확정했다. 자기완결 문서.

## 개수 단위를 먼저 못 박는다

이전 판이 "선언"과 "함수 호출"을 섞어 세서 합이 맞지 않았다. 이 문서는 전부
**그라디언트 함수 호출 1개 = 1개**로 센다. 한 background 선언에 함수가 4개면
4개다.

전체 **49개**: linear 36, radial 7, conic 6.

| 파일 | 개수 |
|---|---|
| ui/src/styles/node-workspace.css | 7 |
| ui/src/styles/assetgen-workspace.css | 6 |
| ui/src/styles/progress-composer.css | 6 |
| ui/src/styles/canvas-annotations.css | 4 |
| ui/src/index.css | 3 |
| ui/src/styles/card-news-layout.css | 3 |
| ui/src/styles/prompt-builder-messages.css | 3 |
| ui/src/styles/sidebar.css | 3 |
| 나머지 9개 파일 | 1~2 |

분류 합계: **functional 18, state 11, scrim 2, decorative 18.** 합 49.

## 전수 매니페스트

매니페스트는 49개 **전부**를 담는다. 일부만 담으면 항목을 지우는 것이
"미등재 decorative"로 재분류되어 예산을 통과할 수 있다(감사 F8). 전수이므로
등재되지 않은 그라디언트의 존재 자체가 실패 조건이다.

### functional 18 - 격자/좌표/마스크

| 위치 | 셀렉터 | 개수 | 이유 |
|---|---|---|---|
| ui/src/styles/assetgen-workspace.css:21 | 체커보드 스와치 | 2 | 45도 체커보드 2레이어 |
| ui/src/styles/assetgen-workspace.css:59 | .assetgen-tile.is-keyed | 1 | 알파 격자 |
| ui/src/styles/assetgen-workspace.css:62 | .assetgen-tile.is-alpha | 1 | 알파 격자 |
| ui/src/styles/assetgen-workspace.css:90 | 프리뷰 스테이지 | 1 | 알파 격자 |
| ui/src/styles/assetgen-workspace.css:133 | 라이트박스 스테이지 | 1 | 알파 격자 |
| ui/src/styles/sprite-curator.css:13 | .sprite-curator__preview | 1 | 알파 격자 |
| ui/src/styles/canvas-annotations.css:432 | 알파 프레임 | 4 | 알파 격자 4레이어 |
| ui/src/styles/canvas-mode.css:6 | 캔버스 점 격자 | 1 | 좌표 격자 |
| ui/src/styles/node-workspace.css:57 | 노드 점 격자 | 1 | 좌표 격자 |
| ui/src/styles/node-canvas-extras.css:10 | 템플릿 프리뷰 격자 | 1 | 좌표 격자 |
| ui/src/styles/node-workspace.css:171 | -webkit-mask | 2 | 마스크 합성 |
| ui/src/styles/node-workspace.css:173 | mask | 2 | 마스크 합성 |

투명 배경 이미지를 다루는 도구에서 격자는 장식이 아니라 "이 픽셀은 투명하다"는
정보다. 마스크 4개는 검은색 단일 stop이라 시각 색을 만들지 않으므로 감축 대상이
아니다 - 지우면 진행 링 테두리가 깨진다.

### state 11 - 상태 전달

| 위치 | 셀렉터 | 상태 |
|---|---|---|
| ui/src/styles/node-workspace.css:163 | .image-node--reconciling::before | 진행 회전 링 |
| ui/src/styles/node-workspace.css:206 | .image-node__skeleton | 로딩 shimmer |
| ui/src/styles/right-panel.css:540 | .multimode-sequence__skeleton | 로딩 shimmer |
| ui/src/styles/sidebar-history.css:150 | .sidebar-history__thumb--skeleton | 로딩 shimmer |
| ui/src/styles/sidebar-history.css:172 | .sidebar-collection-mini--skeleton | 로딩 shimmer |
| ui/src/styles/progress-composer.css:149 | .history-thumb--skeleton | 로딩 shimmer |
| ui/src/styles/progress-composer.css:190 | .collection-mini--skeleton | 로딩 shimmer |
| ui/src/styles/progress-composer.css:221 | 진행 레이어 | 진행 |
| ui/src/styles/progress-composer.css:228 | 진행 레이어 | 진행 |
| ui/src/styles/progress-composer.css:235 | 성공 레이어 | 성공 |
| ui/src/styles/progress-composer.css:236 | 성공 레이어 | 성공 |

### scrim 2

ui/src/styles/gallery-modal.css:376(.gallery__caption),
ui/src/styles/canvas-mode.css:17(상단 스크림). 흰 텍스트 대비를 만든다.

### decorative 18

| 위치 | 셀렉터 | 처분 |
|---|---|---|
| ui/src/index.css:214 | body::before 라디얼 틴트 | 유지 |
| ui/src/index.css:123 | --prism 정의 | 유지 |
| ui/src/index.css:124 | --chrome 정의 | 유지 |
| ui/src/styles/sidebar.css:59 | .logo-title 텍스트 클립 | **wp4가 var(--chrome)로 치환** |
| ui/src/styles/sidebar.css:69 | .logo-title--gen | 유지 |
| ui/src/styles/sidebar.css:190 | .theme-toggle__family-dot | 유지(라이트/다크 분할 = 정보) |
| ui/src/styles/canvas-viewer.css:44 | .settings-workspace 라디얼 | 제거 |
| ui/src/styles/canvas-viewer.css:45 | .settings-workspace 135deg | var(--bg) 단색 |
| ui/src/styles/prompt-builder-messages.css:13 | assistant 메시지 | 단색 표면 |
| ui/src/styles/prompt-builder-messages.css:48 | 구조화 헤더 | 단색 표면 |
| ui/src/styles/prompt-builder-messages.css:67 | 구조화 카드 | 단색 표면 |
| ui/src/styles/card-news-layout.css:231 | 빈 상태 카드 | 유지(아래 참조) |
| ui/src/styles/card-news-layout.css:260 | 스켈레톤 텍스트 라인 | 유지(가짜 텍스트 = 정보) |
| ui/src/styles/card-news-layout.css:261 | 같음 | 유지 |
| ui/src/styles/right-panel.css:328 | .canvas__blank-sheet | 죽은 선언 제거 |
| ui/src/styles/viewer-workflow.css:8 | .canvas__blank-sheet 점 격자 | 유지 |
| ui/src/styles/viewer-workflow.css:13 | .canvas__blank-sheet 종이 | 토큰 참조로 |
| ui/src/styles/settings-controls.css:66 | 라디오 체크 점 | 유지(선택 상태 = 정보) |

## 범위: 감축은 3개만 (감사 F10 수용)

이전 판은 6개를 단색으로 내리려 했다. 그런데 예산 규칙(파일당 decorative 3개
이하)을 **이미 모든 파일이 만족한다.** 예산을 근거로 규격 준수 표면을 6개
평탄화하는 건 예산 수리가 아니라 재디자인이고, 사용자가 요청한 폴리싱 범위를
넘는다.

그래서 감축은 근거가 개별적으로 서는 것만 남긴다.

**.settings-workspace 2개 제거.** 설정 화면 전체 배경에 라디얼 틴트를 깔면
D5 밀도에서 폼 컨트롤 대비가 흔들린다. 이건 예산이 아니라 대비 근거다.
before/after 렌더로 확인한다.

**.canvas__blank-sheet 죽은 선언 1개 제거.** 아래 참조. 렌더 무변경.

prompt-builder-messages 3개와 card-news 1개는 **유지한다.** color-mix 표면 위
얕은 그라디언트라 시각적으로 문제가 확인되지 않았고, 단색으로 내리면 메시지
종류(assistant/구조화 카드) 구분이 약해질 수 있다. 근거 없이 건드리지 않는다.

## shimmer 중복 6개 (감사 F7 정정)

동일한 90deg 3-stop 패턴이 **6곳**이다. 5개로 적었던 건 오류다.

| 위치 | 셀렉터 |
|---|---|
| ui/src/styles/node-workspace.css:206 | .image-node__skeleton |
| ui/src/styles/right-panel.css:540 | .multimode-sequence__skeleton |
| ui/src/styles/sidebar-history.css:150 | .sidebar-history__thumb--skeleton |
| ui/src/styles/sidebar-history.css:172 | .sidebar-collection-mini--skeleton |
| ui/src/styles/progress-composer.css:149 | .history-thumb--skeleton |
| ui/src/styles/progress-composer.css:190 | .collection-mini--skeleton |

--skeleton-shimmer 토큰 하나로 모으고 **6곳 전부** 참조하게 한다. 값이 동일하므로
렌더가 바뀌지 않는다. 회귀 위험이 가장 낮은 실제 개선이다.
keyframes skeleton-shimmer(ui/src/styles/node-workspace.css:216)는 그대로 둔다.

## .canvas__blank-sheet 중복 정의

같은 셀렉터가 두 파일에서 background를 선언한다.

- ui/src/styles/right-panel.css:322 - 흰색 linear + #ffffff
- ui/src/styles/viewer-workflow.css:6 - radial 점 격자 + 같은 linear + #ffffff

ui/src/index.css의 @import 순서에서 right-panel.css(261행)가
viewer-workflow.css보다 먼저 오므로 **viewer-workflow가 이긴다**. right-panel의
선언은 죽은 코드다. 이 요소는 ui/src/components/Canvas.tsx:336에서
aria-hidden으로 렌더되는 빈 상태 종이 그림이다.

## wp4와의 소유 경계 (감사 F9 수용)

두 유닛이 겹치는 지점을 이름까지 확정한다.

| 항목 | 소유 | 내용 |
|---|---|---|
| --paper, --paper-edge 토큰 정의 | **wp4** | 라이트/다크 값 포함 |
| ui/src/styles/viewer-workflow.css:13의 #ffffff/#f8fafc 치환 | **wp5** | var(--paper), var(--paper-edge) |
| ui/src/styles/sidebar.css:59 -> var(--chrome) | **wp4** | 상태색/토큰 복원 |
| ui/src/styles/right-panel.css:328 죽은 선언 제거 | **wp5** | 그라디언트 정리 |

wp4가 sidebar.css:59를 var(--chrome)로 바꾸면 그라디언트 함수 호출이 1개 줄어
**wp5의 입력은 48개**가 된다. 실행 순서는 wp4 -> wp5로 고정한다.

## 기준선 48 -> 최종 40 (감사 4라운드 F6)

앞선 판은 wp5가 끝난 뒤에도 48개를 요구했는데, 그건 wp5가 하는 일과 모순이다.
감축을 하면서 같은 개수를 요구하면 테스트가 통과할 수 없다. 매니페스트를 두 개로
나눈다.

| 단계 | 총계 | functional | state | scrim | decorative |
|---|---|---|---|---|---|
| 원본 | 49 | 18 | 11 | 2 | 18 |
| wp4 후 = wp5 입력 | 48 | 18 | 11 | 2 | 17 |
| **wp5 후 = 최종** | **40** | **18** | **6** | **2** | **14** |

48 -> 40 내역:

- shimmer 6개 함수를 --skeleton-shimmer 토큰 정의 1개로 모음: state 11 -> 6
  (**-5**). 토큰 정의 자체가 그라디언트 함수 1개이므로 6개가 사라지고 1개가
  생겨 순감 5다.
- .settings-workspace 2개 제거: decorative 17 -> 15 (**-2**).
- right-panel.css:328 죽은 선언 1개 제거: decorative 15 -> 14 (**-1**).

합 -8. 48 - 8 = 40. functional 18과 scrim 2는 변하지 않는다.

--skeleton-shimmer 정의는 ui/src/index.css의 :root 블록에 **단 한 번만** 둔다
(감사 5라운드 F4). 양쪽 테마 블록에 같은 식을 쓰면 그라디언트 함수가 2개가 되어
최종 개수가 41이 되고 위 산술이 깨진다. 식이 참조하는 --surface-2와 --amber가
테마 블록에서 재정의되므로, 정의 하나로도 테마별 값이 따라온다.
매니페스트에서 이 정의는 state 카테고리로 등재한다.

## 테스트: tests/ui-gradient-manifest-contract.test.ts

테스트는 **파일별 그라디언트 개수 매니페스트**로 검증한다. 같은 파일 안에서
카테고리를 바꾸는 동시 치환은 감지하지 않는다 — 이건 의도적 범위 제한이다.
Per-declaration PostCSS 매니페스트는 후속 강화 대상.

- 파일별 그라디언트 함수 호출 개수가 매니페스트와 일치하는지 단언.
  미등재 파일에 그라디언트가 생기면 실패.
- 카테고리별 합계를 상수로 단언: functional 18, state 6, scrim 2, decorative 14.
  합 40.
- 파일당 decorative 3개 이하.
- --skeleton-shimmer 정의 1곳, 참조 6곳(4개 파일 명시 고정).
- .canvas__blank-sheet background 선언이 viewer-workflow.css 한 곳에만 존재.

## 완료 조건

파일별 매니페스트가 40개 등재(functional 18 / state 6 / scrim 2 / decorative 14),
--skeleton-shimmer 정의 1곳에 참조 6곳(4파일), .canvas__blank-sheet background
선언 1곳, npm test 무회귀.
.settings-workspace before/after 렌더 비교는 wp7 렌더 증거에서 수행
(060_wp7_design_md_and_render_proof.md가 소유).

## Implementation Log (B-phase)

All changes in two commits on codex/ui-polish-wp5-gradient-budget:

- f385a5a0: fix(ui): shimmer consolidation, settings-workspace pruning, paper tokens
- 2891a87e: test(ui): 5-assertion gradient manifest contract

Final: 40 gradients (functional 18 / state 6 / scrim 2 / decorative 14).
PR #188 -> dev. 2712/0/2 tests.

## Test Scope Amendment (audit round 2)

The contract test uses file-level gradient counting, not per-declaration
PostCSS parsing. This is a deliberate scoping decision:

- File-level counts catch additions, removals, and file-level regressions
- Shimmer consumers are pinned by file list (4 files) and total count (6)
- Category totals are manifest constants that match measured CSS reality
- Per-declaration PostCSS manifest is deferred as future hardening

Settings render: live Playwright probe confirmed dark theme at 1280px
shows backgroundColor=rgb(11,11,15) (var(--bg)), backgroundImage=none.
Light theme and before/after comparison deferred to wp7 render proof
which already owns the full screenshot archive.
