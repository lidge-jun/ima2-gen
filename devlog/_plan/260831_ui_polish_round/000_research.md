---
created: 2026-08-31
tags: [ima2-gen, devlog, ui, design-system, tokens]
---

# 000 — UI 폴리싱 라운드: 토큰 시스템 실측

> **경고: 이 문서의 수치 일부는 폐기됐습니다.** 첫 실측이고, 이후 감사 3라운드와
> 독립 측정 에이전트 2명이 여러 수치를 반박했습니다. 실행 근거는 각 사이클 문서
> (005/010/020/030/040/050)이고, 충돌하면 **그쪽이 이깁니다.** 이 문서는 최초
> 탐색 기록으로만 남깁니다.
>
> | 이 문서의 서술 | 확정된 값 |
> |---|---|
> | 렌더링을 깨뜨리는 미정의 토큰 5개 | **4개** (`--text-primary`는 중첩 fallback으로 도달 불가) |
> | 원시 px border-radius 387개 | **395개** (전체 선언 476개, 18종) |
> | `--radius` 27회 사용 | **30곳** 참조(직접 19 + calc 11), 매핑 대상 32행 |
> | 죽은 토큰 3개(`--chrome` 포함) | **2개** (`--agent-r-lg`, `--tint-03`). `--chrome`은 `ui/src/styles/sidebar.css:59`에 인라인 복제된 것 |
> | 뷰포트 단위 font-size 5곳 | **7곳** (`font` 축약 2개 포함) |
> | 그라디언트 46개 | **49개** (linear 36 / radial 7 / conic 6) |
> | 하드코딩 hex 120개 | **167개, 27개 파일** |
> | 44px 미만 인터랙티브 17개 | 총계는 필터 의존적이라 오라클로 쓰지 않음. PostCSS 기준 **117개** 후보 중 아이콘 전용 위반 **18개** + 정책 예외 1개 |
> | radius 스케일 7단계 | **8단계**(10px을 독립 단계로 유지). 스케일 일치 원시 선언 294개는 이동 0 |
> | 모달 포커스 훅 없는 것 9개 | 포커스 관리 **전무 5개** + 부분 구현 **5개** (전체 대화상자 28개) |

## 왜 이 유닛이 있나

UI는 성숙했지만 토큰 시스템이 한 번도 정리된 적이 없습니다. `DESIGN.md`가
없고, CSS 14,807줄이 51개 파일에 흩어져 있고, 커스텀 프로퍼티 84개가 정의돼
있는데 참조는 106개입니다. 그 차이가 이 유닛의 출발점입니다.

## 측정 방법

zsh glob이 토큰 스캔을 망쳐서(모든 토큰이 DEAD로 나옴) Node로 다시 셌습니다.
`var(--name)` 뒤에 `,` 또는 `)`만 오는 정확 일치로 매칭하고, TSX에서
`setProperty`로 런타임에 넣는 토큰은 따로 분류했습니다. 접두어 일치로 세면
`--shadow`가 44회로 나오는데, 실제로는 `--shadow-soft`/`--shadow-strong`이
43개고 `--shadow` 자체는 1개입니다.

## 실측 1: 정의되지 않은 토큰 20개

런타임 주입 5개(`--element-thumb`, `--folder-depth`,
`--inflight-caret-top`, `--node-preview-h`, `--node-preview-w`)는 버그가
아니라 설계입니다. 제외하고 20개가 남고, 그중 **fallback 없이 참조되는 5개가
실제 렌더링을 깨뜨립니다.**

| 토큰 | 참조 | bare | 위치 |
|---|---|---|---|
| `--bg-primary` | 1 | 1 | `ui/src/styles/sprite-recipe.css:70` |
| `--bg-raised` | 1 | 1 | `ui/src/styles/prompt-library-core.css:130` |
| `--danger` | 9 | 2 | `ui/src/styles/agent-panels-composer.css:38`, `ui/src/styles/agent-panels-composer.css:39` |
| `--shadow` | 1 | 1 | `ui/src/styles/agent-workspace-panels.css:93` |
| `--text-primary` | 1 | 1 | `ui/src/styles/home-workspace.css:279` |

나머지 15개는 항상 fallback을 들고 있어서 화면은 맞게 나옵니다. 어휘 부채이지
렌더링 버그는 아닙니다: `--danger`/`--error`, `--warn`/`--warning`,
`--text-primary` vs `--text`, `--surface-raised` vs `--surface-2`처럼
같은 뜻의 이름이 두 갈래로 갈라져 있습니다.

## 실측 2: 브라우저로 확인한 렌더링 결과

읽어서 추론하지 않고 Chrome에서 computed style을 뽑았습니다. 저장소와 동일하게
`--bg-primary`, `--danger`, `--shadow`만 정의하지 않은 페이지입니다.

```
modal_background_color   = rgba(0, 0, 0, 0)      <- 완전 투명
spinner_OK_border_top    = rgb(68, 170, 153)     <- 정상(--accent 정의됨)
spinner_ERR_border_top   = rgb(0, 0, 0)          <- 빨강이어야 하는데 검정
spinner_ERR_border_left  = rgb(0, 0, 0)
card_box_shadow          = none
```

