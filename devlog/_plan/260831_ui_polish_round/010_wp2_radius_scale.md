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
| `ui/src/styles/responsive-layout.css:264` | `.compose-sheet__inflight` (`@media (max-width: 800px)` 안) | 10px | `var(--r-lg)` |
| `ui/src/styles/settings-controls.css:24` | `.settings-radio-option` | 10px | `var(--r-lg)` |
| `ui/src/styles/settings-controls.css:107` | `.provider-card` | 10px | `var(--r-lg)` |
| `ui/src/styles/sidebar.css:425` | `.billing-bar` | 10px | `var(--r-lg)` |
| `ui/src/styles/toast-modal.css:14` | `.toast` | 10px | `var(--r-lg)` |
| `ui/src/styles/toast-modal.css:70` | `.trash-undo-toast` | 10px | `var(--r-lg)` |
| `ui/src/styles/toast-modal.css:201` | `.modal` | 10px | `var(--r-lg)` |
| `ui/src/styles/node-polish.css:126` | `.session-current` | 10px (fallback 6px 모순) | `var(--r-lg)` |
| `ui/src/styles/node-polish.css:149` | `.session-btn` | 10px (같은 모순) | `var(--r-lg)` 10px — 형제 관계, 아래 참조 |
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

`.session-btn`은 `--r-md`(8px)가 아니라 `--r-lg`(10px)입니다(감사 wp2-F1).
`ui/src/components/SessionPicker.tsx:30`을 보면 `.session-current`와 `.session-btn`
두 개가 `.session-picker-row` 안의 **형제**이고 지금 셋 다 10px을 씁니다.
"버튼은 부모보다 한 단계 작게"는 중첩 관계에만 맞는 규칙이라 여기서는 틀렸습니다.
형제는 같은 반경을 씁니다.

8단계 스케일에서 위 32행의 이동을 다시 세면 **증가 1, 감소 8, 무변경 23**이고
값이 움직이는 행은 **9곳**입니다.
7단계안의 "증가 20"이 사라졌습니다. `--radius`(10px) 직접 참조 19곳이
`--r-lg`(10px)로 값 그대로 가기 때문입니다.

감소 8곳의 출처는 둘로 갈립니다. calc 오프셋 유래 7곳(5px -> 4px, 9px -> 8px),
정의 없는 토큰 1곳(`ui/src/styles/canvas-annotations.css:385`
`.canvas__drop-overlay` fallback 14px -> 12px). 최대 이동폭 2px입니다.
증가 1곳은 `ui/src/styles/controls.css:9` `.ctl-select__trigger`(7px -> 8px)로
calc 유래입니다. 즉 값이 움직이는 매핑 행은 **총 9곳**입니다.

그래도 wp7 렌더 증거에 `.modal`, `.toast`, `.gallery`, `.provider-card`의
before/after를 넣습니다. 무변경이 예상되므로, 차이가 보이면 그게 회귀 신호입니다.

### 정의 없는 토큰 참조 2곳

| 위치 | 셀렉터 | 현재 | 이후 |
|---|---|---|---|
| `ui/src/styles/canvas-annotations.css:385` | `.canvas__drop-overlay` | `var(--radius-lg, 14px)` → fallback 14px로 렌더 | `var(--r-xl)` 12px |
| `ui/src/styles/prompt-library-extras.css:376` | `.video-progress` | `var(--radius-md, 8px)` → fallback 8px | `var(--r-md)` 8px |

## 이 유닛에 함께 들어가는 릴리스 가드 (감사 wp2r4-F1)

radius와 무관해 보이지만 여기서 해야 합니다. 릴리스 프로베넌스 가드를 wp10에서
만들면 wp8이 무방비 워크플로를 먼저 호출할 수 있습니다. 통제는 보호 대상보다
먼저 존재해야 하므로 **첫 구현 사이클인 wp2에 넣습니다.**

