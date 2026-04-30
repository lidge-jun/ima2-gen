# 0.09.48 — Mobile node-mode + card-news audit (PLAN)

**Date:** 2026-04-28
**Status:** Plan — bundled with 0.09.45 (one PR, separate commits)

## STATUS 2026-04-30 — Partial

- Shipped: `549ad8f feat(mobile): add mobile UI shell with app bar, compose sheet, and settings toggle` gives the shared mobile shell this work depends on.
- Remains: node/card-news-specific mobile CSS and test coverage are still open; keep this folder in `_plan`.
**Parent:** [0.09.45 PLAN.md](./PHASE-45-ui-overhaul.md)
**Closes:** Final follow-up to #33; addresses INVESTIGATION.md gap G7.

---

## Part 1 — Plain explanation

ima2-gen은 **classic / node / card-news** 세 가지 UI 모드를 가지고 있습니다. 0.09.45/46/47은 classic 모드 위주였어요. node 모드는 React Flow 기반 노드 캔버스라 모바일에서 핀치 줌 같은 기본 제스처는 됩니다. 그런데 떠다니는 패널들 (NodeBatchBar, MultimodeSequencePreview, mini-map)이 모바일 폭 (390px) 에서 서로 겹칩니다. card-news 모드는 모바일 룰이 0개입니다.

이 단계는 두 모드의 모바일 사용성을 **최소한으로 정상화**합니다 — 풀 리디자인이 아닙니다. 노드 모드는 PC 위주 워크플로이고, card-news는 가로형 인포그래픽 작성 도구라 본질적으로 폰 친화적이지 않아요. 그래서 "안 깨지게만" 합니다.

---

## Part 2 — Diff-level spec

### Goal
On phone viewports (≤800px) for `uiMode === "node"` and `uiMode === "card-news"`: prevent broken UI. Floating panels reflow / dismissable. Card-news grid stops overflowing horizontally.

### Non-goals
- Phone-first node-mode redesign.
- Card-news authoring on phones (it remains tablet+ recommended).
- Touch gesture rewriting for React Flow (use library defaults).
- Backend / API.

### Acceptance criteria
- [ ] Node mode at 393×852: minimap and NodeBatchBar do not overlap or escape viewport.
- [ ] Node mode floating panels (MultimodeSequencePreview, others) reflow to bottom and have dismiss/collapse on mobile.
- [ ] Card-news at 393×852: workspace doesn't overflow horizontally; nav controls reachable; recommend desktop via a one-time mobile notice (dismissable).
- [ ] Both modes still render the `<MobileSettingsToggle />` (from 0.09.45) — confirmed not blocked.
- [ ] React Flow pan/zoom not regressed on desktop.
- [ ] tsc clean, build clean.

---

### File touch list

```text
ui/src/index.css                                       # node-mode + card-news mobile rules (A-audit: existing node CSS lives here at 3262-3301; card-news classes also indexed here; styles/canvas-mode.css is for canvas-mode shell only — keep node mobile rules in index.css for consistency)
ui/src/components/NodeCanvas.tsx                       # conditional <MiniMap />; verify React Flow touch defaults (A-audit: actual path, not under canvas-mode/)
ui/src/components/NodeBatchBar.tsx                     # mobile-only flex-wrap class hooks if needed (A-audit: actual path)
ui/src/components/MultimodeSequencePreview.tsx          # CSS-only mobile via existing .multimode-sequence class (A-audit: NOT .multimode-sequence-preview)
ui/src/components/card-news/CardNewsWorkspace.tsx      # mobile notice banner JSX
ui/src/i18n/ko.json                                    # mobile.cardNewsBanner copy
ui/src/i18n/en.json                                    # mobile.cardNewsBanner copy
```

**7 files; 0 new components.** No new deps.

> A-audit corrections applied: (1) all node-mode component paths are at `ui/src/components/` directly, NOT under `canvas-mode/`. (2) Multimode actual class is `.multimode-sequence`. (3) Card-news has no separate `.css` file — its rules live in `ui/src/index.css`. (4) Node-mode CSS belongs in `index.css` next to existing node-mode rules at lines 3262-3301.

---

### Hidden traps (HT-48)

| ID | Trap | Action |
|----|------|--------|
| HT-48-1 | React Flow `pan-on-drag` vs single-finger scroll on mobile | React Flow auto-detects `touches.length`. Test pan + pinch zoom on real iOS; if regressed, set `panOnDrag={false}; zoomOnPinch={true}` for mobile only. |
| HT-48-2 | `MobileSettingsToggle` may overlap floating node-mode panels at top-right | Floating panels use top-left or bottom-right; verify no z-index/position collision. Toggle z=55 (A-audit), RF panels typically z=4-5. |
| HT-48-3 | Card-news has hardcoded grid widths that compute via JS | If grid is JS-driven, CSS @media won't help; will need to thread a `isMobile` prop. Decide during audit. |
| HT-48-4 | Mode switch (UIModeSwitch) — switching to card-news on mobile right now is broken UX | Show a toast "Card-news works best on desktop" the first time a user enters card-news on mobile. localStorage key `ima2:cardNewsMobileNoticeShown`. |
| HT-48-5 | Node-mode minimap takes ~120×120px — at 390px viewport this is 30% of screen | Hide minimap on mobile. React Flow `<MiniMap pannable={false} />` → conditional render `!isMobile && <MiniMap />`. |

---

### Pseudo-diff plan

#### 1. `ui/src/index.css` — extend existing `@media (max-width: 800px)` block (A-audit: not canvas-mode.css)

