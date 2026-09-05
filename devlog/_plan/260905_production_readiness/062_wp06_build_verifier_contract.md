# WP06 — disjoint build and verifier contract

P artifact paired with060/061; no source changes before A passes. Current baseline
54543ee0 and WP05's original-index correction/strict network violation ledger remain
intact. Seven bounded workers plus main; all Astra/high, no leaf delegation.
Main owns config/branch/FSM/goal/PR/CI/release decisions and final integration.

## Write ownership

| Worker | Exclusive source/test writes | Result |
| --- | --- | --- |
| G-wire | lib/providers/adapters/geminiOperations.ts, lib/geminiApiImageAdapter.ts | actual body relocation; unchanged wire/auth/error behavior |
| A-process | lib/agyProcess.ts, lib/agyArtifact.ts, config.ts | actual parser/scanner relocation;061 lifetime/central policy |
| A-operation | lib/providers/adapters/agyOperations.ts, lib/agyImageAdapter.ts | prompt/ref staging/operation relocation plus061 staging/late-abort correction |
| G-family | lib/providers/adapters/googleExecution.ts, lib/providers/execution/index.ts, legacy.ts, legacyClassic.ts, legacyNode.ts, legacyEdit.ts, legacyMultimode.ts | actual family routing and context-filtered refs |
| G-tests | tests/google-execution-parity.test.ts, tests/gemini-transport-parity.test.ts, tests/_geminiTransportFixture.ts, tests/gemini-api-wire-contract.test.ts | real Gemini routes/native wire/error/token fixtures |
| A-native | tests/_agyProcessFixture.ts, tests/fixtures/agy-fixture.mjs, tests/agy-execution-process.test.ts | only-owned native executable; family/process/ref/lifetime cases |
| A-cleanup | tests/_agyFaultFixtures.ts, tests/agy-execution-cleanup.test.ts | exact filesystem faults/held read and exception-safe cleanup |
| Main | existing boundary/import/node/prompt/error contracts, inventory/structure/docs/evidence | integrate exact owners; preserve all other lanes |

Workers may read sibling files but never overwrite them or stage/commit/rebase.
Main creates checkpoints when integrated compilers/focused tests pass. New tests
may wait for planned sibling files but must not invent duplicate stubs/production
flags to work around an unfinished dependency. None may execute066 changes.
Hard limit<500lines/file; split private fixtures before exceeding, with main approval
of disjoint paths. Functions target<50lines except unchanged bodies whose deliberate
relocation is recorded; do not use this migration as an unrelated rewrite.

## Production interface and source-body integrity

G-wire moves every declaration in geminiApiImageAdapter with only relative import
rebasing. Facade reexports generateViaGeminiApi and GeminiApiGenerateResult, same
function identity in source/emitted graphs. No timeout/auth/provider fallback fix
is smuggled into this move. Native last-inline-image and text concatenation behavior,
usage key casing and reference MIME precedence stay exact.

A-process exports spawnAgy(prompt,signal?), agyError(message,status,code);
agyArtifact exports parseAgyOutput(stdout), findRecentAgyArtifact(sinceMs,roots?).
The parser/scanner function bodies remain byte-identical apart from import owners;
the existing file-symlink residual is preserved until066. Process lifetimes change
only as061 specifies. Central config policy is a named readonly export, not a new
persisted key. Configuration must be isolated before importing this new dependency.

A-operation imports these actual functions, never its old facade. Move prompt/
reference/result declarations; keep signatures and prompt line text exact. New
signal checks use one private helper that throws the existing Agy cancellation
error, not signal.reason (which can be a string/foreign error). After partial-stage
failure, cleanup cannot mask the original EIO. Ref paths are unique owned roots;
do not remove a broad tmp/home root or unknown provider artifact after cancellation.

