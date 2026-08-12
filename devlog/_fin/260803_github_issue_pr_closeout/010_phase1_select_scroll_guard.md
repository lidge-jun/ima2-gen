# 010 — Phase 1: 포털 Select 내부 스크롤 가드 (이슈 #119)

대응 work-phase: `wp1` / 대응 기준: `c-scroll-activation`, `c-gates`

## 스코프

IN

- `ui/src/components/controls/Select.tsx` — 캡처 스크롤 close 가드
- `ui/src/lib/portalDismiss.ts` — NEW, 순수 판정 함수 (테스트 가능 경계)
- `tests/portal-dropdown-scroll-dismiss-contract.test.ts` — NEW, 회귀 테스트
- `docs/migration/runtime-test-inventory.md` — 생성물 재생성 (필수)
- `structure/01-file-function-map.md` — line count 계약 갱신 (필요 시)

OUT

- `ui/src/components/ImageModelSelect.tsx` — 사이드바 분기는 현재 렌더되지 않는 죽은 코드다
  (`001` 참조). 이슈 #119와 무관한 결합을 만들지 않기 위해 손대지 않는다
  (A-phase 감사 blocker 4 반영). 죽은 분기 정리는 별도 판단 사안이다.
- `ui/src/components/composer/InFlightPopup.tsx` 동작 변경 — 조사만 하고 결함이면 별도 판단
- CSS/레이아웃, 드롭다운 키보드 동작, 접근성 속성
- 다른 provider/서버 코드

## 설계 판단

판정을 순수 함수로 분리해 `ui/src/lib/portalDismiss.ts`에 둔다. 이유는 판정 로직 자체를
노드 테스트로 직접 호출해 경계 조건(이벤트 없음, ref 없음, 내부/외부 타깃)을 고정하기
위해서다.

**단, 이 단위 테스트는 활성화 증거가 아니다.** 함수가 올바르게 판정해도 컴포넌트가 그 함수를
호출하지 않거나 `listRef`가 엉뚱한 곳을 가리키면 사용자에게는 버그가 그대로다. 실제
사용자 동작 증명은 아래 "활성화 시나리오"의 브라우저 관측이 담당한다
(A-phase 감사 blocker 1 반영).

## 변경 1 — NEW `ui/src/lib/portalDismiss.ts`

```ts
/**
 * Capture-phase scroll listeners on `window` also receive scrolls that
 * originated inside a portaled menu. Dismissing on those closes the menu the
 * moment the user scrolls its own list (issue #119). Only scrolls from OUTSIDE
 * the menu detach a fixed-position panel from its trigger, so only those
 * should dismiss it.
 */
export function shouldDismissOnScroll(
  event: Pick<Event, "target"> | undefined,
  menu: { contains(node: Node): boolean } | null | undefined,
): boolean {
  if (!event) return true;
  const target = event.target;
  if (!menu) return true;
  if (target && typeof target === "object" && "nodeType" in target) {
    if (menu.contains(target as Node)) return false;
  }
  return true;
}
```

주의: `menu.contains`를 구조적 타입으로 받는다. 그래야 테스트에서 DOM 없이
가짜 컨테이너를 넣어 분기를 구동할 수 있다. 실제 사용처에서는 `HTMLElement`가 그대로 들어간다.

## 변경 2 — MODIFY `ui/src/components/controls/Select.tsx`

임포트 추가 (파일 상단, `createPortal` 임포트 다음 줄):

```diff
 import { createPortal } from "react-dom";
+import { shouldDismissOnScroll } from "../../lib/portalDismiss";
```

포털 effect의 close 핸들러 (현재 `Select.tsx:183-189`):

```diff
-    const close = () => setOpen(false);
-    window.addEventListener("resize", close);
-    window.addEventListener("scroll", close, true);
+    const close = () => setOpen(false);
+    const closeOnScroll = (event: Event) => {
+      // Issue #119: the capture-phase listener also sees scrolls raised inside
+      // the portaled list, which is itself a scroll container. Only outside
+      // scrolls detach the fixed panel from its trigger.
+      if (!shouldDismissOnScroll(event, listRef.current)) return;
+      setOpen(false);
+    };
+    window.addEventListener("resize", close);
+    window.addEventListener("scroll", closeOnScroll, true);
     return () => {
       window.removeEventListener("resize", close);
-      window.removeEventListener("scroll", close, true);
+      window.removeEventListener("scroll", closeOnScroll, true);
     };
   }, [portal, open]);
```

