# 010 — Phase 1: Frame Foundation — Rail Default + Top-Bar Contract + Grid

Goal: establish the frame every later phase depends on. The 64px session
thumbnail rail becomes the ONLY desktop session UI; the app grid drops
the 260px expanded-sidebar column; the top bar becomes reachable on all
non-desktop layouts; the drawer is the sole management surface; the
model pill renders exactly once. No stage work in this phase — the body
keeps chat + `AgentRightSidebar` (both desktop and tablet) so the phase
closes independently verifiable.

## File change map

| Action | Path |
|--------|------|
| MODIFY | `ui/src/components/agent/AgentWorkspace.tsx` |
| MODIFY | `ui/src/components/agent/AgentSessionRail.tsx` |
| MODIFY | `ui/src/components/agent/AgentSessionSidebar.tsx` (strip `AgentPanePreference` component + its usage; keep file compiling — deletion is Phase 3) |
| MODIFY | `ui/src/styles/agent-workspace.css` |
| MODIFY | `ui/src/styles/agent-workspace-sidebar.css` (rail thumb spec §3d) |
| MODIFY | `ui/src/store/persistenceRegistry.ts` (comment only) |
| MODIFY | `tests/agent-mode-layout-contract.test.js` |
| MODIFY | `tests/agent-mode-frontend-contract.test.js` |
| MODIFY | `tests/agent-mode-right-sidebar-contract.test.js` |

## 1. `AgentWorkspace.tsx`

### 1a. Rail default

Before (`:257`):
```tsx
const useSessionRail = layoutMode === "desktop-three-pane" && panePreference === "rail";
```
After:
```tsx
const useSessionRail = layoutMode === "desktop-three-pane" || layoutMode === "desktop-rail";
```

### 1b. Remove pane preference

DELETE: `panePreference` state (`:151-153`), `changePanePreference`
(`:259-261`), the `AgentPanePreference` import and both render sites
(rail-wrap `:421` and sidebar props `:435-436`), the
`AGENT_PANE_PREFERENCE_STORAGE_KEY` import, AND the now-unused
`AgentSessionSidebar` import (noUnusedLocals is on — leftover imports
fail typecheck). In `AgentSessionSidebar.tsx`, deleting
`AgentPanePreference` also orphans its `MenuIcon` import — remove it,
and drop the dead `panePreference`/`onPanePreferenceChange` Props
fields. The expanded
`<AgentSessionSidebar>` else-branch is DELETED entirely — desktop
renders the rail wrap unconditionally:

```tsx
{useSessionRail ? (
  <div className="agent-session-rail-wrap">
    <AgentSessionRail sessions={workspace.sessions} selectedId={selectedSessionId ?? ""}
      imagesById={workspace.imagesById} runSummaryBySession={workspace.runSummaryBySession}
      onCreate={createSession} onSelect={selectSession} onOpenDrawer={() => setDrawerOpen(true)} />
  </div>
) : null}
```

