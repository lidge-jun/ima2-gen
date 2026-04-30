# 0.09.46 — Mobile classic layout breathing room (PLAN)

**Date:** 2026-04-28
**Status:** Plan — bundled with 0.09.45 (one PR, separate commits)

## STATUS 2026-04-30 — Partial

- Shipped: `549ad8f feat(mobile): add mobile UI shell with app bar, compose sheet, and settings toggle` covers the first app-bar/compose shell.
- Remains: #38 is still OPEN for the clearer mobile generate/compose flow; keep this folder in `_plan`.
**Parent:** [0.09.45 PLAN.md](../260428_0.09.45-mobile-ui-overhaul/PLAN.md)
**Closes:** Follow-up to #33; addresses INVESTIGATION.md gaps G3, G4, partial G8.

---

## Part 1 — Plain explanation

0.09.45가 우측 설정 드로어를 모바일에서 쓸 수 있게 만들고 나면, 다음 통증은 **좌측 사이드바가 화면 절반을 잡아먹는 것**입니다. 모바일에서 사이드바가 50dvh를 차지해서 캔버스가 절반밖에 안 보이고, 거기에 history-strip(과거 결과 가로 스크롤바)이 또 자리를 차지해요. 또 iOS Safari에서 키보드 올라오면 prompt composer 아래쪽이 잘립니다.

이 단계는 사이드바를 모바일에서 **상단 앱바(56px)**로 압축하고, 탭하면 바텀시트로 펼쳐지게 합니다. history-strip은 safe-area-inset-bottom 적용. iOS 키보드는 `visualViewport` API로 보정합니다.

데스크톱은 손 안 댑니다.

---

## Part 2 — Diff-level spec

### Goal
On phone viewports (≤800px): expose the full image canvas above the fold by collapsing the sidebar into a 56px top app bar with a "compose" entry that expands as a bottom sheet. Address iOS keyboard occlusion of the composer with `visualViewport`. History-strip respects safe-area.

### Non-goals
- Settings drawer (already done in 0.09.45).
- Modals / SettingsWorkspace nav (deferred → 0.09.47).
- Node mode / card-news (→ 0.09.48).
- Touch composer rewrite — keep existing `<textarea>` + GenerateButton.

