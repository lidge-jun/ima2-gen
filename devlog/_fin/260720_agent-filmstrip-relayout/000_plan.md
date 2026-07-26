# 000 — Agent Filmstrip Relayout: Objective, Constraints, Phase Map

## Objective

Relayout the desktop agent workspace to the locked design direction:
filmstrip skeleton (concept #2) + session thumbnail rail (variant A).
The generated image becomes the visual hero; sessions are recognized by
thumbnail, not text; the list sidebar is demoted to the drawer.

Target layout (desktop, >=1280px):

```
+--------+----------------+--------------------------------------+
| nav    | [64px session  | chat column      |  stage (hero img)  |
| rail   |  thumb rail]   |  (~380-420px)    |  + meta caption    |
| (app)  |                |                  |  + bottom filmstrip|
+--------+----------------+--------------------------------------+
```

Design tokens preserved: near-black background, single accent, grotesk
sans, pill chips, no emoji, no gradients.

## Evidence base (explored 2026-07-20, dev @4cf51ba)

- `ui/src/components/agent/AgentWorkspace.tsx` (490L) — renders
  `AgentSessionSidebar` (expanded, default) OR `AgentSessionRail` behind
  `panePreference` localStorage key `AGENT_PANE_PREFERENCE_STORAGE_KEY`
  (`persistenceRegistry.ts:53`, PERSISTED_KEYS[18]); default is
  `"expanded"` (`AgentWorkspace.tsx:151-153`). Rail only activates when
  `layoutMode === "desktop-three-pane" && panePreference === "rail"`
  (`:257`).
- `ui/src/lib/agentLayout.ts` — `resolveAgentLayout` returns
  `desktop-three-pane` (>=1280), `desktop-rail` (>=960 wide enough),
  `tablet-stacked`, `mobile-chat-image-sheet`.
- `ui/src/components/agent/AgentImagePane.tsx` (164L) — already owns the
  hero preview + variants thumbs + keyboard nav (Arrow/Home/End) +
  `AgentVideoPreview` + `AgentContextTabs` (Image/Refs/Web/Memory).
  Currently mounted inside `AgentRightSidebar` "image" tab only.
- `ui/src/components/agent/AgentRightSidebar.tsx` (93L) — 6-tab column
  (image/library/forms/quality/model/queue) via `AgentSidebarTabs`.
- `ui/src/components/agent/AgentSessionRail.tsx` (42L) — thumbnail rail
  already implements: last-image thumb, `is-active` class, spinner
  (`AgentSessionSpinner`), compacted badge, + / drawer buttons. Session
  buttons currently carry `title` ONLY (no aria-label) — adding
  aria-labels is Phase 1 work (010 §2), not existing behavior. CSS at
  `agent-workspace.css:68-96` (64px column) and
  `agent-workspace-sidebar.css:396+`.
- `ui/src/components/agent/AgentSessionDrawer.tsx` (54L) — drawer already
  has search + create + `AgentSessionList` with rename/delete.
- Model badge duplication: `AgentChatPane.tsx` header renders
  `AgentModelSelector`; the expanded `AgentSessionSidebar` also renders
  `SidebarChrome agentSettings=...` which shows the same model pill.
  With the sidebar demoted, only the chat-header instance remains — the
  dedup falls out of the relayout; verify by screenshot.
- Contract tests touching this area:
  `tests/agent-mode-layout-contract.test.js` (source-regex on
  `agentLayout.ts` + hook), `tests/agent-mode-right-sidebar-contract.test.js`,
  `tests/agent-mode-frontend-contract.test.js` (321L). These are
  source-shape contracts, not DOM tests; phases must re-run and amend.

## Scope

IN: desktop agent-mode layout (`desktop-three-pane`, `desktop-rail`),
session rail promotion, stage+filmstrip pane, drawer demotion, model
badge dedup, CSS for the above, contract-test amendments.

OUT: server/API/routes, other UI modes (classic/node/assets/card-news),
mobile/tablet redesign (regression-guard only), full inspector accordion
rework, site/.

## Dependency-ordered phase map (one decade doc = one PABCD cycle)

Phase order is FRAME FIRST (audit round-2 Blocker 2: the stage grid math
only fits after the 64px rail replaces the 260px sidebar; foundations
before integration per PHASE-SPLIT-01):

| Phase | Doc | Delivers | Depends on |
|-------|-----|----------|-----------|
| 1 | `010_phase1_frame_rail_default.md` | Frame foundation: session thumbnail rail becomes the ONLY desktop session UI (sidebar unmounted everywhere), top bar keyed purely on layoutMode with tablet access guaranteed, app grid 260px→64px, drawer as sole management surface, model badge single-render, contract-test amendments for all of the above | — |
| 2 | `020_phase2_stage_pane.md` | `AgentStagePane` (hero + caption + filmstrip, full component code) as desktop right column; tools overlay via `.agent-dialog` pattern with shared-body refactor; grid column values; contract-test amendments for grid/stage | Phase 1 frame |
| 3 | `030_phase3_polish_regression.md` | CSS polish (rail ring/dot spec, filmstrip density), `AgentSessionSidebar` deletion, viewport regression matrix incl. 900x900 and 1000x500 dead-zone probes, SoT sync, devlog close-out | Phases 1-2 |

### Non-desktop invariant (Blocker-1 resolution)

`tablet-stacked` and `mobile-chat-image-sheet` keep their EXISTING body
surfaces. Tablet retains the persistent right column (`AgentRightSidebar`
with its 6 tabs including Image and Queue), so tablet does NOT need
top-bar image/queue actions — those stay mobile-only (LOCKED). What
tablet gains in Phase 1 is a guaranteed top bar carrying the ≡ session
drawer trigger, because top-bar visibility switches from
`isMobile && layoutMode !== "desktop-three-pane"` (media-query/layout
mismatch leaving 801-959px and 960-1279px@<560h with NO top bar) to
`layoutMode === "tablet-stacked" || layoutMode === "mobile-chat-image-sheet"`.
Session access per layout after Phase 1: desktop = rail + drawer;
tablet/mobile = top-bar ≡ → drawer. Desktop-only surfaces (stage,
overlay, rail) never gate tablet/mobile access.

## Accept criteria (goalplan mirror)

- c-rail: 64px rail default on desktop; 40px thumbs (44px visual
  footprint including the 2px white active ring);
  green running dot/spinner; hover tooltip title+count; aria-labels.
- c-stage: stage image is the largest element on screen; filmstrip lists
  session images horizontally under the stage; click swaps stage.
- c-polish: session management only in drawer; model pill rendered once
  in persistent shell chrome (transient dialogs exempt — 020 lock).
- c-build: `npm run typecheck`, `npm run typecheck:tests`, `npm test`,
  `cd ui && npm run build` all green; no regression in 1094 tests.
- c-visual: agbrowse screenshots at >=1280 and 500px; dark tokens kept.

## Verification commands

```
npm run typecheck && npm run typecheck:tests && npm test
cd ui && npm run build
agbrowse navigate "http://127.0.0.1:3333/#agent" && agbrowse screenshot
```

Git: local commits per B step (`codex/` branch not required — work lands
on dev per user's ongoing convention); NO push without explicit approval.