- `scripts/release-cut.mjs`에 순수 함수 `assertUnitProvenance({ head,
  requiredCommits, contains })`를 추가하고 `preflight()`에서 `assertBaseline`
  다음에 호출합니다.
- **필수 유닛 이름은 코드에 둡니다.** JSON을 순회하는 방식은 파일이 `{}`이면
  `Object.entries({})`가 아무것도 검사하지 않아 problems `[]`로 **fail-open**
  됩니다(감사 wp2r5-F1). 그래서 코드에 `const REQUIRED_UNITS = ["wp9"]`를 두고
  JSON은 값만 제공합니다. 키가 없으면 그것도 problems입니다.

심볼릭 ref도 막아야 합니다(감사 wp2r6-F2). `{"wp9": "HEAD"}`나 `{"wp9": "dev"}`는
git이 정상 해석하므로 `contains(ref, head)`가 true를 돌려주고 가드가 통과합니다.
실측 확인: `git merge-base --is-ancestor HEAD HEAD`와
`git merge-base --is-ancestor dev HEAD` 둘 다 성공합니다. 그래서
`contains`를 부르기 **전에** 40자 16진수 object id인지 검사합니다.

```js
export const REQUIRED_UNITS = ["wp9"];
const FULL_OID = /^[0-9a-f]{40}$/i;

export function assertUnitProvenance({ head, requiredCommits, contains }) {
  const problems = [];
  const map = requiredCommits && typeof requiredCommits === "object" && !Array.isArray(requiredCommits)
    ? requiredCommits
    : null;
  if (!map) return [`.release/required-units.json must be a JSON object`];
  for (const label of REQUIRED_UNITS) {
    if (!Object.prototype.hasOwnProperty.call(map, label)) {
      problems.push(`required unit ${label} is missing from .release/required-units.json`);
      continue;
    }
    const sha = map[label];
    if (typeof sha !== "string" || !sha) {
      problems.push(`required unit ${label} has no recorded merge commit`);
    } else if (!FULL_OID.test(sha)) {
      problems.push(`required unit ${label} must be a full 40-hex commit id, got "${sha}"`);
    } else if (!contains(sha, head)) {
      problems.push(`HEAD does not contain ${label} (${sha})`);
    }
  }
  return problems;
}
```

- `.release/required-units.json`을 추가하고 `{"wp9": null}`로 시작합니다.
  `null`은 미머지를 뜻하고 가드는 **fail-closed**입니다.
- 릴리스 가드 단위 테스트는 이미 이 파이프라인을 소유한
  `tests/release-pipeline-contract.test.ts:417`에 붙입니다(감사 wp2r7-F3).
  radius 매니페스트 계약은 새 `tests/ui-radius-scale-contract.test.ts`에만 두어
  경계를 섞지 않습니다. 케이스: 포함된 40자 SHA면 problems `[]`, 미포함 SHA면 1건,
  `null`이면 1건, 키 누락이면 1건, `{}`이면 1건, `undefined`면 1건,
  `"HEAD"`/`"dev"` 같은 심볼릭 ref면 1건, 짧은 해시면 1건, `true`면 1건,
  배열이면 1건.

### wp8용 baseline-only 명령

`node scripts/release-cut.mjs preflight`에는 부분 모드가 없어서, `wp9`가 `null`인
동안 wp8이 그걸 부르면 (의도대로) 실패합니다(감사 wp2r5-F4). 그래서 wp2에서
**baseline 전용 서브커맨드**를 추가합니다:

```
node scripts/release-cut.mjs assert-baseline
```

`assertBaseline`만 실행하고 프로베넌스는 보지 않습니다. wp8은 이걸 씁니다.
등록 지점은 두 곳입니다: `scripts/release-cut.mjs:170`의 `COMMANDS` 맵과,
`scripts/release-cut.mjs:183`의 usage 문자열. usage를 같이 고치지 않으면 오타로
들어온 명령이 새 서브커맨드를 안내하지 못합니다.
`.github/workflows/release.yml:69`는 **전체 `preflight`에 그대로 묶어 둡니다** —
발행 경로는 가드를 반드시 통과해야 합니다.

