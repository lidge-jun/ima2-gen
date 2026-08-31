---
created: 2026-08-31
tags: [ima2-gen, devlog, ui, tokens, radius]
---

# 010 — wp2: radius 스케일 정합

> 감사 1라운드로 개정됨. 인벤토리 수치와 calc 처리 방침이 001_audit_round1.md 기준으로 바뀌었습니다.

## 목표

원시 px `border-radius` 395개를 근거 있는 스케일 토큰으로 바꾸고, 스케일 밖
값이 다시 들어오면 테스트가 깨지게 만듭니다.

## 결정: 스케일 8단계 (감사 4라운드 F2로 개정)

처음에 7단계로 잡고 10px을 `--r-lg: 12px`에 흡수시켰습니다. 그건 **원시 px
개수만 보고 내린 판단**이라 틀렸습니다. 10px의 실제 사용처를 다 세면:

| 경로 | 개수 |
|---|---|
| 원시 `10px` 선언 | 13 |
| `var(--radius)` 직접 참조 (정의값 10px) | 19 |
| `var(--agent-r-md, 10px)` 참조 (정의값 10px) | 4 |
| **10px 유효 사용처 합** | **36** |
| 원시 `12px` 선언 | 22 |

10px이 12px보다 많이 쓰입니다. 재디자인이 아니라 정합이 목표이므로 10px을 독립
단계로 남깁니다.

```css
--r-xs: 4px;     /* 2px(9) 3px(4) 4px(15) 5px(13) */
--r-sm: 6px;     /* 6px(79) 7px(43) */
--r-md: 8px;     /* 8px(94) 9px(18) */
--r-lg: 10px;    /* 10px(13) 11px(2) + --radius 19 + --agent-r-md 4 */
--r-xl: 12px;    /* 12px(22) 13px(3) 14px(7) */
--r-2xl: 16px;   /* 16px(3) 18px(1) */
--r-3xl: 20px;   /* 20px(1) 22px(1) */
--r-pill: 999px; /* 999px(67) */
```

18종 395개가 8단계로 들어갑니다. 흡수 이동폭은 최대 2px이고, 스케일 값과 정확히
일치하는 원시 선언 **294개는 이동이 0**입니다:
4px(15) + 6px(79) + 8px(94) + 10px(13) + 12px(22) + 16px(3) + 20px(1) + 999px(67).
나머지 101개(2/3/5/7/9/11/13/14/18/22px)만 1~2px 움직입니다.

`50%`(19개)는 원형이라 스케일이 아니고 그대로 둡니다. shorthand 12개와
`7px !important` 1개는 아래 처분 표대로 스케일 조합으로 바꿉니다.

F2가 지적한 후퇴 경로 문제도 이걸로 사라집니다. 7단계안의 후퇴 경로였던
"`--r-lg`를 12 -> 10으로 내리기"는 12/13px에서 온 사이트까지 같이 줄여버리는
위험한 수였습니다. 8단계에서는 각 원래 값이 자기 단계를 가지므로 공유 토큰을
나중에 흔들 필요가 없습니다.

## 결정: calc 패턴을 없앤다

`calc(var(--radius) - Npx)`가 11곳, 오프셋이 1/2/3/5px입니다.

| 오프셋 | 현재(--radius:10px) | --radius를 12px로 올리면 |
|---|---|---|
| -1px | 9px | 11px |
| -2px | 8px | 10px |
| -3px | 7px | 9px |
| -5px | 5px | 7px |

`--radius`를 12px로 올리면 11/10/9/7px이 나와서 wp2가 없애려는 off-scale 값이
그대로 되살아납니다. 그래서 `--radius`를 스케일에 맞추는 대신 **calc 패턴과
`--radius`를 함께 폐기**하고 11곳을 스케일 토큰 직접 참조로 바꿉니다.
중첩 반경은 부모 `--r-lg`(10px) / 자식 `--r-md`(8px)처럼 인접 단계로 표현합니다.

폐기 대상(실측 재확인): `--radius` 참조 **30곳**(직접 19 + calc 11), 그중
`var(--radius, 6px)` 3곳은 fallback이 정의값 10px과 모순.
`--radius-md`/`--radius-lg`는 정의가 없어 fallback으로만 렌더되는 2곳.
합쳐서 매핑 대상 **32행**. `--agent-r-sm/md/lg` 로컬 스케일 3개도 폐기.
앞선 초안의 "27곳"은 틀렸다.

`--chrome`은 죽은 토큰이 아닙니다. `ui/src/styles/sidebar.css:59`에 같은
그라디언트가 인라인 복제돼 있습니다. wp4가 인라인을 토큰 참조로 되돌립니다.
wp2에서 삭제하지 않습니다.
## shorthand 12개 + !important 1개 처분

