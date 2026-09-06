# WP12 C repair plan — keep PR UI on a fresh hosted runner

Observed PR Fast34026173258/job101467421810 at cc304e80: root tests pass, then
Playwright I1 fails before any app starts with J6 BLOCKED: legacy configuration
or auth store exists.257journeys do not run; missing PNG uploads are consequences,
not separate product failures. Exact offending store/writer was not logged and
must remain unknown; do not assert a specific path or delete possible stores.
Separate fullCI's UI job starts from a fresh runner and progresses through the
suite. Current PR workflow combines root tests and UI on one machine.

Accepted cause boundary: the PR job cannot promise an untouched UI-runner home
after earlier server tests. This is an isolation-contract mismatch, not grounds
to weaken appServer's existing refusal or clear account/config directories.

Minimal repair in existing .github/workflows/pr-fast.yml only: keep backend job
key fast and its complete existing tests/build/lint/budgets, rename its display
to PR backend checks. Move existing E2E+artifact steps to independent frontend
job on fresh ubuntu-latest (25min, same as fullCI). Add only prerequisites already
used by fullCI: exact merge checkout with persist-credentials:false, setup/pinned
npm, root/UI installs, server/CLI builds, then original fixture build/journeys.
Root and frontend execute in parallel. No HOME override, store cleanup, fixture
rewrite, changed test deadline/retry, lost assertion or artifact weakening.

Preserve required check display name PR fast gate as a tiny terminal gate job,
needs:[fast,frontend], if:always(), that fails unless BOTH dependency results are
success. Backend failure, frontend failure, skip or cancellation cannot yield a
green aggregate. No required-check setting changes or permission expansion.

Extend existing release-pipeline-contract.test.ts to verify graph/result predicate,
frontend exact checkout/guard ordering, full E2E and artifacts and absence of root
suite in frontend. Existing pr-fast-history.test.mjs still reads jobs.fast checkout;
do not generalize it into a framework. Inspect the amended PR job on actual CI;
an older source run is diagnostic, not final-head acceptance. This same-WP repair
preserves121's outcomes while replacing its single-job scheduling assumption.

Independent plan reviewer Wegener PASS/blocking_issues=[]; test-file change is
explicitly in scope along with workflow/operations docs. Implemented graph keeps
all original backend and UI/artifact steps. The aggregate uses a tiny Node
predicate (same built-in runner runtime as the early SHA guard), not a
platform-specific shell. Existing contract executes that actual predicate with
all16success/failure/cancelled/skipped result pairs, using only those two env
values; only success/success exits0. Focused history/release contracts36pass/0fail.
No new test framework/runner and no local app or account-store operation.
