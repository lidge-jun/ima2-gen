# WP09 P — implementation order and audit packet

Plan unit:090 plus current amendments091–093. Baseline7e2f084d (PR210), current
branchcodex/prod-wp09-journeys. No production implementation in this phase yet.
The prior WP08c docs-head CI33994363407 is now successful as well.

## Authority and closure

One WP09 PABCD cycle delivers isolated, persistence-honest journeys and the two
source-confirmed UI corrections. Code/projection/receipt/public APIs remain those
listed in090/092/093; amendments take precedence over obsolete WP00 examples.
No new dependency, package version, app authentication, generation policy or
server endpoint. Preserve user recording/stashes/media/config and unrelated refs.
All app/guard startup and browser execution remains hosted-only; pure existing
mocked helpers, new pure receipt/selection tests, build/typechecks are local-safe.
No full local suite. Four-hour work-phase reassessment/72-hour overall bound.

Mandatory D proof: UIR/I/J/G/T/E/R activation rows, original179 native assertions,
exact-head CI/SAST, actual screenshots and direct-view provenance for both visual
oracles, final teardown, focused test receipt, SoT update and reviewable stacked
PR. No inherited High/Critical issue is waived for the final release. Known native
loader/race limits remain explicit; JavaScript guards do not claim an OS sandbox.

## Inherited protection and ordering

1. Receipt/schema/files/transaction foundation, independent synthetic tests.
2. Runtime policy/guards and worker-owned emitted cache/projection. Guard imports
   precede all actual app imports; no tsx or compiler exception in the child.
3. appServer/env/IPC/ownership/seed/stub wiring, with same-home restart and failure
   cleanup. Additive defaults do not silently replace J6 provenance.
4. Hosted isolation probes first, then original and new UI journeys. UI correction
   code may be implemented in parallel because its write set is disjoint; it is
   not accepted before the natural renderer runs behind the verified boundary.

Playwright projects encode the gate: `isolation` matches only
fixture-isolation.spec.ts; `journeys` excludes that file and depends on isolation.
Both inherit existing no-retry/single-worker policy. This keeps Node-only isolation
tests browser-free and prevents alphabetical execution from running Comfy before
the guard tests. Ordinary `test:e2e` invokes the dependency graph. Focused journey
commands keep dependencies; no --no-deps acceptance run. CI builds server/CLI,
then build:fixture before this graph. WP12 consumes these owners, not duplicates.

## B write ownership (only after A passes)

| Lane | Exact ownership |
| --- | --- |
| Main | Receipt public facade/schema/files/transaction/declaration and wrapper; ui/package build:fixture; root UI receipt tests; Playwright project config; both CI workflows; integration of worker boundaries; numbered docs, inventory and structure04. |
| Runtime worker | appIsolation.ts, appOwnership.ts, appRuntimeBuild.ts, appProjection.ts, appGuardReport.ts, appServer.ts; parent lifecycle/environment/projection-focused tests under named files below. |
| Guard worker | appPolicy.mjs, appFilePaths.mjs, appFileDescriptors.mjs, appFilesystemGuard.mjs, appProcessGuard.mjs, appNetworkGuard.mjs; tests/e2e-runtime-guards.test.mjs only (hosted execution). |
| UI worker | NavRail.tsx/nav-rail.css, McpReadinessDetails.tsx/mcpReadiness.ts, ProviderReadinessPopup.tsx, four locale JSONs, tests/mcp-readiness.test.ts, tests/i18n-dictionary-contract.test.ts and navrail-hover-label-contract.test.ts. No generator/fixture edits. |
| Journey worker | stubUpstream.ts; fixture-isolation.spec.ts; j8-composer-transitions.spec.ts; J1–J7/J7b/core-selection/execution-admission/provider-surface-affordance/Comfy-provider-display specs; j6Selection/j6Catalog only for additive fixtures and safe evidence. No production UI, receipt or guard implementation. |