전부 시트/패널의 한쪽 모서리만 둥글리는 경우라 스케일 조합으로 그대로 옮깁니다.

| 위치 | 현재 | 처분 |
|---|---|---|
| `ui/src/styles/agent-panels-composer.css:217` | `12px 12px 0 0` | `var(--r-xl) var(--r-xl) 0 0` |
| `ui/src/styles/agent-panels-composer.css:228` | `12px 12px 0 0` | `var(--r-xl) var(--r-xl) 0 0` |
| `ui/src/styles/agent-panels-composer.css:236` | `12px 12px 0 0` | `var(--r-xl) var(--r-xl) 0 0` |
| `ui/src/styles/agent-workspace.css:217` | `12px 12px 0 0` | `var(--r-xl) var(--r-xl) 0 0` |
| `ui/src/styles/canvas-annotations.css:141` | `6px 0 0 6px` | `var(--r-sm) 0 0 var(--r-sm)` |
| `ui/src/styles/canvas-annotations.css:147` | `0 6px 6px 0` | `0 var(--r-sm) var(--r-sm) 0` |
| `ui/src/styles/right-panel.css:33` | `6px 0 0 6px` | `var(--r-sm) 0 0 var(--r-sm)` |
| `ui/src/styles/gallery-modal.css:31` | `0 0 6px 6px` | `0 0 var(--r-sm) var(--r-sm)` |
| `ui/src/styles/inflight-tray.css:180` | `0 0 8px 8px` | `0 0 var(--r-md) var(--r-md)` |
| `ui/src/styles/element-mention.css:33` | `14px 14px 0 0` | `var(--r-xl) var(--r-xl) 0 0` (14->12) |
| `ui/src/styles/toast-modal.css:574` | `14px 14px 0 0` | 같음 |
| `ui/src/styles/responsive-layout.css:136` | `20px 20px 0 0` | `var(--r-3xl) var(--r-3xl) 0 0` |
| `ui/src/styles/assets-workspace.css:11` | `7px !important` | `var(--r-sm) !important` |

`!important` 하나는 왜 붙었는지 먼저 확인합니다. 특이성 싸움이면 `!important`를
없애고 셀렉터를 고치는 편이 맞지만, 그 판단은 이 유닛 범위가 아니라 값만
스케일로 옮기고 `!important`는 유지합니다.

## --radius 참조 32곳 셀렉터별 매핑

"인접 단계로 표현한다"는 서술만으로는 구현자가 값을 고를 수 없습니다. 실측한
32개 참조 전부를 셀렉터 단위로 확정합니다. 현재 `--radius: 10px`
(`ui/src/index.css:114`)이므로 계산값을 병기합니다.

### 직접 참조 19곳 → `--r-lg`(10px), 값 무변경

| 위치 | 셀렉터 | 현재 계산값 | 이후 |
|---|---|---|---|
| `ui/src/styles/canvas-viewer.css:308` | `.settings-action-btn` | 10px | `var(--r-lg)` |
| `ui/src/styles/form-controls.css:2` | `.prompt-area` | 10px | `var(--r-lg)` |
| `ui/src/styles/form-controls.css:267` | `.generate-btn` | 10px | `var(--r-lg)` |
| `ui/src/styles/form-controls.css:316` | `.generate-row__readiness` | 10px | `var(--r-lg)` |
| `ui/src/styles/gallery-modal.css:1` | `.composer__dropzone` | 10px | `var(--r-lg)` |
| `ui/src/styles/gallery-modal.css:104` | `.gallery` | 10px | `var(--r-lg)` |
| `ui/src/styles/inflight-tray.css:18` | `.inflight-badge` | 10px | `var(--r-lg)` |
| `ui/src/styles/node-polish.css:248` | `.error-card` | 10px | `var(--r-lg)` |
| `ui/src/styles/progress-composer.css:201` | `.composer` | 10px | `var(--r-lg)` |
| `ui/src/styles/responsive-layout.css:2` | `@media (max-width: 800px)` 내부 | 10px | `var(--r-lg)` |
| `ui/src/styles/settings-controls.css:24` | `.settings-radio-option` | 10px | `var(--r-lg)` |
| `ui/src/styles/settings-controls.css:107` | `.provider-card` | 10px | `var(--r-lg)` |
| `ui/src/styles/sidebar.css:425` | `.billing-bar` | 10px | `var(--r-lg)` |
| `ui/src/styles/toast-modal.css:14` | `.toast` | 10px | `var(--r-lg)` |
| `ui/src/styles/toast-modal.css:70` | `.trash-undo-toast` | 10px | `var(--r-lg)` |
| `ui/src/styles/toast-modal.css:201` | `.modal` | 10px | `var(--r-lg)` |
| `ui/src/styles/node-polish.css:126` | `.session-current` | 10px (fallback 6px 모순) | `var(--r-lg)` |
| `ui/src/styles/node-polish.css:149` | `.session-btn` | 10px (같은 모순) | `var(--r-md)` — 버튼은 부모보다 한 단계 작게 |
| `ui/src/styles/node-polish.css:162` | `.session-list` | 10px (같은 모순) | `var(--r-lg)` |

