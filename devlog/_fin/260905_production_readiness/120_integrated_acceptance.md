# WP12 — Exact-candidate, cross-platform integrated acceptance

Execution amendment: [121_lean_delivery_plan.md](121_lean_delivery_plan.md)
supersedes this WP00 design's stale implementation map and commands. In particular,
no new workflow-checker framework or J12 harness is authorized; existing SHA,
fixture and J5 owners are reused. Original acceptance obligations remain open.

Status: WP00 design, not executed. Class C4 CI integrity/release-readiness boundary.
Archetype repair/integration. Trigger: current tests pass while e2e ignores dispatch
SHA, PR base filters exclude mid-stack work, baseline Windows was schedule-only, successful
visual evidence is not collected consistently. Goal: the exact cumulative candidate
is checked through isolated UI recovery, packed installation, and every relevant
hosted CI job, with evidence that a reviewer can actually inspect.
Non-goals: paid provider canaries, release script replacement, new orchestration,
branch protection edits, a second browser fixture, universal workflow framework.
Verifier: executable SHA guard, parsed workflow negative tests, integrated journey,
artifact readback. Stop: all mandatory candidate jobs success on same SHA, usable
visual artifacts observed, review resolved. Parent owns goal/FSM/git/merge/release;
escalate missing fixture seam or permissions, not bypass. No leaf delegation.

## Dependencies and independently meaningful outcome

### WP05-discovered inherited CodeQL debt (registered at WP06 P)

The `wp12/codeql-triage` goalplan task is mandatory. WP05 exact-head analysis
1728958810 at54543ee0 and the then-current dev reference each reported the same
93 open alert IDs, including inherited High/Critical path, command and URL flows.
Zero introduced Grok alerts is not proof these inherited alerts are false positives.

At this P, refresh full alert instances and trace each High/Critical report through
its exact source/sink, validation, trust boundary and real caller. Record alert ID,
source SHA/path/line, reachability, classification and executable negative evidence.
Fix genuine in-scope defects; append dependency-ordered implementation WPs and
their own PABCD/PRs if the fix is an independent outcome. A false-positive decision
requires concrete source-grounded proof, not baseline age, count parity, scanner
silence or a green workflow. Do not auto-dismiss alerts or weaken scanner rules.
Unresolved reachable High/Critical findings prevent WP12 acceptance and release.
Repeat the analysis against the integrated post-WP12s candidate during WP13.

Evidence anchor: `058_wp05_check_synthesis.md`, PR204, CodeQL33959122484;
session `wp05/54543ee0/ci-codeql-evidence.json` retains the comparison and raw runs.

Semantic: WP01–06 capability/selection/execution contracts; WP07 tracker/replay;
WP08 real composer affordances; WP09 isolated fixtures and journey assertions;
WP10 doctor report; WP11 install/generated-output checks, standalone Windows
dispatch/ref/SHA guard and Pages publication compatibility tests (009/110 and
[111_pages_publication_gate.md](111_pages_publication_gate.md)).
Stack base WP11. The parent
subsequently registered WP12s (125, security lane) before WP13 delivery; original
semantic prerequisites remain unchanged. Run this cumulative gate at WP12, then
AGAIN after WP12s as part of WP13/c15. This PR changes enforcing CI, a cross-layer acceptance journey and
evidence capture; it is not a docs-only checklist or counted as WP09's tests again.

WP09 owns `ui/e2e/fixtures/appServer.ts` and `stubUpstream.ts` isolation changes.
WP12 must NOT overwrite them, spread ambient env anew, add test-mode production
routes, or seed real OAuth. Required retained public seam:

```ts
startApp(mode?, options?): Promise<AppHandle>;
seedBrowser(page, options?): Promise<void>;
assertStubOnlyCalls(stub): void;
// AppHandle: baseUrl, stub, home, close(): Promise<void>
// WP09 also supplies app.isolation.assertClean(), deniedConnections/deniedProcesses.
// WP12 must call assertClean, not treat stub Host-header checks as egress proof.
// StubHandle also supplies generationRequests and setMode(mode).
// BrowserSeedOptions types provider/profile/locale; seed once per session,
// never invoke seedBrowser again on a same-origin reload.
```

WP09 must make close await process exit and allow caller-owned `home` reuse;
teardown policy for generated temp dirs must be documented there. Required local
fixture controls for the integrated cancellation scenario (confirmed in canonical
090; WP09-owned, not invented in WP12 source):

