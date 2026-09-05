# WP08 — one pane geometry owner, preserved editing behavior

Status: WP00 design only; no implementation has occurred.
Baseline: `ecde2bc79cddc50ff0da38091c1ce0590383090c`.
Research: [003_visual_research.md](003_visual_research.md).

## Outcome and phase contract

- Archetype: preserve-and-consolidate. Trigger: dual input geometry is distributed
  among six stylesheets and IME input can activate submit shortcuts.
- Goal: classic/sidebar, bottom dock, mobile sheet and Home obey a single pane
  geometry contract without hiding input, its hint, or actionable controls.
- Non-goals: redesign, new component framework, provider capability changes,
  store migration, new prompt parser, unifying Home and Classic submit policies.
- Verifier: focused source contracts + existing J7 geometry at implementation C;
  the new WP09 matrix later broadens coverage. Stop only after original floor and
  scroll assertions survive and changed renders are actually inspected.
- Memory artifact: this doc + `003`; C records exact head, commands, screenshots
  and any changed assumptions. Expected terminal outcomes: implemented/verified,
  or blocked with the failing invariant; never "CSS refactor, visually assumed".
- Escalation: main reclaims or replans if host allocation needs redesign, provider
  controls change semantics, or another lane changes the selectors below. This
  leaf cannot dispatch, transition FSM, commit, merge or release.

Semantic prerequisites: baseline NAI correction; WP02 only if its selection work
changes provider gating/caller signatures (none is assumed here). WP07 is the
stack parent, not an imported dependency. Stack: WP07 → WP08 → WP09.
WP08 is one substantial implementation PR: consolidate both editing surfaces and
verify their layout/input contract. It is not a documentation-only count filler.

## Boundary decision and necessity

Existing graph: Sidebar/ClassicWorkspace/MobileComposeSheet → PromptComposer →
NegativePromptField + DeadTagMirror + Toolbar; HomeHero → HomePromptComposer →
NegativePromptField. Components own text, events and semantics; CSS owns sizing.

Choose one new feature stylesheet, grouping existing selectors. Reject a generic
`PromptPane` React abstraction: Home has no mention mirror and has a different
submit guard, while the mobile sheet owns focus and scrolling outside the composer.
Reject another last-loaded override: it leaves the original competing owners.
No-code/config-only cannot remove duplicate ownership or close IME submission.
Reuse original selectors, existing CSS tokens, installed PostCSS/test tools.
No barrel, new store field, provider enum or runtime API is introduced.

## Exact future file map

All paths are repository-relative; this is the WP08 implementation scope, not a
license to modify them during WP00. No whole-file deletion is planned.

| Action | Path | Concrete delta |
| --- | --- | --- |
| NEW | `ui/src/styles/composer-panes.css` | Canonical dual-grid, positive/negative input, label/hint and variant geometry described below. |
| MODIFY | `ui/src/main.tsx` | Import new stylesheet once, immediately after home-workspace import. |
| MODIFY | `ui/src/styles/progress-composer.css` | Transfer pane grid/panel/input rules and desktop pane adjustments; retain composer shell, mirror skin, toolbar and chip rules. |
| MODIFY | `ui/src/styles/provider-controls.css` | Transfer all `.negative-prompt*` rules; retain `.nai-controls*` and other provider settings. |
| MODIFY | `ui/src/styles/home-workspace.css` | Transfer pane/label/hint/textarea rules and textarea-only <=480px overrides; retain home shell/footer/provider/CTA styles. |
| MODIFY | `ui/src/styles/classic-workspace.css` | Transfer bottom textarea and dual-grid child rules; retain dock allocation, composer shell tokens and toolbar non-shrink. |
| MODIFY | `ui/src/styles/responsive-layout.css` | Transfer `.compose-sheet__panel--prompt` textarea and prompt-stack geometry; retain sheet body/actions/focus-shell layout and per-host composer allocation. |
| MODIFY | `ui/src/components/PromptComposer.tsx` | Composition guard only in submit key branch; DOM, refs and positive mention behavior stay. |
| MODIFY | `ui/src/components/NegativePromptField.tsx` | Composition guard only; no mention parsing, same props/provider gate. |
| MODIFY | `ui/src/components/home/HomePromptComposer.tsx` | Composition guard only; same guards/navigation and props. |
| MODIFY | `tests/nai-dual-prompt-contract.test.ts` | Read new CSS owner; keep semantic assertions, test no stale geometry owners. |
| MODIFY | `ui/e2e/j7-nai-negative-geometry.spec.ts` | Preserve 3 baseline scenarios; assert positive floor in bottom/mobile and both pane scroll reachability. |
| MODIFY | `structure/04-frontend-architecture.md` | Add canonical pane owner/host allocation/IME contract paragraph. |