Runtime focused new files: `tests/e2e-app-environment.test.ts` (pure constructor
with synthetic values; no app import), `tests/e2e-runtime-build.test.mjs` (owned
synthetic staging/compiler fixtures; no real app), and
`ui/e2e/fixtures/isolationProbes.ts` (hosted-only driver/collector glue reused by
fixture-isolation). No new worker/file allocation is improvised mid-B. Upward
reclaim follows the two-distinct-failed-packets rule; a downward scope change is
a recorded P amendment. Main serializes integration builds/tests/git/FSM.

The receipt tests may split into `tests/ui-build-receipt.test.mjs`,
`tests/ui-build-receipt-inventory.test.mjs` and
`tests/ui-build-receipt-transaction.test.mjs` with test-owned
`tests/_uiBuildReceiptFixture.mjs`. All import the public receipt API; expected
digests and failure outcomes are independent literals, not DUT-derived snapshots.

Guard/parent coordination: runtime collector accepts the exact090/092 JSON union;
guard worker owns producer/validation semantics. Projection copies the exact six
MJS runtime guard modules. Journey probes use the fixed prepareRuntime seam for
owned faults, never custom startup argv/env/skip flags. Typed driver glue does not
export a production private handler or manufacture successful guard status.

## Activation additions and tests

- Native watcher barrier: tests wrap the real fs.watch callback in a synthetic
  fixture so the DUT callback executes before the test continues. Edit/revert
  assertions wait for that actual event, not sleeps. Also inject null-name/error
  callbacks with sentinels. No production inspection switch is added.
- Environment: all explicit090 env keys were found in config/storage owners;
  constructor rejects foreign targets and excludes secret/loader/proxy variables.
  Wrapper fixed API target avoids homedir advertise lookup before Vite loads.
- Parent cache: first compile failure, simultaneous callers, changed source/head/
  compiler/output, missing/tampered manifest/entry/guard, and later same-home
  restart. Assertions include zero child spawn before rejection and retained data.
- Filesystem: default/named exports, sync/callback/promises, FileHandle/FD,
  write-capable read flags, invalid-byte Buffer, sibling prefix, nested cp symlink,
  and expected discovery versus explicit denied content. Observe original native
  sentinels never reached for rejected operands. Test successful owned controls.
- Process/network: direct/custom-promisified/default/named/prototype/Worker;
  DNS/TCP/TLS/HTTP2/UDP/WebSocket and foreign redirect before native connect.
  Actual emitted app discovery is separate from pure hook invocation.
- UI:093's mobile internal scroll/reachable destinations and actual MCP facts,
  including default-null model, malformed consumed data, stale selection/error,
  image/video same-ID and execution locks. No generation/connect/login request.
- Hypotheses: node HUD/default-fit and composition interruption must first produce
  hosted repro. Changes beyond093's confirmed targets require a recorded causal
  amendment; do not patch speculative symptoms to make one screenshot look quiet.

## Verifiers and present evidence

Already run at P: `npm --prefix ui run test:e2e -- --list` exit0/179 tests15files;
E2E noEmit exit0; existing J6 preflight12, network6, process2 synthetic cases pass.
Those commands observe their named existing source targets, not future scripts.
Prior exact source CI measured server builds6–7s, CLI4s, UI17–25s, so120s per
compiler/UI stage is an explicit intrinsic bound, not a post-failure adjustment.

New future direct-file tests cannot pass before the files exist. C will invoke
their exact paths with node:test; root inventory's `*.test.[cm]?[jt]s` discovery
includes them. UI tsconfig includes src; E2E config includes e2e/Playwright config.
Full exact-head CI runs npm test plus the dependency-ordered browser graph. Static
parsing/listing is not guard startup, native UI, isolation or visual evidence.

No A/B implementation is authorized by this document alone. Independent auditors
must challenge reachability, contradictory old clauses, field chains, cleanup,
build/public compatibility and permission limits before the persisted A→B edge.
