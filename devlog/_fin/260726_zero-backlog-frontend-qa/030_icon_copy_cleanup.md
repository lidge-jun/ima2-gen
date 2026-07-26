---
title: "030 — WP3: 아이콘 문자 · 미번역 카피 제거"
lane: "260726_zero-backlog-frontend-qa"
wp: 3
created: 2026-07-26
depends_on: [WP1]
criteria: [C3]
---

# WP3 — 아이콘 문자 · 미번역 카피 제거

텍스트 문자를 UI 아이콘으로 쓰는 지점과, 한국어 UI에서 영어가 새어나오는 지점을
정리한다. FE-AI-TELL-01(렌더 tell)과 ux-writing-ko 소관이다.

## 왜 문자 아이콘이 문제인가

`★`/`☆`/`x`는 이모지가 아니라 일반 문자다. 그래서 STRICT 이모지 금지에는 걸리지
않는다. 그럼에도 고쳐야 하는 이유는 세 가지다.

1. **렌더 불일치** — 폰트 폴백에 따라 별의 굵기·크기·baseline이 플랫폼마다 다르다.
   같은 화면에 SVG 별(`FavoriteStarButton`)과 문자 별이 공존하면 즉시 눈에 띈다.
2. **스크린리더** — `☆`는 "white star"로 읽힌다. 버튼 라벨이 별도로 없으면 의미가 없다.
3. **이미 정답이 있다** — `ui/src/components/controls/FavoriteStarButton.tsx`가
   SVG 별 + `aria-label` + `aria-pressed` + `aria-busy`를 갖춘 채 존재한다.

`x`(Toast 닫기)도 같은 부류다. `×`(U+00D7)도 아닌 소문자 라틴 x라서 시각적으로
비대칭이다.

## 현재 사용처 (rg 전수)

| 위치 | 현재 | 처리 |
|---|---|---|
| `ui/src/components/PromptDetailModal.tsx:72` | `"★ " + t(...)` / `"☆ " + t(...)` | `FavoriteStarButton` + 텍스트 라벨 |
| `ui/src/components/PromptLibraryRow.tsx:51` | `{isFavorite ? "★" : "☆"}` | `FavoriteStarButton` 교체 |
| `ui/src/components/ImageNode.tsx:339` | `☆` | **즐겨찾기 아님** — 아래 참조 |
| `ui/src/components/PromptLibraryPanel.tsx:114` | `<span aria-hidden="true">★</span>` | 인라인 SVG로 교체 |
| `ui/src/components/Toast.tsx:113-120` | `aria-label="Dismiss notification"`, 본문 `x` | i18n 키 + `×` 또는 SVG |

`ui/src/components/PromptLibraryPanel.tsx:114`는 이미 `aria-hidden="true"`라 스크린리더 문제는 없다.
장식 마커이므로 렌더 일관성만 맞추면 된다.

### `ui/src/components/ImageNode.tsx:339` 정정 (A-감사 blocker 6 반영)

최초 계획은 이것을 즐겨찾기 토글로 보고 `FavoriteStarButton`으로 교체하려 했다.
실제 코드를 읽으니 **프롬프트 저장 버튼**이다:

```tsx
            <button
              type="button"
              onClick={() => setSaveOpen((v) => !v)}
              disabled={!d.prompt?.trim()}
              title={t("promptLibrary.saveTitle")}
              aria-label={t("promptLibrary.saveTitle")}
            >
              ☆
            </button>
            {saveOpen && <SavePromptPopover text={d.prompt || ""} onClose={...} />}
```

`aria-label`이 "프롬프트 저장"인데 글리프는 별이다. 이건 문자 아이콘 문제이자
**의미 불일치 문제**다. 즐겨찾기 컴포넌트로 바꾸면 의미가 더 틀어진다.

처리: 저장/북마크를 뜻하는 별도 SVG 아이콘으로 교체한다. `aria-pressed={saveOpen}`와
`aria-expanded={saveOpen}`, `aria-haspopup="dialog"`를 추가한다 — 팝오버를 여는
버튼이므로 그 상태가 노출돼야 한다. `FavoriteStarButton`은 여기 쓰지 않는다.

따라서 즐겨찾기 교체 대상은 3곳이다: `PromptDetailModal`, `PromptLibraryRow`,
`PromptLibraryPanel`(장식).

## 변경 파일 맵

