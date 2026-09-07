# WP06s — confined, bounded Agy artifact ingestion

Status: WP06s P revalidation at ef0e80a2. Original registration was during WP06 P;
no implementation in WP06 B. One full PABCD and one implementation PR, after065/wp06m and before070.
Semantic input: WP06's extracted agyArtifact/agyOperations and lifetime barriers.
Branch codex/prod-wp06s-agy-artifacts; base the verified wp06m tip. c-18 and WP13's
agy-artifact-gate prevent merge/release until this outcome is verified.

## Grounding and scope

At54543ee0, an actual findRecentAgyArtifact invocation with explicit owned roots
selected ima2_generated_link.png, a file symlink to a sentinel outside its search
root. Reading the selected path yielded the sentinel's SHA256. The separate
directory-symlink test already passed: it does not cover file symlinks. Evidence:
session wp06/symlink-baseline.json and unchanged adapter SHA25644c62099…ea31f.
No sensitive file, auth store, real Agy process or public network was accessed.

Threat: provider output controls RESULT/SAVED_PATH/fallback candidate path strings;
do not turn these into arbitrary file reads or cleanup outside approved artifact
roots. Reject static symlink/junction escape and detected file replacement. Bound
artifact allocation and preserve explicit cancellation. Do not claim isolation
from a malicious process already running with this user's filesystem privileges,
hardlink provenance proof, or a portable atomic openat filesystem sandbox.
Concurrent path changes detected by before/after identity checks fail closed;
residual adversarial same-user races must be recorded, not called impossible.

Resource/authority: existing repository/CI, temporary fixture roots, zero paid
provider calls. No auth/config migration, real home scan, external files deletion,
native addon/dependency or user-server restart. Local tests use tiny images and
fault hooks; actual50MiB boundaries run only in exact-head hosted CI. Reassess at
4hours/WP and72hours/goal. Main owns goal/FSM/stack; workers have disjoint scopes.

## Exact change manifest

| Action | Path | Required diff |
| --- | --- | --- |
| NEW | lib/agyArtifactRead.ts | canonical-root/regular-file checks, descriptor-owned bounded read, identity receipt |
| MODIFY | lib/agyArtifact.ts | skip symlink and nonregular scanner candidates before stat; retain parse/time/depth/order behavior |
| MODIFY | lib/providers/adapters/agyOperations.ts | replace lexical stat/read sequence with trusted read; receipt-bound exact cleanup |
| MODIFY | lib/errors/providerMap.ts | map AGY_ARTIFACT_TOO_LARGE to INTERNAL_STATE_ERROR |
| MODIFY | config.ts | export AGY_ARTIFACT_POLICY maxBytes=52428800, chunkBytes=65536 |
| NEW | tests/agy-artifact-confinement.test.ts | real owned symlink/junction/root/identity/cancel/cleanup negatives |
| NEW | tests/agy-artifact-read-bounds.test.ts | small allocation guards plus explicitly hosted-only real byte-boundary cases |
| MODIFY | tests/agy-artifact-fallback.test.ts | retain directory tests, add matching-file-symlink exclusion |
| MODIFY | tests/agy-execution-process.test.ts | real operation consumes only accepted artifact and preserves499 cleanup |
| MODIFY | tests/_agyFaultFixtures.ts, tests/agy-execution-cleanup.test.ts | retarget actual descriptor-read barrier; preserve inherited cancellation/cleanup cases |
| NEW | .github/workflows/agy-artifact-check.yml | PR/dispatch exact-SHA Linux/macOS/Windows filesystem gate |
| NEW | scripts/run-agy-artifact-check.mjs | exact file/child-marker light and hosted-heavy driver |
| NEW | tests/agy-artifact-check-contract.test.ts | parsed workflow/SHA/platform and real tiny driver selector/exit-code negatives |
| MODIFY | tests/error-class-coverage.test.ts | only required named-policy/error contract updates |
| MODIFY | docs/API.md | rejection/resource error vocabulary and allowed artifact boundary |
| MODIFY | docs/migration/runtime-test-inventory.md | new tests |
| MODIFY | structure/01-file-function-map.md, structure/03-server-api.md, structure/07-devlog-map.md | source owners and boundary/evidence |

