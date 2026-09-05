# WP09 B — implementation log and worker synthesis

096 closes real three-lane A. Main entered B at317ba542. Main owns receipt/schema/
inventory/transaction/Tailwind/CI integration; runtime, guards, UI and journeys
have the audited disjoint write sets from094/095.

Initial worker returns are NOT implementation completion. Main inspected actual
deltas: projection returned uncreated guard/entry paths and a non-contract policy;
runtime input collection was not git-tracked and did not compile/verify a cache;
guard wrappers/descriptors were mostly unimplemented; journey tests omitted the
I1–I9/hold/transition matrix; UI omitted all focused tests. Missing peer files are
integration dependencies, not permission to replace specified behavior with an
empty projection or reduced test matrix. No local app/guard/browser was executed.

Main sends one concrete same-worker repair round per lane, with these causal gaps
and public receipt declaration already on disk. Do not credit partial stubs, change
acceptance to match them or advance C. Guard/runtime/journey interfaces must use
the audited names and exact schemas, not incompatible independently renamed shapes.
If that round still fails, retire/re-dispatch per bounded packet policy; main will
reclaim after two distinct actors fail. Existing changes remain preserved.

Second actors Heisenberg/Wegener/Chandrasekhar still returned incomplete parent,
guard and journey implementations. Main reclaimed all three write sets and closed
every worker. UI worker's source/tests also require main integration review; no
worker completion statement substitutes for its actual delta. Two replacement
actors ran the two-case guard test despite the no-local-guard instruction. Source
inspection shows the process call was intercepted, but this unauthorized proof is
not credited; replace those tests with native sentinels before any later execution.

Main receipt foundation now has public schema/declaration/facade, complete positive
input/output inventory, bounded regular-file hashing, strict environment, exclusive
transaction/watcher/publication lifecycle and fixture wrapper/Tailwind plugin.
Thirteen focused receipt tests pass. This is partial UIR coverage, not completed
WP09. Transaction tests cover copied/foreign nonce, concurrent/abandoned lock,
actual watcher edit/revert, output tamper and idempotent cleanup. A case-collision
test initially failed because the host filesystem collapsed the two names, then
its mock matched lexical /var rather than canonical /private/var. Canonical
boundary matching plus an injected-call counter proves the collision branch fires.
No production check was weakened; remaining UIR/guard/journey gates stay open.

Main UI integration found a second set of real gaps: parser narrowing/type errors,
unchecked connection/executable values, missing provider/model/kind facts and an
uncancelled manual refresh path. Main rewrote the pure consumed-field projection
and effect-owned popup read lifecycle. HTTP-error body cleanup is now awaited.
Worker tests were also wrong: they expected a new selection to be ready against
an old selection snapshot, supplied a non-Promise cancel stub and aborted before
body consumption despite claiming an after-headers case. Corrected fixtures await
the actual body-read signal and retain the stale-selection guard. Nine focused
MCP tests now pass without asynchronous activity after test completion. Native
render/lifetime coverage and remaining parser adversarial cases are still open.

Parent integration refinement: register an owned starting app with appOrigin:null
until the actual listener address is observed; null never grants browser access.
This retains startup-failure child ownership without inventing a URL. Home identity
checks are async and expose hasUnexitedOwnedApps so worker cleanup never removes
the shared emitted cache while a child exit is unproven. The resource/verification
split and no-forged-ready IPC contract are unchanged.

Main replaced the unsafe two-case guard test with a pure bundled-module VM fixture.
Every node:fs/process/network/os/module dependency is replaced by in-memory objects
and native-call sentinels; unknown requires reject. It does not install hooks into
the host process or start an app/socket/provider. Local execution of this pure
fixture is within the existing mocked-helper allowance. Actual Node preload,
filesystem/syscall and server/browser proof remains hosted-only I1–I9; do not
promote VM results into OS/runtime isolation claims.

Main parent/guard rewrites now typecheck. The old J6 regression was migrated to
mock the new ownership/projection boundaries while still executing the actual
preflight/startApp source. All12 J6 cases pass, including rejection before resource
allocation and an emitted --import/IPC/allowlisted-env launch through fake child
and projection objects. Four new pure guard VM cases and13 receipt cases pass.
This replaces obsolete tsx/HOME assumptions without deleting hosted identity,
fallback refusal or zero-real-startup assertions. Actual hosted startup is still
unverified and remains the next integration gate.

Main resumed at b16abc9397fd72499d3be88ff3bf874322b9b7d6 with FSM B confirmed.
The bounded environment-only worker added five pure tests; main corrected its
regenerated-config oracle and portable path expectations before accepting the
file. Fresh focused execution:34 passed,0 failed (environment5, VM guards4,
mocked J6 startup12, receipts13). No native guard/app/browser ran locally.

Hosted isolation coverage now includes foreign redirect with a separate listener
and independent native-call sentinel, held-response counters, early/double release,
abort/close, runtime config content denial, path/Buffer/URL/symlink overloads,
write-capable read flags, native realpath, callback/promises and closed descriptors.
These are authored assertions, not yet runtime proof. Playwright now encodes
isolation -> journeys and blocks service workers; app-using specs adopt the
worker cleanup fixture. Both workflows prebuild emitted server/CLI, use the
strict fixture UI build and record its actual command plus WP09 artifacts.

Main replaced the worker's nonexistent Sequence-tab scenario with actual T1–T4
draft/provider/reload/breakpoint/tab interactions and an initial MCP popup case.
J2 now checks edit recovery; J3 captures two distinct prompts across billing
recovery; J5 enters Create and unloads the page before same-home restart.
Remaining UIR/compiler/cache fault coverage, T5/T6, complete mobile-navigation/MCP
matrix and actual native/render evidence stay open. B has not advanced to C.

First hosted integration: f55906630dfcf5cde10e4092e0a583e82623786d,
run33999593938/job101395962930. Strict receipt UI build passed. Isolation17 pass,
4 fail (three primary-config startup cases plus normal server startup), all
E2E_CHILD_EARLY_EXIT:E2E_EGRESS_DENIED;184 journey cases correctly did not run.
WP09 artifact9979112289 downloaded under the session evidence wp09/f5590663-native.
Do not waive missing downstream PNGs: they reflect dependency-gate refusal.

RCA hypotheses before repair: H1 numeric-loopback listener setup calls guarded
dns.lookup (falsifier: denial transport/stack is not numeric lookup); H2 bootstrap
provider traffic uses an unowned target (falsifier: exact bind-only probe reproduces
the denial); H3 incorrect inherited listener address (falsifier: generated env is
127.0.0.1/port0 and same bind-only call fails). Local read-only inspection of Node
v24.17.0 built-in net source confirms lookupAndListen invokes dns.lookup even for
an explicit address. That is a causal candidate, not yet exact Node22 runtime proof.
Next diagnostic captures sanitized denial transport and native-only stack frames;
no address allowlist is broadened on this hypothesis alone.

Diagnostic candidate edfc11fb42f155877eb27792700b065b59657f34, run33999838832,
did not reach the bind probe: Node22 ESM collection rejected four new dictionary
imports lacking `with { type: "json" }`. Typecheck alone did not detect this.
Main added explicit import attributes and reruns actual Playwright listing before
the next push. No failed runtime evidence is claimed for this collection failure.
