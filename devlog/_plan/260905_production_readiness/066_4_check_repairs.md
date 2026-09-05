# WP06s C — observed failures and repairs

Candidate92fae36b / PR207 above206. New platform workflow run33970717208 failed
before creating jobs. No platform test ran; do not call this a Windows/test failure.
Main `actionlint .github/workflows/agy-artifact-check.yml` exited1 and identified
line50: runner context is unavailable in job-level env; available contexts are
github/inputs/matrix/needs/secrets/strategy/vars. The parsed-YAML contract had
required this invalid form, so 13 green contract tests did not establish GHA
expression validity. Actual first-run failure is retained, not hidden by retries.

Accept the workflow-context blocker. Keep a unique output basename in job env,
resolve runner.temp only in allowed run/upload step expressions (or equivalent
step-local env). Update independent parsed expectations and add a negative for
runner context at job env. Main runs installed actionlint on this exact workflow
in addition to real tiny driver contracts and both project typechecks. No new
dependency, bootstrap merge, privileged trigger or protection bypass is needed.
Re-push a corrected tip and require fresh four-row/platform and canonical CI.
Initial canonical CI33970737635 / CodeQL33970738595 belong to92fae36b, not a
later repaired head. They cannot certify a changed tip.

Worker corrected only workflow/context contract; actual actionlint exit0,
13 tiny driver-contract tests PASS and project typecheck:tests exit0. Main
independently re-ran exact-file actionlint and checked the scoped diff.

## Actual source mutations

Main mutated actual production source, ran the exact named verifier, restored
the original source with apply_patch and reran the same verifier:

- Scanner leaf-link exclusion: removed both Dirent link/regular-file filters.
  The owned matching-symlink test failed expected equality, then passed restored.
- Root containment: removed parent/absolute rejection in the shared relative-path
  predicate. The owned directory-link/sibling/traversal verifier failed missing
  expected rejection, then passed restored.
- Stream cap: removed the overflow-byte rejection. The tiny17-byte/16-byte-cap
  verifier failed missing expected rejection, then passed restored.

All three RED runs exited1, all restored runs exit0. Raw files live in session
wp06s/mutations/{scanner-link,containment,streamed-cap}-{red,restored}.txt.
No large local allocation, user file or provider call. git diff -- lib routes is
empty after restoration; no mutation was built into emitted JS or committed.

## Four-row run33970927606 at8a4987ac

macOS24 light and Linux24 heavy passed. Windows failed before dependency install:
the npm probe reported11.13.0 after pinning12.0.0. The shared npmInvocation helper
uses npm_execpath when present, otherwise Windows's Node-adjacent CLI; this plain
Node workflow/driver had selected the older adjacent copy. Fix the new gate's
explicit npm binding, not the required version or shared runtime helper.

Linux22 failed two small allocation-oracle cases in the bounds file. Hosted TAP
is saved under wp06s/platform-first-node22. The short-read case observed the four
8-byte blocks plus a25-byte allocation, while expecting only the blocks. Suspected
cause: Buffer.concat's Node22 implementation invokes the observed allocUnsafe for
its allowed final result. Require source/runtime confirmation and distinguish
chunk retention from final bounded concatenation, preserving both checks. No
production defect or large-boundary failure is asserted from these two test errors.
Reused original workers on disjoint CI/test repairs; no unchanged blind rerun.

Node22 allocation RCA confirmed on local22.22.3 (not hosted22.23): native concat
calls the exported allocUnsafe, while24.17 allocates internally. The revised
oracle separately records actual read-block identity/count/size and the single
bounded concat result. Both original failing cases plus two overflow controls
pass4/4 on local22.22.3 and24.17; hosted default50MiB still requires the new tip.

Windows npm repair installs the pinned version in a runner-temp prefix, verifies
that exact CLI and exports its path for dependency install/build and driver
identity. Test children do not inherit the binding. Shared npm helper is unchanged.
Worker actionlint,15tiny contracts and both project typechecks pass; actual
Windows still requires hosted execution. No expected version was relaxed.

## Independent reader C documentation finding

Locke2 (01a071e9-1dae-7893-8168-190d0d35ff8b) found no production reader/caller
blocker and passed four tiny checks plus six exact source/emitted comparisons.
Its Medium finding is accepted: docs/API's new blanket no-generation-retry
statement contradicts unchanged nodeGeneration.ts:300-340. Reference-free node
requests can retry once after retryable artifact502 errors. Qualify the reader's
no-added-retry behavior and explicitly preserve caller retry policy, rather than
changing pre-existing runtime semantics in this unit. Also clarify that direct
GENERATION_CANCELED/499 can normalize to node INVALID_REQUEST/499. This is a
source-grounded documentation correction, not a live provider retry claim.