### calc 11곳 → 부모/자식 관계로 확정

| 위치 | 셀렉터 | 현재 계산값 | 이후 | 이유 |
|---|---|---|---|---|
| `ui/src/styles/controls.css:9` | `.ctl-select__trigger` | 7px | `var(--r-md)` 8px | 셀렉트 트리거 |
| `ui/src/styles/controls.css:53` | `.ctl-select__list` | 8px | `var(--r-md)` 8px | 트리거와 짝 |
| `ui/src/styles/controls.css:70` | `.ctl-select__item` | 5px | `var(--r-xs)` 4px | 리스트 자식 |
| `ui/src/styles/element-mention.css:1` | `.element-mention-menu` | 9px | `var(--r-md)` 8px | 메뉴 컨테이너 |
| `ui/src/styles/element-mention.css:14` | `.element-mention-menu__option` | 5px | `var(--r-xs)` 4px | 메뉴 자식 |
| `ui/src/styles/assetgen-workspace.css:69` | `.assetgen-tile__open-hint` | 5px | `var(--r-xs)` 4px | 타일 내부 |
| `ui/src/styles/assetgen-workspace.css:72` | `.assetgen-tile__retry` | 5px | `var(--r-xs)` 4px | 타일 내부 |
| `ui/src/styles/assetgen-workspace.css:73` | `.assetgen-tile__key` | 5px | `var(--r-xs)` 4px | 타일 내부 |
| `ui/src/styles/right-panel.css:611` | `.result-actions__menu` | 8px | `var(--r-md)` 8px | 무변경 |
| `ui/src/styles/sprite-recipe.css:1` | `.assetgen-workflow-tabs` | 8px | `var(--r-md)` 8px | 무변경 |
| `ui/src/styles/sprite-recipe.css:17` | `.assetgen-workflow-tabs button` | 5px | `var(--r-xs)` 4px | 탭 자식 |

8단계 스케일에서 위 32행의 이동을 다시 세면 **증가 1, 감소 9, 무변경 22**입니다.
7단계안의 "증가 20"이 사라졌습니다. `--radius`(10px) 직접 참조 19곳이
`--r-lg`(10px)로 값 그대로 가기 때문입니다.

감소 9곳의 출처는 셋으로 갈립니다. calc 오프셋 유래 7곳(5px -> 4px, 9px -> 8px),
직접 참조 1곳(`ui/src/styles/node-polish.css:149` `.session-btn` 10px -> 8px,
버튼은 부모보다 한 단계 작게), 정의 없는 토큰 1곳
(`ui/src/styles/canvas-annotations.css:385` `.canvas__drop-overlay`
fallback 14px -> 12px). 최대 이동폭 2px입니다.
증가 1곳은 `ui/src/styles/controls.css:9` `.ctl-select__trigger`(7px -> 8px)로
calc 유래입니다. 즉 값이 움직이는 매핑 행은 **총 10곳**입니다.

그래도 wp7 렌더 증거에 `.modal`, `.toast`, `.gallery`, `.provider-card`의
before/after를 넣습니다. 무변경이 예상되므로, 차이가 보이면 그게 회귀 신호입니다.

### 정의 없는 토큰 참조 2곳

| 위치 | 셀렉터 | 현재 | 이후 |
|---|---|---|---|
| `ui/src/styles/canvas-annotations.css:385` | `.canvas__drop-overlay` | `var(--radius-lg, 14px)` → fallback 14px로 렌더 | `var(--r-xl)` 12px |
| `ui/src/styles/prompt-library-extras.css:376` | `.video-progress` | `var(--radius-md, 8px)` → fallback 8px | `var(--r-md)` 8px |

## 적용 순서

1. `ui/src/index.css`에 스케일 토큰 **8개**(`--r-xs` `--r-sm` `--r-md` `--r-lg`
   `--r-xl` `--r-2xl` `--r-3xl` `--r-pill`) 추가.
2. 위 매핑 표대로 `--radius` 참조 32곳을 치환하고, `ui/src/index.css:114`의
   `--radius` 정의를 삭제합니다. 별칭으로 남기지 않습니다 — 남기면 다음 사람이
   다시 `calc(var(--radius) - Npx)`를 씁니다.
