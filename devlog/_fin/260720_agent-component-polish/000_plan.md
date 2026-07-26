# 000 — Agent Component Polish: Tell Audit + Phase Map

## Direction lock (Design Read)

Dark studio repeated-work tool. D4-D5, VARIANCE 4, MOTION 2 (feedback
only). Polish = refinement, not decoration: token consistency, complete
interaction states, typographic hierarchy, optical alignment. Single
white marker (`--accent #f0f0f4`), green reserved for run state.

## Token base (verified `ui/src/index.css:62-94`)

`--bg #0b0b0f`, `--surface #14141a`, `--surface-2 #1c1c23`,
`--border #26262f`, `--border-strong #3d3d49`, `--text #f4f4f6`,
`--text-dim #b6b6c2`, `--text-faint #55555f`, `--accent #f0f0f4`,
`--accent-ink #0b0b0f`, `--green #22c55e`, `--red #ef4444`,
`--radius 10px`, `--control-bg rgba(255,255,255,0.03)`.

## Rendered tell audit (screenshot_1784481449621, 1440x900 + narrow probes)

| # | Component | Tell | Class |
|---|-----------|------|-------|
| T1 | Chat bubbles | EVERY bubble carries the same 1px border + same radius — "boxed everything" monotony (FE-AI-TELL catalog); user/agent distinguished only by bg shade | High |
| T2 | Bubble radius | `agent-message` radius 8px vs app `--radius` 10px vs pill 999 — three unrelated radii in one column | Med |
| T3 | Tool-run toggle | `border: 1px dashed` reads as unfinished scaffold; hover jumps to green-tinted border (green must stay run-state-only) | High |
| T4 | Streaming state | `.agent-message.is-streaming` uses a `linear-gradient` wash — the only gradient in the agent surface (FE-GRADIENT-01 budget: keep 0) | High |
| T5 | Composer | Send uses `!important` against the 0,2 chrome group; textarea lacks focus ring + radius token; `.is-active` uses accent border while rail active uses white ring — inconsistent selected grammar (stale claims removed after audit: textarea already 14px, Send already 36px) | High |
| T6 | Model pill | `image-model-select__trigger--pill` shows double-chrome (inner badge + outer border) and mono 11px; status "Ready" is bare text floating without a chip | Med |
| T7 | Pane headers | label+strong pattern fine, but three panes repeat identical 11px/14px stack with no alignment to a shared 56px header height; stage header tools button 30px vs header buttons 40px elsewhere | Med |
| T8 | Filmstrip | selected ring radius echo (8 vs 10 family) + focus-visible uses cyan `--focus-ring` (second accent, audit-found); inner "red"/"blue" labels confirmed part of image fixtures, not UI | Med |
| T9 | Empty thumbs | broken-image placeholder tiles show bare icon on `--surface-2` with full border — acceptable, but density of 8 identical placeholder tiles reads as debris; dim empty tiles | Low |
| T10 | Drawer/overlay | drawer rows show two icon buttons (rename/delete) per row at rest — management noise at rest; overlay header `strong` uses body size | Med |

Not tells (keep): near-black layering, mono for tool names, inset white
ring grammar from relayout, single accent discipline.

## Phase map (dependency-ordered)

| Phase | Doc | Delivers |
|-------|-----|----------|
| 1 | `010_phase1_tokens_chrome.md` | Shared grammar: radius scale, chip/button state recipes, header alignment, model pill + status chip, gradient removal (T2 T4 T6 T7) |
| 2 | `020_phase2_chat_composer.md` | Bubble de-boxing + tool toggle + composer hierarchy (T1 T3 T5) |
| 3 | `030_phase3_stage_rail_overlay.md` | Filmstrip/empty-tile/drawer polish + full regression matrix (T8 T9 T10) |

## Verification

Per phase: `npm run typecheck && npm test`, `cd ui && npm run build`,
agbrowse screenshots (1440/1000/900/500) vs baseline
`screenshot_1784481449621.png`, console clean, other modes spot-checked
(classic + assets) for shared-CSS fallout. Commit per phase; no push.