No files deleted, no public request/persistence fields added. Existing adapter
facades remain unchanged. Emitted JS is rebuilt, not hand-edited/committed.

## Trusted read contract

New `readAgyArtifact(path:string,signal?:AbortSignal):Promise<AgyArtifactRead>`:
return `{buffer:Buffer, canonicalPath:string, identity:{dev:bigint,ino:bigint},
approvedRoots:readonly string[]}`. Internal data only; never serialize receipt or
roots into API/SSE/history. Export a cleanup helper from the same owner or consume
the receipt in agyOperations; do not split validation and use across raw paths.
The reader owns a private validated receipt once pre-open/post-open trust checks
pass, even before successful return. On cancellation after that point it first
closes its descriptor, then invokes guarded receipt cleanup and rejects499. Policy
rejection (including overflow), failed identity checks and replacements are not
cleanup-authorized and remain untouched. On success, receipt ownership passes to
the operation for its later guarded cleanup. Never attach the receipt to a public
Error or serialize it. Abort during descriptor close is checked before returning;
the reader handles that cleanup too. The operation retains WP06's final cancellation
check after its own awaited ref cleanup, with no later asynchronous return gap.

1. Pre-abort499; require an absolute path. Canonicalize existing approved roots
   from homedir/.gemini, homedir/.cache and tmpdir; missing roots do not broaden
   policy. Preserve intentionally relocated root symlinks by canonicalizing roots.
2. lstat the candidate and reject a leaf symlink/nonregular file. Resolve its
   canonical path; path.relative against canonical roots must denote containment,
   not prefix resemblance. Parent-directory escape, sibling prefix and traversal
   outside every root reject before opening or reading bytes.
3. Open canonical path read-only with no-follow/nonblocking flags where the current
   platform supports them. fstat must be regular and dev/ino must match the checked
   path. Re-resolve/lstat after open and compare root containment and identity.
   Do not silently skip unsupported-platform verification; revalidate flag behavior
   on Windows/macOS/Linux at P and state the actual supported guarantee.
4. Reject stat size over maxBytes before reading. Read with handle.read using
   explicit offsets, chunks<=chunkBytes and at most maxBytes+1 total; reject overflow
   even if size grew after fstat. Abort checks between reads and before return.
   Buffer.concat only after a successful bounded EOF. Always close descriptor in
   finally, including overflow/abort/malformed file/read error.
5. Before returning, revalidate the canonical path/identity and original candidate
   mapping; changed/unlinked/replaced objects fail closed. No untrusted buffer is
   returned before all checks. Do not label this portable atomic-openat security.

Error contract: missing path preserves502 AGY_ARTIFACT_NOT_FOUND; path/symlink/
nonregular/changed identity use502 AGY_PATH_REJECTED without outside path details.
New bounded-overflow error502 AGY_ARTIFACT_TOO_LARGE; cancel499 GENERATION_CANCELED.
Add AGY_ARTIFACT_TOO_LARGE:"INTERNAL_STATE_ERROR" to PROVIDER_ERROR_MAP. Direct
operation/error envelope preserves that code/status; existing normalized generation
failure deliberately keeps codeUNKNOWN/status502 but must decorate rawCode
AGY_ARTIFACT_TOO_LARGE and errorClassINTERNAL_STATE_ERROR. Tests assert both actual
consumer paths, not a new normalization rewrite. Main's in-memory map hypothesis
probe at WP06 A confirmed this existing normalizer projection; implementation is
still future. The emitted error is never a lexical coverage exception; only the
central AGY_ARTIFACT_POLICY constant may join the non-error exception list.
Safe messages do not echo artifact paths, provider stdout or sentinel contents.
Verify real error normalizer/API envelopes, not only helper Error properties.