`listRef`는 이미 `Select` 안에 존재하고 포털 목록 `<ul>`에 붙어 있다(`Select.tsx:270-274`).
새 ref는 필요 없다.

`resize`는 그대로 무조건 닫는다. 창 크기 변경은 항상 위치를 무효화하기 때문이다.

## 변경 3 — NEW `tests/portal-dropdown-scroll-dismiss-contract.test.ts`

두 층으로 검증한다.

A. **순수 판정 단위 테스트 (보조)** — `shouldDismissOnScroll`을 실제 호출해 경계 조건을
고정한다. 판정 로직의 정확성만 증명하며, 컴포넌트 배선은 증명하지 않는다.

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { shouldDismissOnScroll } from "../ui/src/lib/portalDismiss.ts";

const makeMenu = (owned: object[]) => ({
  contains: (node: Node) => owned.includes(node as unknown as object),
});

test("scroll raised inside the portaled list keeps the menu open", () => {
  const inner = { nodeType: 1 };
  const menu = makeMenu([inner]);
  assert.equal(shouldDismissOnScroll({ target: inner } as never, menu), false);
});

test("scroll raised outside the menu still dismisses it", () => {
  const outside = { nodeType: 1 };
  const menu = makeMenu([{ nodeType: 1 }]);
  assert.equal(shouldDismissOnScroll({ target: outside } as never, menu), true);
});

test("a missing menu ref or missing event falls back to dismissing", () => {
  assert.equal(shouldDismissOnScroll(undefined, null), true);
  assert.equal(shouldDismissOnScroll({ target: { nodeType: 1 } } as never, null), true);
});
```

B. **배선 층 (정적, 보조)** — 컴포넌트가 가드된 핸들러를 캡처 단계에 등록하는지 고정한다.
정적 검사이므로 단독으로는 활성화 증거가 아니다. 향후 리팩터링이 배선을 되돌리는 것을
막는 회귀 방지용이다.

```ts
const select = readFileSync("ui/src/components/controls/Select.tsx", "utf8");

