---
created: 2026-08-31
tags: [ima2-gen, devlog, ui, color, tokens]
---

# 030 — wp4: 정의되지 않은 토큰과 하드코딩 색

> 감사 2라운드 반영본. 이 문서가 실행 지시서입니다.

## 목표

렌더링을 실제로 깨뜨리는 토큰 4개를 먼저 고치고, 어휘가 갈라진 15개를 통합하고,
최악 4개 파일의 하드코딩 hex를 토큰으로 올립니다.

## 우선순위 1: 도달 가능한 미정의 참조 4개 (렌더링 버그)

| 토큰 | 위치 | 매핑 | 이유 |
|---|---|---|---|
| `--bg-primary` | `ui/src/styles/sprite-recipe.css:70` | `--surface` | 모달 표면 |
| `--bg-raised` | `ui/src/styles/prompt-library-core.css:130` | `--surface-2` | 올라온 표면 |
| `--danger` | `ui/src/styles/agent-panels-composer.css:38`, `ui/src/styles/agent-panels-composer.css:39` | `--red` | 에러 상태 |
| `--shadow` | `ui/src/styles/agent-workspace-panels.css:93` | `--shadow-soft` | 기본 그림자 |

`ui/src/styles/home-workspace.css:279`는 `var(--text, var(--text-primary))`로
`--text`가 정의돼 있어 내부 fallback이 평가되지 않습니다. 도달 불가라 렌더링
결함이 아니지만, 죽은 중첩이라 `var(--text)`로 정리합니다.

브라우저 확인(합성 재현):

```
modal_background_color = rgba(0, 0, 0, 0)    <- .sprite-anchor-dialog 투명
spinner_ERR_border_top = rgb(0, 0, 0)        <- 에러 스피너가 검정
card_box_shadow        = none
```

이건 저장소와 같은 조건을 재현한 합성 페이지입니다. wp7이 실제 앱에서 같은
값을 다시 확인합니다.

## 우선순위 2: 통합은 리네임이 아니라 색 이동

같은 의미 토큰이 위치마다 다른 하드코딩 fallback을 들고 있어서, **지금 화면에서
이미 색이 다릅니다.** 독립 측정(PostCSS + 균형 `var()` 스캐너)으로 갈라진
계열을 전수 확인했고, 앞선 초안보다 폭이 넓습니다.

**테마 방향을 먼저 못 박습니다(감사 4라운드 F4).** 이 저장소는
`:root`가 **다크**이고 `:root[data-theme="light"]`가 **라이트**입니다
(`ui/src/index.css:61`이 `--bg: #0b0b0f`, `ui/src/index.css:142`가
`--bg: #f2f2f6`). 앞선 초안이 이걸 뒤집어 적었습니다. 아래 표기는 전부
**다크(`:root`) / 라이트(`[data-theme="light"]`)** 순서입니다.

**빨강 계열 8종.** 정식 `--red`는 다크 `#ef4444`(`ui/src/index.css:112`),
라이트 `#cc3340`(`ui/src/index.css:192`).

| 리터럴 | 위치 |
|---|---|
| `#e53935` | `ui/src/components/settings/QuotaCard.tsx:33`, `ui/src/components/settings/QuotaCard.tsx:188` |
| `#ff6262` | `ui/src/styles/assetgen-workspace.css:107`, `ui/src/styles/assets-workspace.css:20`, `ui/src/styles/assets-workspace.css:21`, `ui/src/styles/element-detail.css:6`, `ui/src/styles/element-detail.css:7` |
| `#e05555` | `ui/src/styles/right-panel.css:172`, `ui/src/styles/right-panel.css:201`, `ui/src/styles/right-panel.css:207` |
| `#ff6b6b` | `ui/src/styles/assets-workspace.css:124` |
| `#ff9c9c` | `ui/src/styles/sprite-curator.css:31` |
| `#fecaca` | `ui/src/styles/canvas-annotations.css:66` |

**노랑 계열 3종.** 정식 `--amber`는 다크 `#f59e0b` / 라이트 `#a96a06`.
`#d9a12e`가 `ui/src/styles/progress-composer.css:338`,
`ui/src/styles/provider-controls.css:39`, `ui/src/styles/provider-controls.css:87`,
`ui/src/styles/provider-controls.css:88`에 있고, `#d08c3a`가
`ui/src/styles/settings-controls.css:286`에 있습니다.

**초록 2종.** `--green` 다크 `#22c55e` / 라이트 `#178a43` 대비
`#4caf50`가 `ui/src/styles/right-panel.css:169`.

**파랑 2종.** `--blue` 다크 `#4a9eff` / 라이트 `#1d6fd1` 대비
`#3b82f6`가 `ui/src/components/settings/QuotaCard.tsx:35`.

리네임이 아니라 색 변경입니다. 라이트/다크 양쪽 before/after를 기록하고 렌더로
확인합니다. `--red`가 라이트와 다크에서 값이 다르므로, 하드코딩 리터럴을 토큰으로
올리면 다크 테마에서 이동폭이 더 큽니다 — 다크 캡처를 반드시 남깁니다.

