# WP12 P revalidation — integrated delivery without test-foundation growth

Class: C4. Archetype: repair/integration. Base:1091713091f4d48404507f1e5b908d2b4455cc6a.
Trigger: WP11 D119_2 closed installation; its next direction is WP12 lifecycle,
inherited CodeQL triage and exact-candidate acceptance before WP12s/WP13.
Goal: repair reachable product defects, preserve safe boundaries, prove the actual
cumulative candidate, and unblock the existing ordered PR train.
Non-goals: new test framework, generic workflow checker, scanner suppressions,
paid canaries, dependency upgrades, global machine changes or expanded access.
Verifier: existing focused owners below, then exact-SHA hosted full CI/CodeQL,
native Windows diagnostics, and opened UI artifacts. No local app/full-suite run.
Stop: all WP12 tasks and120 acceptance obligations have evidence; unresolved
reachable High/Critical findings or the original unclassified MCP failure block D.
Bound: existing four-hour reassessment and72-hour goal; zero paid calls. CI trails
implementation asynchronously; a green older SHA never verifies a newer patch.
Ownership: main owns integration/FSM/Git/CI/stack; independent workers have disjoint
file sets, model and effort omitted. No leaf dispatch, global settings or release.
Escalation: new authority or an independently large defect returns to P; do not
grow a checker to compensate for a missing product boundary.

## Classification and supersession

Product: first-event MCP reconnect, node metadata containment, safe browser launch,
linear input normalization, current token-guard route matching, bounded incoming
API work, and actual download destination/body handling. Existing93 CodeQL reports
are individually traced; unchanged counts are not a waiver.
Necessary verification: focused regressions in existing owners, final candidate
Linux/Windows full lanes, focused native macOS install, J5 lifecycle plus existing
composer/isolation journeys, package/runtime inventory and reviewed artifacts.
Auxiliary work withdrawn from120: check-readiness-workflows.mjs,
ci-candidate-integrity.test.ts, test:ci-integrity, verify:built-runtime, J12 harness,
new UI package command, second receipt producer and speculative EXPECTED_SHA env
fields that no fixture consumes. Existing assertions/isolation remain unchanged.

## B batches and exact ownership

| Batch | Files | Product change and required observation |
|---|---|---|
| Lifecycle | lib/eventsPolicy.ts, routes/events.ts, bin/lib/sse.ts, bin/lib/mcpJob.ts; tests/cli-model-resolver.test.ts and existing event route tests | Accepted SSE headers carry the effective replay cursor before POST. Drop before first event must replay terminal result without reposting; missing header remains legacy compatible; malformed present header fails closed. Preserve pending/error/deadline behavior. |
| Local inputs | lib/nodeStore.ts; bin/lib/platform.ts; lib/promptImport/githubFolder.ts, lib/promptImport/parsePromptCandidates.ts, lib/canvasVersionStore.ts; existing corresponding tests | Reject escaping metadata paths before read; preserve valid legacy names/null-on-missing. No shell interpretation when opening URLs. Linear trimming/frontmatter parsing with unchanged normal outputs. |
| Incoming API | server.ts, config.ts, NEW lib/apiRequestBudget.ts, NEW tests/api-request-budget.test.ts; tests/backend-input-lan-hardening.test.ts | Match Express's case-insensitive API route semantics in existing token guard; exempt only GET OAuth callback. Per-app, actual socket-peer budget before JSON parsing, not forwarded-header identity. Small pure middleware test; existing app-based owner executes hosted only. |
| Download boundary | lib/grokImageDownload.ts, lib/grokImageDownloadPolicy.ts, NEW lib/pinnedHttpGet.ts; lib/mcp/downloadMediaResult.ts; lib/promptImport/githubSource.ts and githubFolder.ts; existing download/import tests | Extract the existing pinned GET lifecycle for actual Grok/MCP/GitHub consumers, preserving Grok semantics. Validate HTTPS and allowed destination before each request; pin validated addresses; bound body reads during streaming; cancel rejected/redirected bodies. |
| Candidate CI | .github/workflows/ci.yml, .github/workflows/pr-fast.yml; tests/release-pipeline-contract.test.ts, tests/ci-windows-candidate.test.ts; NEW tests/pr-fast-history.test.mjs if not present | Reuse assert-ci-sha, explicit ref and guard before source execution on every candidate job. All PR bases, synthetic merge SHA distinct from head, full ancestry. Focused macOS installation lane. Preserve existing checks. |
| Integrated UI | ui/e2e/j5-restart-recovery.spec.ts and artifact paths in existing workflows | Correlate real stub request/result with rendered generated image, cancellation and same-home restart without another submission; app.guard.assertClean(), screenshots and JSON with actual head. No fixture-owner rewrites. |
| Triage/docs | scripts/mcp-schema-spike.mjs if confirmed HTML sink; structure/04-frontend-architecture.md, structure/06-infra-operations.md, docs/migration/runtime-test-inventory.md, structure/01-file-function-map.md and numbered122/123/124 records | ID-level source/caller/boundary disposition for all93 alerts. Text response for auxiliary reflected HTML sink. Update existing inventories only when files actually added. |