Read-only protected dependencies: `sidebar.css`'s dual spacer removal,
`MobileComposeSheet.tsx`, `DeadTagMirror.tsx`, `composer-flow.css`, store setters,
`useIsMobile.ts`, `App.tsx`, all provider adapters. Existing oversize legacy files
are not an authorization for unrelated splits. New CSS must stay under 400 lines.

## Geometry contract (independent acceptance values)

| Surface | Single positive field | Dual pane rule | Scroll owner |
| --- | --- | --- | --- |
| Sidebar, width >800px | Existing flex-fill, `min-height:0`; preserve 7:3 spacer | Both textarea rectangles >=72px; content-minimum rows; spacer yields | Dual grid scrolls when short; textarea scrolls long content |
| Bottom, prompt-studio desktop | 86px minimum / 148px maximum | Same 86px/148px bounds on both, dock cap `min(52dvh,420px)` | Grid scrolls inside composer; toolbar cannot shrink out |
| Mobile classic sheet, <=800px | Existing 160px floor | Both >=160px, stacked by container width | Sheet body scrolls; sticky actions remain independently reachable |
| Home | 168px floor; <=480px 144px | Equal width columns when container >=720px; otherwise one column, same floors | Home workspace/page and native textarea resizing; no artificial classic dock cap |

Only the sidebar dual floor is 72px; do not globally replace Home/mobile floors
with 72px. `@container (max-width:719px)` concerns the query container, NOT viewport
width. Keep `.composer` and `.home-prompt` as inline-size containers. Short-height
acceptance permits an offscreen pane if scrolling reveals it; it never permits
the pane to paint over the toolbar or its text to be irretrievably clipped.

## Diff-level stylesheet design

New `composer-panes.css` has four ordered sections. Move the exact source blocks
below (all properties including typography/focus) before coalescing equivalent
rules; do not approximate existing home colors/radii or textarea font metrics.

1. Base shared wrappers/grid, label/hint and panel skins.
2. Classic and Home textarea skin/metrics, with variant differences explicit.
3. Desktop sidebar and bottom geometry.
4. <=800px sheet, <=480px home, then the 719px container collapse.

Base before (separate files, same structural rules):

```css
.composer__prompt-panes, .composer__prompt-pane { display: contents; }
.home-prompt__panes, .home-prompt__pane { display: contents; }
.composer__prompt-panes--dual {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch; gap: 8px; min-width: 0;
}
.home-prompt__panes--dual {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch; gap: 12px;
}
```

After (new owner; no JSX wrapper/class changes):