```ts
// Only on a controlled generation stub, no production API changes:
holdNextGeneration(): { submitted: Promise<void>; release(): void };
// host isolation guard reports attempted outbound calls, including calls that
// never reached the stub (stub Host-header inspection alone is insufficient).
```

The visual lane confirmed this exact holdNextGeneration signature in
[090_user_journeys.md](090_user_journeys.md). WP09 owns deterministic hold-fixture
verification; WP12 owns the application cancellation scenario. Waiting uses
submitted/close signals, not arbitrary sleeps. This is a finalized documentation
contract, not executed fixture or cancellation proof. Early
WP02/WP08 browser evidence remains isolated hosted-runner/no-secrets/intercepted
generation proof; do not retroactively claim WP09's stronger socket guard ran there.

WP12s may add cookie/header bootstrap after this gate's first execution. Keep WP12
fixture loops anonymous on loopback as agreed; do not pass ambient LAN tokens into
test children or classify an auth challenge as provider failure. Security lane owns
LAN-specific cases and API/DOCKER docs; WP13 reruns these unchanged cumulative gates
after integrating that layer, including doctor and generated-media retrieval. An
unexpected 401/403 is a seam failure to main, never grounds to bypass the new policy.

## File change manifest

| Action | Exact path | Purpose |
|---|---|---|
| MODIFY | `.github/workflows/ci.yml` | Explicit ref+guard every checkout; candidate Windows/macOS; docs/output gates and evidence |
| MODIFY | `.github/workflows/pr-fast.yml` | All PR bases, explicit merge SHA guard, same new checks, success artifacts |
| CONSUME, NO EDIT | `scripts/assert-ci-sha.mjs` | WP11-owned comparator; extend callsites, not its contract |
| CONSUME, NO EDIT | `tests/ci-windows-candidate.test.ts`, `tests/pages-publication-contract.test.ts` | WP11's independently registered Windows/Pages negatives remain mandatory |
| NEW | `scripts/check-readiness-workflows.mjs` | Parsed exact-shape checks for these two workflows only |
| NEW | `tests/ci-candidate-integrity.test.ts` | Executable guard and parsed per-job workflow mutations |
| MODIFY | `tests/release-pipeline-contract.test.ts` | Replace ci-wide text-presence assertion with per-job structured checker |
| NEW | `ui/e2e/j12-integrated-readiness.spec.ts` | UI selection→local execution→cancel/recovery→restart with correlated evidence |
| MODIFY | `ui/playwright.config.ts` | Retain failure traces and structured reporter; no retries increase |
| MODIFY | `ui/package.json` | Named targeted integrated journey command |
| MODIFY | `package.json` | Named read-only workflow integrity check command |
| MODIFY | `structure/06-infra-operations.md` | Event/SHA/job evidence matrix and interim caveats |
| MODIFY | `structure/04-frontend-architecture.md` | Integrated journey coverage vs upstream proof |
| MODIFY | `docs/migration/runtime-test-inventory.md` | New test inventory |
| MODIFY | `structure/01-file-function-map.md` | Script/test owner references and counts |

DELETE files: none. Explicitly unchanged: release.yml, publish.yml, package-health.yml,
wait-ci-gate.mjs, WP09 fixture owners, production TS routes and adapters. Parent's
WP13 uses existing canonical release machinery and actual provenance readback.

## Exact SHA guard: consume the WP11 contract

`scripts/assert-ci-sha.mjs` already exists from WP11 (110), ESM,
built-in child_process/url/path only. Its unchanged shared signature is:

```js
export function assertCiSha(expected, actual) {
  if (!/^[0-9a-f]{40}$/.test(expected)) throw new Error('EXPECTED_SHA must be a full lowercase 40-hex SHA');
  if (!/^[0-9a-f]{40}$/.test(actual)) throw new Error('HEAD must be a full lowercase 40-hex SHA');
  if (expected !== actual) throw new Error('checked-out HEAD differs from EXPECTED_SHA');
  return { expectedSha: expected, actualSha: actual };
}
```

The WP11 main guard executes `git rev-parse HEAD` using execFileSync, validates
process.env.EXPECTED_SHA, prints only the comparison JSON; errors to stderr/exit1.
No fetch, ref changes, credential use, GitHub lookup, release identity fallback or
arbitrary shell evaluation. This is a CI-local comparison, not new release provenance.