| 파일 | 종류 | 내용 |
|---|---|---|
| `ui/src/components/PromptDetailModal.tsx` | MODIFY | 즐겨찾기 버튼 교체 |
| `ui/src/components/PromptLibraryRow.tsx` | MODIFY | 즐겨찾기 버튼 교체 |
| `ui/src/components/PromptLibraryPanel.tsx` | MODIFY | 장식 별 SVG화 |
| `ui/src/components/ImageNode.tsx` | MODIFY | 저장 아이콘 + 팝오버 ARIA |
| `ui/src/components/Toast.tsx` | MODIFY | i18n 라벨 + 닫기 글리프 |
| `ui/src/components/controls/FavoriteStarButton.tsx` | MODIFY | `FavoriteStarIcon` 추출 + variant 확장 |
| `ui/src/i18n/ko.json` | MODIFY | `common.dismiss` 추가 |
| `ui/src/i18n/en.json` | MODIFY | `common.dismiss` 추가 |
| `ui/src/styles/favorite-star.css` | MODIFY | `prompt` variant 스타일 |
| `tests/ui-glyph-policy.test.ts` | NEW | 문자 아이콘 회귀 차단 |

## 030-1. FavoriteStarButton variant 확장

현재 variant는 `"gallery" | "result" | "asset"` 세 가지다. `"prompt"` 하나를 추가한다.

```ts
-  variant: "gallery" | "result" | "asset";
+  variant: "gallery" | "result" | "asset" | "prompt";
```

`ui/src/styles/favorite-star.css`에 `.favorite-star--prompt` 규칙을 추가한다. 기존
variant의 크기 토큰을 재사용하고 44px 히트 박스(WP2 원칙)를 따른다.

### 기존 variant 회귀 방지 (blocker 6)

union 확장과 `FavoriteStarIcon` 추출은 기존 사용처 3곳에 영향을 준다.

| 사용처 | 라인 | variant |
|---|---:|---|
| `ui/src/components/Canvas.tsx` | 224 | `result` |
| `ui/src/components/assets/AssetsGrid.tsx` | 68 | `asset` |
| `ui/src/components/GalleryImageTile.tsx` | 157 | `gallery` |

union에 값을 **추가**하는 것은 기존 호출을 깨지 않는다(기존 값이 여전히 유효).
진짜 위험은 SVG를 `FavoriteStarIcon`으로 추출할 때 마크업이 바뀌어 CSS 셀렉터가
어긋나는 것이다. 현재 CSS는 `.favorite-star svg` 형태로 자식을 겨냥할 가능성이 높다.

따라서 **추출 시 DOM 구조를 보존한다** — `FavoriteStarIcon`이 렌더하는 결과가
기존 `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path .../></svg>`와
바이트 단위로 동일해야 한다. 래핑 `<span>`을 추가하지 않는다.

검증: 세 사용처를 실제 렌더해 별 크기·색·정렬이 변하지 않았는지 스크린샷으로 확인한다.
`aria-pressed`/`aria-busy`/이벤트 전파 동작도 그대로여야 한다.

## 030-2. PromptDetailModal (`ui/src/components/PromptDetailModal.tsx:68-72`)

```tsx
-          <button className="prompt-detail-modal__favorite" onClick={onToggleFavorite}>
-            {prompt.isFavorite ? "★ " + t("promptLibrary.unfavorite") : "☆ " + t("promptLibrary.favorite")}
-          </button>
+          <button
+            type="button"
+            className="prompt-detail-modal__favorite"
+            onClick={onToggleFavorite}
+            aria-pressed={prompt.isFavorite}
+          >
+            <FavoriteStarIcon active={prompt.isFavorite} />
+            {prompt.isFavorite ? t("promptLibrary.unfavorite") : t("promptLibrary.favorite")}
+          </button>
```

여기서는 `FavoriteStarButton`을 통째로 쓰지 않는다. 이 자리는 **아이콘 + 텍스트**
복합 버튼이고, `FavoriteStarButton`은 아이콘 전용이다. 대신 SVG 마크업을
`FavoriteStarIcon`으로 분리해 양쪽이 같은 path를 공유하게 한다.

즉 `FavoriteStarButton.tsx`에서 `<svg>` 부분을 `FavoriteStarIcon` 컴포넌트로 추출하고,
`FavoriteStarButton`은 그것을 쓰도록 리팩터한다. 별 모양이 두 벌 존재하는 상황을
만들지 않는다.

## 030-3. PromptLibraryRow (`ui/src/components/PromptLibraryRow.tsx:51`)

아이콘 전용 토글이므로 `FavoriteStarButton`을 그대로 쓴다.

```tsx
-          <button className="prompt-row__star" onClick={...}>
-            {prompt.isFavorite ? "★" : "☆"}
-          </button>
+          <FavoriteStarButton
+            active={prompt.isFavorite}
+            label={prompt.isFavorite ? t("promptLibrary.unfavorite") : t("promptLibrary.favorite")}
+            variant="prompt"
+            onToggle={onToggleFavorite}
+          />
```