test("the portaled Select registers the guarded scroll handler", () => {
  assert.match(select, /shouldDismissOnScroll\(event, listRef\.current\)/);
  assert.match(select, /addEventListener\("scroll", closeOnScroll, true\)/);
  assert.match(select, /removeEventListener\("scroll", closeOnScroll, true\)/);
  assert.doesNotMatch(select, /addEventListener\("scroll", close, true\)/);
});
```

## 활성화 시나리오 (C-ACTIVATION-GROUNDING-01)

활성화 증거는 **실행 중인 브라우저에서의 관측**이다. 도구는 `agbrowse`(로컬 Chrome/CDP).

### 실행 경계 (STRICT)

baseline 관측과 patched 관측은 **서로 다른 번들을 띄운 별개의 서버 수명주기**여야 한다.
한 서버를 계속 띄운 채 두 관측을 하면 stale 번들을 patched라고 오판한다.

```
[1] baseline 빌드 → 격리 서버 기동 → baseline 관측 → 서버 종료 확인
[2] 코드 수정 → ui 재빌드 → 격리 서버 재기동 → patched 관측 → teardown
```

`node bin/ima2.js serve`는 싱글톤 가드가 있어 이미 떠 있는 서버를 발견하면 **새 코드를
실행하지 않고 즉시 반환한다**(`bin/ima2.js:176-192`). 따라서 검증에는 사용하지 않고,
격리 환경변수와 함께 `node server.js`를 직접 실행한다.

**선행 빌드 (필수).** `node server.js`는 `ui/dist`를 정적 서빙만 하고 자동 빌드하지 않는다
(`server.ts:228-251`). UI 자동 freshness 빌드는 `bin/ima2.js serve` 경로에만 있는데
우리는 그 경로를 우회한다. 게다가 `ui/dist/`는 gitignore 대상이라(`.gitignore:13`)
fresh worktree에는 존재하지 않는다. 따라서 매 단계 기동 전에 명시적으로 빌드한다:

```bash
npm --prefix ui ci          # 최초 1회
npm --prefix ui run build
npm run build:server
test -f ui/dist/index.html  # 없으면 여기서 중단
```

**격리 기동.** 사용자의 실제 설정/생성물/advertise 파일을 건드리지 않고, helper 자식
프로세스(OAuth 프록시, Grok 프록시)가 공유 포트에서 충돌하지 않도록 전부 끈다.
두 helper는 기본이 auto-start다(`config.ts:194-198`, `config.ts:308-312`).

```bash
IMA2_VERIFY_DIR="$(mktemp -d)"
IMA2_PORT=13399 \
IMA2_CONFIG_DIR="$IMA2_VERIFY_DIR/config" \
IMA2_GENERATED_DIR="$IMA2_VERIFY_DIR/generated" \
IMA2_ADVERTISE_FILE="$IMA2_VERIFY_DIR/server.json" \
IMA2_NO_OAUTH_PROXY=1 \
IMA2_NO_GROK_PROXY=1 \
node server.js
```

기동 확인: `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:13399/` 가 `200`.

**teardown (필수).** 서버 PID(또는 background exec session)를 기록하고 SIGINT로 종료한 뒤
포트가 닫혔는지 확인한다. baseline과 patched 양쪽 모두 같은 선빌드·격리·teardown 절차를
거친다.

```bash
kill -INT <PID>
curl -s http://127.0.0.1:13399/ ; # ECONNREFUSED 여야 함
```

임시 디렉터리는 검증 후 정리한다. `$IMA2_VERIFY_DIR`만 대상으로 하며,
홈 디렉터리나 저장소 경로를 대상으로 삼지 않는다.

### 관측 절차

```bash
agbrowse doctor
agbrowse start --headed
agbrowse navigate http://127.0.0.1:13399
agbrowse resize 1280 720
agbrowse snapshot --interactive          # 트리거 ref 확보
agbrowse click <ref>                     # #sidebar-generation-model 열기
agbrowse evaluate '<아래 스크립트>'
agbrowse screenshot
agbrowse stop
```

**스크롤 가능성 선확인** — 목록이 실제로 스크롤되지 않으면 관측 자체가 무의미하다.
포털 목록의 높이는 CSS의 260px이 아니라 인라인 `menuPos.maxHeight`(최대 420px,
`Select.tsx:166-180,275-281`)가 우선한다. 따라서 고정 픽셀 기준 대신 실제 값으로 판정한다:

```js
const ul = document.querySelector("ul.ctl-select__list--portal");
({ scrollHeight: ul.scrollHeight, clientHeight: ul.clientHeight });
// scrollHeight > clientHeight 여야 함. 아니면 뷰포트 높이를 줄여
// (agbrowse resize 1280 480) maxHeight를 낮춘 뒤 재확인한다.
```

**이벤트 발생과 읽기를 반드시 분리한다 (STRICT).**
`dispatchEvent()`는 핸들러를 동기 실행하지만, 핸들러 안의 `setOpen(false)`는 React state
업데이트라 DOM 커밋은 그 JavaScript 작업이 끝난 뒤에 일어난다(React 19 자동 배칭).
따라서 같은 `evaluate` 안에서 dispatch 직후 `aria-expanded`를 읽으면 **커밋 전 값**을
읽을 수 있고, 다음처럼 결론이 뒤집힌다:

- baseline 내부 스크롤: 닫힐 예정인데 `"true"`로 읽혀 재현 실패로 오판
- 외부 스크롤: 닫힐 예정인데 `"true"`로 읽혀 #79 회귀로 오판
- patched 내부 스크롤: 가드가 없어도 `"true"`가 읽혀 위양성 통과

그래서 매 관측은 `evaluate(발생)` → `wait` → `evaluate(읽기)` 3단계로 나눈다.

**관측 1 — 내부 스크롤 (수정 후 유지되어야 함)**

```bash
agbrowse evaluate '
  const ul = document.querySelector("ul.ctl-select__list--portal");
  ul.scrollTop = 60;
  ul.dispatchEvent(new Event("scroll", { bubbles: false }));
  "dispatched";