Before assigning the download batch, main confirms repository-relative import paths
from rg --files. Workers may not concurrently edit githubFolder.ts: local-input
worker owns its normalization first, then hands that file to download owner.
No unused shared abstraction: pinnedHttpGet is only the existing production
request/lookup/lifecycle extraction consumed by these real downloaders. Do not
replace retry orchestration, introduce a driver registry, or alter provider APIs.

## Explicit protocol and safety decisions

SSE new field is `initialEventId?: string` on OpenSseResult. Its creation chain is
EventConnection.cursor -> response header `x-ima2-event-cursor` -> openSse header
validation -> returned initialEventId -> consumeStream lastEventId -> existing
Last-Event-ID reconnect/replay. No disk serialization. On resumed streams use the
effective requested cursor, NOT latestEventId (which could skip unread replay).
Missing header is old-server compatibility, not successful recovery proof. New
header parsing accepts decimal digits only, with a nonnegative safe integer value
(including0), matching the event bus domain. It must be read
before a job POST; first-frame EOF activates replay with the pre-job bookmark.

Metadata reads reuse the nodeStore path owner and check canonical containment
against the supplied generatedDir before reading; preserve missing/invalid null
response. Do not import a helper hardcoded to global config for an explicit-dir
call. Traversal, sibling prefix and symlink escape negatives use owned temp roots.
Concurrent hostile filesystem replacement remains an OS-level residual, not a
claim of atomic filesystem confinement. No unrelated saveNode ID restrictions.

Browser open: execFileSync argument arrays for macOS/Linux. Windows/WSL uses a
fixed PowerShell EncodedCommand whose only URL input is base64 UTF-8 data decoded
to one Start-Process FilePath argument; no execution-policy change or interpolated
URL code. Reject non-http(s) schemes before invoking the OS. Keep headless behavior
and {ok,error} result. Tests stub the child process; no real browser is launched.

Regex fixes use bounded scanning/slicing with semantic examples and long inputs,
not timing thresholds. Preserve existing source-size limits. Fix reachable suffix
trim/frontmatter sites; do not claim the whole parser is linear without inspecting
its other expressions. Keep unrelated prototype helper unchanged: actual CLI
callers validate keys through WRITABLE_CONFIG_KEYS before setNestedKey.

Incoming API budget: fixed60-second window, default600 total requests and120
mutating requests per peer per window, maximum4096 active peers per app; full map
rejects new peers until expiry rather than evicting active limits. Constants live
in config's exported immutable API_REQUEST_POLICY (no new persisted schema).
Identity is socket.remoteAddress; ignore X-Forwarded-For. API matching is
case-insensitive segment matching: `/^\/api(?:\/|$)/i` in both token guard and
budget. Tests include `/API/health`, `/Api/health`, `/api`, `/apix/health`, and
`/api/mcp/oauth/callback` GET versus POST; only exact case-insensitive callback
path plus GET is exempt. Auth precedes budget; budget precedes body
parsers. Rejected requests return429 and Retry-After with stable error code.
GET/HEAD/OPTIONS use total budget; other methods consume both; existing SSE frames
are not requests. Static UI is excluded. Keep existing job/concurrency limits.
Burst defaults exceed24-way generation plus polling; verify ordinary flow and
rejection/recovery with fake clock and bare middleware, not a real local app.
This is bounded local process resource protection, not distributed abuse immunity.