```css
.composer__prompt-panes, .composer__prompt-pane,
.home-prompt__panes, .home-prompt__pane { display: contents; }
.composer__prompt-panes--dual, .home-prompt__panes--dual {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
  min-width: 0;
}
.composer__prompt-panes--dual { gap: 8px; }
.home-prompt__panes--dual { gap: 12px; }
.composer__prompt-panes--dual .composer__prompt-pane,
.home-prompt__panes--dual .home-prompt__pane,
.negative-prompt {
  display: flex; flex-direction: column; min-width: 0;
}
.negative-prompt { margin: 0; }
@container (max-width: 719px) {
  .composer__prompt-panes--dual, .home-prompt__panes--dual {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

Transfer map defines the rest of the NEW file completely by source blocks:

- `progress-composer.css:502-531`: move positive panel skin, label/hint and stack
  geometry. Shared flex above replaces duplicate flex declarations. Keep the
  positive panel border/background/clip-path under its original dual selector.
- `progress-composer.css:562-582`: move `.composer__textarea` and both focus rules
  verbatim. Keep `position:relative; z-index:1` and its padding/line-height; keep
  `.composer__prompt-mirror` and `.dead-tag` rules in progress-composer unchanged.
- `provider-controls.css:199` through final negative-home focus block: move all
  negative prompt rules. Combine positive/negative classic label/hint selectors
  only where property values are identical; retain negative-home label override.
  Negative home has both `negative-prompt__textarea` and `home-prompt__textarea`;
  preserve its effective base `border-radius:var(--r-xl)` from Home's later rule,
  rather than accidentally making it `--r-sm` after the move.
- `home-workspace.css:260-323`: move all Home label/pane/hint/input/focus rules;
  preserve rule ordering relative to negative Home rules so computed skin remains
  identical. Merge duplicated structural rules with section 1 above.
- `home-workspace.css:435-436`: move both textarea overrides under the original
  `@media(max-width:480px)`, after base Home rules. No change to footer layout.
- `progress-composer.css:583-625`: keep `.composer--sidebar` shell token/allocation
  block in place, move its following descendant stack/input/grid rules as a
  single `@media(min-width:801px)` section. Keep the single textarea reset before
  the more-specific dual reset. Move 719px query to the shared block above.
- `classic-workspace.css:118-125`, `:147-158`: move bottom textarea/grid/child
  rules verbatim; leave dock `:has(...)` max-height and shell tokens in classic.
- `responsive-layout.css:209-221`: move stack and BOTH textarea rules under
  `@media(max-width:800px)`; keep parent composer 160px tokens and `flex:1 0 auto`
  in responsive-layout. This is intentional host allocation, not scatter.

Protected desktop reset after move (one shared rule, not two drifting copies):

```css
@media (min-width: 801px) {
  .composer--sidebar .composer__prompt-panes--dual {
    flex: 1 1 auto; min-height: 0;
    grid-auto-rows: minmax(min-content, 1fr); overflow-y: auto;
  }
  .composer--sidebar .composer__prompt-panes--dual > .composer__prompt-pane,
  .composer--sidebar .composer__prompt-panes--dual > .negative-prompt {
    min-height: 0;
  }
  .composer--sidebar .composer__prompt-panes--dual .composer__textarea,
  .composer--sidebar .composer__prompt-panes--dual .negative-prompt__textarea {
    height: 100% !important; min-height: 72px;
    max-height: none; flex: 1 1 auto;
  }
}
```

`!important` remains because `PromptComposer` writes inline auto-height. Removing
it needs a separate measured sizing design; this WP does not casually remove it.
Before `main.tsx:25`: only `import "./styles/home-workspace.css";`.
After: keep that import and immediately add
`import "./styles/composer-panes.css";`. Remove transferred old blocks, not entire
source files. Host allocation remains only in sidebar/classic/responsive files.

## Input contract and exact handler deltas

Signatures unchanged: `PromptComposer({variant="sidebar"}: PromptComposerProps)`,
`NegativePromptField({variant,onSubmit}: NegativePromptFieldProps)`, and
`HomePromptComposer({providerAvailability}: HomePromptComposerProps)`.
No serialization/deserialization impact: no props/fields/enums added.

Before in `PromptComposer.tsx:402`:

```tsx
if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
  e.preventDefault();
  submitPrompt();
}
```

After: add `if (e.nativeEvent.isComposing || composingRef.current) return;`
inside that branch, before `preventDefault`. Do not move the Escape mention
dismissal branch or composition commit microtask; no resubmission on compositionend.
For NegativePromptField/HomePromptComposer, after their existing early-return
key check, add `if (event.nativeEvent.isComposing) return;` before preventDefault.
Plain Enter remains multiline; completed Ctrl/Cmd+Enter still uses the same shared
submit callback once. Negative `@text` remains literal and Home remains mention-free.

## Acceptance activation and independent assertions

| ID | Constructible activation | Required observable assertion |
| --- | --- | --- |
| P08-1 | Existing J7 sidebar 1157×826, NAI | Both textarea heights >=72; label/hint inside own pane; toolbar actual controls receive hit tests. |
| P08-2 | Existing J7 bottom 1440×1000, prompt-studio | Both fields >=86, max-height 148; grid below header/above toolbar; scroll each field into view independently. Never require entire offscreen pane inside grid. |
| P08-3 | Existing J7 mobile 390×844, open Prompt tab | Both fields >=160; hint and submit each scroll into unobscured view; sheet closes/returns focus through existing owner. |
| P08-4 | Toggle NAI → MiniMax → NAI using actual provider control | Dual class disappears/reappears; positive text and negative draft preserved; non-NAI wrapper remains `display:contents`; no residual dual padding/floor. |
| P08-5 | Home at 1440 and 390 widths | Home floors 168/144, no classic cap; two labels/hints correctly associated; non-NAI one field remains unchanged. |
| P08-6 | Component-level keyboard harness: compositionstart + composing Ctrl/Meta+Enter, then compositionend + ordinary chord, with a counting submit callback | Callback count 0 during composition, 1 after completion; no generation request. Full browser request-count/error coverage belongs to WP09 T5 after isolation. |
| P08-7 | Classic positive attachment tag removed, long prompt scrolled/resized | Retired tag mirror follows text coordinates/scroll, pointer-transparent; negative never opens mention menu. |

P08-4, P08-5 and P08-7 are non-generating implementation-C browser observations;
P08-6 is a component input check with no server dispatch. WP09 persists their
expanded matrix and adds browser submission coverage after isolation. Do not mark
these automated just because source regex tests pass.
Test values above are independent product expectations, not imported CSS constants.
Mutate the 72px reset or grid scroll in an isolated implementation checkout once;
the same geometry test must fail, then pass after restoration. No mutation now.

## Tests and verification commands

Baseline outcomes are in `003`: focused 35/35, UI and E2E types exit 0, E2E list
11/7 exit 0. None parses these Markdown plans or proves rendered geometry.

Modify `nai-dual-prompt-contract.test.ts` imports from old CSS variables to the new
owner for moved rules; retain all ten behaviors. Replace path-coupled regex shape
expectations with installed PostCSS AST selector/declaration checks where rules
are coalesced (e.g. select rule containing both textarea selectors, assert 72px).
Keep old-file checks only to reject residual pane geometry after transfer. Never
replace the 72/148/160 values with a value extracted from production CSS.

Commands already run: the exact focused node:test command and both typechecks in
`003`. Future C command `(cd ui && npm run test:e2e -- j7-nai-negative-geometry.spec.ts)`
is intentionally NOT RUN in WP00: the current local fixture inherits ambient state.

### Resolved per-phase execution preconditions (main decision, 2026-09-05)

- WP02/WP08 C browser checks run on isolated GitHub runners, not the developer's
  workstation or shared browser. Audit the exact source/build tree for absence of
  `.env`, legacy repo `.ima2/config.json`, and provider credential material; do not
  read secret contents or delete user configuration to manufacture this condition.
  Use a minimal environment with no provider secrets/endpoints inherited from the
  operator and synthetic homes/config directories. No local provider service may
  be present on the fixture's fallback ports. Fail preflight if these conditions
  are not met; a clean runner is required, not an assumed clean checkout.
- Serve the freshly built exact-head UI only inside that isolated runner on its
  owned ephemeral endpoint. Never use live `:3333`. Record runner identity, SHA,
  build command, audited absence of ambient files, synthetic-home paths, viewport
  and screenshots; inspect the rendered images before closing C.
- Early browser cases exercise provider selection, draft editing, geometry,
  scrolling, hit-test/trial clicks and focus only. They do not click Generate or
  issue generation POSTs. Assert zero generation requests in these cases; do not
  treat a fake key or a missing live service as permission to generate.
- P08-6 validates keyboard callback suppression without dispatch; its full browser
  submission/error scenario waits for WP09's fail-closed fixture. WP09 then owns
  network/process enforcement and generation/error journeys. Local browser
  generation is prohibited until that isolation is implemented and verified.

This is a resolved execution boundary, not a pending parent choice or a semantic
dependency on future code. Do not move WP09 backwards, cherry-pick its fixture
implementation into WP08, or create a stack cycle. Re-run UI typecheck and exact-head
render checks under the above conditions; parent owns their CI execution.

## Compatibility, rollback, source of truth

No public API/CLI/schema change. Keep IDs, class selectors, labels/hints and
store callbacks. On layout regression revert this WP's stylesheet transfer/import
and handler changes together; restore baseline host rules, never remove ecde2bc7.
Do not clear localStorage or reset drafts. WP09 consumes retained selectors, so
its regression tests remain useful on a revert and may appropriately fail.

Append to `structure/04-frontend-architecture.md` in the same implementation PR:
"Composer pane geometry is owned by `styles/composer-panes.css`; sidebar/dock/sheet
files allocate host space. Classic and Home keep separate input/submit policies.
NAI dual inputs preserve content-aware scrolling; non-NAI wrappers remain contents.
IME composition does not submit via Ctrl/Cmd+Enter."
No runtime claim enters SoT until its C evidence exists. Parent updates the roadmap
and archives the entire unit only after its registered work is actually complete.
