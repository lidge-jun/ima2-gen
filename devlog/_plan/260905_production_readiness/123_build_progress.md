# WP12 B — scoped implementation and trailing CI

Not acceptance. WP12 remains B; WP12s/WP13, ordered feature merges and release are
not complete. Preserve119 historical failure evidence and all mandatory criteria.

## Main-owned work

- API matcher now uses case-insensitive segment-exact policy; callback exemption
  is exact path+GET. Runtime budget is per app/socket peer, before body parsing,
  with bounded peer memory, total/mutation windows,429 and Retry-After. Existing
  application tests cover token case aliases/callback methods on hosted runners.
- Pure API middleware tests:5pass/0fail locally; same transpiled source/tests on
  Windows SSH Node24.19.0:5pass/0fail (61.7123ms reported test duration). Owned
  paths /tmp/ima2-wp12-api.7T8US6 and C:/Temp/ima2-wp12-api-7T8US6 only. No app,
  account, real service, installer or execution-policy manipulation was invoked.
- Source and test typechecks both exit0 after the first integrated partial patch.
  These are not final candidate proof; workers were still editing other files.
- PR history regression first returned1fail/1pass: checkout depth2 differed from
  required0; real four-commit fixture proved depth2 ancestry exit128, then full
  history exit0. After workflow repair2pass/0fail. Original guard unchanged.
- Existing CI/release contract owner now inspects each job instead of requiring
  a literal inline git shell command.36pass/0fail including unchanged Windows
  matrix/guard negative cases. No generic checker/new npm command introduced.
- CI adds focused macOS native installation, unconditional existing comparator
  on Linux and PR merge checkout, all PR bases, full ancestry. PR whole-job budget
  is30min for the retained16.1min UI workload; individual deadlines unchanged.
- Auxiliary OAuth spike's reflected error is now nosniff plain text. Existing
  spike contracts6pass/0fail. This is source inspection, not a live OAuth test.

## Standalone prerequisite with asynchronous CI

Owned worktree /tmp/ima2-wp12-history.x4xJbf/repo starts at actual dev
f499fc7d73c08f19be76fd5b111d163bfaf3c226. Main checkout identity was reverified
after creation and remains /Users/jun/Developer/new/700_projects/ima2-gen.
Only three files changed: PR checkout depth, direct Git history regression, and
generated inventory. Existing dependency tree was linked for pure yaml/test use;
no dependency installation or global Git config changes.

Commit6efd22729b5ea5b55acd805a1f7a1f94365576ab, draft PR214 againstdev.
Focused2tests and inventory pass. Full baseline CI34025661208 was dispatched
with the same exact SHA/ref; pending at recording. Independent source review is
in progress. No merge yet. This prerequisite is not counted as a feature WP.
Do not confuse this older dev runtime's CI with cumulative WP12 acceptance.

## Delegation correction and lifecycle batch

Latest user explicitly required gpt-6-astra/high. Prior inherited workers Hume,
James and Gauss were closed; shutdown notifications observed. Replacement Curie,
Noether and Rawls plus scoped UI/review workers all explicitly use that model
and effort. Partial changes were preserved. Earlier omit/inherit instruction in
historical goal text is superseded by this user correction, not silently honored.

Curie completed the six-file SSE lifecycle batch, then was closed. Main reviewed
the production/header/backpressure diff: accepted effective cursor before flush,
strict decimal safe integer parsing, initialEventId to reconnect, no repeat POST.
Worker reports31focusedpass including legacy/pending/error/deadline/backpressure.
Removing initial cursor consumption caused2 immediate409 regression failures;
restoration passed. Historical original first-case MCP timeout remains unclassified
and is NOT resolved by this separate causal regression.

Remaining B: finish/review input and download batches, integrated J5 UI, exact-ID
CodeQL dispositions and source/docs inventory; then freeze candidate and run all
required CI. CI waiting may overlap independent work, never merge/acceptance claims.

## Subsequent evidence and corrections

Input worker completed; main reviewed metadata canonical boundary, shell-free
launch data, and parser normalization diffs. Main reran pure input+API files:
21tests/0fail. Windows-specific branches in this run are mocked, not native proof.
An owned native Windows PowerShell decoding/parameter-binding probe (external
Start-Process replaced by an in-process observer) failed before PowerShell started:
spawnSync powershell.exe EPERM. No browser launched, no policy change, no alternative
execution channel attempted. Actual PowerShell round-trip remains unverified.

PR214 reviewer found inherited GIT_DIR/worktree/global-hook state in the small Git
fixture. Accepted; inline env filtering and owned empty config/template/hooks were
added to both copies, no framework. New head d48396ec6cefc8a46d75918f0b977b8ba6cac05e,
focused2pass/0fail. Reviewer recheck pending at this entry.
Main mistakenly dispatched34025834039 with an incorrect full SHA, requested cancel
of only that erroneous run, then dispatched34025858936 with the actual Git-read
d48396ec6cefc8a46d75918f0b977b8ba6cac05e. Neither the bad request nor older green
results can count as candidate proof. PR/CodeQL runs remain independently tracked.

## First cumulative checkpoint

All B workers finished and were closed. Download worker reports100 focused
MCP/GitHub/address tests and81selected Grok regressions; no live upstream requests.
The shared transport is extracted from the previous Grok production owner, not a
new test harness. Main read the transport/policy/consumer diff; fresh independent
download review continues concurrently with candidate verification.

Fresh independent reviewer Goodall: PASS, blocking_issues=[] for completed
API/SSE/input sources and direct tests. Independently ran21isolated tests and a
two-consecutive-first-frame-EOF probe (cursor0 retained, one POST). Normalization
comparison found a nonblocking difference: empty frontmatter followed by another
delimiter preserves more body text than the old parser. Do not claim perfect
parser equivalence; normal nonempty cases retain semantics.

Main independently reran20CLI/SSE cases and11backpressure/native-owned-socket
cases:31pass/0fail, one POST in both legacy and initial-cursor replay probes.
Server/CLI builds passed, no application startup. J5 source/typecheck completed;
actual UI runtime/screenshots remain pending. Main narrowed JSON evidence to
request identity/counts and terminal summary; full request bodies/prompts are not
persisted. Assertions still compare actual bodies in memory.