(the rail-wrap's 36px preference row shrinks: CSS §3c.)

### 1c. Top-bar visibility (audit Blocker 1, round-2 refinement)

Before (`:256`):
```tsx
const showAgentTopBar = isMobile && layoutMode !== "desktop-three-pane";
```
After:
```tsx
const showAgentTopBar = layoutMode === "tablet-stacked" || layoutMode === "mobile-chat-image-sheet";
```

`AgentTopBar` itself is UNCHANGED (not in the file map): its
image/queue action cluster stays gated on
`layoutMode === "mobile-chat-image-sheet"` (LOCKED — tablet keeps the
persistent right column with Image/Queue tabs, so duplicated top-bar
actions would violate the single-source rule; tablet needs only the ≡
drawer trigger, which the bar always renders).

`isMobile` usage check: after 1c, `rg -n "isMobile" AgentWorkspace.tsx`
— remaining consumers (if only the topbar used it, delete the
`useIsMobile` import + call; current code has exactly one use at `:256`,
so DELETE both).

## 2. `AgentSessionRail.tsx` — variant A spec

Before: buttons carry `title={session.title}` only.

After (LOCKED to required `session.imageCount` + existing
`agent.imageCount` key — no new props/keys):
```tsx
const label = `${session.title} — ${t("agent.imageCount", { count: session.imageCount })}`;
<button key={session.id} type="button"
  className={session.id === selectedId ? "is-active" : ""}
  onClick={() => onSelect(session.id)}
  title={label} aria-label={label}
  aria-current={session.id === selectedId ? "true" : undefined}>
```

## 3. CSS — `agent-workspace.css`

### 3a. App grid (`:21`)

Before: `grid-template-columns: 260px minmax(0, 1fr);`
After: `grid-template-columns: 64px minmax(0, 1fr);`
applied to `.agent-workspace--desktop-three-pane` and
`.agent-workspace--desktop-rail` (the existing `--session-rail` modifier
block at `:68` becomes the base desktop rule; drop the modifier class
from the TSX template string since rail is unconditional — the
`agent-workspace--session-rail` class and its rule are DELETED).

### 3b. Non-desktop grid

`tablet-stacked`/mobile: single column `minmax(0, 1fr)` with
`grid-template-rows: auto minmax(0, 1fr)` (top bar row + body) — this is
the EXISTING `:44` rule (`.agent-workspace:not(.agent-workspace--desktop-three-pane)`);
amend its selector to target only tablet/mobile modifiers now that
desktop-rail also skips the sidebar:
```css
.agent-workspace--tablet-stacked,
.agent-workspace--mobile-chat-image-sheet {
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
}
.agent-workspace--tablet-stacked .agent-workspace__body,
.agent-workspace--mobile-chat-image-sheet .agent-workspace__body {
  grid-column: 1;
  grid-row: 2;
}
```

(round-3 Blocker 1: the body's base rule is `grid-column: 2; grid-row: 1`
at `:53`; without the explicit tablet override the single-column grid
creates an implicit second column. The mobile-specific body rule already
does this — the new rule generalizes it to both non-desktop modes.)
Desktop placement is unchanged: after 3a the desktop grid is
`64px minmax(0,1fr)` with the rail wrap in column 1 and the body keeping
its base `grid-column: 2; grid-row: 1`. The `.agent-session-sidebar`
grid-placement rule (`:48-51`) is DELETED (component unmounted).

### 3c. Rail wrap

`:76` `grid-template-rows: 36px minmax(0, 1fr);` →
`grid-template-rows: minmax(0, 1fr);` (preference toggle gone).
Rail column: `overflow-y: auto;` on `.agent-rail__sessions` (verify
present; add if missing), scrollbar-width none, never collapse.

### 3d. Rail thumb spec (variant A lock — `agent-workspace-sidebar.css`)

Rail geometry (round-3 Blocker 5): the 64px rail has 10px padding, so
`.agent-rail__sessions` is exactly 44px wide with `overflow-y: auto` —
an OUTWARD 2px ring on a 44px thumb would clip at the scroller edge.
LOCKED: thumbs shrink to 40px inside the 44px track and the ring is
INSET-safe:

```css
.agent-rail__sessions > button {
  width: 40px; height: 40px;
  margin: 0 auto;
  border-radius: 10px;
  overflow: hidden;
}
.agent-rail__sessions > button.is-active {
  border-color: var(--agent-rail-ring, #f5f5f7);
  box-shadow: inset 0 0 0 2px var(--agent-rail-ring, #f5f5f7);
}
```

Geometry (round-5 residual 1): the rail-wrap carries a 1px right
border, so the internal track is ~43px, not 44px. The ring is therefore
a TRUE INSET shadow (keyword `inset`) drawn inside the 40px button —
zero outward growth, no clip at any scrollbar mode. The white
border-color doubles the marker at the box edge.
The existing active rule sets `border-color: var(--accent)`
(`agent-workspace.css:~510`) — the new `.is-active` selector OVERRIDES
border-color to the white ring token (round-4 Blocker 2; green stays
exclusive to the running spinner). Delete the old accent border-color
declaration from the legacy rule when amending it.
(Amend any existing rail button size rule in the same block; the
white ring is the active marker; accent green stays reserved for the
running spinner.) The roadmap's "44px thumb" contract is amended to
"40px thumb with an internal 2px active ring inside the ~43px rail
track" — goalplan c-rail criterion reads accordingly (an inset shadow
does not expand the box; footprint stays 40px).