## Workflow diffs

### ci.yml — one revision expression for all executable candidate jobs

After WP11, test and windows checkouts use input SHA; e2e still omits `with.ref`.
Windows already has the unconditional comparator. Every job below
must have the SAME explicit checkout ref and unconditional assertion after setup-node
(before npm install or any source execution; setup-node supplies the pinned runtime):

```yaml
with:
  ref: ${{ github.event.inputs.sha || github.sha }}
  fetch-depth: 0
# after setup-node, before npm ci
- name: Assert candidate checkout
  env:
    EXPECTED_SHA: ${{ github.event.inputs.sha || github.sha }}
  run: node scripts/assert-ci-sha.mjs
```

Apply to test matrix, windows matrix, e2e, and the new macos-install job. Keep pinned
Action SHAs. Replace the old conditional Bash assertion, do not leave two diverging
definitions. On push/schedule absent input, github.sha is still explicit and asserted.
Malformed nonempty dispatch SHA fails, never falls back silently. Do not infer test
identity from run.headSha when dispatch ref and requested SHA differ; record both.

Retain WP11's Windows condition (do not count it as a new WP12 implementation):

```yaml
if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
```

Keep existing Node22/npm11 and Node24/npm12 matrix, builds, full tests and packed
smoke. Retain WP11's explicit Windows installer behavioral step so a skipped
POSIX branch is not mistaken for Windows execution. Schedule remains maintenance;
WP11 already supplies candidate-specific Windows proof. Do not call a prior nightly
run per-layer proof. No local whole-suite execution.

Add `macos-install` on the SAME schedule/dispatch condition, runs-on macos-latest,
Node24.17.0/npm11.18.0, timeout 30 minutes. Checkout/guard as above, root/UI npm ci,
native smoke, server/CLI/UI builds, focused `install-runtime-contract.test.ts`,
`doctor-runtime.test.ts`, `doctor-report.test.ts`, `test:package-install`. No redundant
full suite on this extra OS lane. It proves macOS install behavior, not Windows.
Ubuntu test matrix executes POSIX Linux fixtures. Public macOS/Windows release
claims require these candidate jobs plus WP13 installed release smoke.

After existing builds in test/windows/macos-install, run
`npm run verify:built-runtime` and `npm run docs:runtime:check`; after dependencies
in test/e2e/fast run `node scripts/generate-contract-docs.mjs --check` and
`npm run test:ci-integrity`. Baseline e2e built only UI, but WP09 now owns
build:server and build:cli steps before Build ui for its emitted isolated fixture.
Preserve those existing predecessor steps, then add the emitted/runtime docs checks;
do not add duplicate builds or run a check before its inputs exist. Record SHA guard
JSON in each job log and job summary.

WP09 also owns the concrete UI build receipt producer: ui/package.json's
build:fixture invokes scripts/write-ui-build-receipt.mjs, retaining the compiler/Vite
stages inside one parent transaction, and emits ui/dist/.ima2-ui-build-receipt.json.
The existing appProjection consumer uses scripts/lib/uiBuildReceipt.mjs to verify
source/head binding and the full HTML/public-asset inventory. WP12 preserves and
consumes this implementation; it adds no second receipt schema/producer and must
not bypass it with a direct Vite-only build for E2E fixtures. E2E and PR-fast
call build:fixture after server/CLI emit; ordinary build/ui:build/prepack/release
and source-serve rebuild remain unchanged and do not certify source fixtures.
Exact-candidate CI requires Git binding;
source-ZIP digest-only support is not exact-commit CI proof.

### pr-fast.yml — mid-stack coverage without confusing merge SHA and head SHA

Before:

```yaml
on:
  pull_request:
    branches: [main, dev]
```

After: `pull_request: {}` with no branches/branches-ignore/paths/paths-ignore filters.
Retain read-only permissions and fork-safe pull_request, never pull_request_target.
Checkout explicitly `ref: ${{ github.sha }}`, fetch-depth:0. Keep blob budget base
HEAD^1 because this job tests GitHub's synthetic merge commit. Guard EXPECTED_SHA is
github.sha, NOT pull_request.head.sha. Job summary must name merge SHA and PR head
SHA separately; exact layer-tip proof comes from ci.yml dispatch with full tip input.
Do not change branch protection/check names or claim API-read verification proves
protected-branch settings. Main independently checks host-required checks before merge.

