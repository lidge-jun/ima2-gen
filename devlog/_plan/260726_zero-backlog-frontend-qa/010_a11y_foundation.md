---
title: "010 — WP1: 접근성 기반 (모달 포커스 계약 + 라이브 리전)"
lane: "260726_zero-backlog-frontend-qa"
wp: 1
created: 2026-07-26
depends_on: [WP0]
criteria: [C1]
---

# WP1 — 접근성 기반: 모달 포커스 계약 + 라이브 리전

## 왜 이게 첫 구현 사이클인가

뒤따르는 모든 UI work-phase가 다이얼로그·상태 표시 위에 얹힌다. provenance chip도,
export 포맷 메뉴도, 비교 매트릭스도 결국 모달과 라이브 리전을 쓴다. 기반을 먼저
고치지 않으면 같은 결함을 새 표면에 복제하게 된다.

## 핵심 사실 — 훅은 이미 있다

`ui/src/hooks/useModalFocus.ts`는 포커스 트랩, `data-modal-initial-focus` 초기 포커스,
Escape 처리, 이전 포커스 복원을 모두 구현한다. `OnboardingPopup`,
`ProviderReadinessPopup`, `MetadataRestoreDialog`, `ApiDisabledModal`이 이미 쓴다.

**이 WP는 훅을 새로 만들지 않는다.** 누락된 다이얼로그에 기존 훅을 적용한다.

## 변경 파일 맵

| 파일 | 종류 | 내용 |
|---|---|---|
| `ui/src/components/PromptDetailModal.tsx` | MODIFY | dialog semantics + `useModalFocus` + 제목 레벨 |
| `ui/src/components/GalleryModal.tsx` | MODIFY | `useModalFocus`로 교체, tablist 키보드, 로딩 `role="status"` |
| `ui/src/components/CustomSizeConfirmModal.tsx` | MODIFY | 수동 포커스/Escape를 `useModalFocus`로 교체 |
| `ui/src/components/InFlightList.tsx` | MODIFY | 진행 목록 라이브 리전 |
| `ui/src/styles/prompt-library.css` | MODIFY | backdrop 분리에 따른 셀렉터 조정 |
| `tests/a11y-modal-contract.test.ts` | NEW | 포커스 계약 정적 검증 |

## 010-1. PromptDetailModal

현재(`ui/src/components/PromptDetailModal.tsx:29-36`):

```tsx
  return (
    <div className="prompt-detail-modal" onClick={onClose}>
      <div className="prompt-detail-modal__backdrop" />
      <div className="prompt-detail-modal__content" onClick={(e) => e.stopPropagation()}>
        <div className="prompt-detail-modal__header">
          <h4>{prompt.name || t("promptLibrary.untitled")}</h4>
```

변경 후:

```tsx
  const dialogRef = useModalFocus<HTMLDivElement>(true, onClose);

  return (
    <div className="prompt-detail-modal" role="presentation">
      <div className="prompt-detail-modal__backdrop" onClick={onClose} />
      <div
        ref={dialogRef}
        className="prompt-detail-modal__content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-detail-title"
        tabIndex={-1}
      >
        <div className="prompt-detail-modal__header">
          <h2 id="prompt-detail-title" className="prompt-detail-modal__title">
            {prompt.name || t("promptLibrary.untitled")}
          </h2>
```

설계 결정 세 가지:

1. **`stopPropagation` 제거.** 배경 클릭 닫기를 콘텐츠에서 이벤트를 막는 방식으로
   구현하면 내부의 정당한 클릭 핸들러까지 영향을 받는다. backdrop 엘리먼트 자체에
   `onClick`을 둔다. 키보드 사용자는 훅이 제공하는 Escape로 닫는다.
2. **`h4` → `h2`.** 다이얼로그는 독립 문서 컨텍스트다. 시각 크기는 CSS
   `.prompt-detail-modal__title`로 유지해 회귀를 막는다.
3. **`open` 인자에 `true` 고정.** 이 컴포넌트는 부모가 조건부 렌더링한다
   (마운트 자체가 열림). 훅 시그니처를 바꾸지 않는다.

즐겨찾기 `★`/`☆` 문자(`ui/src/components/PromptDetailModal.tsx:68-72`)는 WP3 소관이다. 이 WP에서 건드리지 않는다.

## 010-2. GalleryModal

현재(`ui/src/components/GalleryModal.tsx:118-125`)는 `window`에 Escape 리스너만 단다.

```tsx
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
```

변경: 이 `useEffect`를 삭제하고 `useModalFocus(open, close)`로 대체한다. 반환된 ref를
갤러리 다이얼로그 컨테이너에 붙이고 `role="dialog"`, `aria-modal="true"`,
`aria-labelledby`를 부여한다.

**주의 — 중첩 키 핸들러 충돌.** 갤러리는 좌우 화살표 탐색과 자체 단축키를 쓴다
(`ui/src/lib/galleryShortcuts.ts`). 훅은 Escape와 Tab만 가로채므로 충돌하지 않는다.
다만 훅이 `event.preventDefault()`를 부르는 Escape 경로에서 기존 닫기 로직이 두 번
실행되지 않도록, 기존 리스너를 **제거**하고 대체해야 한다. 병행 등록은 금지.

