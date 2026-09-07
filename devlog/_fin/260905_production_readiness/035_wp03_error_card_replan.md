# WP03 P amendment — readable actionable error card

Trigger discovered during B before UI edits: toast-modal.css has a two-column
`minmax(0,1fr) 26px` grid, while error cards with a CTA render three children.
All messages inherit nowrap/ellipsis. The long new key-setting guidance would
be clipped, and CTA would occupy the dismiss-sized column. Source evidence:
toast-modal.css:14–66 and Toast.tsx:109–145. This violates032's existing readable
body/action criterion; no visual pass claimed from source inspection.

Main paused all six workers, preserved partial edits, reset B to IDLE and entered
P. This remains WP03, not a second implementation WP or a claim of completion.
Shared server contract and previous A findings remain intact; no scope swap.

## Chosen narrow design / ownership

Keep current application colors/fonts/stack placement and regular one-line toasts.
Error cards only: readable wrapped text on row1, dismiss top-right, CTA row2 using
available width. No new modal, icon, animation, typography system or global token.

Add to Error UI worker's exclusive files:

- MODIFY `ui/src/styles/toast-modal.css`: replace only .toast--card and add
  card-descendant selectors plus the card-containing stack selector below. Leave generic .toast/.toast__message/.toast__dismiss
  rules and all unrelated modal/style sections unchanged.
- MODIFY `tests/toast-stack-contract.test.js`: keep all old assertions unchanged;
  add isolated card-rule assertions, named as source constraints rather than
  pretending these establish rendered geometry.

Concrete CSS contract (place card descendant overrides AFTER generic message and
dismiss blocks so source order cannot restore truncation):

```css
.toast--card {
  width: min(560px, 100%);
  grid-template-columns: minmax(0, 1fr) 44px;
  align-items: start;
}
.toast--card .toast__message {
  grid-column: 1; grid-row: 1;
  white-space: normal; overflow: visible; text-overflow: clip;
  overflow-wrap: anywhere; line-height: 1.5;
}
.toast--card .toast__dismiss {
  grid-column: 2; grid-row: 1;
  width: 44px; height: 44px;
}
.toast--card .toast__cta {
  grid-column: 1 / -1; grid-row: 2;
  justify-self: start; min-height: 44px; max-width: 100%;
  padding: 8px 12px; border: 1px solid var(--border-strong);
  border-radius: var(--r-sm); background: var(--surface-2);
  color: var(--text); font: inherit; cursor: pointer;
}
.toast--card .toast__cta:hover { background: var(--control-hover); }
.toast--card .toast__cta:focus-visible,
.toast--card .toast__dismiss:focus-visible {
  outline: 2px solid var(--accent); outline-offset: 2px;
}
.toast-stack:has(.toast--card) {
  max-height: calc(100dvh - 48px);
  overflow-y: auto; overflow-x: hidden;
  overscroll-behavior: contain;
  padding: 4px;
  pointer-events: auto;
}
.toast-stack:has(.toast--card) > .toast { flex-shrink: 0; }
```

560px is a card-local content-width cap, not a shared token. Existing stack width
already constrains 390/320px layouts. All four specified CTA strings must fit
without clipping; no generic no-wrap rule may create overflow. Card without CTA
has only first row because no child occupies row2. Native DOM order remains
message→CTA→dismiss; no focus trap or JS layout state.

## Verification changes

Retain eight new Grok error scenarios (four locales ×1280/390). Extend Korean
scenario with 320/768/1024/1440 viewport captures after the same fixture refusal
where the existing card lifetime permits; otherwise freshly submit in an isolated
case with exact expected count. No disabling timeout just to make screenshots.
Assert whole message Range rects, body scroll/client bounds, separate CTA/dismiss
rectangles ≥44px, hit tests, no overlap and page horizontal overflow. Keyboard
focus screenshot on CTA and dismiss; no click that starts authentication.

The CSS affects other error cards, so add two bounded J6 synthetic error variants
under a renamed/extended test-only enum (or retain existing name with union):
`oauth-unavailable` on generate provider=oauth →503 flat OAUTH_UNAVAILABLE with
reload CTA; `invalid-request` on generate provider=api →400 flat INVALID_REQUEST
without actionable CTA. No new real endpoint/forwarding. Each variant gets
desktop+390 screenshot and assertions; no fake success/completion. Keep existing
default202 and all route/teardown guards. These two cards demonstrate both
CTA-present and CTA-absent layout; ordinary toast source and hosted existing
journeys remain regression coverage. All wp03 artifacts use existing032 uploads.

No lifecycle/timer changes, no fallbackMessage removal, no stack max-visible change,
no universal AA claim. Card-local text/action contrast measured in final rendered
state; wider theme/contrast work remainsWP08. On a render failure repair only the
observed card delta, keeping geometry assertions intact.

## Amendment A synthesis — accepted stack containment blocker

Plato found a reachable five-card overflow on 320x740: wrapping increases card
height while the existing fixed-bottom stack had no vertical bound. Accepted;
card-containing stack receives max-height/scroll above, children cannot shrink
text, padding preserves focus-ring clearance. No card-count or lifetime change.
Add actual rendered mixed five-row scenarios at320/390: several failed Generate
submissions and an ordinary toast from existing safe UI action, all via the real
store/action path. If setup cannot fit the real3s lifetime, use Playwright clock
to control time in this dedicated lifetime/stack test only (do not alter production
timer or baseline per-card scenarios); after geometry assertions advance3000ms
and prove auto-dismiss still works. No arbitrary store access or test-only
production exports. If ordinary-toast action is unavailable under strictJ6,
use existing no-network UI action after verifyingits handler, never relax mutation
guards. Close mobile compose sheet with Escape before keyboard checks. Verify
stack top/bottom inviewport, scroll old/new cards into view and hit-test their
controls, including CTA-absent and mixed ordinary toast rows. Capture bothscroll
extremes. This additional test-only clock control is explicitly bounded to
stack/time regression, not a way to claim ordinary real-time screenshots passed.

Review outcome: initial GO-WITH-FIXES(blockers=1), folded as above; mainjudgment
near-pass after source grounding. Runtime stack behavior remains C-gated.

Same reviewer closure: `VERDICT: PASS`, blocking_issues empty. Scoped amendment
accepted; production implementation and rendered evidence are still pending.

Focused source test command exists: `node --test tests/toast-stack-contract.test.js`
reads actual Toast/component/CSS via existing readSourceTree. Run before amendment
B and record result. Baseline executed at P: exit0, two tests passed, no skips.
This is source-contract evidence only, not a rendered-layout pass.
Runtime E2E scenarios are new targets and execute hosted CI
after build, with final-head provenance032. Rollback card-specific overrides and
new tests together; regular toast styling/data remains unchanged.

All six original workers acknowledged pause; no new source writes are assigned
during this P/A. Their partial branch files remain intact and are not tests-green.
