---
created: 2026-08-31
tags: [ima2-gen, devlog, ui, audit]
---

# 001 — 감사 1라운드 반영 (VERDICT: fail, 13건)

독립 감사자(sol/high)가 000/010-070을 읽고 13건을 냈습니다. 숫자 분쟁은 전부
다시 측정했고, **감사자가 맞고 제가 틀린 것이 5건**입니다. 원인은 공통적으로
grep 기반 계수입니다: `uniq -c`로 세면 shorthand, `!important`, `font:`
축약 안의 값을 놓칩니다.

## 정정 1 (High, F2): radius 인벤토리가 틀렸다

제 수치 387개/12종은 오측입니다. Node로 파서를 다시 써서 재측정:

```
total border-radius 선언: 476
단일 원시 px:            395개  /  18종
shorthand(다중값):        12개
!important:                1개
2px=9  3px=4  4px=15  5px=13  6px=79  7px=43  8px=94  9px=18  10px=13
11px=2  12px=22  13px=3  14px=7  16px=3  18px=1  20px=1  22px=1  999px=67
```

빠뜨린 값: 18px(`ui/src/styles/prompt-builder.css:10`),
20px(`ui/src/styles/home-workspace.css:210`),
22px(`ui/src/styles/canvas-viewer.css:54`), 그리고 7px `!important` 1건.
7px도 42가 아니라 43입니다. 010의 흡수 표를 18종 전부로 다시 씁니다.
18/20/22px은 `--r-xl`(16px) 위쪽이라 `--r-2xl: 20px`을 추가하고 18->20,
22->20으로 흡수합니다.

## 정정 2 (High, F3): 뷰포트 타입은 5개가 아니라 7개

`font-size`만 봤더니 `font:` 축약 안의 두 개를 놓쳤습니다.

```
ui/src/styles/home-workspace.css:24   font: 700 clamp(84px, 13vw, 176px) / 0.78
ui/src/styles/home-workspace.css:40   font: 700 clamp(24px, 2.8vw, 34px) / 1.08
```

`ui/src/styles/home-workspace.css:24`가 상한 176px으로 실제 히어로 최대치입니다. 020의 "3단 사다리가 150px에서
끝난다"는 서술도 그래서 틀렸습니다. 테스트는 `font-size`와 `font` 둘 다
파싱하고, 변형 증명도 축약 케이스로 한 번 더 합니다.

## 정정 3 (High, F1): 렌더링 깨지는 토큰은 5개가 아니라 4개

`ui/src/styles/home-workspace.css:279`는
`color: var(--text, var(--text-primary))` 꼴입니다. `--text`가 정의돼 있으니 내부
`--text-primary`는 평가되지 않습니다. bare가 아니라 도달 불가입니다.

진짜 렌더링 결함 4개: `--bg-primary`, `--bg-raised`, `--danger`, `--shadow`.

또 하나 인정: 제 브라우저 증거는 저장소와 같은 조건을 재현한 합성 페이지였고
실제 앱 화면이 아닙니다. wp7에서 실제 앱을 띄워 computed style을 확인합니다.

## 정정 4 (Medium, F9): 그라디언트는 46이 아니라 49

linear 36, radial 7, conic 6. 그리고 `assetgen-workspace.css`의 체커보드는
8개가 아니라 conic 4 + linear 2 = 6개입니다. 체커보드는
`ui/src/styles/sprite-curator.css:13`에도 하나 더 있고,
`ui/src/styles/node-workspace.css:163`의 conic은 체커보드가 아니라 상태
애니메이션입니다. 파일별 최다는 node-workspace 7개입니다.

감사자 지적이 맞는 더 중요한 점: 주석(`functional:`)을 테스트 판정 근거로
쓰면 주석만 붙여서 예산을 우회할 수 있습니다. 셀렉터+속성+값 구조를 명시한
매니페스트로 바꿉니다.

## 정정 5 (High, F4): WCAG를 잘못 인용했다

WCAG 2.5.8(AA)은 24x24px이고, 44x44px은 2.5.5(AAA)이자 이 저장소의 내부
정책입니다. 050이 둘을 섞어 썼습니다. 36px 입력은 "인라인 예외"라서 통과하는 게
아니라 **크기로 이미 24px을 넘어서** 통과합니다. 그리고
`ui/src/styles/form-controls.css:305`의 20px은 `.generate-btn__count` —
버튼 안의 카운트 배지로 인터랙티브가 아닙니다. 확인했습니다:

```
.generate-btn__count { min-width: 20px; height: 20px; ... }
```

정책을 명시적으로 씁니다: AA 기준은 24px, 아이콘 전용 컨트롤은 내부 정책으로
44px. 비인터랙티브 요소는 애초에 대상이 아닙니다.

## 신규 (High, F5 확장): 모달 a11y 계약에 큰 구멍이 있다

F6은 `SpriteAnchorGate`가 `aria-modal="true"`를 선언하면서 포커스 처리가
전무하다고 지적했습니다. 맞습니다 — 그 파일의 focus/Escape 관련 코드는 0줄입니다.

