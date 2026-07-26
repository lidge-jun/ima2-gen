# 030 — Phase 3: Polish, Dead-Code Sweep, Regression Pass

Goal: finish the relayout to shippable quality: visual polish per the
locked tokens, remove now-dead code paths, and prove no regression on
narrow/tablet/mobile plus the full test suite.

## File change map

| Action | Path |
|--------|------|
| MODIFY | `ui/src/styles/agent-stage.css` (only if the screenshot pass reveals defects; any fix is appended to this doc as an exact declaration diff BEFORE landing — the known selected-thumb ring rule already ships in 020 and is NOT deferred here) |
| MODIFY | `ui/src/styles/agent-workspace.css` (DELETE only these dead blocks — round-3 Blocker 3 enumeration: `.agent-session-sidebar` container/scroll rules, `.agent-pane-preference` rules, `agent-workspace--session-rail` modifier leftovers if Phase 1 missed any. PRESERVE only drawer/list consumers: `.agent-sessions__create`, `.agent-sessions__search`, `.agent-session-list`, `.agent-session-row*` (all apply without ancestor selectors; drawer grid lives in agent-panels-composer.css:172). DELETE exactly: `:36-38` mobile session-sidebar hide, `:82-90` `.agent-sessions__header` rules, `:319-325` `.agent-sessions` container block, `:327-332` `.agent-session-sidebar .agent-sessions`. In the GROUPED selector at `:309` remove ONLY the `.agent-sessions,` clause (the block also styles live `.agent-rail`/`.agent-chat`/`.agent-image`). Remove the three dead `.agent-sessions__brand` clauses at `:285,:293,:300` keeping their grouped topbar/pane-header partners) |
| DELETE | `ui/src/components/agent/AgentSessionSidebar.tsx` (decision locked — see §1) |
| MODIFY | `tests/agent-mode-frontend-contract.test.js` (DELETE the `sessionSidebar` readSource + its SidebarChrome assertions `:76-82`,`:~101-103`; they described the deleted file) |
| MODIFY | `tests/agent-mode-layout-contract.test.js` + `tests/agent-mode-frontend-contract.test.js` + `tests/agent-mode-right-sidebar-contract.test.js` (drop `AgentSessionSidebar` readSource, final stage/rail/drawer invariants) |
| MODIFY | `structure/04-frontend-architecture.md` (SoT sync: new agent layout) |
| MOVE | this unit → `devlog/_fin/260720_agent-filmstrip-relayout/` at D |

SidebarChrome agent props (wp3 audit fold — full dead-branch removal):
after the sidebar deletion the agent branch has no runtime caller
anywhere. Phase 3 DELETES:
- `ui/src/components/Sidebar.tsx:15+`: agent type import, agent props
  in the Props type, destructuring, and the `agentMode` conditional.
- `ui/src/components/ImageModelSelect.tsx:5+`: agent imports/props/
  state derivation and the agent portal branch (:206-271) — the branch
  requires `variant==="sidebar"` + both agent props, and the only
  supplier was AgentSessionSidebar; keeping it would be permanently
  unreachable code.
- Contract tests (exact ENOENT + assertion map from audit):
  layout-contract `:42` readSource + sidebar assertions `:46,:48,:50`;
  frontend-contract `:68` readSource + sessionSidebar assertions
  `:82-87` + CSS assertions `:91-92` (keep `:76` workspace absence);
  right-sidebar-contract `:21` readSource + `:34-35` sessionSidebar
  assertions + `:36-37` SidebarChrome agent-prop assertions +
  `:63-66,:107-108` agent-branch assertions + now-unused
  `shellSidebar`/`globalModel` readSource at `:20,:24,:97`.

NOT in scope (LOCKED at audit round 2): `persistenceRegistry.ts` — the
retired key keeps all three declarations with the Phase-1 comment,
permanently (removing the tuple entry would break the positional exports
and registry member together; retention is inert). i18n keys added in
Phase 2 all have consumers — no key retirement. `AgentImagePane.tsx` —
keyboard-nav duplication with `AgentStagePane` is ACCEPTED (two small
local copies, different panes); no dedupe pass.

## 1. AgentSessionSidebar deletion (decision LOCKED at roadmap audit)

Phase 1 removed the only mount (the workspace expanded else-branch was
the sole caller; tablet/mobile never mounted it — verified at audit).
DELETE
the file and its dead CSS. `AgentPanePreference` (exported from the same
file) is also dead after Phase 1 — delete with it. Keep
`AgentSessionList` (drawer uses it). Verification command (excludes the
declaration file so it proves mounts, not self-matches):
`rg -n "AgentSessionSidebar|AgentPanePreference" ui/src tests --glob '!**/AgentSessionSidebar.tsx'`
must return only test-amendment lines that assert ABSENCE. Record output
in the close-out section.

## 2. Visual polish checklist (screenshot-driven)

- Stage caption: filename `font-weight 600`, prompt one-line clamp with
  `text-overflow: ellipsis`; no double borders with filmstrip.
- Filmstrip: 72px thumbs, selected = white 2px inset ring (exact rule
  shipped in 020 §4b: `.agent-stage__filmstrip .agent-result-thumb.is-selected`),
  hover scale none (MOTION dial 2 — feedback only, no transform animations).
  This phase only VERIFIES the rendered state.
- Rail: verify 8+ sessions scroll; ring not clipped by overflow.
- Overlay tools panel: solid background (no translucency on content),
  Esc + backdrop close, focus trap via `useAgentDialogFocus`.
- Composer/chat unchanged visually except column width.

## 3. Regression matrix (agbrowse, all with console check)

| Viewport | Expect |
|----------|--------|
| 1440x900 | rail + chat + stage/filmstrip; overlay toggles |
| 1280x800 | same, no overflow/clipping |
| 1000x700 (`desktop-rail`) | rail + two columns fit, no x-scroll |
| 900x900 (`tablet-stacked`, audit Blocker-1 probe) | top bar with ≡ drawer trigger; Image/Queue reachable via persistent right-column tabs (top-bar image/queue actions are mobile-only by design) |
| 1000x500 (short desktop-width, audit Blocker-1 probe) | resolves `tablet-stacked`; top bar with ≡ trigger present; no dead zone |
| 800x900 (`tablet-stacked`) | pre-existing stacked layout unchanged |
| 500x844 (mobile) | app bar + sheets flow unchanged |

Console: zero new errors/warnings vs baseline on #agent route.

## 4. SoT sync (SOT-SYNC-01)

`structure/04-frontend-architecture.md`: update the agent-mode section
to describe rail-default + stage/filmstrip + tools overlay; note the
retired pane preference.

## 5. Close-out

- Full gate: `npm run typecheck && npm run typecheck:tests && npm test`,
  `cd ui && npm run build`, screenshot set attached to goalplan evidence.
- Commit per step; unit moves to `_fin/` with `YYMMDD_` prefix at D.
- Terminal outcome recorded honestly (DONE only with all criteria met).