상세 근거와 wp8/wp10 분담은 `devlog/_plan/260831_ui_polish_round/070_wp8_release.md`
에 있습니다.

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
통과합니다. 감사 wp2-F2가 실제 통과 경로를 셋 제시했습니다: 원시 5px을
`--r-pill`로 매핑, `ui/src/styles/agent-panels-composer.css:217`의 12px 축약을
`--r-xs`로 매핑, `--r-lg`를 12px로 정의. 셋 다 "유효한 스케일 토큰"이라 이름만
보는 검사를 통과합니다.

그래서 오라클을 **동결된 마이그레이션 매니페스트**로 둡니다. 이름 검사가 아니라
"이 선언은 정확히 이 토큰"을 봅니다.

### 토큰 정의: 값 + **정의 위치 유일성**

8개 토큰의 **값**을 단언합니다: `--r-xs` 4px, `--r-sm` 6px, `--r-md` 8px,
`--r-lg` 10px, `--r-xl` 12px, `--r-2xl` 16px, `--r-3xl` 20px, `--r-pill` 999px.
`--r-lg`를 12px로 바꾸면 실패해야 합니다.

값만 고정하면 **스코프 재정의로 우회**됩니다(감사 wp2r3-F1). 예를 들어
`.modal { --r-lg: 999px; }`를 추가하면 476행 매니페스트도, `:root`의 정의도
그대로라 전부 통과하는데 실제 렌더는 틀립니다. 지금 저장소에 바로 그 패턴이
있습니다: `ui/src/styles/agent-workspace.css:15`가 `.agent-workspace` 스코프에서
`--agent-r-lg`를 재정의합니다(wp2가 삭제 대상으로 잡은 것).

그래서 **정의 유일성**을 함께 단언합니다.

- 8개 스케일 토큰 각각은 `ui/src` 전체에서 정의가 **정확히 1개**여야 하고, 그
  위치는 `ui/src/index.css`의 표준 `:root` 블록이어야 합니다.
- 테마 블록(`:root[data-theme="light"]`)에도 radius 토큰을 두지 않습니다. radius는
  테마 종속이 아닙니다.
- 컴포넌트/유틸 셀렉터에서의 재정의는 실패입니다.
- `@property --r-lg { initial-value: ... }` 등록도 실패입니다. `@property`의
  `initial-value`는 `:root` 정의를 남겨둔 채 계산값을 바꿀 수 있습니다. 현재
  저장소에 `@property` 사용은 0건입니다(확인함).
- TS/TSX의 radius 관련 표현은 **동결 allowlist** 하나만 허용합니다. 전면 금지로
  적으면 올바른 구현조차 실패합니다 — `QuotaCard.tsx`가
  `borderRadius: "var(--r-sm)"`를 담아야 하기 때문입니다(감사 wp2r5-F2).
  반대로 "원시 px만 금지"로 풀면 `var(--r-pill)` 같은 잘못된 토큰이 통과합니다.
  그래서 값까지 포함한 정확 목록으로 고정합니다.

| 허용되는 유일한 항목 | 값 |
|---|---|
| `ui/src/components/settings/QuotaCard.tsx` `borderRadius` | `var(--r-sm)` 정확히 |

이 목록 밖의 `borderRadius`, `border*Radius`, `--r-*` 등장은 TS/TSX 어디에서든
실패입니다. `style.setProperty("--r-...")`도 포함합니다. 이 저장소는
`ui/src/components/node-canvas/ElementReferenceNode.tsx:27`에서 이미 커스텀
프로퍼티를 인라인으로 넘기는 패턴을 쓰므로 우회 경로가 실재합니다.

### border-radius 외의 경로도 막는다 (감사 wp2r4-F3)

매니페스트가 `border-radius` 선언만 보면 다음 두 경로로 렌더를 바꾸면서 통과합니다.