그래서 계약 자체를 확인했습니다. `tests/a11y-modal-contract.test.ts`는
`DIALOG_SURFACES` 배열에 손으로 적은 8개 파일만 검사합니다. 트리를 전수 조사한
결과:

```
role="dialog"를 선언한 컴포넌트: 26개
계약이 커버하는 것:              10개
```

`aria-modal="true"`를 선언했는데 포커스 훅이 없는 7개:

```
ui/src/components/PromptImportDialog.tsx
ui/src/components/ResultMetadataModal.tsx
ui/src/components/assetgen/KeyingPanel.tsx
ui/src/components/assetgen/ProjectSearchPopup.tsx
ui/src/components/assetgen/SpriteAnchorGate.tsx
ui/src/components/node-canvas/NodeStudioOverlays.tsx
ui/src/components/node-canvas/NodeTemplatePicker.tsx
```

`aria-modal="true"`는 보조기술에 "이 밖은 없는 것으로 처리하라"고 말합니다.
포커스 트랩과 Escape가 없으면 키보드 사용자가 모달 밖으로 나가지도, 닫지도
못합니다. 계약 문서 주석이 이미 "Rolling your own Escape listener drops focus
trapping and focus restore"라고 경고하는데, 이 7개는 계약 목록에 없어서 아예
검사되지 않았습니다.

이건 색 토큰보다 사용자 영향이 큽니다. **새 work-phase wp9로 올립니다**, 그리고
`DIALOG_SURFACES` 손목록을 트리 탐색으로 바꿔서 다음에 추가되는 모달이 자동으로
걸리게 합니다. 손목록이 구멍의 원인이었으니 목록을 늘리는 것으로는 안 됩니다.

## 반영 (Medium, F8): 색 매핑이 이름 변경이 아니라 시각 변경이다

030이 `--bg-primary`를 23행에서 `--surface`, 44행에서 `--bg`로 두 번 다르게
적었습니다. 모순입니다. `.sprite-anchor-dialog`는 모달이므로 `--surface`가
맞습니다.

그리고 제가 놓친 더 큰 문제를 확인했습니다. 같은 의미 토큰이 위치마다 다른
하드코딩 fallback을 들고 있습니다:

```
var(--error, #e05555)  x3      var(--error, #e53935)  x2
var(--success, #22c55e) x1     var(--success, #4caf50) x1
var(--danger, #ff6262)  x7     var(--warn, #d08c3a)   x1
```

즉 지금 화면에서 에러 빨강이 컴포넌트마다 다릅니다. 통합은 리네임이 아니라
색 이동이고, before/after 값을 라이트/다크 양쪽으로 기록해야 합니다.
`--agent-rail-ring`(`#f5f5f7` 불투명 선택 링)을
`--focus-ring`(반투명 시안)으로 보내면 선택 상태가 포커스 상태처럼 보입니다.
선택은 `--accent`, 포커스는 `--focus-ring`으로 갈라서 매핑합니다.

## 반영 (Medium, F10/F11): wp2 범위 조정

`calc(var(--radius) - Npx)`는 6개가 아니라 11개고 오프셋이 1/2/3/5px입니다.
`--radius`를 12px로 올리면 11/10/9/7px이 나와서 wp2가 없애려는 off-scale 값을
되살립니다. 그래서 `--radius`는 10px에 두고 `--r-md`(8px)/`--r-lg`(12px)와
별개 별칭으로 유지하지 않습니다 — calc 11곳을 스케일 토큰 직접 참조로 바꾸고
`--radius`와 calc 패턴을 함께 없앱니다.

wp2 테스트는 radius 토큰만 검사합니다. "정의되지 않은 토큰 0개"는 wp4 소유입니다.
`--chrome`은 죽은 토큰이 아니라 `ui/src/styles/sidebar.css:59`에 같은
그라디언트가 인라인으로 복제된 경우입니다. 삭제가 아니라 wp4에서 인라인을 토큰
참조로 되돌립니다.

## 반영 (Medium, F12): 버전은 3.12.2

"사용자에게 보이는 버그 수정이니 minor"는 근거가 아닙니다. 공개 기능이 늘지
않았고 릴리스 워크플로 기본값도 patch입니다. 3.12.2로 갑니다.

## 반영 (Low, F13): 이모지 스캐너 정의

`▶`(U+25B6) 5곳이 남아 있습니다. 전부 `aria-hidden="true"`가 붙은 텍스트
심볼이고 기본 표현이 emoji가 아닙니다. "이모지 0"이라는 서술 대신 스캐너 범위를
명시합니다: U+1F300-1FAFF와 U+FE0F variation selector가 붙은 문자를 금지하고,
`aria-hidden` 텍스트 심볼은 허용으로 분류합니다.

## work-phase 변경

wp9(모달 포커스 계약) 추가. 사용자 영향이 커서 wp2-wp6보다 먼저 실행합니다.
