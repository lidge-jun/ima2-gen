# 010 — Phase 1: Shared Grammar — Radius Scale, States, Header Chrome

Fixes T2 (radius drift), T4 (streaming gradient), T6 (model pill /
status chip), T7 (header alignment). Agent-scoped only: overrides live
in agent stylesheets; shared files (`canvas-accordion.css`,
`controls.css`) are NOT touched to avoid classic-mode fallout.

## File change map

| Action | Path |
|--------|------|
| MODIFY | `ui/src/styles/agent-workspace.css` (radius vars §1 + rail thumb radius owner `:456` -> `var(--agent-r-md)`) |
| MODIFY | `ui/src/styles/agent-workspace-panels.css` (pane-header contract §5, streaming state §2, status chip §3) |
| MODIFY | `ui/src/styles/agent-stage.css` (tools button 36px + hover recipe §5) |
| MODIFY | `ui/src/styles/agent-workspace-sidebar.css` (model pill override §4) |

## 1. Agent radius scale (T2) — `agent-workspace.css` top

```css
.agent-workspace {
  --agent-r-lg: 12px;  /* panes, composer, overlay */
  --agent-r-md: 10px;  /* bubbles, cards, thumbs — matches app --radius */
  --agent-r-sm: 8px;   /* chips, small buttons */
}
```

Consumers change in their own phases; phase 1 converts only chrome it
owns: `.agent-stage__tools` radius -> `var(--agent-r-sm)`; rail thumb
radius owner at `agent-workspace.css:456` -> `var(--agent-r-md)`.

## 2. Streaming gradient removal (T4) — `agent-workspace-panels.css:215`

Before:
```css
.agent-message.is-streaming {
  border-color: color-mix(in srgb, var(--green) 48%, var(--border));
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--green) 13%, transparent), transparent 42%),
    color-mix(in srgb, var(--green) 8%, var(--surface));
  box-shadow: inset 3px 0 0 color-mix(in srgb, var(--green) 70%, var(--border));
}
```
After (flat tint + rail bar carries the state):
```css
.agent-message.is-streaming {
  border-color: color-mix(in srgb, var(--green) 34%, var(--border));
  background: color-mix(in srgb, var(--green) 6%, var(--surface));
  box-shadow: inset 2px 0 0 color-mix(in srgb, var(--green) 60%, var(--border));
}
```

## 3. Status chip (T6b) — `agent-workspace-panels.css:23`

`.agent-status` becomes a quiet chip so "Ready" stops floating:
```css
.agent-status {
  display: inline-flex; align-items: center; gap: 6px;
  height: 26px; padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--control-bg);
  color: var(--text-dim);
  font-size: 11px; white-space: nowrap;
}
.agent-status--generating { border-color: color-mix(in srgb, var(--green) 30%, var(--border)); color: var(--text); }
```
(dot/em rules unchanged; reduced-motion rule at `:495` still applies.)

## 4. Model pill agent override (T6a) — `agent-workspace-sidebar.css` AFTER `:100` (audit Blocker 1: sidebar.css imports LAST in main.tsx, and `.agent-model-select .image-model-select__trigger--pill` at `:100` already wins at equal specificity — the override must live in the same file, after that rule)

REPLACE the existing `:100-104` block (accent-mix border/bg) and append
full states:
```css
.agent-model-select .image-model-select__trigger--pill {
  min-height: 36px;
  border: 1px solid var(--border);
  background: var(--control-bg);
  border-radius: var(--agent-r-sm, 8px);
}
.agent-model-select .image-model-select__trigger--pill:hover,
.agent-model-select .image-model-select__trigger--pill:focus-visible,
.agent-model-select .image-model-select__trigger--pill[aria-expanded="true"] {
  border-color: var(--border-strong);
  background: var(--surface-2);
}
.agent-model-select .image-model-select__trigger-effort {
  color: var(--text-dim);
}
```
The effort-text recolor (audit Blocker 3a: shared rule at
`canvas-accordion.css:216` paints it `--green`, violating
green=run-state-only) is agent-scoped via the same `.agent-model-select`
ancestor; classic keeps green. LOCKED (round-2 Blocker 5): `AgentModelSelector` always emits the
`.agent-model-select` wrapper (`AgentModelSelector.tsx:39`) and every
chat/sidebar instance renders through it — no fallback variants needed.

## 5. Pane-header contract (T7) — owner corrected round 2

`.agent-pane-header` base lives at `agent-workspace-panels.css:13-21`
(currently `min-height: 58px; padding: 12px 14px`). Geometry
(round-4 Blocker 1a, border-box accounting — global
`box-sizing: border-box` at index.css:56 puts the 1px bottom border
INSIDE min-height, but content minimum is 36px control + padding + 1px
border): locked to 56px outer = 36px control + 2x9.5px -> use
`min-height: 56px; padding: 9px 14px;` (36+18+1 = 55 <= 56, min-height
governs; headers render exactly 56px). AMEND `:13-21` accordingly
(other declarations kept). Stage tools button grows 30px -> 36px
(`agent-stage.css:77+`: `width/height: 36px`) AND gains the shared hover
recipe (round-3 Blocker 3):
```css
.agent-stage__tools:hover { color: var(--text); border-color: var(--border-strong); background: var(--surface-2); }
```
so all three headers carry the same 36px control row with one hover
grammar; `__actions` at sidebar.css:84 unchanged.

## Accept criteria

- Zero `linear-gradient` occurrences in agent-* css (`rg linear-gradient`).
- Status reads as chip; model pill monochrome in agent, blue intact in classic (screenshot both).
- Chat + stage headers align at 56px outer height with 36px controls
  (overlay header joins the 56px contract in Phase 3 — round-4 Blocker
  1b: phase-1 acceptance covers only surfaces phase 1 touches).
- Suite + typecheck + build green.