Downloads: reuse existing conservative public-address policy (including100.64/10,
mapped IPv6, empty/mixed DNS answer rejection). Never grant MCP/GitHub the Grok
trustedProxyOrigin exception. GitHub supports HTTPS github.com/API/raw hosts only
as used by its current source parser, and revalidates redirects before connecting.
Keep existing preview byte limits; JSON index response also receives a finite
bound derived from existing configured source limit. All reads stop at limit,
release response on every failure, and retain existing timeout/error behavior.
MCP keeps streamed40MiB/800MiB defaults, five redirects, existing retry policy,
query-stripped persistence and owned-temp cleanup. Preserve IPv4 preference and
v4Fallback semantics using already validated addresses, never another unpinned DNS
lookup. No signed URL in evidence. No external fetch needed for focused proofs.

Enforcement bypass record: tier=runtime; surfaces=Express middleware, path read,
OS launch and outbound socket; known bypass=direct internal calls/local OS access
and multiple independent app instances; residual=privileged filesystem races,
per-process rather than distributed budgets; wording=scenario-bounded safety,
not universal confinement. Final enforcement is each actual sink, not test code.
LAN cookie/session/origin/private-media integration remains WP12s125; its future
controls cannot clear current findings. No auth relaxation for fixture convenience.

## CI and acceptance ordering

Correct existing120 claims: E2E already has explicit ref/guard, Windows both
already dispatch, AppHandle uses guard.assertClean (isolation is metadata), and
j6EvidenceIdentity reads git HEAD itself. Preserve these implementations.
Replace Linux's conditional SHA comparison with existing comparator. Do not
duplicate already-correct E2E guards or resurrect built-runtime checker.

PR fast's current15-minute whole-job envelope is below WP11's observed16.1-minute
UI step alone. Set whole-job envelope30 minutes before execution, retain individual
test deadlines and all existing cases/check names. This is workload scheduling,
not a fix for a timed-out test. Exact candidate full CI remains mandatory.
macOS uses existing native/install/doctor/packed owners without a redundant full
suite. Artifact upload includes J5 output on success as well as failure. Actual
screenshots must be opened and correlated with candidate SHA before UI claims.

During B, use only minimal tests for affected owners; dispatch CI after coherent
commits and continue independent changes. Record each run's inputSHA/headSHA and
status separately. After fixes converge freeze the candidate and require all
mandatory jobs on that SHA; no old-green inheritance after runtime changes.
CodeQL gets refreshed per candidate and reconciled by alert ID/source, not count.
Historical first-case MCP timeout is not closed by a retry: new diagnostics must
support a specific disposition or it remains an explicit acceptance blocker.

History prerequisite013 is retained: narrow depth0 prerequisite off current dev,
own CI and normal merge, then non-destructive merge-up cascade with fresh ancestry
and checks for every layer. Main refreshes exact PR chain and native membership
before writes, registers the validated chain via native GitHub stack API, and
verifies membership before claiming stack delivery. All ordered implementation
merges/release stay behind applicable checks; no admin bypass/protection edits.

## Existing verifier commands and rollback

Source-only typechecks: npm run typecheck; npm run typecheck:tests;
npm --prefix ui run typecheck:e2e. Focused tests run via node --import tsx --test
with exact existing file list from the batch, never npm test locally. Module-mock
tests retain their existing --experimental-test-module-mocks requirement.
Existing docs:runtime:check, test:inventory and generated-doc checks consume their
actual owners; no new npm checker command. J5 executes in hosted WP09 isolation via
existing test:e2e; native Windows selected tests use the owned SSH fixture paths
recorded in116/117. No spoofed GITHUB_ACTIONS or installer-policy bypass on SSH.

Rollback reverts only this layer's scoped changes and restores the previous
limited claim; it does not weaken previous guards or erase evidence. Keep user
scripts/recording untouched. WP12 D advances to125 WP12s, then WP13 reruns integrated
candidate acceptance and performs canonical release/provenance/installed smoke.
