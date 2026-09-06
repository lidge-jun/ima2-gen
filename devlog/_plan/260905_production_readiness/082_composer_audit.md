# WP08 A — round-one synthesis

Input/IME reviewer Sartre01a072c9-2491-7830-b7eb-64af18cac70f PASS with no blockers.
CSS/hosted reviewer Cicero01a072c9-251e-7933-ad1c-cf5b340ec5ab FAIL, two High and
two Medium findings. Main remains A; no implementation while FAIL is recorded.

Root cause across the four findings: the audit compared current pre-B production
and tests to the desired future behavior. Their observed deficiencies are real,
but081 already assigns their repairs. This is plan audit, not a claim that current
code meets the plan. Preserve observations as B/C checks; do not pretend they are
already implemented. Request the same reviewer to assess whether the written
future changes are sufficient, with the two concrete refinements below.

| Finding | Main disposition before re-audit |
| --- | --- |
| G1High: current J6 returns202 | Fold clarification.081 additional map assigns nonGenerating and the Hosted section explicitly wires abort of malformed/normal generation paths before202. Add isolated routing self-test with deliberate blocked requests; geometry/input cases still zero generation. |
| G2High: currentmobile72 assertion | Rebut as missing-plan blocker:081 acceptanceP08-1/2/3 explicitly independently asserts both160;080P08-3 also does. Keep as implementation/C requirement, do not weaken floor. |
| G3Medium: negative-onlypane measurement | Rebut as missing-plan blocker:081 explicitly sequentially reveals both label/textarea/hint and tests scrollHeight/clientHeight/actualscrollTop; new composerGeometry helper has assignedowner. Existing J7 is knowingly inadequate. |
| G4Medium: current noWP08upload | Fold detail.081 assigns bothworkflow edits +outputPath artifacts, but spell out retention7days, no-files error, ifalways; absence on an earlier failure is honest missing evidence, never a visual pass. |

No design/scope conflict with input reviewer. No High is waved through. The
re-audit must end with a real new verdict on081+082, not spend an oldFAIL asPASS.

## Concrete B refinements

Hosted geometry lane adds `ui/e2e/j7-capture-policy.spec.ts`, a test-only synthetic
page with no app render/server child and fresh guarded context. Under hosted
preflight, install the exact J6 capture in nonGenerating mode, deliberately send
normal image/video and malformed generation requests from this synthetic page,
and assert all aborted/no202, recorded denied attempts, no upstream/continue.
The self-test treats these exact declared rejections as expected and asserts no
others; it does not use withJ6's normal unexpected-empty success contract. It
never dispatches a provider or starts the application. Record wp08-policy JSON
and full teardown. Native geometry/input cases still forbid all generation POSTs.
Add exact spec to the planned hosted file invocation. No localbrowser execution.

Both existing workflow upload steps gain a separate wp08 artifact with
`if: always()`, existing pinned upload-artifact action, `retention-days:7`,
`if-no-files-found:error`, paths `ui/test-results/**/wp08-*.png` and
`ui/test-results/**/wp08-*.json`. Names bind run/attempt and SHA where existing
convention provides it. Missing screenshots after a preflight/build failure
remain missing proof; the extra upload failure must not hide the original error.

## Main current-tree follow-through

`tests/composer-tray-ui-contract.test.js:44,57` also directly reads moved textarea
z-index/sidebar-stack fromprogress. Main owns updating only those reads to the
new pane stylesheet, preserving mirror/tray/shell assertions inprogress. Include
it and the source-consumer contracts for prompt-studio, issue77 longprompt,
provider-ui-polish, inflight-badge, ui-touch-target andui-gradient in direct checks.

Current `ui/tsconfig.e2e.json` has no JSX option. The new actual component TSX entry
would otherwise fail typecheck. Component-verification lane owns adding
`jsx:react-jsx`, `resolveJsonModule:true`, `DOM.Iterable`, and`vite/client` types to
this existing config, preserving existing strict/noEmit/include. This checks
actual imported production TSX/Vite env, not merely a string evaluated by esbuild.
No new tooling, runtime flag or production config. Main runs both app/E2E checks
after integration; baseline both exited0 at e835 before this new entry existed.

## Round-two synthesis and final routing amendment

Sartre re-confirmedPASS. Cicero returnedGO-WITH-FIXES(blockers1): the synthetic
policy page lacked an explicit document/asset activation path. Accept: merely
calling a serverless origin would fall through currentJ6 static route.continue.

Exact self-test sequence: create fresh empty context(SW blocked); install J6
capture at synthetic `http://127.0.0.1:49152` withnonGenerating; install a LAST
outer route for all URLs. Outer route fulfills ONLY exact GET origin `/` with
fixed emptyHTML, no script/src/image/stylesheet assets. For exact same-origin
POST `/api/generate` or `/api/video/generate` with no query it calls
`route.fallback()` to the already installed J6 handler. EVERY other URL/method
is recorded as unexpected and aborted. Thus no document/static request reaches
continue or a real socket, and there is no server or bind claim for49152.
Only then create/navigate page and execute the three declared POST fetches
(imageJSON/videoJSON/malformedJSON) within that same origin. Capture abort occurs
before payload parsing and before202. All fetches reject; exactlythree denied
generation attempts and0acceptedrequests,0unexpected-other,0upstream/continued.
Persist intendeddenials separately from unexpected traffic; normal withJ6 fails
when any deniedGeneration exists. Keep both route layers until pageclose; close
context in finally and verify every request outcome. WebSockets are always closed.

This directly folds the residual, without weakening zero-generation UI cases or
claiming runtime proof. Main judges A near-pass only after this concrete amendment;
the final C reviewer is fresh. Original round-one FAIL is not the exit verdict.