After existing builds: WP11 docs/output checks and parsed workflow-integrity check.
Existing full suite and UI suite remain, no timeout lowering or skips to meet budget.
If budget exceeds 15min, evidence-driven replan before changing gate semantics.

### Success and failure artifacts

Playwright before trace:"off". After use `trace:"retain-on-failure"`,
`screenshot:"only-on-failure"`, reporter `[["list"], ["json", { outputFile:
"test-results/results.json" }]]`. Preserve workers=1/retries=0. WP09 may already own
some of these settings; amend cumulatively, never revert its isolation or locators.
J12 explicitly attaches successful screenshots and a scenario JSON with testInfo;
ordinary failure screenshot setting alone cannot prove successful visuals.

Replace e2e/fast failure-only artifact upload with `if: always()` and path
`ui/test-results/`, `if-no-files-found:error`, names including github.run_id,
github.run_attempt and job identifier. Every successful required run has results.json
and J12 screenshots; on earlier build failure missing artifacts remain a failure,
not a green job. Retain 14 days for review; main copies final observed evidence to
the approved durable release location in WP13. No uploading config homes, raw server
logs, storage DB, browser cookies, credentials or paid provider results.

## Parsed workflow checker: complete new-file design

`scripts/check-readiness-workflows.mjs` uses already-installed `yaml` (no dependency
addition), fs and main guard. Export
`validateReadinessWorkflows({ ci, prFast }): string[]`, taking parsed YAML objects.
CLI reads only the two named files and exits1 for any findings, 0 otherwise.
Policy is deliberately specific, not a generic GitHub expression interpreter:

1. Require ci jobs test/windows/e2e/macos-install; each has exactly one checkout,
   correct exact ref expression, unconditional non-continue-on-error SHA guard and
   EXPECTED_SHA expression. Guard after setup-node but before dependency/build/test
   steps. Missing or newly added checkout-bearing ci job is checked too.
2. Require test/e2e always applicable; windows/macos condition exactly the supported
   schedule-or-dispatch expression. Require both declared Windows matrix pairs.
3. Require pr pull_request event unfiltered, no pull_request_target; PR checkout and
   guard use github.sha; fetch-depth exactly 0 and blob comparison HEAD^1 retained.
4. Required build/check/test steps may not have `if:false`, success-masking shell
   suffixes, or continue-on-error. Exact known run entries are compared as values;
   only guard ordering is structural, not regex over the entire document.
5. Require success artifact upload always, expected path and missing-file failure;
   no secret-bearing directories. Checker does not claim to interpret every possible
   YAML workflow or prove actual GitHub scheduling: hosted dispatch is independent.

Pages is deliberately NOT a third input to this checker. Its separate executable
`tests/pages-publication-contract.test.ts` is owned and registered by WP11 under
009/110/111, and validates the real pages.yml ordering plus real
`scripts/pages-publication-gate.mjs` compatibility guard
negatives BEFORE upload/deploy. WP12 consumes that test through canonical full CI
and explicitly runs it in the focused command below; missing test or skipped
execution blocks readiness. This keeps release.yml/publish.yml unchanged and
avoids two conflicting Pages validators. Its gate success is not publication;
WP13 still needs exact released-site dispatch and deployed-byte readback.

Package script: `"test:ci-integrity": "node scripts/check-readiness-workflows.mjs"`.
Replace only tests/release-pipeline-contract.test.ts's three broad ci regex assertions
with this checker call; retain unrelated release contract tests unchanged.

Negative tests independently clone parsed fixtures, mutate one field, and assert
specific job/path failure: e2e checkout ref absent; windows ref hardcoded main; guard
conditional or continue-on-error; guard after build; no Windows dispatch; PR bases
main/dev; PR head SHA substituted for merge SHA; no success artifacts; test step
skipped; newly added job with unpinned checkout. Golden valid fixture passes; a
harmless step name change passes. Also invoke assert-ci-sha as subprocess with actual
HEAD and a different 40-hex fixture SHA to observe exit0 vs exit1, plus short/empty
input. Expected values never derive from the checker itself.

## Integrated journey design (NEW j12-integrated-readiness.spec.ts)