**CSS longhand.** `border-top-left-radius` 같은 물리/논리 longhand는 shorthand를
덮어씁니다. 현재 저장소에 longhand 사용은 **0건**(확인함)이므로, 매니페스트에
명시 등재되지 않은 longhand는 전부 실패로 둡니다. 대상 속성:
`border-top-left-radius`, `border-top-right-radius`,
`border-bottom-left-radius`, `border-bottom-right-radius`,
`border-start-start-radius`, `border-start-end-radius`,
`border-end-start-radius`, `border-end-end-radius`.

**벤더 프리픽스도 막습니다**(감사 wp2r5-F3). `-webkit-border-radius`와
`-moz-border-radius`는 표준 shorthand 뒤에 오면 계산값을 덮습니다
(`border-radius: 6px; -webkit-border-radius: 999px` -> 999px). 현재 저장소에
사용은 0건(확인함)이고, 프리픽스 shorthand/longhand 전부 실패로 둡니다.

**JSX 인라인 `borderRadius`.** 현재 **1건** 있습니다:
`ui/src/components/settings/QuotaCard.tsx:138`이
`borderRadius: "6px"`를 인라인으로 넘깁니다. 이 유닛에서 `var(--r-sm)`으로
바꾸고, 이후 TS/TSX에 원시 px `borderRadius`가 나타나면 실패하게 합니다.

| 위치 | 현재 | 이후 |
|---|---|---|
| `ui/src/components/settings/QuotaCard.tsx:138` | `borderRadius: "6px"` | `borderRadius: "var(--r-sm)"` |

### 마이그레이션 매니페스트 스키마

행 하나가 선언 하나를 유일하게 지목해야 합니다(감사 wp2-F3). 셀렉터만으로는
미디어쿼리 안팎이 구분되지 않습니다.

```ts
type RadiusRow = {
  file: string;          // 저장소 루트 기준 경로
  atRule: string | null; // "media (max-width: 800px)" 또는 null
  selector: string;      // 정규화된 셀렉터 문자열
  expected: string;      // "var(--r-lg)" 또는 "var(--r-sm) 0 0 var(--r-sm)"
  important: boolean;    // PostCSS decl.important. value와 별도로 저장되므로 필수
};
```

`important`가 별도 필드인 이유(감사 wp2r2-F2): PostCSS는 `7px !important`를
`decl.value = "7px"`과 `decl.important = true`로 나눠 담습니다. 따라서
`expected` 문자열만 비교하면 `!important`를 **지워도 통과**합니다. 실제로 통과하는
잘못된 구현이므로 필드로 올려 정확히 단언합니다.

### 분할이 476을 정확히 덮는지 (감사 wp2r2-F1)

앞선 판은 "395 + 12 + 1(important) + 32(토큰 참조)"로 적었는데 두 곳이 틀렸습니다.
`!important` 선언(`ui/src/styles/assets-workspace.css:11` = `7px`)은 **이미 395개
원시 안에 들어 있어** 중복 계산이었고, 토큰 참조는 32개가 아니라 **43개**입니다
(`--radius` 계열 32 + `--agent-r-*` 11). 32로 두면 agent 11행이 미등재가 되어
올바른 구현이 실패합니다.

PostCSS로 실측한 정확한 분할:

| 묶음 | 개수 |
|---|---|
| 원시 단일 px (`!important` 1개 포함) | 395 |
| shorthand | 12 |
| 토큰 참조 (`--radius` 32 + `--agent-r-*` 11) | 43 |
| 퍼센트(`50%` 등) | 19 |
| `0` | 4 |
| `inherit` | 3 |
| **합** | **476** |

매니페스트는 이 476행을 전수 담습니다. `!important`는 별도 행이 아니라 해당 원시
행의 `important: true` 메타데이터입니다.

