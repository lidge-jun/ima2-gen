# WP10 — verified operational diagnostics

Frozen implementation/test candidate53c4dea3555835fcf2e19c4b366ad2e0e109b43f.
PR212 is stacked above211. This closes WP10 verification only: no stack PR merge
or release has occurred. Any later closeout-only commit is documentation, not a
newly executed CI candidate; source equivalence is recorded separately.

## Delivered product

Offline installation doctor runs before config/account initialization. Structured
doctor JSON and compatibility bundles have fixed messages, stable codes, derived
exit status and no arbitrary provider error payloads. Runtime/key checks are
explicit and bounded through response cleanup. The Node floor follows package
engines. Existing logger masks URL/userinfo/query/Bearer patterns before truncation
and omits nested causes/bodies/stacks. No new logging sink or test framework.

## Fresh evidence

FullCI34010804208 SUCCESS at53c4dea3: bothNode22/24 root suites3232tests,
3228pass/0fail/4existing skips; builds/types/inventory/dependency audits, package
install/globalupdate/CLI smoke and publish dry-run passed. UI258PASS in16.6min.
Diagnostic34010737116 passed34focused cases, actual emitted CLI JSON/exit/offline
boundaries, and exactly1existing human doctor case with0skips. CodeQL34010805149
SUCCESS, analysis1730920555:93inherited findings, noadded/absent ID/rule/severity,
allinstancesatcandidate. Inherited security disposition remains WP12/release-blocking.

Session evidence wp10/53c4dea3-{cli,codeql,root-ci}-evidence.json and
53c4dea3-visual-observation.json retain details. Main directly opened4current CI
captures: sidebar/bottom/mobile short views and bottom negative input after scroll.
Short viewports require internal prompt scrolling; the toolbar stays outside it.
Actual bottom input heights86/105.5px and grid scroll0→226 are in its geometry JSON.
This is extra cumulative observation, not a new UI implementation or paid generation.
Fresh C reviewer McClintock found0incremental findings; Hume confirmed the prior
legacy config parser correction. Main verified their exact source pointers.

## Repair and residuals

First fullCI34010421031 failed one old Node20literal in tests/bin.test.js on both
Node versions.104records root cause and minimum correction to the package-declared
requirement; no assertion was removed. Its superseded UI tail was cancelled after
the replacement fullCI was running, and is never counted as pass.

No live credentials, keyring, operator port or paid provider probe was used locally.
No generic guard/fixture expansion. Standard doctor retains existing OAuth failure
policy; installation mode excludes account checks. Arbitrary opaque free text in
other direct console sinks is not newly protected. WP12 still owns inherited
security and macOS watcher verification. The dead hypothesis was a broken engine
parser: its exact package input was correct; the stale test expectation was wrong.

Next: WP11 consumes the existing engine parser and installation report; it must
not reimplement them. Revalidate110in a new PABCD cycle. Preserve scripts/recording/
and all unrelated state. Global merge/release criteria remain open.