### tablist 키보드 (`ui/src/components/GalleryModal.tsx:444-483`)

```tsx
  const tabsRef = useRef<HTMLDivElement>(null);
  const onTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const tabs = Array.from(
      tabsRef.current?.querySelectorAll<HTMLButtonElement>("[role='tab']") ?? [],
    );
    const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home" ? 0
      : event.key === "End" ? tabs.length - 1
      : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next]?.focus();
    tabs[next]?.click();
  };
```

각 탭 버튼에 추가: `id`, `aria-controls="gallery-tabpanel"`,
`tabIndex={selected ? 0 : -1}` (roving tabindex). 결과 영역 컨테이너에
`id="gallery-tabpanel"`, `role="tabpanel"`, `aria-labelledby={활성 탭 id}`.

### 로딩 상태 (`ui/src/components/GalleryModal.tsx:542-545`)

```tsx
-  <div className="gallery__empty">{t("gallery.sessionLoading")}</div>
+  <div className="gallery__empty" role="status" aria-live="polite">
+    {t("gallery.sessionLoading")}
+  </div>
```

## 010-3. CustomSizeConfirmModal

현재(`ui/src/components/CustomSizeConfirmModal.tsx:22-30`)는 `cancelRef.current?.focus()` + window Escape 리스너다. 이미
`role="dialog"`/`aria-modal`/`aria-labelledby`는 있으므로 포커스 관리만 교체한다.

```tsx
-  const cancelRef = useRef<HTMLButtonElement>(null);
-  useEffect(() => {
-    if (!pending) return;
-    cancelRef.current?.focus();
-    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") cancel(); };
-    window.addEventListener("keydown", onKeyDown);
-    return () => window.removeEventListener("keydown", onKeyDown);
-  }, [cancel, pending]);
+  const dialogRef = useModalFocus<HTMLDivElement>(Boolean(pending), cancel);
```

취소 버튼에 `data-modal-initial-focus`를 붙여 기존 초기 포커스 동작을 보존한다.
`ref={cancelRef}`는 제거하고 다이얼로그 컨테이너에 `ref={dialogRef}`를 붙인다.

**훅 호출 위치 주의.** `if (!pending) return null;`은 훅 호출 **뒤**에 와야 한다.
현재 코드는 이미 그 순서라 문제없지만, 훅을 조건부 반환 아래로 옮기면 React 규칙
위반이다.

## 010-4. InFlightList 라이브 리전

`CompactList`와 확장 목록 양쪽 `<ul className="in-flight-list">`에 적용:

```tsx
-  <ul className="in-flight-list">
+  <ul className="in-flight-list" aria-live="polite" aria-relevant="additions text">
```

`aria-atomic`은 두지 않는다. 전체 목록을 매번 다시 읽으면 병렬 생성 12건에서
스크린리더가 폭주한다. 변경분만 읽히도록 `aria-relevant`를 쓴다.

## 계약 테스트 (NEW)

`tests/a11y-modal-contract.test.ts` — 소스 정적 검사. 브라우저 없이 회귀를 잡는다.

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const MODALS = [
  "ui/src/components/PromptDetailModal.tsx",
  "ui/src/components/GalleryModal.tsx",
  "ui/src/components/CustomSizeConfirmModal.tsx",
];

test("dialog surfaces declare modal semantics and use the shared focus hook", () => {
  for (const path of MODALS) {
    const src = readFileSync(path, "utf8");
    assert.match(src, /useModalFocus/, `${path} must use useModalFocus`);
    assert.match(src, /role="dialog"/, `${path} must declare role="dialog"`);
    assert.match(src, /aria-modal="true"/, `${path} must declare aria-modal`);
    assert.match(src, /aria-labelledby=/, `${path} must label its dialog`);
  }
});

test("in-flight progress is exposed as a live region", () => {
  const src = readFileSync("ui/src/components/InFlightList.tsx", "utf8");
  assert.match(src, /aria-live="polite"/);
});
```

`scripts/classify-tests.mjs` 인벤토리에 등록한다.

## Accept criteria (C1)

1. 세 다이얼로그 모두 `role="dialog"` + `aria-modal` + `aria-labelledby` 선언.
2. Tab이 다이얼로그를 탈출하지 않고, 닫으면 트리거로 포커스가 돌아온다.
3. 갤러리 탭이 화살표/Home/End로 이동한다.
4. 진행 목록 변경이 라이브 리전으로 노출된다.
5. `npm run typecheck`, `npm run typecheck:tests`, `npm test`, `cd ui && npm run build` 전부 exit 0.
6. **활성화 증거(C-ACTIVATION-GROUNDING-01)**: 포커스 트랩은 조건부 경로다. 브라우저에서
   Tab을 마지막 요소 너머로 눌러 첫 요소로 순환하는 것을 실제로 관찰하고 스크린샷을 남긴다.
   테스트 green만으로는 이 규칙을 만족하지 않는다.

## 범위 경계

IN: 위 4개 컴포넌트 + 관련 CSS 셀렉터 + 신규 계약 테스트.
OUT: 별 문자 교체(WP3), 터치 타깃 크기(WP2), 다른 다이얼로그(이미 양호), 시각 리디자인.