## 4. `persistenceRegistry.ts`

Single comment change (LOCKED, resolves round-2 Blocker 6): keep ALL
three declarations (`PERSISTED_KEYS` tuple entry,
`AGENT_PANE_PREFERENCE_STORAGE_KEY` export, registry member) untouched
and add above the tuple entry:
`// retired 2607: agent pane preference — rail is the only desktop mode; key kept as historical registry member`.
No localStorage migration (stale value is inert once nothing reads it);
Phase 3 does NOT remove these either — final state is retained-with-
comment. The 020/030 docs contain no persistence work.

## 5. Test amendments (exact expressions)

`tests/agent-mode-layout-contract.test.js`:
- `:31` DELETE `assert.match(css, /grid-template-columns: 260px minmax\(0, 1fr\)/);`
  REPLACE with `assert.match(css, /grid-template-columns: 64px minmax\(0, 1fr\)/);`
- `:33` DELETE `assert.match(css, /\.agent-session-sidebar\s*\{[\s\S]*?grid-column: 1;/);`
- `:35-36` grid-value assertions UNCHANGED this phase (body grid moves in Phase 2).
- ADD in the first `it`: `assert.match(workspace, /layoutMode === "tablet-stacked" \|\| layoutMode === "mobile-chat-image-sheet"/);`
  and `assert.doesNotMatch(workspace, /panePreference/);`

`tests/agent-mode-frontend-contract.test.js` (line anchors re-verified
round 3; locate by expression, not line):
- `assert.match(workspace, /AgentSessionSidebar/);` (in "mounts a lazy
  Agent workspace" test, `:75`) → `assert.match(workspace, /AgentSessionRail/);`
  plus `assert.doesNotMatch(workspace, /<AgentSessionSidebar/);`
- `sessionSidebar` SidebarChrome-shape assertions (`:76-82`) REMAIN
  (file still exists with that markup until Phase 3).
- App-grid regex `grid-template-columns: 260px minmax\(0, 1fr\)` (`:86`)
  → `grid-template-columns: 64px minmax\(0, 1fr\)`.

`tests/agent-mode-right-sidebar-contract.test.js`:
- `:32` — the workspace-mount chain
  `assert.match(workspace, /<AgentSessionSidebar[\s\S]*?settings={selectedSettings}[\s\S]*?onSettingsChange={updateGenerationSettings}/);`
  → `assert.match(workspace, /<AgentSessionRail[\s\S]*?onOpenDrawer/);`
  (this chain lives in THIS file only — round-4 Blocker 5 removed the
  phantom duplicate instruction from the frontend contract);
  SidebarChrome-shape assertions at `:34-35` remain (file-level).

## Accept criteria

- Desktop 1440x900 and 1000x700: 64px rail with 40px thumbs (internal
  2px white ring on active — footprint stays 40px), spinner on
  running, tooltip title+count, aria-labels; no expanded sidebar;
  drawer opens from rail ≡ (search/rename/delete work).
- Tablet 900x900 and 1000x500: top bar present with ≡ drawer trigger;
  Image/Queue reachable through the persistent right-column tabs
  (top-bar image/queue actions remain mobile-only by design).
- Model pill appears exactly once in persistent shell chrome (chat
  header); transient dialogs may render their own selector (lock in 020).
- `npm run typecheck && npm run typecheck:tests && npm test` green;
  `cd ui && npm run build` green.