| 별칭 | 정식 | 값 이동 |
|---|---|---|
| `--danger`, `--error` | `--red` | `#ff6262`/`#e05555`/`#e53935` -> `#ef4444` |
| `--warn`, `--warning` | `--amber` | `#d08c3a` -> `#f59e0b` |
| `--success` | `--green` | `#4caf50` -> `#22c55e` |
| `--info` | `--blue` | `#3b82f6` -> `#4a9eff` |
| `--text-primary` | `--text` | 동일 |
| `--text-secondary` | `--text-muted` | 확인 필요 |
| `--bg-raised`, `--surface-raised` | `--surface-2` | 확인 필요 |
| `--surface-hover`, `--control-bg-hover` | `--control-hover` | 확인 필요 |
| `--surface-4` | `--surface-3` | 확인 필요 |
| `--font-ui` | `--font` | 동일 |
| `--font-mono` | `--mono` | 동일 |

`--agent-rail-ring`은 단일 매핑을 하지 않습니다. `#f5f5f7` 불투명 링인데
`--focus-ring`은 반투명 시안이라, 그대로 보내면 선택 상태가 포커스처럼
보입니다. 참조는 **5곳**이고(앞선 초안은 3곳만 적었습니다) 용도로 갈라 매핑합니다.

| 위치 | 속성 | 용도 | 매핑 |
|---|---|---|---|
| `ui/src/styles/agent-stage.css:80` | `border-color` | 선택 | `--accent` |
| `ui/src/styles/agent-stage.css:81` | `box-shadow inset` | 선택 | `--accent` |
| `ui/src/styles/agent-stage.css:103` | `outline` | 포커스 | `--focus-ring` |
| `ui/src/styles/agent-workspace.css:501` | `border-color` | 선택 | `--accent` |
| `ui/src/styles/agent-workspace.css:502` | `box-shadow inset` | 선택 | `--accent` |

다섯 곳을 다 옮기지 않으면 `--agent-rail-ring`이 남아 미정의 토큰 게이트가
실패합니다.

## wp5가 요구하는 종이 토큰 (소유: wp4)

wp5가 `ui/src/styles/viewer-workflow.css:13`의 하드코딩 흰색을 치환하려면 토큰이
먼저 있어야 합니다. 이름과 값을 여기서 확정합니다.

셀렉터를 명시합니다. 위 F4와 같은 실수를 구현에서 반복하지 않도록, 다크가
`:root`라는 점을 값과 함께 씁니다.

```css
/* 다크 (기본) */
:root {
  --paper: #14161b;
  --paper-edge: #1b1e25;
}
/* 라이트 */
:root[data-theme="light"] {
  --paper: #ffffff;
  --paper-edge: #f8fafc;
}
```

라이트 값은 현재 하드코딩 값과 같아서 라이트 렌더가 바뀌지 않습니다.

다크 값에 대한 정직한 서술: 이건 **접근성 수정이 아니라 시각 디자인 변경**입니다
(감사 F5). `.canvas__blank-sheet`는
`ui/src/components/Canvas.tsx:336`에서 `aria-hidden`인 빈 상태 "종이" 그림이고,
`.canvas__blank-copy`는 `ui/src/components/Canvas.tsx:337`에서 그 종이의
**형제**로 아래에 놓입니다. 종이 위에 얹힌 텍스트가 아니므로 텍스트 대비로
`--paper`를 검증할 수 없습니다. 앞선 초안의 "종이 위 텍스트 대비" 근거는
철회합니다.

그러면 다크에서 흰 종이를 어둡게 바꿀 근거는 무엇인가. 근거는 하나뿐입니다:
다크 테마에서 화면 중앙에 순백 사각형이 뜨면 눈에 튄다는 것. 이건 취향 판단이므로
**측정으로 통과시키지 않고 라이트/다크 스크린샷 승인으로 처리**합니다.

승인이 안 나면 어떻게 하는가(감사 5라운드 F8). "라이트 값만 토큰화"는 실행 불가
입니다 — wp5가 다크에서도 `var(--paper)`를 참조하므로 `:root`에 정의가 없으면
미정의 토큰이 되어 wp4의 완료 조건 자체를 깨뜨립니다. 후퇴 경로는 이렇게 정합니다:

```css
/* 승인 실패 시: 테마 불변 흰 종이 */
:root {
  --paper: #ffffff;
  --paper-edge: #f8fafc;
}
```

`:root`에 흰색을 두고 라이트 재정의를 두지 않습니다. 렌더는 지금과 완전히 동일하고
(다크에서도 흰 종이 유지), 하드코딩 제거라는 목적만 달성합니다. 즉 승인 여부와
무관하게 `--paper`는 항상 `:root`에 정의됩니다. 승인이 나면 다크 값을
`:root`에, 흰색을 `[data-theme="light"]`에 둡니다.