Use WP09's safe MiniMax local stub as deterministic generation fixture. Import
`test` from `./fixtures/appServer` (the WP09 worker-cleanup owner), and `expect`
from `@playwright/test`; do not use the raw Playwright test export and bypass
projection/home cleanup. Retain the same startApp/seedBrowser APIs.
This journey
joins catalog/composer/lifecycle/install contracts but does NOT claim OpenAI/Grok/
Google upstream success; WP04–06's own wire/adapter tests remain separate mandatory
CI tests. Do not invent a live success canary or multiply providers just for a matrix.

Test 1, successful artifact and restart:

1. Start isolated app, seed supported fixture model. GET /api/capabilities and
   /api/models using app's own context, read actual selected lane/model UI.
   Assert the app's intercepted POST carries the selected legal lane/model pair;
   use `app.stub.generationRequests` separately to compare the actual upstream model
   and count. Provider lane may not exist in upstream body; do not assert a nonexistent
   field. Use WP08/09 finalized accessible selectors.
2. Submit a fixture prompt once. Capture real requestId from 202 response, observe
   matching terminal state and generated result. Assert exactly one stub generation,
   corresponding history filename, zero outstanding job for that requestId. Read
   image naturalWidth/naturalHeight >0, not a placeholder div visibility assertion.
3. Attach desktop success screenshot at 1280×720 and narrow view at 390×844 after
   layout settles via assertions; ensure visible composer/result, no horizontal
   overflow, keyboard focus usable. These are observations, not a new visual redesign.
4. Await app.close; restart using SAME isolated home, no second generation request.
   Assert exact prior history filename/result survives, active job count stays zero,
   screenshot restored state. Teardown only owned processes and temp paths.

Test 2, cancellation and persisted reconciliation:

1. Record baseline history/generated-media inventories and subscribe to terminal
   SSE before submission. Arm `app.stub.holdNextGeneration()`, submit, await
   `held.submitted` and matching active job response. Capture requestId; prove one
   upstream request arrived and no response headers/image bytes preceded cancel.
   Click actual Cancel affordance (or documented existing cancellation action,
   not direct DB edit), then await its observable canceled terminal state.
2. Assert local pending indicator clears, then call `held.release()`. Assert no new
   gallery/result item, no successful terminal SSE event, and no persisted history
   or generated-media result attributable to the canceled request. Correlate by
   requestId or unique synthetic prompt marker plus before/after result inventories;
   tile absence alone is insufficient. Cancellation must remain authoritative in
   terminal recovery. Upstream disconnection before release is valid; never force
   a write to a destroyed response to manufacture a late completion.
3. Reload/reconcile and recheck result/inventory absence, no resurrected spinner
   or success, and canceled terminal state; screenshot canceled/recovered state.
   This proves local cancellation, not real-provider compute cancellation or refunds.
   WP07 lower-level tests separately drive TTL/backpressure; do not wait 90min or
   mutate runtime config solely for this UI test.

Test 3, installed doctor joins candidate health:

This is NOT duplicated browser fixture code. Existing package-install-smoke modified
by WP11 invokes emitted CLI and parses DoctorReport; add a contract assertion there
only if WP11 omitted health.version == report.version == package.version. Otherwise
consume that existing assertion in the acceptance matrix and do not touch its file.
No extra installer runner or release script in this WP.

J12 attaches schemaVersion:1 scenario JSON: candidate SHA from EXPECTED_SHA, scenario
ID, fixtureKind:"local-stub", selected provider/model, generated filename (test data),
requestId, observed terminal status, screenshot attachment names, outbound attempts
count, teardown outcome. Do not include raw request/response, keys, full prompt, or
home path. Assertions compare independently observed request, UI and persisted state.
Use try/finally and await both release and app.close; a teardown failure fails test.
Explicit UI command added: `"test:e2e:readiness": "playwright test e2e/j12-integrated-readiness.spec.ts"`.
Existing CI `test:e2e` includes J12 automatically through testDir; no sole new smoke
substitutes for existing journeys.

## Activation, evidence and stop matrix