3. agent 로컬 스케일을 새 토큰으로 치환합니다. 정의 3줄과 소비 참조 11곳을
   전부 바꿉니다(정의 줄은 참조가 아니므로 개수에서 뺍니다).

| 위치 | 현재 | 이후 |
|---|---|---|
| `ui/src/styles/agent-workspace.css:15` | `--agent-r-lg: 12px` 정의 | 삭제(소비처 0) |
| `ui/src/styles/agent-workspace.css:16` | `--agent-r-md: 10px` 정의 | 삭제 |
| `ui/src/styles/agent-workspace.css:17` | `--agent-r-sm: 8px` 정의 | 삭제 |
| `ui/src/styles/agent-stage.css:76` | `var(--agent-r-md, 10px)` | `var(--r-lg)` 10px |
| `ui/src/styles/agent-panels-composer.css:61` | 같음 | `var(--r-lg)` 10px |
| `ui/src/styles/agent-workspace-panels.css:172` | 같음 | `var(--r-lg)` 10px |
| `ui/src/styles/agent-workspace.css:497` | 같음 | `var(--r-lg)` 10px |
| `ui/src/styles/agent-panels-composer.css:132` | `var(--agent-r-sm, 8px)` | `var(--r-md)` 8px |
| `ui/src/styles/agent-panels-composer.css:147` | 같음 | `var(--r-md)` 8px |
| `ui/src/styles/agent-stage.css:90` | 같음 | `var(--r-md)` 8px |
| `ui/src/styles/agent-stage.css:173` | 같음 | `var(--r-md)` 8px |
| `ui/src/styles/agent-workspace-panels.css:369` | 같음 | `var(--r-md)` 8px |
| `ui/src/styles/agent-workspace-sidebar.css:104` | 같음 | `var(--r-md)` 8px |
| `ui/src/styles/agent-workspace.css:467` | 같음 | `var(--r-md)` 8px |

11곳 전부 값이 그대로입니다(10px -> `--r-lg` 10px, 8px -> `--r-md` 8px).
8단계 스케일을 택한 덕분에 agent 스케일 이전이 시각 변화 0입니다. 7단계안이었다면
`--agent-r-md` 4곳이 10px -> 12px로 커졌습니다.

`--agent-r-lg`는 정의만 있고 `border-radius` 소비처가 없어 삭제 대상입니다.
다만 값 12px이 여러 곳에 원시 px로 인라인돼 있으므로(`--r-xl`로 흡수됨) "죽은
토큰"이라는 표현보다 "우회당한 토큰"이 정확합니다. 어느 쪽이든 wp2에서 정의를
지우고 원시 px는 `--r-xl`로 갑니다.
4. 파일별로 원시 px 395개 치환. `border-radius`가 있는 파일만 대상입니다.
5. 죽은 토큰 **2개**만 삭제(`--agent-r-lg`, `--tint-03`).
   `--chrome`은 삭제하지 않습니다 — 위 결정 절 참조.

## 테스트: tests/ui-radius-scale-contract.test.ts

테스트가 "스케일 토큰이면 통과"로만 짜이면 잘못된 토큰을 잘못된 셀렉터에 붙여도
통과합니다(감사 F2). 그래서 오라클을 두 층으로 둡니다.

- **셀렉터 매니페스트**: 위 32행 표를 상수 배열로 테스트 파일에 넣고, 각
  셀렉터가 **지정된 그 토큰**을 쓰는지 단언합니다. 다른 스케일 토큰이면 실패.
- CSS 전체를 파싱해 `border-radius` 값이 스케일 토큰, `50%`, `0`,
  `inherit`, 또는 스케일 토큰만으로 된 다중값 축약인지 단언합니다.
  **원시 px 축약(`12px 12px 0 0`)도 실패**입니다 — 축약 12개는 위 처분 표대로
  토큰 조합으로 바뀌어야 합니다.
- `--radius`와 `calc(var(--radius)` 패턴이 CSS에 남아 있으면 실패.
- 스케일 토큰 8개가 `ui/src/index.css`에 정의돼 있는지 단언.
- `--agent-r-sm/md/lg`가 CSS에 남아 있지 않은지 단언(정의와 참조 모두).
- 정의 없는 radius 토큰 참조가 없는지 단언(`--radius-md` 재발 방지).
- 변형 증명 4개: 아무 radius를 `7px`로 되돌리면 실패, 매니페스트 셀렉터에
  **다른** 스케일 토큰을 붙이면 실패, 원시 축약 `12px 12px 0 0`을 되살리면 실패,
  `--radius`를 별칭으로 재도입하면 실패.

## 완료 조건

원시 px 단일값 0개, 정의 없는 radius 토큰 0개, `npm test` 무회귀, 그리고
데스크톱/모바일 렌더에서 카드와 모달의 모서리가 시각적으로 깨지지 않음.