`ui/src/components/settings/QuotaCard.tsx`가 `--error`/`--warning`/
`--info`/`--success`를 쓰므로 TSX도 같이 바꿉니다(`--warn`은 CSS 쪽
`ui/src/styles/settings-controls.css:286`에만 있습니다).

`ui/src/styles/settings-controls.css:286`의 `var(--warn, #d08c3a)`는 폼
**유효성 실패** 표시입니다. 이름은 warn이지만 의미는 오류에 가깝습니다. 값만
`--amber`로 옮기면 "경고색으로 표시된 오류"가 되므로, 옮기기 전에 해당 컨트롤이
어떤 상태를 나타내는지 확인하고 필요하면 `--red`로 보냅니다.

## 우선순위 3: 하드코딩 hex

독립 측정 결과 `ui/src/styles` 전체에 토큰 정의 밖 리터럴 색이 **167개, 27개
파일**입니다(`var()`를 품은 `rgb()/rgba()`는 제외). 앞선 초안의 파일별
숫자는 틀렸습니다. 실제 상위:

| 파일 | 개수 |
|---|---|
| `ui/src/styles/canvas-annotations.css` | 34 |
| `ui/src/styles/sprite-curator.css` | 22 |
| `ui/src/styles/canvas-background-cleanup.css` | 15 |
| `ui/src/styles/right-panel.css` | 15 |
| `ui/src/styles/progress-composer.css` | 11 |
| `ui/src/styles/assetgen-workspace.css` | 10 |
| `ui/src/styles/sidebar.css` | 9 |

167개 전부를 이 사이클에서 토큰화하지 않습니다. 그건 wp4 하나에 담기지 않는
분량이고, 캔버스 도구 색(`canvas-annotations.css` 34개)은 주석 도구의 팔레트라
테마 토큰과 성격이 다릅니다. 이 사이클 범위는 **상태색 계열만**입니다: 위
우선순위 2 표에 오른 빨강/노랑/초록/파랑 리터럴 전부와,
`ui/src/styles/sidebar.css:59`의 `--chrome` 인라인 복제.
나머지(캔버스 팔레트, 스프라이트 큐레이터 다크 표면 등)는 개수를 기록만 하고
후속 유닛으로 넘깁니다. 범위를 넘겨 잡으면 사이클이 끝나지 않습니다.

`ui/src/styles/sidebar.css:59`는 `--chrome` 토큰의 그라디언트를 그대로
인라인 복제한 경우입니다. 토큰 참조로 되돌립니다 — `--chrome`은 죽은 토큰이
아니라 우회당한 토큰입니다.

각 hex가 기존 토큰과 같은 값이면 토큰으로 바꾸고, 다르면 왜 다른지 확인한 뒤
가장 가까운 토큰에 맞춥니다. 색을 새로 만들지 않습니다.

## 테스트: tests/ui-color-token-contract.test.ts

- 정의되지 않은 커스텀 프로퍼티 참조가 0개인지 단언. 런타임 주입 5개
  (`--element-thumb`, `--folder-depth`, `--inflight-caret-top`,
  `--node-preview-h`, `--node-preview-w`)는 명시 허용 목록.
- fallback 유무를 구분해서, 도달 가능한 미정의 참조를 따로 보고.
- **상태색 리터럴**(위 우선순위 2 표의 빨강 6/노랑 2/초록 1/파랑 1 위치)이
  0개인지 단언. 파일 단위 "hex 0개"가 아니라 목록 단위입니다 — 캔버스 팔레트를
  이 사이클에서 건드리지 않기 때문입니다.
- `ui/src/styles/sidebar.css:59`가 `var(--chrome)`을 참조하는지 단언.
- 남은 하드코딩 색 총계를 스냅샷으로 기록하고, 그 수가 **늘면** 실패하게 합니다
  (감소는 허용). 후속 유닛이 줄여갈 여지를 남기면서 역행만 막습니다.
- 삭제한 별칭 이름이 다시 나타나지 않는지 단언.
- 변형 증명: `--danger` 참조를 되살려 실패 확인, fallback 있는 미정의 참조를
  넣어 그것도 잡히는지 확인.

## 완료 조건

도달 가능한 미정의 토큰 0개, 상태색 리터럴 0개, 하드코딩 색 총계가 167 이하,
`.sprite-anchor-dialog`가 실제 앱 브라우저에서 불투명 배경으로 렌더되고 에러
스피너가 빨강으로 나오는 것을 computed style로 확인, 라이트/다크 양쪽 캡처.

## Implementation Log (B-phase)

All changes landed in two commits on codex/ui-polish-wp4-color-tokens:

- 506cb027: fix(ui): 20 files, 4 undefined refs, state colors, paper tokens
- c88336d2: test(ui): 6-assertion contract test

Verified: npm test 2707/0/2, typecheck clean, UI build OK.
PR #187 -> dev.