## Cleanup and fallback

Scanner skips every isSymbolicLink entry (file or directory), and only regular
matching files enter existing age/depth selection. Direct RESULT/SAVED_PATH/regex
paths all pass the same trusted reader; scanner filtering alone is insufficient.

On accepted artifact consumption, re-lstat canonicalPath and compare the receipt
before unlink. Re-resolve candidate/canonical path and approved-root containment
again at cleanup, including parent mapping; unchanged inode alone cannot authorize
a path now redirected outside. If identity or mapping changed, do not delete the
replacement/target. Never delete an outside-root or policy-rejected candidate/target.
Parent cleanup must use nonrecursive
rmdir and only a contained subdirectory that is not an approved root; a race that
adds unrelated files must yield ENOTEMPTY rather than recursive deletion. Retain
best-effort cleanup without masking primary errors. Known accepted artifacts on
late abort follow the same guarded cleanup; unknown paths are not swept.

## Independent verification matrix

- Valid PNG under each isolated canonical root, including an intentionally relocated
  root, returns exact bytes/mime/usage and removes only the accepted file.
- Matching-file symlink, directory symlink/junction to outside, relative path,
  sibling-prefix path, direct RESULT/SAVED_PATH, nonregular/FIFO and nonexistent
  path: no outside bytes returned/deleted, descriptor/child cleanup complete.
- File/path swapped at pre-open/post-open/pre-return barriers: reject; replacement
  survives. Cleanup identity swap and concurrently populated parent: unrelated data
  survives. These are controlled mutation cases, not universal race elimination.
- Tiny held handle.read followed by abort rejects499 and closes the handle; no
  operation/route persisted success. Controlled read errors preserve cleanup.
  Replace inherited readFile hooks with the actual opened-handle read boundary.
  EOF-then-abort and abort-during-close both reject499 and remove only the accepted
  identity; a concurrent replacement survives. Retain post-ref-rm cancellation and
  primary-error preservation from WP06 rather than skipping an unreachable barrier.
- Hosted50MiB exact succeeds;50MiB+1 fails for both honest stat and a file grown
  after stat. Local runs must not select these cases; use the proven inline child
  marker/filter, not a parent filter that executionTestProcess discards.
- Actual mutations removing file-symlink rejection/containment and streamed bound
  each turn their specific verifier RED, then exact restoration GREEN.
- Canonical Node22/24 CI and selected Windows/macOS filesystem tests at the exact
  standalone tip; no unsupported-platform silent skip qualifies as assurance.
- Caller route/curl error and ordinary success, unchanged Google reference/lifetime
  tests, full current UI regression and independent security verification.

At this future P, read platform filesystem docs/current source before finalizing
flag and error details. Revise the design if real platform constraints contradict
it; do not implement a knowingly weaker fallback under the same criterion.

## Exact-tip platform and local/heavy execution path

NEW agy-artifact-check.yml has pull_request (opened/synchronize/reopened/ready_for_review)
and workflow_dispatch with required string input sha. No pull_request_target. PR
execution checks out github.event.pull_request.head.sha, dispatch checks inputs.sha;
neither uses the synthetic merge commit as product identity. This permits the first
pre-merge run without assuming an unregistered dispatch workflow can be launched.
Use contents:read permissions, no secrets/environment/publish step and fail-fast:false.
Four explicit rows: ubuntu-latest Node22.23.0/npm11.18.0 heavy; ubuntu-latest
Node24.17.0/npm12.0.0 heavy; macos-latest and windows-latest Node24.17.0/npm12.0.0 light.
Twenty-minute job bound. Reuse checkout3d3c42e5… and setup-node82076278… full pins
from current CI. Checkout fetch-depth0; persist-credentials:false. Before install/build,
a shell-neutral Node assertion checks WANT_SHA against /^[a-f0-9]{40}$/ and
git rev-parseHEAD exactly. Verify actual Node/npm/platform against the matrix row.
Run npm install-g npm@<matrix.npm>, npm ci, npm run build:server, then the driver below.
No UI deps/browser/full suite required for this dedicated filesystem job.
Both Ubuntu rows run --hosted-heavy; macOS/Windows run --light. Always upload nonempty
JSON/TAP artifacts named with matrix OS, Node version and expected SHA, with current
upload-artifact043fb46d… full pin. ExpectedSHA/platform/runtime and exit status are
in each receipt. Separate canonical ci.yml at the same tip owns Node22/24 full
suite. Dedicated rows explicitly own both heavy runtimes; no implicit selector
inheritance through the full-suite wrapper is claimed. Do not rely on schedule-only Windows.

