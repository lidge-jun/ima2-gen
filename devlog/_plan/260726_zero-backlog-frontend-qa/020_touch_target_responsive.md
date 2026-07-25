---
title: "020 — WP2: 터치 타깃 · 반응형 · reduced-motion"
lane: "260726_zero-backlog-frontend-qa"
wp: 2
created: 2026-07-26
depends_on: [WP1]
criteria: [C2]
---

# WP2 — 터치 타깃 · 반응형 · reduced-motion

WP1이 키보드/스크린리더 경로를 열었다면, WP2는 포인터와 뷰포트 경로를 연다.
같은 CSS 파일을 두 사이클이 동시에 건드리지 않도록 순서를 나눴다.

## 원칙 — 히트 영역만 키우고 밀도는 지킨다

ima2-gen은 반복 작업 도구다(density profile: productivity/ops). 44px 규칙을 시각
크기에 그대로 적용하면 조밀한 좌측 레일이 소비자 앱처럼 헐거워진다. 따라서:

- 버튼 **박스**를 44px로 키우되 `padding`/투명 영역으로 확보한다.
- 시각 아이콘 글리프는 16~20px 유지.
- 촘촘한 리스트 행에서는 `min-height: 44px`를 행 자체에 주고 버튼은 행을 채운다.

## 변경 파일 맵

| 파일 | 종류 | 내용 |
|---|---|---|
| `ui/src/styles/gallery-modal.css` | MODIFY | 닫기 버튼 44px |
| `ui/src/styles/assets-workspace.css` | MODIFY | 버튼 3종 44px + 컬럼 유연화 + 툴바 붕괴 |
| `ui/src/styles/form-controls.css` | MODIFY | SizePicker 비율 행 중간 뷰포트 |
| `ui/src/index.css` | MODIFY | 전역 reduced-motion 블록 |
| `tests/a11y-touch-target-contract.test.ts` | NEW | 하드코딩 소형 타깃 회귀 방지 |

## 020-1. 갤러리 닫기 버튼

`ui/src/styles/gallery-modal.css:156-163`:

```css
 .gallery__close {
   background: transparent;
   border: 1px solid var(--border);
   color: var(--text);
   border-radius: 6px;
-  width: 32px;
-  height: 32px;
+  width: 44px;
+  min-width: 44px;
+  height: 44px;
   cursor: pointer;
   font-size: 14px;
```

`font-size: 14px`는 유지한다. 글리프는 그대로, 박스만 커진다.

## 020-2. assets workspace

### 버튼 3종

```css
-.assets-folders__heading button { width: 28px; height: 28px; border-radius: 7px; font-size: 18px; }
+.assets-folders__heading button {
+  width: 44px; min-width: 44px; height: 44px;
+  border-radius: 7px; font-size: 18px;
+  display: inline-flex; align-items: center; justify-content: center;
+}
```

```css
-.assets-folder-row__actions button { width: 25px; height: 25px; border-radius: 6px; color: var(--text-dim); }
+.assets-folder-row__actions button {
+  width: 44px; min-width: 44px; height: 44px;
+  border-radius: 6px; color: var(--text-dim);
+  display: inline-flex; align-items: center; justify-content: center;
+}
```

**부수효과 검증 필요.** `.assets-folder-row__actions`는 `position: absolute; right: 3px`로
행 위에 겹친다. 25px→44px는 행 높이(현재 `padding: 7px 8px` + 텍스트 ≈ 31px)를 넘는다.
행에 `min-height: 44px`를 주고 액션 컨테이너를 세로 중앙 정렬한다:

```css
 .assets-folder-row {
   position: relative; display: flex; align-items: center;
+  min-height: 44px;
   padding-left: calc(var(--folder-depth) * 14px);
 }
```

`button.is-armed`는 `width: auto`라 영향 없지만 `height: 44px`가 상속되는지 확인한다.

상세 닫기(`ui/src/styles/assets-workspace.css:70-72`)도 30px → 44px. 모바일 미디어쿼리에 있는 44px 재정의는 이제
중복이므로 제거해 단일 소스로 만든다.

### 컬럼 유연화

```css
-.assets-workspace { ... grid-template-columns: 220px minmax(0, 1fr); ... }
-.assets-workspace--detail-open { grid-template-columns: 220px minmax(0, 1fr) 360px; }
+.assets-workspace { ... grid-template-columns: minmax(160px, 220px) minmax(0, 1fr); ... }
+.assets-workspace--detail-open {
+  grid-template-columns: minmax(160px, 220px) minmax(0, 1fr) minmax(280px, 360px);
+}
```

1024px 미만에서 detail이 열리면 중앙이 여전히 좁다. 컨테이너 쿼리 대신 미디어쿼리로
detail을 오버레이 전환한다:

```css
@media (max-width: 1023px) {
  .assets-workspace--detail-open { grid-template-columns: minmax(160px, 220px) minmax(0, 1fr); }
  .assets-workspace__detail {
    position: absolute; inset: 0 0 0 auto; width: min(360px, 100%);
    z-index: 20; border-left: 1px solid var(--hairline-soft); background: var(--surface);
  }
  .assets-workspace { position: relative; }
}
```

### 툴바

```css
 .assets-toolbar__controls { display: grid; grid-template-columns: minmax(180px, 420px) 150px; gap: 8px; }
+@media (max-width: 767px) {
+  .assets-toolbar__controls { grid-template-columns: 1fr; }
+}
```

## 020-3. SizePicker 비율 행

`ui/src/styles/form-controls.css:87-91`:

```css
+@media (max-width: 767px) {
+  .size-picker__ratio-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
+}
```

이 컨트롤은 우측 패널과 모바일 시트 양쪽에 들어간다. 뷰포트 폭이 아니라 컨테이너
폭이 진짜 제약이므로 컨테이너 쿼리를 우선 검토한다:

```css
.size-picker { container-type: inline-size; }
@container (max-width: 320px) {
  .size-picker__ratio-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
```

B 단계에서 실제 렌더를 보고 둘 중 하나를 고른다. 컨테이너 쿼리가 동작하면 그쪽이
정답이다 — 좁은 시트 안에서도 올바르게 접힌다.

## 020-4. 전역 reduced-motion

현재 12개 CSS 파일이 각자 대응한다. 새로 추가되는 표면은 매번 빠뜨린다. `index.css`의
`:focus-visible` 블록 다음에 안전망을 둔다:

```css
@media (prefers-reduced-motion: reduce) {
  *:not([data-motion-essential]),
  *:not([data-motion-essential])::before,
  *:not([data-motion-essential])::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**`data-motion-essential` 예외가 핵심이다.** 생성 진행 스피너는 장식이 아니라 상태
전달 수단이다. 전부 죽이면 진행 중인지 멈춘 건지 알 수 없다. 다음 요소에 이 속성을
부여한다:

- `InFlightList`/`InFlightBadge`의 진행 인디케이터
- `AgentSessionSpinner`
- 노드 생성 중 펄스

동시에 이 요소들은 **텍스트 상태를 항상 함께 노출**해야 한다(WP1의 라이브 리전이
이미 그 절반을 담당한다). 애니메이션만이 유일한 진행 신호면 그 자체가 접근성 결함이다.

기존 12개 파일의 개별 대응은 제거하지 않는다. 더 구체적인 규칙이므로 공존해도
충돌하지 않고, 일괄 제거는 이 사이클의 롤백 단위를 불필요하게 키운다.

## 계약 테스트 (NEW)

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const TARGETS = [
  ["ui/src/styles/gallery-modal.css", ".gallery__close"],
  ["ui/src/styles/assets-workspace.css", ".assets-folders__heading button"],
  ["ui/src/styles/assets-workspace.css", ".assets-folder-row__actions button"],
];

test("interactive icon buttons keep a 44px hit box", () => {
  for (const [path, selector] of TARGETS) {
    const css = readFileSync(path, "utf8");
    const rule = css.split(selector)[1]?.split("}")[0] ?? "";
    assert.match(rule, /height:\s*44px/, `${selector} needs a 44px height`);
  }
});

test("global reduced-motion fallback exists with an essential-motion escape", () => {
  const css = readFileSync("ui/src/index.css", "utf8");
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /data-motion-essential/);
});
```

## Accept criteria (C2)

1. 지목된 아이콘 버튼 전부 44×44px 히트 박스.
2. `.assets-folder-row` 레이아웃이 깨지지 않는다(액션 버튼이 행을 넘치지 않음).
3. 768px에서 assets 툴바가 1열로, detail이 오버레이로 전환된다.
4. SizePicker 비율 행이 좁은 컨테이너에서 2열로 접힌다.
5. 전역 reduced-motion이 적용되고 진행 인디케이터는 예외로 살아있다.
6. **렌더 근거(C-RENDER-GROUNDING-01, STRICT)**: 390 / 768 / 1440 세 뷰포트에서
   assets·갤러리·SizePicker를 실제 렌더해 스크린샷을 관찰하고 devlog에 저장한다.
   CSS를 읽어서 "될 것"이라 판단하는 것은 이 규칙을 만족하지 않는다.
7. **활성화 근거**: reduced-motion은 조건부 경로다. `prefers-reduced-motion: reduce`를
   에뮬레이션한 상태에서 장식 모션이 멈추고 진행 스피너는 계속 도는 것을 관찰한다.

## 범위 경계

IN: 위 4개 CSS 파일 + `data-motion-essential` 부여 대상 컴포넌트 + 신규 테스트.
OUT: 색상/타이포 변경, 컴포넌트 구조 리팩터, 다른 워크스페이스의 밀도 조정.
