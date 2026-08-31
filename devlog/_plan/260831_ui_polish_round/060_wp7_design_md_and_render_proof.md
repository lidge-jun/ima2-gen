---
created: 2026-08-31
tags: [ima2-gen, devlog, ui, design-system, verification]
---

# 060 — wp7: DESIGN.md와 렌더 증거

## DESIGN.md

앞선 사이클이 정한 토큰을 한 파일에 모읍니다. 이 저장소는 지금
`DESIGN.md`가 없어서, 다음 사람이 radius를 8px로 쓸지 7px로 쓸지 판단할
근거가 코드밖에 없습니다.

담을 내용: 색 토큰과 각각의 역할, 타이포(글꼴, 스케일, letter-spacing 0 규칙),
radius 스케일 **8단계**(`--r-xs` 4 / `--r-sm` 6 / `--r-md` 8 / `--r-lg` 10 /
`--r-xl` 12 / `--r-2xl` 16 / `--r-3xl` 20 / `--r-pill` 999)와 흡수 규칙,
아이콘 전략, 그라디언트 분류
매니페스트(functional/state/scrim/decorative), 탭 타깃 하한 두 개(24px AA 전체 /
44px 히트박스 아이콘 전용)와 면제 근거, 그리고 dial 설정.

```
DESIGN_VARIANCE: 3
MOTION_INTENSITY: 2
Product density profile: D5
```

D5는 스킬 표에서 "Korean consumer app, feature-rich mobile"과
"Dashboard/SaaS admin"(3/2/5) 사이입니다. 이 제품은 반복 전문 작업 도구라
후자에 맞춥니다. Liquid Editorial 같은 표현형 기본 키트는 도메인 게이트로
적용하지 않는다는 것도 명시합니다 — 다음 세션이 "모던하게"를 듣고 대시보드에
히어로를 넣지 않도록.

## 렌더 증거

소스를 읽어서 "잘 나올 것"이라고 쓰지 않습니다. 실제 브라우저에서 computed
style과 기하를 뽑습니다. agbrowse의 `screenshot`은 이 기계에서 멈춘 이력이
있으니, 페이지가 스스로 측정값을 DOM에 써넣고 `agbrowse text`로 읽는 방식을
씁니다. 이번 라운드의 토큰 버그도 그 방법으로 확인했습니다.

측정 항목은 앞선 사이클이 바꾼 것을 전부 덮어야 합니다(감사 3라운드 F14). 사이클별로
무엇을 어떤 뷰포트에서 어떻게 확인하는지 확정합니다.

**wp9 모달 포커스 / Escape 스택**

- `.sprite-anchor-dialog` `background-color`가 `rgba(0,0,0,0)`이 아닌지.
- `SpriteAnchorGate`에 backdrop 요소가 실제로 존재하고, 그 밖 좌표에
  `document.elementFromPoint`를 찍으면 backdrop이 반환되는지(밖 클릭 차단 증거).
- 중첩 모달 두 층을 열고 Escape 한 번 -> **상위 한 층만** 닫히는지.
- 각 모달을 열었을 때 `document.activeElement`가 모달 안에 있는지, 닫은 뒤
  트리거로 돌아오는지.
- Tab을 요소 수 + 2회 눌러 포커스가 모달 밖으로 나가지 않는지.

**wp2 radius**

- `.modal`, `.toast`, `.gallery`, `.provider-card`의 computed
  `border-radius`가 **10px 그대로**인지 확인. 8단계 스케일에서 이 네 셀렉터는
  `--radius`(10px) -> `--r-lg`(10px)로 값이 바뀌지 않습니다. 차이가 보이면
  그게 회귀 신호입니다.
- 값이 실제로 움직이는 **10곳**만 before/after를 기록합니다. 최대 이동 2px.
  감소 9곳 + 증가 1곳(`ui/src/styles/controls.css:9` `.ctl-select__trigger`
  7px -> 8px)입니다. 감소 9곳은 calc 유래 7곳에
  `ui/src/styles/node-polish.css:149`(`.session-btn` 10px -> 8px)과
  `ui/src/styles/canvas-annotations.css:385`(`.canvas__drop-overlay`
  fallback 14px -> 12px)이 더해진 것입니다.
- 중첩 반경(부모 `--r-lg` 10px / 자식 `--r-md` 8px)이 뒤집히지 않았는지.
- agent 스케일 이전 11곳(`--agent-r-md`->`--r-lg`, `--agent-r-sm`->`--r-md`)이
  전부 값 무변경인지.

**wp3 타이포**

- `.home-hero__mark`, `.home-hero__title`, `.home-workspace h2`,
  `.assets-tile__glyph` **네 셀렉터**의 computed `font-size`를
  (h2는 `.home-workspace__recent > h2`만 사다리 대상;
  `.home-modes__title`은 의도적 11px 별도 스타일.)
  **320/480/481/767/768/769/1024/1025/1279/1280/1920 열한 폭 전부**에서 기록하고,
  사다리 표와 일치하며 경계에서 감소하지 않는지 확인. h2는 앞선 판에서 빠져 있었고,
  1024/1025는 wp3가 mark 경계를 768에서 1024로 옮겨서 추가됐습니다.
