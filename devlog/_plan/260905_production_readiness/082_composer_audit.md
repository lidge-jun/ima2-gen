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
