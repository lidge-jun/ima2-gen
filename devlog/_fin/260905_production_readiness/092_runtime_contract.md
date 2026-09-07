# WP09 P — runtime and build boundary amendments (draft)

Consumes090 with091 current-tree evidence. This is a P artifact, not an A approval
or implementation. Source baseline remains7e2f084d; WP09 has docs changes only.
All UIR-1–10 and I1–I9 criteria remain. Amendments below resolve current caller
shape, module size and repeated-build issues before B ownership is assigned.

## Structural decision

Existing appServer owns subprocess lifecycle and public fixture API. Keep that
boundary. Split its new mechanisms into test-only modules with no production
imports. Receipt generation is a separate script boundary consumed by wrapper,
projection and focused tests. Rejected: copying a live checkout; a second test
runner; per-test full recompilation; importing provider-test fixtures into an app
preload; weakening ordinary builds to obtain deterministic fixture output.

Dependency direction:

`build:fixture → receipt public facade → schema/files/transaction`

`appServer → appOwnership + appProjection → appRuntimeBuild + receipt validator`

`appNetworkGuard → appPolicy + appFilesystemGuard + appProcessGuard`

`appFilesystemGuard → appFilePaths + appFileDescriptors`

Production modules do not import any of these. Guards execute only in the emitted
app child; compiler commands execute only in the clean parent runner. Types are
owned by the declared public contract, not copied into individual consumers.

## Exact additional module map

| New file | Responsibility and public boundary |
| --- | --- |
| `scripts/lib/uiBuildReceiptSchema.mjs` | Pure digest, strict receipt parsing and binding assertions from090. |
| `scripts/lib/uiBuildReceiptFiles.mjs` | Positive source/output inventory, canonical regular-file reads, source Git/options snapshot. |
| `scripts/lib/uiBuildReceiptTransaction.mjs` | WeakMap-bound begin/finish/abort, native watchers, exclusive cache lock and publication. |
| `scripts/lib/uiBuildReceipt.mjs` | Public feature facade retaining the exact090 exports; no independent state or duplicate parser. |
| `scripts/lib/uiBuildReceipt.d.mts` | Exact declared public types/signatures. Private modules use JSDoc imports from this contract. |
| `ui/e2e/fixtures/appOwnership.ts` | Parent-only owned homes, live app/stub origin leases, idempotent disposers and worker cleanup. |
| `ui/e2e/fixtures/appRuntimeBuild.ts` | Parent-only tracked-source inventory and one verified emitted cache per worker. |
| `ui/e2e/fixtures/appProjection.ts` | Per-start runtime projection, verified UI copy, policy/guard installation and owned cleanup. |
| `ui/e2e/fixtures/appPolicy.mjs` | Strict policy parsing and fixed safe denial records; imported by runtime guards only. |
| `ui/e2e/fixtures/appFilePaths.mjs` | Lexical/canonical descendant checks and exact expected-discovery classification; no content reads in canonicalization. |
| `ui/e2e/fixtures/appFileDescriptors.mjs` | Checked descriptor/FileHandle provenance, allowed mode, close/restore lifecycle. |
| `ui/e2e/fixtures/appFilesystemGuard.mjs` | Home override and090 filesystem wrappers, delegating paths/descriptors. |
| `ui/e2e/fixtures/appProcessGuard.mjs` | Fresh denying functions, named/prototype/custom-promisified/Worker coverage. |
| `ui/e2e/fixtures/appNetworkGuard.mjs` | Preload composition, exact socket destination, independent DNS/TLS/UDP denial and ready IPC. |

The extra guard helpers are explicit runtime copy inputs. They replace090's
three-file-only copy assumption: copy exactly network/process/filesystem/policy/
file-paths/file-descriptors MJS files, never appProjection/appOwnership/TypeScript
builders or arbitrary fixture files. Module size target<=400, functions<=50;
boundaries encode responsibility, not effort buckets. Public facade re-exports
are permitted as a feature API, not a catch-all convenience barrel.

