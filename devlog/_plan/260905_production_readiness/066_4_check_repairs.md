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
