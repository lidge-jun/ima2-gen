# 020 — Phase 2: Chat De-Boxing + Tool Toggle + Composer Hierarchy

Fixes T1 (boxed-everything bubbles), T3 (dashed tool toggle), T5
(composer hierarchy). CSS-only; no TSX changes expected (verify at P).

## File change map

| Action | Path |
|--------|------|
| MODIFY | `ui/src/styles/agent-workspace-panels.css` |
| MODIFY | `ui/src/styles/agent-panels-composer.css` |

## 1. Bubble de-boxing (T1) — `panels.css:116-131`

Direction: agent turns become borderless text blocks on the canvas
(dense-tool reading column); only USER turns keep a filled bubble
(strong figure-ground: my input vs tool output). This kills the
boxed-everything monotony while raising scanability.

Before:
```css
.agent-message { max-width: min(720px, 92%); display: grid; gap: 6px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
.agent-message--user { justify-self: end; background: var(--surface-2); }
```
After:
```css
.agent-message { max-width: min(720px, 92%); display: grid; gap: 6px; padding: 10px 12px; border: 1px solid transparent; border-radius: var(--agent-r-md, 10px); background: transparent; }
.agent-message--user { justify-self: end; border-color: var(--border); background: var(--surface-2); }
```
- `is-streaming`/`is-error` states keep their tinted background+border
  (they re-declare both — verify they still read on transparent base).
- `.agent-message--assistant-run`: LOCKED no-change (audit Blocker 5b —
  run rows indent via `.agent-run__step` 12px marker column only; the
  bubble padding is the outer 10px 12px which stays for all turns).
- Images grid inside turns unaffected.

## 2. Tool toggle solidify (T3) — `panels.css:284-309`

Before: `border: 1px dashed var(--border);` hover -> green-mixed border.
After:
```css
.agent-message__tool-toggle {
  /* geometry unchanged */
  border: 1px solid var(--border);
  border-radius: var(--agent-r-sm, 8px);
  background: var(--control-bg);
}
.agent-message__tool-toggle:hover,
.agent-message__tool-toggle:focus-visible {
  border-color: var(--border-strong);
  background: var(--surface-2);
  color: var(--text);
}
.agent-message__tool-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
```
Green stays only on the run-state dot inside the summary line.
`.agent-run__header-tool .agent-message__tool-toggle` color-mix override
(`panels.css:158`) is deleted (base now covers it).

## 3. Composer hierarchy (T5) — `agent-panels-composer.css`

- textarea font-size: LOCKED no-change (already 14px at `:55`, no
  nested 12px override — round-2 Blocker 4). Deltas are ONLY:
  `border-radius: var(--agent-r-md, 10px)` on `.agent-composer textarea`
  and `.agent-composer textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: -1px; }`.
- `:119` action buttons: `min-width: 36px; height: 36px` stays; add
  `border-radius: var(--agent-r-sm, 8px);`.
- `:129` `.is-active` accent-border -> white-marker grammar:
  `border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent);`
  (matches rail/filmstrip ring language at chip scale).
- `:134` Send (audit Blocker 2 — MANDATORY, not conditional): the
  chrome group at `agent-workspace.css:105-119` (corrected anchor)
  DEFINITELY wins over bare `.agent-composer__send` (0,2 vs 0,1).
  Rewrite the rule as:
  ```css
  .agent-composer__actions .agent-composer__send {
    margin-left: auto;
    color: var(--accent-ink);
    background: var(--accent);
    border-color: var(--accent);
    font-weight: 700;
    border-radius: var(--agent-r-sm, 8px);
    padding: 0 16px;
  }
  ```
  (specificity 0,2 + later in cascade order within composer css — verify
  composer css imports after workspace css in main.tsx: yes, :18 > :16.)
  Both `!important` flags removed. Send is the ONLY filled-accent
  control in the pane. Height 36px already inherited — no change.
- Run-status spinner colors unchanged.

## Accept criteria

- Agent turns render borderless; user turns bubbled; streaming/error
  states still visible (trigger via live run or class-injection probe).
- Tool toggle solid + control-bg; no green hover; focus ring visible.
- Composer: 14px input, single accent fill on Send, `!important` gone,
  `.is-active` chips use white ring grammar.
- Suite + typecheck + build green; screenshots vs baseline.
