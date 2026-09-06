# WP07 C — observed activation and CLI repair

bc83b5ff CI E2E50PASS/3FAIL. Actual node steps rule out load and SSE: nativeOPEN,
visibility and enabled all pass; click fails because MiniMap intercepts its center.
Main viewed both preaction and failurePNG and read geometry: Gen center≈815,716
hits react-flow__minimap-svg at zoom1.838. No guessed timing fix is warranted.

## Node activation

Use existing user-facing Zoom Out control, at most3 clicks, until the actual Gen
button center is hit-testable; then ordinary Playwright click. Preserve initial
occluded screenshot/geometry and capture ready geometry after adjustment. No force
click, CSS hiding, injected ReactFlow state or production zoom change. This task
tests terminal warning, not arbitrary canvas positioning: panning/zooming is a
normal canvas interaction. Record default fit/HUD overlap as an observed initial
state, not as a fixed layout defect or a universal no-overlap promise.

## Mixed toast regression

The two WP03 mixed cases fail before POST because their HEIC error toast now uses
the wrapped error layout. They used .toast--card to infer semantic row kind. Keep
the same real HEIC trigger and four provider refusals; select the known HEIC notice
by its independent literal text, and exclude it from provider-card enumeration.
It is now expected to wrap with44px dismissal and no CTA. Retain5 rows,4 submissions,
scroll extremes/full glyph geometry, keyboard focus, hit testing and3s lifetime.
J7b animation success additionally proves ordinary success remains nowrap/compact.
No production data attribute or test-only exported handler is added.

## CLI unknown options (bounded C QA fix)

RealCLI capture atbc yielded30PASS/1FAIL: gen --qa-unknown-flag reports only missing
prompt. Source inspection shows gen/upscale ignore parseArgs._unknown; video
already rejects it with die(2,"unknown option: ..."). Apply that existing policy
after help and before positional/file/catalog/server handling in gen/upscale.
Valid commands and help precedence remain unchanged. No new parser or dependency.

MODIFY bin/commands/{gen,upscale}.ts: one local boundary guard each.
NEW tests/cli-unknown-options.test.ts: actualCLI child with stripped environment,
owned valid config/default roots and forced loopback server; unknown long/short
flags with/without positional input return2/nameflag/stderr and0server requests;
help returns0 before unknown validation. Every parent server/child/temp root gets
teardown proof. Negative baseline must fail before guard, then same tests pass.
No provider/auth/user3333/paid request. Test server refuses all provider POSTs.

MODIFY ui/e2e/{j7b-tracking-timeout,execution-admission}.spec.ts for activation and
selectors described above. CLI and manualvideo/Agy workers acknowledged all prior
capture resources absent BEFORE these tracked edits. bc evidence remains pinned.
Fresh compilers/tests/review/CI/manualCLI required; no FAIL is relabeled PASS.