## Receipt wrapper refinements

Retain090 public API, schema and ordinary build command. The strict wrapper uses
the same installed UI tsc/tsc-E2E/Vite sequence after server/CLI CI prebuilds.
Before Vite loads, child env is a positive selection of runtime path/system/locale/
temp variables plus the five validated public build switches. Do not forward
NODE_OPTIONS/NODE_PATH, provider keys, proxy variables or arbitrary VITE values.
Always inject `VITE_IMA2_API_TARGET=http://127.0.0.1:1` for the strict child so the
resolver never falls through to homedir/server.json. Caller target may be absent
or exactly that value; other values fail before spawning. No request is sent there.
HOME is never reassigned; absence is not claimed to change os.homedir.

Record input options from the original validated caller and fixed production
mode, not from a receipt. The synthetic target is fixed policy, not a variable
receipt field. CLI child commands have bounded output and an intrinsic deadline;
failure waits for child exit before aborting its transaction. Fix the exact bound
alongside observed CI build duration before A, not by increasing it after timeout.

Watch selected trees recursively and explicit-file parents non-recursively with
exact filters. Null filenames, watcher errors and selected input rename/change
invalidate the transaction. No polling fallback and no lost-event security claim.
Ignore only declared generated caches/outputs; never ignore a changed source.
Same-process object/nonce ownership and published-output recheck remain as090.

UIR additions: direct/custom-promisified wrapper process sentinels; null-filename
watch invalidation; no advertise read with absent caller target; private transaction
cleanup on watcher setup failure; ordinary build stays compatible with synthetic
dotenv and missing root emitted files. These do not require live data or services.

## One worker cache, fresh per-start projection

`createAppProjection({repoRoot,home,buildDir})` retains090's public signature.
Its first call obtains a process-local cache owned by the worker registry. The
cache copies the positive tracked source list, compiles server+CLI into a separate
owned runtime, compares every output with the preceding source build and stores
source/compiler/output digests. It is never served and never used as a writeable
app root. Concurrent first calls share one promise; failure does not publish it.

On later calls, re-enumerate and hash selected tracked worktree sources, verify
compiler identity/version and cached emitted outputs, compare current preceding
build outputs, then copy verified bytes into a NEW per-start projection. Changed
source/compiler/build/cache is an error before app spawn, not automatic rebuilding
or reuse of an old cache. Preserve090's shebang normalization and output mapping.
UI receipt is independently verified before and after every copy. Each app has
its own runtime root/policy; registered durable test home can survive a restart.

Worker cleanup waits for all owned child exits before disposing homes and the
cache. If any exit is unproven, retain its roots and fail teardown; never delete
active runtime bytes. No persistent on-disk cache, cross-worker sharing, PID-based
lock stealing or source archive app launch. Test cache tamper, source change,
failed first compile, two callers and same-home restart independently.

## AppHandle compatibility and browser boundaries

Keep `baseUrl/stub/home/close` and existing optional J6 isolation provenance.
Add `guard` rather than replacing the J6 object:

```ts
type FixtureGuardReport = {
  ready: boolean;
  deniedConnections: Array<{ transport: string; host: string; port: number }>;
  deniedProcesses: Array<{ api: string }>;
  deniedFilesystem: Array<{ operation: string; category: "outside-fixture" }>;
  expectedDiscoveries: Array<{ api: string; discovery: string }>;
  expectedLegacyProbes: number;
  assertClean(): void;
};
```

Creation: parent IPC collector; IPC validates fixed record fields; consumer:
startApp startup/close, I tests and evidence writers. No production state/wire
serialization. JSON evidence includes only safe counters/records, not policy
paths, private ownership tokens, command argv or raw env. J6's existing configPath
field must become an owned-home marker in new evidence, not expose the new lease.
Old frozen artifacts are not rewritten. Tests compare the guard directly before
serialization; methods are not manufactured by JSON parsing.