### Acceptance criteria
- [ ] On 393×852 portrait: above-the-fold = top app bar (56px) + canvas. Sidebar invisible until summoned.
- [ ] App bar shows: ima2-gen logo, ImageModelSelect (compact), prompt-library entry, settings icon (= 0.09.45's `MobileSettingsToggle`), "compose" pill.
- [ ] Tapping "compose" pill opens a bottom sheet containing the full Sidebar contents (PromptComposer, ReferenceImages, GenerateButton, InFlightList, SessionPicker, UIModeSwitch).
- [ ] Bottom sheet has drag-handle affordance, dismissible by tap-outside or swipe-down (CSS-only swipe via overscroll-behavior — no gesture lib).
- [ ] iOS keyboard open + composer focused: composer + GenerateButton remain visible above the keyboard (uses `visualViewport.height` CSS var).
- [ ] HistoryStrip on mobile gets `padding-bottom: env(safe-area-inset-bottom)`.
- [ ] Desktop (≥801px): no app bar; sidebar renders as today.
- [ ] `prefers-reduced-motion: reduce`: bottom-sheet transitions disabled.
- [ ] tsc clean, build clean.

---

### File touch list

```text
ui/src/index.css                              # mobile @media block: app bar + bottom sheet styles
ui/src/App.tsx                                # data-mobile / data-ui-mode attrs + render <MobileAppBar /> + <MobileComposeSheet />
ui/src/components/Sidebar.tsx                 # extract <SidebarStack />; hidden on mobile via CSS
ui/src/components/MobileAppBar.tsx            # NEW — 56px app bar
ui/src/components/MobileComposeSheet.tsx      # NEW — bottom sheet hosting <SidebarStack />
ui/src/store/useAppStore.ts                   # composeSheetOpen + open/close actions slice
ui/src/hooks/useIsMobile.ts                   # NEW — shared (max-width: 800px) matchMedia hook
ui/src/hooks/useVisualViewportInset.ts        # NEW — CSS var for keyboard offset
ui/src/i18n/ko.json                           # appBar.compose / sheet.close labels
ui/src/i18n/en.json                           # appBar.compose / sheet.close labels
```

**10 files; 4 new components/hooks** (+`useIsMobile` from A-audit). No new runtime deps.

> Note: `ui/src/components/HistoryStrip.tsx` was previously listed but the safe-area inset is CSS-only — no JSX change needed. Removed from touch list.

---

### Hidden traps (HT-46)

| ID    | Trap | Action |
|-------|------|--------|
| HT-46-1 | `Sidebar` content includes `PromptComposer` which already binds focus + paste handlers. Re-mounting it inside a sheet must preserve store state | The Sidebar contents (PromptComposer + GenerateButton + ...) are extracted into `<SidebarStack />` consumed by both `<Sidebar />` (desktop) and `<MobileComposeSheet />` (mobile). Single store-bound subtree. |
| HT-46-2 | iOS Safari `100vh` ≠ visible viewport when keyboard up | Use `visualViewport` API + CSS var `--vv-h: <px>` on `<html>`; bottom sheet uses `max-height: var(--vv-h, 100dvh)`. |
| HT-46-3 | Bottom sheet over canvas may conflict with React Flow node-mode pan-gestures | Render `<MobileComposeSheet />` only when `uiMode === "classic"`. Node-mode keeps existing sidebar (its own concern → 0.09.48). |
| HT-46-4 | `app--history-horizontal` / `app--history-sidebar` modifiers from `App.tsx:97-101` interact with mobile `grid-template-columns: 1fr` | Existing mobile rule already flattens both modifiers (`index.css:3017-3033`). Verify; do not touch. |
| HT-46-5 | App bar height eats vertical space on landscape phone | App bar collapses to 48px in `(max-width: 800px) and (orientation: landscape)`. |
| HT-46-6 | Drag-to-dismiss without gesture lib | Use `overscroll-behavior: contain` + tap-outside-backdrop. No swipe gesture in this PR; document in non-goals. |

---

### Pseudo-diff plan

#### 1. `ui/src/components/MobileAppBar.tsx` (NEW)

```tsx
import { useAppStore } from "../store/useAppStore";
import { ImageModelSelect } from "./ImageModelSelect";
import { useI18n } from "../i18n";
import { useIsMobile } from "../hooks/useIsMobile";

export function MobileAppBar() {
  const { t } = useI18n();
  const togglePromptLibrary = useAppStore((s) => s.togglePromptLibrary);
  const openComposeSheet = useAppStore((s) => s.openComposeSheet);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const uiMode = useAppStore((s) => s.uiMode);
  const isMobile = useIsMobile();

  if (!isMobile || settingsOpen || uiMode !== "classic") return null;

  return (
    <header className="mobile-app-bar" role="banner">
      <div className="mobile-app-bar__brand">
        <div className="logo-mark" aria-hidden="true" />
        <span className="mobile-app-bar__title">ima2-gen</span>
      </div>
      <div className="mobile-app-bar__actions">
        {/* A-audit: ImageModelSelect currently supports "sidebar"/"settings" only.
            Either add a new "compact" variant in this PR, or reuse "sidebar" + scope-down with CSS. Decision: reuse "sidebar" — no component API change needed. */}
        <ImageModelSelect variant="sidebar" />
        <button
          type="button"
          className="mobile-app-bar__compose"
          onClick={openComposeSheet}
          aria-label={t("appBar.compose")}
        >
          {t("appBar.compose")}
        </button>
      </div>
    </header>
  );
}
```

#### 2. `ui/src/components/MobileComposeSheet.tsx` (NEW)

Hosts a refactored `<SidebarStack />` (extracted from `Sidebar.tsx`). Renders as fixed bottom sheet. Backdrop dismiss + close button.

```tsx
export function MobileComposeSheet() {
  const open = useAppStore((s) => s.composeSheetOpen);
  const close = useAppStore((s) => s.closeComposeSheet);
  // ...
  if (!isMobile || uiMode !== "classic") return null;
  return (
    <>
      {open && <div className="compose-sheet-backdrop" onClick={close} />}
      <section
        className={`compose-sheet${open ? " compose-sheet--open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={t("sheet.compose")}
      >
        <button className="compose-sheet__handle" onClick={close} aria-label={t("sheet.close")} />
        <div className="compose-sheet__body">
          <SidebarStack />
        </div>
      </section>
    </>
  );
}
```

#### 3. `ui/src/components/Sidebar.tsx` — extract `<SidebarStack />`

```diff
- export function Sidebar() {
-   ...
-   return (
-     <aside className="sidebar">
-       <div className="sidebar__scroll">
-         {/* logo + composer + generate + ... */}
-       </div>
-     </aside>
-   );
- }
+ export function SidebarStack() {
+   /* same JSX body, no <aside> wrapper */
+ }
+ export function Sidebar() {
+   return (
+     <aside className="sidebar">
+       <div className="sidebar__scroll">
+         <SidebarStack />
+       </div>
+     </aside>
+   );
+ }
```

#### 4. `ui/src/App.tsx`

```diff
+ import { MobileAppBar } from "./components/MobileAppBar";
+ import { MobileComposeSheet } from "./components/MobileComposeSheet";
  ...
        <Sidebar />