G-family exports isGoogleRequest and prepareGoogleExecution with the existing
generic/surface-specific PreparedImageExecution contract. Use function overloads
like current family owners; no result coercion with broad any/as casts. Classic
capture timing and node parent MIME metadata follow060. Agy receives requestId
property even when undefined; Gemini's optional requestId follows the old per-surface
omission behavior. Each execution reads the current ctx credential state, never a
prepared secret snapshot. Multimode returns one dense native image/projection with
no originalIndexes, callback or maxImages loop. Shared native result object remains
identical for single results; no extra metadata reshaping.

Main compares moved declarations using TS AST/text snapshots and transpiled emitted
graphs, separating intentional061 changes from relocation. Retarget source tests
to real owners; keeping facade-name strings green while executing duplicate legacy
bodies is not acceptance. All legacy Google branches/imports must be removed, while
Atlas/MiniMax/NAI/Comfy branches and WP05 sparse final-sweep behavior remain untouched.

## Gemini test fixture, auth and graph isolation

Public helper responsibilities in `_geminiTransportFixture.ts`:
`openGeminiFixture():Promise<fixture>` opens an existing strict isolated environment,
installs module mocks for vertexAuth BEFORE the selected DUT graph imports, and
returns operation/route access, captured calls, configurable synthetic Vertex state,
work tracking and close. Exact helper shape may be private to G-tests; no other
worker depends on it. Existing openRouteHarness is reused for actual HTTP routing.
Use source .ts graph for route tests; run a separate fresh child for emitted .js
facade identity/native Vertex activation. Do not mix graphs in a single fixture.

Mock only isVertexInitialized/getVertexAccessToken/getVertexProjectId; any extra
auth entry point reached must fail loudly. No GoogleAuth construction, real token
refresh, env credentials or initialized real state. Public cases assert tokenCalls0;
Vertex cases count initialization/token/project reads and require exact synthetic
project/token identity. Neither public key nor token may leak into result/URL.
Native fetch sees only exact expected public/Vertex URLs, method/header/body;
default-deny all unexpected fetch/DNS/http/process channels persists through drain.
Track pending operations; releases/abort/allSettled run before traps/config restore.

Required direct-operation cases: public vs forcedVertex vs no-public-key Vertex;
uninitialized/missing credentials; existing explicit-Vertex-unready/public-key
fallback observed without relabeling it fixed; aliases/dimensions/auto omission;
declared/detected/fallback MIME and accepted3refs; last inline image wins; text order;
usage/missing usage; safety/no-image/429/400/403/500; JSON/fetch failure; AbortError
with/without external abort and TimeoutError exact baseline classification; token
reject identity and held token then abort. No extra network call or paid retry.

Actual route cases cover Gemini classic/node/edit/multimode, effective/raw prompt
and sidecars, parent-only/plus root/child, exact cap3 and parent+3 rejection before
token/fetch, masks/admission, one-image multimode projection, cancellation persistence.
Q06-5 Vertex must execute on both canonical CI runtimes, never conditionally skipped.

## Native Agy fixture contract shared with A-cleanup

`openAgyProcessFixture()` in `_agyProcessFixture.ts` exposes a private test-only
handle with:

```ts
root: string;
generate: typeof generateViaAgy;
prepare: typeof prepareImageExecution;
ctx: RuntimeContext;
configure(scenario: string, options?: Record<string, unknown>): Promise<void>;
waitFor(event: string): Promise<Record<string, unknown>>;
spawnCount(): number;
observations(): readonly Record<string, unknown>[];
track<T>(work: Promise<T>): Promise<T>;
close(): Promise<void>;
```

A-native publishes this handle before A-cleanup integrates. It reuses strict
isolation primitives, never changes isolateExecution's default deny or adds a
production test switch. In its dedicated scope only, a child-process guard accepts
one fixed test executable and exact argv[-p,-], cwd/options/env shape. All other
spawn/exec/fork and fetch/DNS/http remain denied with persistent violations.
Native child must have owned home/config/temp, no credential vars. Parent captures
the native spawn capability before installing default-deny, invokes it only after
exact target checks. A fixed Node fixture bridge may translate validated executable
to process.execPath + checked-in fixture path on Windows; record this limitation,
not a claim that actual Windows agy.cmd launch was tested. Never shell:true.