```css
  /* Node-mode minimap hidden (consumes 30% of viewport on phone) */
  .node-canvas .react-flow__minimap { display: none; }

  /* NodeBatchBar collapsed */
  .node-batch-bar {
    bottom: calc(8px + env(safe-area-inset-bottom));
    left: 8px;
    right: 8px;
    max-width: none;
    flex-wrap: wrap;
    gap: 6px;
  }
  .node-batch-bar > * { min-height: 40px; }

  /* Multimode preview as bottom sheet (A-audit: actual class is .multimode-sequence) */
  .multimode-sequence {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    max-height: 50dvh;
    border-radius: 16px 16px 0 0;
    overflow-y: auto;
    box-shadow: 0 -10px 40px var(--shadow-strong);
  }

  /* Floating React Flow controls */
  .node-canvas .react-flow__controls {
    bottom: calc(80px + env(safe-area-inset-bottom));
    right: 8px;
  }
```

#### 2. `ui/src/components/NodeCanvas.tsx` (A-audit: actual path)

The wrapper element is `<main className="node-canvas">` (A-audit). Use the shared `useIsMobile` hook from 0.09.46.

```diff
+ import { useIsMobile } from "../hooks/useIsMobile";
  ...
+ const isMobile = useIsMobile();
  ...
  return (
    <main className="node-canvas">
      <ReactFlow
        ...
+       /* React Flow defaults handle touch pan/pinch reasonably; no prop override unless V48-6 finds regression. */
      >
-       <MiniMap />
+       {!isMobile && <MiniMap />}
        <Controls />
      </ReactFlow>
    </main>
  );
```

`<MiniMap />` import is already present (A-audit confirmed `NodeCanvas.tsx:1-17`). Conditional render only.

#### 3. `ui/src/components/card-news/CardNewsWorkspace.tsx`

```diff
+ import { useEffect, useState } from "react";
+ const NOTICE_KEY = "ima2:cardNewsMobileNoticeShown";
  ...
  function CardNewsMobileNotice() {
    const { t } = useI18n();
    const [show, setShow] = useState(() => {
      if (typeof window === "undefined") return false;
      if (window.matchMedia("(max-width: 800px)").matches === false) return false;
      return localStorage.getItem(NOTICE_KEY) !== "1";
    });
    if (!show) return null;
    return (
      <div className="card-news-mobile-notice" role="status">
        <span>{t("mobile.cardNewsBanner")}</span>
        <button onClick={() => { localStorage.setItem(NOTICE_KEY, "1"); setShow(false); }}>
          {t("mobile.dismiss")}
        </button>
      </div>
    );
  }
```

Mount at top of `CardNewsWorkspace`. CSS:

```css
@media (max-width: 800px) {
  .card-news-mobile-notice {
    margin: 8px 12px;
    padding: 10px 12px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }
  .card-news-mobile-notice button { min-height: 36px; }

  /* card-news grid horizontal-overflow stop */
  .card-news-workspace { overflow-x: auto; }
  .card-news-workspace__grid {
    grid-template-columns: minmax(0, 1fr) !important;
    gap: 12px;
  }
}
```

(`!important` only because card-news may have inline-style widths from drag-resize state; clean during audit.)

#### 4. i18n

```json
{
  "mobile": {
    "cardNewsBanner": "카드뉴스 모드는 데스크톱에서 가장 잘 동작해요.",
    "dismiss": "닫기"
  }
}
```

en.json: `"cardNewsBanner": "Card-news mode works best on desktop."`, `"dismiss": "Dismiss"`.

---

### Implementation order

1. **48.1** — `fix(ui): node-mode mobile floating panels + minimap hide`
2. **48.2** — `fix(ui): React Flow touch behavior verified on mobile`
3. **48.3** — `feat(ui): card-news mobile notice banner`
4. **48.4** — `fix(ui): card-news mobile grid stop horizontal overflow`

---

### Verification matrix

| # | Area | Viewport | Verify |
|---|------|----------|--------|
| V48-1 | Desktop regression | 1440×900 | Node mode + card-news identical to today |
| V48-2 | Node mode mobile | 393×852 | Minimap hidden, batch bar fits, controls reachable, pan/zoom works |
| V48-3 | Node mode landscape | 844×390 | Floating panels don't overlap |
| V48-4 | Card-news mobile | 393×852 | Banner shows once, grid doesn't overflow horizontally |
| V48-5 | Card-news banner persistence | After dismiss + reload | Banner does not re-show |
| V48-6 | Touch gesture | iPhone Safari real device | RF pinch-zoom + pan work, no scroll-conflict |
| V48-7 | Theme | Dark + light | Banner visible, contrast ok |
| V48-8 | Locale | KO + EN | Banner copy fits |
| V48-9 | Mode switch | classic → node → card-news on mobile | All transitions clean, no errors |

---

### Rollback plan
Each commit (48.1 – 48.4) revertable. Worst case revert all → node and card-news back to current "broken on mobile" state, but other modes (classic, settings) remain fixed by 0.09.45/46/47.

---

## Important caveat

This phase is **necessarily lighter** than 0.09.45-47 because:
1. Issue #33 was filed about classic-mode generation controls. 0.09.45 alone closes it.
2. Node mode is a power-user feature; phones aren't its target.
3. Card-news authoring on phones isn't a real workflow.

If A-phase audit finds significant scope creep here, reduce to:
- Commit 48.1 (node-mode floating panel fix)
- Commit 48.3 (card-news banner only)

…and defer 48.2 + 48.4 to a later issue.