Driver `node scripts/run-agy-artifact-check.mjs --light` runs the exact five files:
agy-artifact-confinement, agy-artifact-read-bounds, agy-artifact-fallback,
agy-execution-cleanup, agy-execution-process (all tests/*.test.ts). One child/file,
argv=[--experimental-test-module-mocks,--import,tsx,--test,--test-reporter=tap,--test-concurrency=1,
--test-skip-pattern=hosted CI,<absoluteFile>]. Set EXECUTION_TEST_FILE to that
file's pathToFileURL href in an otherwise minimal PATH/platform/temp/locale env.
Thus executionTestProcess executes inline and cannot discard the selector.
Preflight requires the regex to match all four exact `[hosted CI]` bound-case
labels, and not a small-case label; reject any heavy PASS row during --light.
Node24 may omit filtered rows: require expected named small-case passes instead of
pretending absent rows are four explicit SKIPs. No blanket skip or count-only PASS.

--hosted-heavy requires parent GITHUB_ACTIONS=true and omits only the skip flag;
the child marker/flags remain identical. Record all four heavy case names and
passing results. Actual50MiB cases execute only in the hosted job/canonical suite;
they are not selected by local light commands. No global NODE_OPTIONS changes.
The driver accepts --test-root (default repository tests/) and --output-dir
(required fresh directory); it selects only those five fixed basenames, never
discovers arbitrary files or shells out. CI uses the default test root and a fresh
runner-temp output directory. Test-root override exists only for isolated driver
contract fixtures, not a production provider switch. It writes per-file TAP plus
JSON, forwards nonzero exit/signal, tracks child completion and has a bounded
watchdog. Contract test runs the real driver against that controlled tiny root:
a heavy-labeled body throws if selected in light mode, an
ordinary body must execute, and deliberate ordinary failure propagates exit1.
This tests selector forwarding without allocating a large buffer locally.

Parsed YAML negative tests (existing yaml dependency) delete/change checkoutref,
SHA guard, one platform, driver command/mode or artifact step and must fail the
exact contract. Driver-copy mutations remove the native mock flag, child marker
or light selector and must fail the real tiny-file invocation contract; these
are JS driver mutations, not imaginary YAML fields. New SHA assertion belongs
this small dedicated workflow;
do not import not-yet-created WP11 assert-ci-sha or change WP11/12 ownership.
At066 C obtain the dedicated PR-triggered run and dispatch registered canonical CI
with an explicit workflow ref and the same verified full SHA. Record workflow revision
separately from actual checkout, including the canonical frontend job. Inspect each
checkout and platform artifact, and require all four dedicated jobs plus both
canonical Linux runtimes green. Explicit failure is a blocker, not a silent skip.

## Rollback and delivery

Revert this layer through the owned stack and rebuild matching runtime. No user
data migration. Rollback reopens c-18 and the release gate; the prior symlink/raw
read behavior is not production-ready merely because it was previously shipped.
Record source SHA, actual platforms, negative sentinels, size/teardown evidence,
remaining same-user race assumptions and PR parent before D. Scanner success or
green old tests are not substitutes for these negative activations.