The fixture executable reads a control JSON only under owned HOME, consumes stdin,
parses literal ImagePaths JSON, reads each exact staged file and records byte hashes
and order. It rejects paths outside its owned temp root. It emits a tiny valid PNG
at a known owned artifact path and protocol output. Scenarios: success, malformed
RESULT, no-artifact, unparseable-with-recent-artifact, explicitERROR/quota, outside
lexical path, cooperative wait, TERM-ignoring wait. Readiness/TERM/close use explicit
events/receipts, never sleeps. Child code has its own no-network/no-process guard.
No source/test file outside these assigned scopes is created.

`close` releases held actions, aborts tracked work, kills any retained native child
handle if needed, waits actual close and all tracked promises, asserts violation
ledger, then restores mocks/env and removes only its own root. A watchdog that
reaps a mutated DUT child must mark the test failed, not silently turn it green.
Startup/no-close failures retain enough identity for main cleanup. Do not restore
network/process traps while unresolved work can still execute.

Native cases: all four family surfaces (one native call each), correct root/child
ref bytes/order for both context modes, classic captures, edit prefix, default fixed
resolution, multimode one-image/no callbacks, absent/malformed/error/fallback paths,
cooperative abort and TERM-ignoring native termination, timeout first-reason wins,
pre-aborted spawn0, original stdout/stderr/result semantics. Assert actual process
close before operation rejection/refs removal, not merely kill() invocation.

A-cleanup imports this handle. `_agyFaultFixtures.ts` installs exact owned-path
writeFile/readFile fault hooks after harness setup, with native restoration in
finally and no unscoped filesystem mock. Second ref write EIO and mkdir/write
failures leave no staged directory/spawn. Hold artifact read, abort and release:
499, no successful native result, known artifact cleaned, refs removed. Prompt/log
failure after staging is caught by the cleanup-owning finally. Tests explicitly
release barriers and await all work before restoring hooks/closing harness.
Add an exact ref-directory rm barrier: cancel while successful reference cleanup
awaits, release, and require499 after cleanup; mutate only the final post-cleanup
check for an independently failing oracle. A separate primary-EIO + held-cleanup
case must preserve the original EIO despite cancellation. Held artifact-read
ablation removes all later masking guards as a documented compound mutation.

## Main regression and publication gates

Retarget `_executionBoundaryProbe`, `_executionImportEdges`, import/node/prompt
contracts to new actual owners. Add capture timing/effective refs assertions; keep
non-Google exceptions intact. Update inventory and source function-map generated
drift artifacts using existing scripts, not manual forged counts.
Main specifically owns actual Agy node-route cap cases: P+A+B reaches the operation;
P+A+B+C returns400 AGY_REF_TOO_MANY with operation/process0. Direct prepare/generate
tests cannot substitute for this caller admission guard.

Before C: main typecheck, tests typecheck, server/CLI/UI builds, inventory, diffcheck,
focused new/existing files under env-i. No local full suite or hosted-only heavy
tests. Required independent C lanes: production/input semantics, native process/
cleanup safety, fixture activation/negative-oracle validity. Actual barrier/KILL/
mapping mutations must go RED and restore GREEN. Main owns manual HTTP, current UI
capture comparison and exact-head CI/CodeQL/gitleaks. At least one native process
test and Vertex test must run unskipped on both canonical Node runtimes.

Publish one WP06 PR above204 only after scoped evidence exists; keep draft until C
proof and independent review pass. No merge until the overall stack gates. D cites
real receipts and still leaves066/c18 and inherited CodeQL triage explicitly open.
