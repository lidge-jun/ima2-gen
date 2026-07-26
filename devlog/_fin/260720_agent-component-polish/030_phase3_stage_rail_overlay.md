# 030 — Phase 3: Stage/Rail/Overlay Optics + Full Regression

Fixes T8 (ring/radius echo), T9 (placeholder debris), T10 (drawer rest
noise, overlay header), then runs the full matrix.

## File change map

| Action | Path |
|--------|------|
| MODIFY | `ui/src/styles/agent-stage.css` |
| MODIFY | `ui/src/styles/agent-workspace.css` (rail + drawer rows) |
| MODIFY | `ui/src/styles/agent-workspace-panels.css` (result-thumb placeholder state + focus ring owner recolor `:376`) |
| MODIFY | `ui/src/styles/agent-workspace-image.css` (preview focus ring recolor `:21`) |
| MODIFY | `structure/04-frontend-architecture.md` (close-out snapshot note — audit Blocker 5d) |
| MOVE | unit → `devlog/_fin/260720_agent-component-polish/` at D |

## 1. Filmstrip/caption optics (T8)

- `.agent-stage__filmstrip .agent-result-thumb { border-radius: var(--agent-r-md, 10px); }`
  — same radius family as rail (kill 8/10 echo). Ring rule unchanged.
- Caption (13px already set — round-2 Blocker 4, size is no-change):
  deltas are `letter-spacing: 0.01em` on strong,
  `.agent-stage__caption { padding: 12px 14px 10px; }`, prompt span
  `max-width: 72ch`.
- Empty state: `.agent-stage__empty { gap: 8px; } .agent-stage__empty small { color: var(--text-faint); }`

## 2. Placeholder de-noising (T9) — result thumbs w/o media

`AgentSafeImage` default fallback class is `.agent-image-fallback`
(verified — thumbs pass no fallbackClassName). Add in panels.css:
```css
.agent-result-thumb .agent-image-fallback { opacity: 0.45; }
```
Broken/empty tiles recede; real thumbs pop.

## 2.5 Focus ring recolor — agent-wide (round-2 Blocker 3)

`AgentResultThumb` renders in filmstrip, chat messages, run groups, and
sidebar variants; `.agent-result-thumb:focus-visible` (`panels.css:376`)
is agent-only CSS (classic mode does not mount these components), so
recolor the OWNER directly instead of a filmstrip-scoped override:
```css
.agent-result-thumb:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```
(amend `:376-379` in place). Also amend
`agent-workspace-image.css:21-24`:
`.agent-image__preview:focus-visible { outline: 2px solid var(--accent); outline-offset: -3px; }`
— covers the tablet image pane preview. Cyan `--focus-ring` remains
untouched outside agent styles.

## 3. Rail optics (T8/rail)

- `+`/`≡` rail buttons ONLY (round-4 Blocker 3: `.agent-rail button`
  would also hit session thumbs — thumbs keep their own ring grammar):
  `.agent-rail > button { border-radius: var(--agent-r-sm, 8px); }`
  `.agent-rail > button:hover { color: var(--text); border-color: var(--border-strong); background: var(--surface-2); }`
  `.agent-rail > button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }`
  (menu/create are direct children of `.agent-rail`; session thumbs live
  under `.agent-rail__sessions` — child combinator excludes them. 010
  adds the same recipe to stage tools, so grammar is genuinely shared.)
  Session thumbs additionally get keyboard focus:
  `.agent-rail__sessions > button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }`
- Spinner dot: LOCKED no-change (round-2 Blocker 4 — `top/right: 3px`
  already present at `agent-workspace-sidebar.css:396+`, clear of the
  2px inset ring).

## 4. Drawer + overlay chrome (T10)

- Drawer rows (`.agent-session-row` / `.agent-session-row__actions`):
  rename/delete buttons get `opacity: 0.4` at rest,
  `opacity: 1` on row hover/focus-within (management recedes until
  intent):
```css
.agent-session-row__actions button { opacity: 0.4; transition: opacity 0.12s ease; }
.agent-session-row:hover .agent-session-row__actions button,
.agent-session-row:focus-within .agent-session-row__actions button { opacity: 1; }
```
  (keyboard path preserved via focus-within.)
- Overlay header: `.agent-right-sidebar__overlay-header { min-height: 56px; }` (matches the 56px pane-header contract from 010 §5) and
  `.agent-right-sidebar__overlay-header strong { font-size: 12px; color: var(--text-dim); font-weight: 600; }`;
  overlay close button joins the 36px control row with COMPLETE states
  (round-4 Blocker 2):
```css
.agent-right-sidebar__overlay-header button {
  width: 36px; height: 36px;
  display: grid; place-items: center;
  border: 1px solid var(--border);
  border-radius: var(--agent-r-sm, 8px);
  background: var(--control-bg);
  color: var(--text-dim);
  cursor: pointer;
}
.agent-right-sidebar__overlay-header button:hover { color: var(--text); border-color: var(--border-strong); background: var(--surface-2); }
.agent-right-sidebar__overlay-header button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
```
  (56px header height matches the 010 §5 pane contract:
  `min-height: 56px; padding: 9px 14px;` same border-box math.)
- Backdrop: current value is `var(--scrim)` = rgba(0,0,0,0.6)
  (index.css:83) — LOCKED: keep `var(--scrim)` for both drawer and tools
  overlay; no change needed, only verify the tools overlay backdrop uses
  the same var (it reuses `.agent-dialog__backdrop` — yes).

## 5. Regression matrix

| Viewport | Check |
|----------|-------|
| 1440x900 | full polish read vs baseline screenshot_1784481449621 |
| 1000x700 | desktop-rail fit, composer/stage polish intact |
| 900x900 | tablet column + top bar unregressed |
| 500x844 | mobile sheets/composer unregressed |
| classic mode (1440) | model pill still blue; no agent override leak |
| assets mode (1440) | shared chrome unregressed |

Console clean at all; `rg linear-gradient ui/src/styles/agent-*` = 0;
no emoji introduced; suite + typechecks + build green.

## Close-out

SoT: append polish snapshot note to `structure/04-frontend-architecture.md`
(same section as relayout note). Unit moves to `_fin/` at D.