`FavoriteStarButton`이 이미 `stopPropagation`을 하므로, 행 클릭이 상세를 여는 기존
동작과 충돌하지 않는다. 오히려 현재 수동 구현보다 안전하다.

## 030-4. ImageNode 저장 버튼 (`ui/src/components/ImageNode.tsx:332-340`)

즐겨찾기가 아니라 프롬프트 저장 팝오버 트리거다. 별 글리프를 저장 의미의 SVG로
바꾸고 팝오버 ARIA를 붙인다.

```tsx
             <button
               type="button"
               onClick={() => setSaveOpen((v) => !v)}
               disabled={!d.prompt?.trim()}
               title={t("promptLibrary.saveTitle")}
               aria-label={t("promptLibrary.saveTitle")}
+              aria-haspopup="dialog"
+              aria-expanded={saveOpen}
             >
-              ☆
+              <SavePromptIcon />
             </button>
```

노드 캔버스는 `@xyflow/react` 드래그 영역이다. 이 버튼은 기존에도 `stopPropagation`
없이 동작해 왔으므로 현재 동작을 바꾸지 않는다. 다만 **B 단계에서 이 버튼을 드래그해
노드가 딸려오는지 실제로 확인**한다. 딸려온다면 그건 이 WP가 만든 문제가 아니라
기존 결함이며, 발견 시 별도로 기록한다.

## 030-5. Toast (`ui/src/components/Toast.tsx:113-120`)

```tsx
-              aria-label="Dismiss notification"
+              aria-label={t("common.dismiss")}
```

```tsx
-              x
+              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="14" height="14">
+                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
+              </svg>
```

**`ui/src/components/Toast.tsx`가 `useI18n`을 쓰는지 먼저 확인해야 한다.** 현재 파일에서 `t`가 보이지
않는다. import가 없으면 추가하고, 토스트가 i18n Provider 밖에서 렌더되는 구조라면
(전역 스택일 가능성) 라벨을 스토어 경유로 전달한다. B 단계 첫 작업은 이 확인이다.

i18n 키 추가:

```json
   "common": {
     "ok": "확인",
     "cancel": "취소",
     "delete": "삭제",
     "close": "닫기",
+    "dismiss": "알림 닫기",
     "saving": "저장 중...",
     "loading": "불러오는 중..."
   },
```

en: `"dismiss": "Dismiss notification"`.

한국어를 "알림 해제"가 아니라 "알림 닫기"로 쓴다. 해제는 설정을 끄는 뉘앙스라
일회성 토스트에 맞지 않는다.

## 계약 테스트 (NEW)

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BANNED = /[\u2605\u2606\u2730-\u2734]/u; // ★ ☆ 및 별 계열 딩벳

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith(".tsx") ? [full] : [];
  });
}

test("no dingbat star glyphs are used as UI icons", () => {
  const offenders = walk("ui/src/components").filter((file) =>
    BANNED.test(readFileSync(file, "utf8")),
  );
  assert.deepEqual(offenders, [], `dingbat glyphs found in: ${offenders.join(", ")}`);
});

test("toast dismiss label is translated", () => {
  const src = readFileSync("ui/src/components/Toast.tsx", "utf8");
  assert.doesNotMatch(src, /aria-label="Dismiss notification"/);
  const ko = JSON.parse(readFileSync("ui/src/i18n/ko.json", "utf8"));
  const en = JSON.parse(readFileSync("ui/src/i18n/en.json", "utf8"));
  assert.ok(ko.common.dismiss, "ko.common.dismiss missing");
  assert.ok(en.common.dismiss, "en.common.dismiss missing");
});
```

## Accept criteria (C3)

1. `rg "★|☆" ui/src/components`가 0건.
2. 즐겨찾기 토글 3곳이 모두 같은 SVG path를 공유한다(별 모양 이중화 없음).
3. Toast 닫기 라벨이 한국어 UI에서 한국어로 나온다.
4. `ImageNode` 저장 버튼이 저장 의미의 아이콘을 쓰고 `aria-expanded`를 노출한다.
5. 기존 variant 3곳(`Canvas`/`AssetsGrid`/`GalleryImageTile`)의 렌더가 변하지 않는다 —
   **스크린샷 대조**.
5. 전 게이트 green + 렌더 스크린샷 관찰.

## 범위 경계

IN: 위 6개 컴포넌트 + i18n 2파일 + favorite-star CSS + 신규 테스트.
OUT: 다른 아이콘 라이브러리 도입, 아이콘 세트 전면 교체, 이모지 감사(현재 0건 확인됨).