- 사다리는 경계에서 뜁니다(mark 480->481 +25, 1024->1025 +25, 1279->1280 +26).
  각 경계 양쪽 캡처를 나란히 두고, 점프가 레이아웃을 밀어 다음 섹션을 첫 화면
  밖으로 내보내지 않는지 확인합니다.
- 같은 열한 폭에서 네 요소의 `scrollWidth`가 부모 `clientWidth`를 넘지 않는지.
  히어로 마크는 100~176px 단일 글자라 특히 481, 1025, 1280에서 확인이 필요합니다.
  **예외 (wp3c3에서 확정):** mark는 `overflow:hidden`이므로 scrollWidth > clientWidth는
  의도된 클리핑. glyph는 wp3에서 빈 스토어로 computed 미측정, wp7에서 에셋 fixture로
  최초 computed font-size 검증 수행.
  binary overflow 판정 자체는 wp3 C단계 게이트이고(`devlog/_plan/260831_ui_polish_round/020_wp3_typography.md:236`),
  여기서는 캡처 아카이브와 before/after 비교를 남깁니다.
- letter-spacing 0으로 바뀐 7곳에서 텍스트가 부모를 넘지 않는지.

**wp4 색 토큰**

- 에러 스피너 `border-top-color`가 정상 스피너와 다른 색인지.
- `.canvas__blank-sheet`가 `--paper`/`--paper-edge`를 참조하고, 두 토큰이
  `:root`에 정의돼 있는지(다크에서 미정의가 되지 않는지).
- 라이트/다크 스크린샷을 제출해 다크 종이 색 승인을 받습니다. 승인 실패 시
  테마 불변 흰색이 후퇴 경로이며, 그 경우 렌더는 현재와 동일해야 합니다.
  `.canvas__blank-copy` 텍스트 대비는 종이 위가 아니라 **페이지 배경 위**에서
  측정합니다(형제 관계).
- 상태색을 옮긴 위치들의 computed color를 라이트/다크 양쪽에서 기록.

**wp5 그라디언트**

- 알파 체커보드 셀렉터들이 여전히 `repeating-conic-gradient`/45도 패턴을 갖는지
  (computed `background-image`에 gradient 문자열 존재).
- 투명 PNG를 올린 상태에서 타일 배경에 격자가 보이는지.
- `.settings-workspace`의 before/after 캡처.
- shimmer 6곳의 computed `background-image`가 서로 동일한지.

**wp6 탭 타깃**

- C표 18개 각 컨트롤에 대해 **의도한 44x44 경계**를 프로브합니다(감사 4라운드 F8).
  요소 사각형 안쪽 2px만 찍으면 22px 버튼이 44px 의사요소 없이도 통과하므로
  의미가 없습니다. 절차:
  1. `getBoundingClientRect`로 시각 박스 중심 `(cx, cy)`를 구합니다.
  2. 중심에서 ±21px 떨어진 네 점, 즉 `(cx±21, cy±21)`을 찍습니다. 시각 박스가
     22px이면 이 점들은 **박스 밖**이고, 44px 히트 영역이 실제로 동작할 때만
     해당 컨트롤이 반환됩니다.
  3. 네 점 각각에서 `document.elementFromPoint`가 **그 컨트롤 자신 또는 그
     자손**을 반환하는지 확인합니다. 의사요소가 없거나 overflow로 잘리면
     부모/형제가 반환되어 실패합니다.
  4. 실제 크기를 키운 행(input[type=color], .agent-result-thumb--compact,
     .asset-element-toggle, .right-panel-toggle)은 시각 박스가 이미 44px이므로
     같은 프로브가 그대로 성립합니다.
- 인접 아이콘 쌍에서 두 44px 영역이 겹쳐 **의도하지 않은 쪽**이 반환되지 않는지.
  겹치면 어느 쪽이 위인지 기록하고, 잘못된 쪽이 잡히면 실패로 적습니다.
- 세션 액션 2개(면제 항목)는 44px이 아니라 **24px AA**만 확인합니다.
- 모바일 폭(390)에서 at-rule 재정의가 데스크톱보다 작아지지 않았는지.
- `.canvas__blank-sheet`의 `--paper` 검증은 텍스트 대비가 아니라
  **라이트/다크 스크린샷 승인**으로 처리합니다. 이 요소는
  `ui/src/components/Canvas.tsx:336`에서 `aria-hidden`이고
  `.canvas__blank-copy`는 그 형제로 아래에 놓이므로, 종이 위 텍스트 대비라는
  검증은 성립하지 않습니다(감사 4라운드 F5).

**뷰포트와 테마**

측정은 라이트/다크 x 320/390/768/1280/1920에서 돌립니다. wp3 타이포 항목만
**열한 폭**(320/480/481/767/768/769/1024/1025/1279/1280/1920)으로 넓힙니다 -
앞선 판은 여기서도 "아홉 폭"이라 적어 1024/1025가 빠져 있었습니다(감사 wp3a3-F1).

## 완료 조건

DESIGN.md 커밋, 위 항목 전부 통과, 측정값(숫자 그대로)을 이 유닛 closeout에 기록,
통과하지 못한 항목은 숨기지 않고 실패로 적고 원인과 함께 남김.