+       <MobileAppBar />
        <HistoryStrip />
        ...
+       <MobileComposeSheet />
        <MobileSettingsToggle />
```

#### 5. `ui/src/store/useAppStore.ts` (extend slice)

```diff
+ composeSheetOpen: boolean;
+ openComposeSheet: () => void;
+ closeComposeSheet: () => void;
```

Initial value `false`. Two setters. No persistence.

#### 6. `ui/src/hooks/useVisualViewportInset.ts` (NEW)

```ts
import { useEffect } from "react";

export function useVisualViewportInset() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const apply = () => {
      const h = Math.round(vv.height);
      document.documentElement.style.setProperty("--vv-h", `${h}px`);
      const offsetTop = Math.round(vv.offsetTop);
      document.documentElement.style.setProperty("--vv-offset-top", `${offsetTop}px`);
    };
    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
    };
  }, []);
}
```

Mounted via single `useEffect` in `App.tsx` (or `main.tsx`).

#### 7. `ui/src/index.css` — mobile rules (additions to `@media (max-width: 800px)`)

```css
  /* Hide desktop sidebar on mobile classic mode (single deterministic selector — A-audit fix).
     Relies on data-mobile + data-ui-mode being set on `.app` in App.tsx. */
  .app[data-mobile="1"][data-ui-mode="classic"] .sidebar { display: none; }

  .mobile-app-bar {
    position: sticky;
    top: 0;
    height: calc(56px + env(safe-area-inset-top));
    padding: env(safe-area-inset-top) 12px 0 12px;
    background: color-mix(in srgb, var(--surface) 96%, transparent);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    z-index: 30;
  }
  .mobile-app-bar__brand { display: flex; align-items: center; gap: 8px; }
  .mobile-app-bar__title { font-weight: 700; font-size: 14px; }
  .mobile-app-bar__actions { display: flex; align-items: center; gap: 8px; }
  .mobile-app-bar__compose {
    min-height: 44px;
    padding: 0 16px;
    border-radius: 999px;
    border: 1px solid var(--accent);
    background: var(--accent-bright);
    color: var(--accent-ink);
    font-weight: 600;
    font-size: 13px;
  }

  /* Bottom sheet */
  .compose-sheet {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    max-height: min(75dvh, var(--vv-h, 100dvh));
    transform: translateY(100%);
    transition: transform 220ms ease;
    background: var(--surface);
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -10px 40px var(--shadow-strong);
    z-index: 55;
    display: flex;
    flex-direction: column;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .compose-sheet--open { transform: translateY(0); }
  .compose-sheet__handle {
    width: 44px; height: 6px;
    margin: 10px auto 6px;
    background: var(--border-strong);
    border-radius: 3px;
    border: 0;
    cursor: grab;
  }
  .compose-sheet__body {
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 8px 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .compose-sheet-backdrop {
    position: fixed;
    inset: 0;
    background: var(--scrim);
    backdrop-filter: blur(2px);
    z-index: 50;
  }

  /* HistoryStrip safe-area */
  .history-strip {
    padding-bottom: calc(10px + env(safe-area-inset-bottom));
  }

  /* Landscape app bar shrink */
  @media (orientation: landscape) {
    .mobile-app-bar { height: calc(48px + env(safe-area-inset-top)); }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .compose-sheet { transition: none; }
  }
```

App.tsx changes (single source of truth for sidebar-hide selector):
- Add `data-mobile={isMobile ? "1" : undefined}` to `<div class="app">`. Currently `App.tsx:96-105` has `data-theme-mode`, `data-theme-family`, `data-history-strip-layout` — add `data-mobile` and `data-ui-mode` alongside.
- The CSS rule above (`.app[data-mobile="1"][data-ui-mode="classic"] .sidebar`) handles the rest.

```diff
+ import { useIsMobile } from "./hooks/useIsMobile";
  ...
+ const isMobile = useIsMobile();
  ...
  <div
    className={`app${...}`}
    data-theme-mode={resolvedTheme}
    data-theme-family={themeFamily}
    data-history-strip-layout={historyStripLayout}
+   data-mobile={isMobile ? "1" : undefined}
+   data-ui-mode={uiMode}
  >
```

**`useIsMobile` hook (decision: extract to shared file, added in commit 46.0):** all new mobile components (`MobileSettingsToggle`, `MobileAppBar`, `MobileComposeSheet`) and the App.tsx attribute setter use it. Existing `RightPanel.tsx` retains its inline matchMedia for now (refactor to the hook is optional and can land in 46.1 alongside the SidebarStack extract).

```ts
// ui/src/hooks/useIsMobile.ts (NEW — included in commit 46.0)
import { useEffect, useState } from "react";

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 800px)").matches
      : false,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 800px)");
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}
```

`MobileSettingsToggle` (0.09.45) is updated in commit 46.0 to import this hook instead of its own matchMedia (small cleanup; both versions work but consistency wins).

#### 8. `ui/index.html`

Already updated by 0.09.45 (`viewport-fit=cover, interactive-widget=resizes-content`). No further change.

#### 9. i18n additions

```json
{
  "appBar": { "compose": "작성", "openSettings": "설정" },
  "sheet": { "compose": "프롬프트 작성", "close": "닫기" }
}
```

en.json: `"compose": "Compose"`, `"openSettings": "Settings"`, `"close": "Close"`.

---

### Implementation order (commits 46.x)

1. **46.0** — `feat(ui): useIsMobile hook + App.tsx data-mobile/data-ui-mode attrs` — small hook + App.tsx attribute additions. Used by 0.09.45 toggle too.
2. **46.1** — `feat(ui): extract SidebarStack from Sidebar` — refactor only, no behavior change, desktop unchanged.
3. **46.2** — `feat(store): composeSheetOpen + setters` — store slice.
4. **46.3** — `feat(ui): useVisualViewportInset hook + mount` — hook + App.tsx effect.
5. **46.4** — `feat(ui): MobileAppBar + MobileComposeSheet components` — new files + App.tsx mount.
6. **46.5** — `feat(ui): mobile classic layout CSS (app bar + sheet + history safe-area)` — index.css.
7. **46.6** — `i18n(ui): app-bar/sheet copy` — ko.json + en.json.

---

### Verification matrix

| # | Area | Viewport | Verify |
|---|------|----------|--------|
| V46-1 | Desktop regression | 1440×900 | Sidebar identical to today, no app bar |
| V46-2 | iPhone SE portrait | 375×667 | App bar visible, canvas fills below, sheet opens on Compose tap |
| V46-3 | iPhone 14 portrait | 393×852 | Top safe-area honored, sheet bottom safe-area honored |
| V46-4 | Landscape | 844×390 | App bar 48px, sheet max-height ≤75dvh, both fit |
| V46-5 | iOS keyboard | Real iOS Safari + composer in sheet focused | Composer + GenerateButton stay visible (visualViewport CSS var) |
| V46-6 | iPad portrait 768 | 768×1024 | Mobile layout (app bar + sheet) renders correctly |
| V46-7 | iPad portrait 801 | 801×1024 | Desktop layout, no app bar |
| V46-8 | A11y | Sheet open | Focus trapped, Esc closes, restored to invoking button |
| V46-9 | Reduced motion | macOS pref | Sheet snap (no slide) |
| V46-10 | Locale | KO + EN | "작성"/"Compose" both fit on small phones |
| V46-11 | Theme | Dark + light | App bar contrast, sheet handle visible |
| V46-12 | Node-mode + card-news | Mobile | App bar/sheet **don't render**; existing sidebar shows |

---

### Rollback plan
- Revert 46.4 + 46.5 → app bar / sheet disappear; sidebar reappears on mobile (back to 0.09.45 behavior). Other commits (extract, hook, store) are dormant if app bar is removed.
