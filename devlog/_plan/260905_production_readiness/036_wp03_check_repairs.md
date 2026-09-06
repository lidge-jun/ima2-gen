# WP03 C — first candidate findings and bounded repairs

Candidate `0a59597c12e60e281c5d39011167f90c5accc940`, draft PR #202 over #201.
CI `33953378983` failed. This record does not count the candidate as accepted.

## Independent review M1: cancellation must not hide fixture failures

Production-parity reviewer Kant found no High/Medium regression and passed138
focused cases. Safety/UI reviewer Helmholtz found a real false-green path:
after the handler is canceled, any unrelated upstream fixture exception was
excluded from the violation ledger solely because signal.aborted was true.

Accepted RCA: cancellation state is not error identity. The fixture now allows
only `signal.aborted && error === signal.reason`. A real classic handler test
cancels then throws UNMATCHED_ENDPOINT_SENTINEL; HTTP202/cancelled terminal can
remain normal, but harness cleanup must reject with that exact sentinel.
Original guard failed this regression; repaired harness10/10 plus classic/node
cancellation tests1/1 each passed. Same independent reviewer verified closure.
No production lifecycle/retry code changed.

## CI radius-manifest synchronization

Both Node22 and24 had exactly one failing full-suite case: radius declaration
count477 vs frozenmanifest476. The new card CTA uses existing var(--r-sm), but
its selector was absent from the per-declaration manifest.

Added exactly one literal `.toast--card .toast__cta` manifest row and count477.
All-source enumeration, uniqueness, exact token and !important checks remain.
Focused radius suite11/11 passed; combined existing toast/radius suite14/14.
This is an explicit new declaration, not a blanket snapshot regeneration.

## Visual failure and actual pixel RCA

Frontend39 cases:37 passed, mixed five-row320/390 failed control hit testing.
Sixteen single-card scenarios had passed automated assertions, but main opened
the actual KO320 PNG and found its action partly obscured by bottom navigation.

Evidence under `devlog/_artifacts/260905_production_readiness/wp03/0a59597c/`:
`wp03-errors/execution-admission-WP03-g-00705--card-and-keyboard-controls/`.
Card bottom712; CTA660..704; navigation begins around683. CTA center682 passes
the center-only hit test despite text/control clipping. Main visually inspected
the image and read the paired DOM geometry. No visual PASS is inferred from the
sixteen automated passes.

Root cause: toast stack z130 sits below sticky header150 and mobile nav160.
An overflowing mixed stack also begins at y24, inside the header. The narrow
correction places only card-containing mobile stacks at z165, above navigation
but below compose backdrop170/sheet180. No guessed header dimensions, global
toast change or jump above input sheets. These temporary overlays may cover
navigation; all card text/actions must remain visible and dismissible.

The same KO320 frame also split the word 시도하세요 across lines. The card-only
message rule now uses word-break:keep-all while retaining overflow-wrap:anywhere
for genuinely unbroken long inputs. No global typography or literal copy change.
Final narrow/CJK captures must verify the resulting line breaks and containment.

Strengthen full text/control occlusion samples, record hit-element identity and
header/nav bounds, and capture mixed PNG/metrics before assertions. Keep18
scenarios, viewport bounds, 44px targets, clock/lifetime assertions and isolation
guards. Original UI worker owns only this observed card CSS/test delta.
Fresh exact-head CI and dual pixel/DOM inspection remain required.

## Prior evidence retained, not reused as final

Main aggregate receipt passed154 test cases including child runs. Manual curl
pass captured13 scenarios/14 requests with four real route registrations and
synthetic intercepted upstream; all13 ephemeral ports were absent after teardown.
These belong to0a59597c, not a later repaired commit. Failed CI/artifacts remain
available. No paid provider calls, user server restart, merge or release occurred.