| Gate | Activation / independent evidence | Failure means |
|---|---|---|
| Exact candidate every CI job | dispatch ref and full input same tip; each guard JSON actual==expected; job conclusions and artifacts inspected | wrong/skipped/missing job blocks that claim |
| Dispatch mismatch negative | fixture ref at commit A, input B; every job must checkout/guard B; local comparator mismatch test separately red | e2e cannot silently run A |
| Mid-stack PR | PR against codex/prod-wp11-* triggers PR Fast Gate; run merge SHA and head SHA recorded distinctly | no run is NOT green |
| Windows candidate | dispatch runs both Windows matrix legs on requested SHA, installer behavior and package smoke pass | nightly or macmini is insufficient |
| macOS install | candidate macos-install passes focused shell/native/packed smoke | Linux success is insufficient |
| Cross-layer UI | successful result, cancel late completion, same-home restart; screenshots opened by reviewer | produced-but-unread image is not visual acceptance |
| Egress isolation | WP09 denial counter zero; poisoned ambient fixture proves denial by separate WP09 test | stub Host header alone not enough |
| Docs/runtime parity | WP11 generators/checkers and installed JSON CLI pass on actual candidate | TS-only test cannot prove shipped JS |
| Staged publication compatibility | WP11 Pages guard/parsed-ordering test runs on cumulative SHA, rejects unpublished/mismatched/installation-mode-incompatible artifact before upload | source promotion does not authorize site publication; WP13 still owns live-byte proof |
| Upstream provider success | manual paid canary remains NOT RUN | no live-success claim; main obtains spend authority if later required |

## Commands and baseline status

Executed WP00: `node --test tests/release-pipeline-contract.test.ts` exit0, 32 pass;
parsed YAML inspection exit0 showed e2e/windows missing ref and PR base exclusion.
`npm run typecheck` and typecheck:tests exit0. These are not a passing new gate.
New verifier files/commands do not exist yet; cannot claim baseline exits for them.
No local browser, full suite, hosted dispatch, or provider generation was run here.

Implementation local allowance: focused ci-candidate-integrity test, parsed checker,
typechecks; J12 may run only in dedicated WP09-isolated environment approved by main.
CI performs full tests/builds and cross-platform installation. Required commands:

```sh
node --import tsx --test tests/ci-candidate-integrity.test.ts
node --import tsx --test tests/ci-windows-candidate.test.ts tests/pages-publication-contract.test.ts
npm run test:ci-integrity
npm --prefix ui run typecheck:e2e
npm --prefix ui run test:e2e:readiness
```

Hosted dispatch and artifact inspection are main-owned. Before WP11, main's
`gh workflow run ci.yml --ref <exact-stack-ref> -f sha=<same-full-tip>` workaround
aligns e2e by ref but cannot produce Windows candidate proof. Starting at WP11,
that same-ref/same-tip dispatch DOES run/assert both Windows legs independently;
e2e remains ref-aligned without its own assertion until this WP. After WP12, the guard
also supports explicit input different from dispatch ref, but existing release run
correlation may still require same ref/tip. Do not modify that release assumption.

## Compatibility, rollback and SoT

No production protocol/schema change in WP12. CI now does more work for candidate
dispatch and all PR bases; record cost/timing, do not weaken mandatory jobs after a
red result. Existing Action pins, read-only permissions and check names retained.
Rollback reverts this layer only; then readiness MUST revert to the old limited claim,
not retain exact-candidate/Windows badges without enforcing jobs. Existing release
workflows stay unchanged and main's WP13 verifies exact tarball provenance, observed
installation and visual proof. Current structure docs describe these gates honestly;
archived logs are not rewritten. Final readiness is scenario-bounded, not a universal
production/security certification.

## Discovered PR ancestry prerequisite (013)

PR199's actual Fast Gate fails because fetch-depth2 omits a required historical
commit, while the same full-head CI passes. Preserve the provenance guard; change
PR Fast checkout to fetch-depth0 and test real shallow/full Git fixtures. The
checker rejects depth2 even though HEAD^1 exists: that is sufficient for blob
budget, not historical provenance. Include tests/pr-fast-history.test.mjs and
its inventory in this WP's file map; pure temporary Git fixture, no production data.

Before feature-stack merging, publish a narrow CI-history prerequisite branch off
current dev containing only this depth fix/test/inventory; verify and merge it,
then merge-up cascade dev -> task prerequisite -> docs -> each implementation
branch. Fresh parent ancestry/diff/CI receipts are mandatory. Do not force shared
refs or merge a top feature first.013 defines the main's execution order and
proves the root cause; the prerequisite's own checks are not waived or inherited
from this cumulative branch. This task remains open until PR199's Fast Gate and
all updated-layer checks succeed.