원시 395행의 `expected`는 원래 값에서 가장 가까운 스케일 단계로 결정되며, 표는
구현 전에 생성 스크립트로 만들어 동결 커밋합니다(수작업 395행 금지).
퍼센트/`0`/`inherit` 26행은 `expected`를 원값 그대로 등재합니다.

### 검사 절차

PostCSS로 파싱해 각 `border-radius` 선언의 (file, atRule, selector)로 매니페스트를
조회하고, `value`가 `expected`와 **문자 단위로** 같고 `important` 플래그도 같은지
봅니다. 매니페스트에 없는 `border-radius` 선언이 있으면 실패(신규 선언이 검사를
우회하지 못하게). 반대로 매니페스트에 있는데 CSS에 없으면 실패.

- **동결 매니페스트 대조**: 위 스키마대로 전수 대조. 다른 스케일 토큰이면 실패.
- **토큰 정의 값 단언**: 8개 토큰의 px 값이 위와 정확히 일치하는지.
- 원시 px 단일값과 원시 px 축약이 하나도 남지 않았는지.
- `--radius`와 `calc(var(--radius)` 패턴이 CSS에 남아 있으면 실패.
- 스케일 토큰 8개가 `ui/src/index.css`에 정의돼 있는지 단언.
- `--agent-r-sm/md/lg`가 CSS에 남아 있지 않은지 단언(정의와 참조 모두).
- 정의 없는 radius 토큰 참조가 없는지 단언(`--radius-md` 재발 방지).
- 변형 증명 **22개 사례 / 19개 실패 모드**(감사 wp2r7-F1): 아래 22개를 각각 돌리되
  독립 불변식으로는 19종입니다 — 스코프 재정의와 theme-block 정의, 키 누락과
  `{}`, 심볼릭 ref와 짧은 해시는 같은 검사 분기의 다른 표본입니다.
  아무 radius를 `7px`로 되돌리면 실패, 매니페스트 행에 **다른**
  스케일 토큰을 붙이면 실패(원시 5px 자리에 `--r-pill`), 축약 한 행에 잘못된
  토큰을 붙이면 실패(`ui/src/styles/agent-panels-composer.css:217`에 `--r-xs`),
  `--r-lg` **정의를 12px로** 바꾸면 실패, 원시 축약 `12px 12px 0 0`을 되살리면
  실패, `--radius`를 별칭으로 재도입하면 실패,
  `ui/src/styles/assets-workspace.css:11`에서 **`!important`만 지우면** 실패,
  임의 셀렉터에 **스코프 재정의**(`.modal { --r-lg: 999px; }`)를 추가하면 실패,
  `:root[data-theme="light"]`에 radius 토큰을 추가하면 실패,
  `@property --r-lg`를 `initial-value: 999px`로 등록하면 실패,
  JSX에 `style={{ "--r-lg": "999px" }}`를 넣으면 실패,
  CSS에 `border-top-left-radius: 999px`를 넣으면 실패,
  TSX에 `borderRadius: "999px"`를 넣으면 실패,
  `ui/src/components/settings/QuotaCard.tsx`의 `var(--r-sm)`을 `var(--r-pill)`로
  바꾸면 실패(allowlist는 값까지 고정),
  CSS에 `-webkit-border-radius: 999px`를 추가하면 실패,
  `.release/required-units.json`에 미포함 SHA를 넣으면 preflight 실패,
  같은 파일에서 `wp9` 키를 지우면 실패,
  같은 파일을 `{}`로 만들면 실패,
  같은 파일에 `"wp9": "HEAD"`를 넣으면 실패,
  같은 파일에 짧은 해시를 넣으면 실패,
  같은 파일을 배열로 만들면 실패,
  `ui/src/index.css`에서 스케일 토큰 하나의 정의를 지우면 실패.

## 완료 조건

원시 px 단일값 0개, 정의 없는 radius 토큰 0개, `npm test` 무회귀, 그리고
데스크톱/모바일 렌더에서 카드와 모달의 모서리가 시각적으로 깨지지 않음.