'
agbrowse wait 150
agbrowse evaluate '({
  expanded: document.querySelector("#sidebar-generation-model")
    ?.getAttribute("aria-expanded"),
  listPresent: Boolean(document.querySelector("ul.ctl-select__list--portal")),
  scrollTop: document.querySelector("ul.ctl-select__list--portal")?.scrollTop,
})'
// 기대: expanded === "true" && listPresent === true && scrollTop > 0
```

`scrollTop`을 함께 읽는 이유는 스크롤이 실제로 일어났는지 확인하기 위해서다.
`scrollTop === 0`이면 통과해도 의미가 없다. `listPresent`는 메뉴가 언마운트되지 않았음을
이중으로 확인한다.

**관측 2 — 외부 스크롤 (회귀 감시)**

```bash
agbrowse evaluate '
  document.querySelector(".sidebar__scroll")
    .dispatchEvent(new Event("scroll", { bubbles: false }));
  "dispatched";
'
agbrowse wait 150
agbrowse evaluate '({
  expanded: document.querySelector("#sidebar-generation-model")
    ?.getAttribute("aria-expanded"),
  listPresent: Boolean(document.querySelector("ul.ctl-select__list--portal")),
})'
// 기대: expanded === "false" && listPresent === false
```

실패 시 이슈 #79(포털 패널이 트리거에서 분리)가 되살아난 것이다.

**baseline 관측**은 같은 3단계 절차를 수정 전 번들에서 실행해, 관측 1에서
`expanded === "false"`(그리고 목록 언마운트)가 나오는 것을 확인한다. 이 대조가 없으면
"고쳤다"는 주장이 무엇을 고쳤는지 증명하지 못한다.

### 기록

각 단계의 관측값과 스크린샷을 `011_activation_evidence.md`에 남긴다.
teardown(서버 종료, `agbrowse stop`) 영수증도 함께 기록한다.

## 검증 명령

새 테스트 파일을 추가하므로 인벤토리는 **검사 전에 재생성**해야 한다. `test:inventory`는
`--check` 전용이라 stale 상태에서 반드시 실패한다(`scripts/classify-tests.mjs:56-62`).

```
node scripts/refresh-structure-line-counts.mjs --check
node scripts/classify-tests.mjs
node --import tsx --test tests/portal-dropdown-scroll-dismiss-contract.test.ts
npm run typecheck
npm run typecheck:tests
npm run test:inventory
npm run build:server
npm run build:cli
npm --prefix ui run build
npm test
```

`structure/01-file-function-map.md`는 CI의 fast-fail 게이트이기도 하다
(`.github/workflows/ci.yml:48-49`). 파일 길이가 바뀌면 `npm run docs:refresh-line-counts`로
갱신한다.

## 롤백

단일 커밋. `git revert`로 되돌리면 `Select`는 이전의 무가드 close로 복귀한다.
새 파일 `portalDismiss.ts`는 다른 코드가 의존하지 않으므로 잔여 위험이 없다.

## 리스크

- `listRef`가 포털 목록이 아닌 다른 요소를 가리키게 되면 가드가 무력화된다.
  현재는 `<ul ref={listRef}>`가 유일한 목록 요소이므로 성립한다.
- 가드가 지나치게 넓으면 외부 스크롤에서도 안 닫히는 회귀가 생긴다.
  테스트 A의 두 번째 케이스와 활성화 시나리오의 "관측 2 — 외부 스크롤"이 이를 감시한다.
- `Select`는 스크롤 시 위치를 재계산하지 않고 닫는 설계다. 내부 스크롤에서 메뉴를 유지해도
  트리거 위치는 움직이지 않으므로 패널 분리가 생기지 않는다. 이 논리는 "관측 2 — 외부
  스크롤"로 고정한다.