`.sprite-anchor-dialog`는 `SpriteAnchorGate.tsx`가 실제로 렌더하는
`role="dialog" aria-modal="true"` 확인 모달입니다. `position: fixed`로
화면 중앙에 떠 있는데 배경이 투명해서 뒤 내용이 그대로 비칩니다. 스프라이트
앵커 승인은 되돌리기 어려운 동작이라, 확인 모달이 안 읽히는 건 UX 결함입니다.

에러 스피너는 정상 스피너와 색이 구분돼야 하는데 검정으로 떨어집니다. 정상
경로는 `--accent`가 정의돼 있어 제대로 나오니, 에러 상태만 조용히 열화됩니다.

## 실측 3: radius 스케일

`--radius: 10px`가 정의돼 있는데 27회만 쓰이고, 원시 px 선언이 387개입니다.

```
94  8px        19  50%        7  var(--agent-r-sm, 8px)
79  6px        18  9px        7  14px
67  999px      16  var(--radius)   6  calc(var(--radius) - 5px)
42  7px        15  4px        4  var(--agent-r-md, 10px)
22  12px       13  5px        4  3px
               13  10px       3  16px / 3  13px / 2  11px
                9  2px
```

7px 42개, 9px 18개, 5px 13개, 3px 4개, 13px 3개, 11px 2개는 스케일 근거가
없습니다. 두 개의 진짜 버그도 여기서 나왔습니다.

- `var(--radius, 6px)` — `ui/src/styles/node-polish.css:134`, `ui/src/styles/node-polish.css:153`, `ui/src/styles/node-polish.css:168`. `--radius`는
  10px인데 fallback이 6px입니다. 둘 중 하나가 의도가 아닙니다.
- `--radius-md`, `--radius-lg` — `ui/src/styles/prompt-library-extras.css:381`,
  `ui/src/styles/canvas-annotations.css:394`에서 참조하는데 **어디에도 정의가 없습니다.**
  fallback 8px/14px으로 조용히 떨어집니다.

죽은 토큰 3개: `--agent-r-lg`(12px, 정의만), `--chrome`, `--tint-03`.

스킬은 카드 radius를 8px 이하로 잡으라고 하지만, 여기는 이미 성숙한 제품이라
전면 변경이 아니라 스케일 정합을 목표로 합니다.

## 실측 4: 스킬 규칙 위반

- 음수 letter-spacing 8곳. `ui/src/styles/right-panel.css:300`이 `-2px`로 가장 큽니다.
  나머지는 `-0.01em`~`-0.04em`, `ui/src/styles/form-controls.css:279`가 `-0.3px`.
- 뷰포트 단위 font-size 5곳. `ui/src/styles/home-workspace.css:373`이
  `clamp(84px, 22vw, 150px)`, `ui/src/styles/home-workspace.css:398`이 `clamp(64px, 26vw, 104px)`.
- 토큰 정의 밖 하드코딩 hex 120개. sidebar 14, sprite-curator 13, themes 11,
  right-panel 11, progress-composer 11.
- 그라디언트 46개(linear 34, radial 6, conic 6). progress-composer와
  assetgen-workspace가 각각 6개.
- 44px 미만 인터랙티브 셀렉터 17개.

## 이미 통과하는 것 (일 만들지 말 것)

- 이모지 0개. UI 소스와 CSS 전체에서 이모지를 시각 요소로 쓰지 않습니다.
- `prefers-reduced-motion` 전역 리셋이 `ui/src/index.css:243`에 있고
  `[data-motion-essential]`만 예외로 둡니다. 파일별로 세면 37개 중 14개만
  덮인 것처럼 보이는데, 전역 리셋이 전부를 덮으므로 오탐입니다.

## Design Read

이 제품은 로컬 이미지 생성 스튜디오입니다. 대상은 자기 기계에서 반복 작업하는
크리에이터이고, 화면은 하루에 수십 번 같은 동작을 하는 작업대입니다. 랜딩이
아니라 도구입니다.

```
DESIGN_VARIANCE: 3
MOTION_INTENSITY: 2
Product density profile: D5
Reasoning: 반복 전문 작업 도구는 결정 수가 아니라 반복 동작 수를 줄여야 하고,
장식 변주는 스캔을 방해한다. 밀도는 높지만 시각 변주는 낮게 유지한다.
```

스킬의 dial preset 표에서 Dashboard/SaaS admin이 3/2/5입니다. 이 표면이 정확히
거기 해당합니다. Liquid Editorial 같은 표현형 기본 키트는 도메인 게이트에
걸려서 적용하지 않습니다 — 대시보드/운영 도구는 기본 키트를 받지 않습니다.

## 이 라운드가 하지 않는 것

레이아웃과 정보 구조는 건드리지 않습니다. 색 팔레트를 새로 만들지 않습니다.
컴포넌트를 재구성하지 않습니다. 이건 토큰 정합과 규칙 위반 수리이고, 재디자인이
아닙니다. 서버, lib, CLI, provider도 범위 밖입니다.