All startApp calls now require the genuine hosted preflight, not just j6=true.
The j6 option preserves no-credential/selection-only defaults, not an isolation
bypass. Existing J6 fallback-port checks stay until real I9 evidence justifies any
later change; do not add port probes on the laptop. Both actual server-listen and
guard-ready IPC must be observed; bounded cleanup preserves the original failure.

`seedBrowser` installs the new exact-origin browser guard once per context using
live origins issued by the parent ownership registry. Seed payload installs once
per page; an identical second call is a no-op, a conflicting seed is a misuse
error. This preserves J5's identical second seed call without duplicate scripts.
Same-origin reload is protected by the sessionStorage marker from090. Pure I tests
must not allocate a browser through an auto fixture dependency.

J6 keeps its existing stronger context routing, serverless fixtures keep their
asset-only transport, and WP07's owned native SSE redirect remains a separately
verified capability. Do not broaden a global rule to all loopback ports to support
that stream. Its exact path/origin/credential checks and close receipts remain.
All specs that start an app, directly or through J6, import the automatic worker
cleanup `test` export. Serverless specs may retain bare Playwright test.

## Open P items

Additional filesystem activation cases are required before audit: readFile and
createReadStream can receive write-capable flags, so a method name alone is not
the access mode. Check explicit flags before opening, including numeric flags.
readFile/open path-vs-FD overloads must reject untracked descriptors. Preserve and
guard realpath.native/realpathSync.native, not a copied original bypass. A recursive
cp needs metadata checks for descendant symlinks and effective destination paths
before native copy; checking only its two top-level strings is insufficient.
State TOCTOU/native-internal limits honestly; do not claim those prechecks are an
OS security boundary. Synthetic positives/negatives must activate these overloads
with native sentinel counts, without any real credential or user-directory probe.

Finalize narrow method signatures for the parent registry/cache and explicit IPC
schema; finish source audit of runtime method use and expected discovery patterns;
write the production UI journey amendment; assign disjoint B files; run independent
A review. This draft is not permission to start implementing unspecified edges.

## Parent ownership API refinement

The registry owns homes and app resource leases, not a generic resource service:

```ts
export type OwnedAppRecord = {
  home: string;
  appOrigin: string;
  stubOrigin: string;
  closeResources(): Promise<void>;
  exited(): boolean;
  verificationReported(): boolean;
  verify(): void;
};
export function issueAppHome(): Promise<string>;
export function requireAppHome(path: string): void;
export function registerOwnedApp(record: OwnedAppRecord): void;
export function isOwnedBrowserOrigin(origin: string): boolean;
export function disposeOwnedApps(): Promise<void>;
```

issueAppHome uses mkdtemp and stores canonical path/dev/ino before returning.
requireAppHome rejects unknown/changed/symlinked homes without content reads.
registerOwnedApp checks that home and exact ephemeral loopback origins, then keeps
the record through worker teardown; origin admission requires the record still be
live. Native process exit is the authority, not an untrusted JSON flag.

Separate closeResources from verification: public app.close awaits resources and
then records/reports guard.assertClean. Worker teardown always awaits resources;
it verifies records not already reported, then disposes homes only after every
associated child exit is proven. This lets a negative I6-content case explicitly
assert a rejected close without the worker reporting the same expected assertion
again. It does NOT clear violations, label a dirty guard clean, or skip resource
cleanup. Repeated guard.assertClean still throws. Unreported violations remain a
worker failure. A failed resource close still fails cleanup and retains live roots.

appServer's auto-worker finalizer calls disposeOwnedApps first, then a separately
exported disposeRuntimeBuildCache from appRuntimeBuild. Ownership does not import
the builder, avoiding a cycle. If any child exit is unproven, skip cache deletion
and fail; the disposable runner remains the outer exposure bound.

Runtime build API:

```ts
export type EmittedSnapshot = {
  root: string;
  sourceDigest: string;
  compilerVersion: string;
  files: readonly { sourcePath: string; sourceSha256: string;
    emittedPath: string; emittedSha256: string }[];
};
export function getVerifiedRuntimeBuild(repoRoot: string): Promise<EmittedSnapshot>;
export function disposeRuntimeBuildCache(): Promise<void>;
```

The builder returns only an internally registered snapshot, never accepts one
from JSON/callers. Projection rehashes files before copying. Capture/check source
inventory before and after staging/compile and compare current preceding build
bytes. Changed root/head/source/output/compiler fails; no implicit cache refresh.
The source list is positive and git-tracked; imported untracked TS cannot resolve
inside staging. Server/CLI compiler output is bounded8MiB per command with120s
deadline, matching the same bound for UI wrapper stages. Current source CI builds
finish well below this bound; timeout is failure, not an automatic retry.

Browser teardown additions to the exact old map: J1/J2/J3/J4 and provider-surface-
affordance close their owned page before app.close. J5 navigates to about:blank
while the first app is still alive before closing it, then navigates the same page
to the second owned origin. This prevents unloading after origin lease retirement.
No extra seed is installed and no persistence assertion is removed. J6 already
closes pages before the app; keep that ordering. Its owned native stream path is
unchanged. All current app-starting specs adopt the cleanup-owning test import.

## Guard and IPC precision

090's policy remains exactly `{version:1,root,home,dependencyRoots}`. All values
must match the issued canonical roots before installing guards. No cache path,
command argv or arbitrary target can be smuggled in a new policy field. Runtime
helpers export only the described installers/check functions, not app mutation APIs.

IPC accepts only version1 ready, fixed filesystem denial, fixed process denial,
and connection denial record shapes from090. Unknown fields/types or malformed
records are protocol violations and fail startup/clean checks without echoing the
message. Discovery enum is exactly agy-version/grok-version/codex-login-status or
null, not arbitrary strings. Host/port records contain no URL path/query/credentials.
All unexpected denials remain in the ledger even when the app catches the error.

Network installer covers the socket connect overloads, rejects pipes/custom fd/
lookup/socketPath, and permits only the exact HTTP stub address. Add explicit
DNS resolver/lookup, TLS, HTTP2, UDP and global WebSocket traps patterned after
the verified route-test fixture. No legacy caller lease is imported. A new app
native stream is not authorized; the existing WP07 browser-only stream stays in
its own parent fixture. Tests use harmless sentinels for every transport and an
actual owned HTTP control request plus redirect denial in the hosted boundary.

Path conversion rejects NUL, non-file URL and Buffer values that do not round-trip
as UTF-8 before canonicalization. Otherwise an invalid-byte filename could be
checked under replacement characters but passed unchanged to native fs. Preserve
URL/Buffer/string safe forms and test an invalid-byte Buffer explicitly. Nearest-
existing-parent traversal handles ENOENT/ENOTDIR only; permission/other errors deny.
Check lexical policy and canonical target, including sibling-prefix and symlink
escapes, before any native content/open/copy call.

Descriptor registry exposes checked read/write/metadata checks, registers only
native open results after path/mode admission, and removes entries on close. A
FileHandle is admitted by object identity, not any object with an fd property;
its methods retain the correct native receiver. readFile/readStream flags are
checked just like open flags. cp preflight traverses only already-admitted source
metadata, checking each effective destination and rejecting nested links before
native recursive copy. No data source is opened during policy canonicalization.

These additions harden exercised JavaScript paths; native bindings/internal
loaders/new unpatched APIs remain outside the claim. Hosted cleanroom and trusted
code/dependency assumptions are unchanged, so none grants permission for a local
browser/server probe or an unreviewed new runtime allowance.

## Reachable negative setup seam

I6/I9 cannot poison a constructed runtime or remove an emitted entry through the
old startApp options alone. Add a test-fixture-only option, preserving all old
fields and defaults:

```ts
type AppStartOptions = {
  provider?: "minimax" | "oauth";
  home?: string;
  withoutMinimaxKey?: boolean;
  j6?: boolean;
  prepareRuntime?: (paths: { runtimeRoot: string; home: string }) => Promise<void>;
};
```

This callback runs in the already-required disposable parent AFTER projection
construction and BEFORE child spawn. It is for owned synthetic fault setup, not
an app runtime flag or permission bypass. Launcher still rechecks issued projection
identity, manifest entry/guard bytes, policy and UI receipt after the callback;
there is no custom command/argv/env/skip option. Missing/tampered compiled entries
therefore fail before spawn, while an injected `.ima2/config.json` remains an
explicit data-read denial tested by the actual child guard. The callback cannot
make a corrupt projection valid; a thrown setup error follows normal cleanup.
Trusted parent test code remains outside the JS child guard by definition.

For missing/malformed primary config, issue a home through the ownership API and
pass it via existing home option. An explicitly supplied registered home is never
reseeded; only a default newly issued start initializes config. This preserves
restart semantics and makes both I6 branches constructible without real-home edits.

NEW `ui/e2e/fixtures/appGuardReport.ts` owns the typed IPC collector used by startApp
and isolated guard probes. It exposes createGuardReport with accept(unknown), a
ready promise, immutable diagnostic views and assertClean. Malformed IPC fails the
ready promise/clean assertion with a fixed code, no raw payload. Probe-only result
messages use a separate test-local handler and are never accepted as guard-ready.
The MJS runtime protocol validator and this collector are checked against shared
literal positive/negative JSON examples; no app imports or fake authentication.

I8/I9 direct emitted-module probes run as separate parent-owned Node children with
the same fixed --import guard before their test driver; the app child never spawns
them. They invoke real codexDetect/quota/storageMigration only after guard-ready,
report fixed synthetic observations and exit. Driver code is fixture-owned, not
retrieved text or user input. Actual normal startApp plus models/keys/quota requests
still separately prove server startup. Do not replace either with a hand-called
mock that cannot activate the consumer.

## B causal amendment — blocked libc platform discovery

Native run34000963925 at5c66d810 identifies the three remaining startup refusals:
openSync of/proc/self/exe, openSync of/usr/bin/ldd, and readFileSync of/usr/bin/ldd.
No content reached the original filesystem. Installed detect-libc2.1.2 uses these
optional probes and falls back to Node's existing process.report data after denial.
The kernel/is-wsl hypothesis was rejected by the sanitized exact-path labels.

Keep both paths outside the read/write allowlist. Add expectedPlatformProbe only
for those exact lexical paths, normalized open/readFile APIs and write=false.
It throws E2E_FILESYSTEM_DENIED before originalFS; w/r+/O_TRUNC, streams/copies,
other paths and user config/auth remain unexpected refusals. No/proc prefix rule.
The IPC category expected-platform-probe is distinct from legacy metadata; the
collector admits only open/readFile (+Sync/promises) and platformLdd/platformExecutable
operation labels, stores readonly expectedPlatformProbes, and continues rejecting
malformed/extra fields. J6 and native startup evidence serialize this observation.

Field chain: path checker/write-intent -> private reported refusal -> IPC category
and sanitized operation -> strict GuardReport validation -> expectedPlatformProbes
-> J6/native evidence. There is no production API, config or provider change.
Validation: independent original-FS sentinels on both lexical and canonical paths;
native read/open/promise attempts remain denied, original-call count0; r+ attempts
remain in unexpected deniedFilesystem and assertClean fails for that negative case.
Normal guarded boot must separately pass and retain platform-refusal evidence.
Independent proposal reviewer Maxwell01a0741a-64c5-75a2-ab93-11b4c8be8e9e PASS;
this is not C/native acceptance. Pure regression went5pass/1fail before the change.
