# WP06m — frozen helper interfaces and disjoint build map

Read with065/065_1. Plan-only until A passes. No video URL policy or observable
download-caller behavior change. The one mechanical production operation extraction
below is distinct from test helpers. New files<500lines, functions<50lines except
the explicitly unchanged extracted operation body; main
approves any additional file split before workers write it.

## Worker ownership

| Lane | Exclusive writes |
| --- | --- |
| Body | lib/grokVideoDownload.ts |
| Stream | tests/_videoStreamFixture.ts, tests/grokVideoDownload.test.ts |
| Transport fixture | tests/_videoExecutionFixture.ts |
| Codec fixture | tests/_videoFfmpegFixture.ts |
| Generator | tests/grokVideoAdapter.test.ts |
| Routes | tests/videoRoute.test.ts, tests/videoExtendedRoute.test.ts |
| Last-frame | tests/videoExtendI2v.test.ts, lib/videoExtendI2vOperation.ts, routes/videoExtended.ts |
| Agent/envelope | tests/agent-mode-runtime-contract.test.ts, tests/error-envelope-contract.test.ts |
| Main | tests/_executionRouteIsolation.ts, tests/execution-process-isolation.test.ts, tests/provider-execution-harness.test.ts, pairing/inventory/SoT/plan/evidence |

Workers read sibling files but never change their write sets, shared raw-network
guard or Git/FSM/goal. Main owns integrated emit/typechecks; test workers wait for
helper/DUT graph-ready. No full local suite, large allocation, real provider or
user3333. Codec lane may run only the approved tiny owned FFmpeg checks after
its guard is implemented; other process operations remain denied.

## Whole last-frame operation: narrow production extraction

NEW lib/videoExtendI2vOperation.ts exports `runLastFrameI2v(task):Promise<void>` and
the moved ParentMetadata type. task contains the original IIFE captures:
ctx:RuntimeContext; requestId/sourceVideoId/prompt/model:string;
provider:"grok"|"grok-api"; duration:number;
resolution:NonNullable<GrokVideoOptions["resolution"]>;
aspectRatio:NonNullable<GrokVideoOptions["aspectRatio"]>; parent:ParentMetadata|null;
motion:{ids:string[];fragment:string}; cancelController:AbortController;
extractFrame:(dir:string,file:string,position:string,options:{signal:AbortSignal})=>Promise<string>;
generateVideo:(prompt:string,ctx:RouteRuntimeContext,options:GrokVideoOptions)=>Promise<GrokVideoGenerateResult>;
persistArtifact:typeof persistVideoArtifact; createFilename:(ctx:RuntimeContext)=>string.

Move videoExtended.ts324–382's IIFE (body325–381) unchanged after one capture destructure.
Keep stage/event/finish-before-done/catch behavior and every actual dependency call.
Route passes original values/functions and does `void runLastFrameI2v({...})`;
no request fields, await-before202, runtime test flag, retries or lifecycle change.
Move ParentMetadata verbatim and import it as a type in the route; the existing
VideoExtendedDependencies export stays compatible. Use canonical lib imports, no
lib-to-route cycle. Main checks body equivalence and registers the emitted JS twin.
The unchanged long body is a recorded relocation exception, not an unrelated rewrite.

Transport fixture imports the real function after isolation, before route import,
then module-wraps it by delegating unchanged arguments, tracking the original
Promise and returning that SAME Promise. Never fake generator/persistence or infer
completion from inflight/event state. Last-frame tests hold an existing dependency
through cancellation, observe early terminal/empty inflight, and require finishCase
to remain pending until the actual whole-work Promise settles.

## Stream fixture public test contract

`makeVideoStreamFixture(chunks:readonly Uint8Array[],options?:VideoStreamOptions)`
returns the real Response/body, a `stats` record, `waiting:Promise<void>`,
`close():void`, `error(reason:unknown):void`, `releaseCancel():void`, and
`assertDrained():void`. Options are headers/status/holdOpen/failAfterChunks and
cancelBehavior resolve/reject/pending from065. Stats include pulls, bytesEnqueued,
sourceCancelCalls, readerCancelCalls, releaseLockCalls, arrayBufferCalls and copied
chunk identities where the test explicitly installs a Buffer spy.

Use HWM0, pull-driven enqueue and actual default reader delegation. Record methods
without replacing read semantics. The instance arrayBuffer spy records AND throws;
callers independently assert0, so its error cannot masquerade as an expected502.
Create fixtures before global Buffer spies; do not count Response construction as
downloader concat/copy. `releaseCancel` settles the intentionally pending cleanup
promise during final teardown. `close/error` tolerate an already closed/canceled
controller only in cleanup, never suppress an unexpected test assertion.

Export tiny `fakeMp4Bytes()` and `forbidArtifactArrayBuffer(response,violations)`
for caller fixtures. The latter returns the SAME Response with an instance method
spy and inspection handle; no arrayBuffer/text/blob pre-read or reconstructed body.
Frame endpoint response consumers do not use this helper.

## Codec fixture public test contract

```ts
captureFfmpegCapability(): { nativeExecFile: typeof execFile; originalPath: string };
installVideoFfmpeg(root:string, capability:ReturnType<typeof captureFfmpegCapability>,
  violations:unknown[]): Promise<{
    available:boolean;
    executable:string | null;
    attempts:readonly FfmpegAttempt[];
    createClip(path:string,color?:"blue"|"green"):Promise<void>;
    drain():Promise<void>;
    close():Promise<void>;
    restore():void;
  }>;
```

Capture runs before base process denial, but does not execute anything. Resolve
the fixed executable from original PATH with filesystem checks during installation;
pin its canonical regular-file path. Install a fresh execFile replacement after
base isolation and before production imports. No inherited native promisify.custom:
omit it or supply a new custom async wrapper that calls the guarded function and
returns native-compatible stdout/stderr (and child if used). Never mutate native
function properties while installing a proxy.

Synchronous argument/path validation lets execFile return the actual ChildProcess.
Use realpathSync/statSync for existing inputs and canonical output parents under
the owned root. Permit only these full argv forms, with owned path positions:

An existing output leaf must also be lstat-verified regular/non-symlink and remain
canonically owned; an absent leaf is allowed only under the checked parent. Reject
input/output same canonical path or same dev/ino. Reserve each canonical output
for its live writer (portable normalized path key); reject simultaneous writers
before native delegation. Release only at child close. Tiny validator tests cover
leaf links, nonregular targets, aliases and duplicate reservations with0commands.

- `["-version"]`;
- `["-y","-f","lavfi","-i","color=c=blue|green:s=64x64:d=1",
  "-pix_fmt","yuv420p",<owned.mp4>]` (color is one literal choice, not a regex input);
- the exact last-frame and numeric-position extraction arrays in
  lib/videoFrameExtract.ts; finite position0..3600;
- the exact one-frame thumbnail array in lib/videoThumb.ts, including its fixed
  scale expression and owned output suffix.

Reject other flags, URLs, shell/cwd/env overrides, wrong executable, outside-root
paths and unbounded options into the violation ledger. Native delegation supplies
owned cwd/home/temp and only trusted executable PATH/platform/locale env; no keys.
Version/createClip receive explicit bounded timeout/maxBuffer; production frame/
thumbnail options retain their validated existing values and signal.

Retain every returned ChildProcess, actual pid when present, close promise and
callback completion. Ordinary native codec errors are outcomes, not boundary
violations. On close, kill only retained live child handles and await their close
before restore/removal. A native watchdog failure is recorded, never a passing
cleanup. If no binary is available, approved attempts target a guaranteed absent
owned path to deliver native ENOENT; never fall back to the host PATH.

`createClip` uses the same guarded entry point and creates only a64x64 one-second
owned file. `available` drives explicit optional-test skip. Main C requires local
real-codec cases unskipped; hosted skips are reported separately.

## Shared video fixture public test contract

```ts
openVideoFixture(options?:{codec?:boolean}):Promise<{
  root:string; config:RuntimeContext["config"];
  beginCase():void;
  calls:UpstreamCall[]; violations:unknown[];
  ffmpeg:Awaited<ReturnType<typeof installVideoFfmpeg>> | null;
  trackApp(app:Express):void;
  listen(server:Server,role:"app"|"proxy"):Promise<string>;
  registerApp(server:Server):void;
  fetchApp(input:Parameters<typeof fetch>[0],init?:RequestInit):Promise<Response>;
  respond(handler:(call:UpstreamCall)=>Response|Promise<Response>):void;
  allowFailure(error:unknown):void;
  bridgeProxy(server:Server,validate:(call:UpstreamCall)=>void,
    artifactPath:string):void;
  controller():AbortController;
  track<T>(work:Promise<T>):Promise<T>;
  addStream(stream:ReturnType<typeof makeVideoStreamFixture>):void;
  drain():Promise<void>;
  finishCase():Promise<void>;
  close():Promise<void>;
}>;
```

Use executionTestProcess/child environment allowlist at file entry, then capability
capture, isolateExecution, optional codec guard, tracked-write setup, and finally
config/SUT dynamic imports. No static SUT import ahead of isolation. Preserve actual
config/logger/runtime functions and verify owned storage paths. Different fixtures
must not overlap in one process or reuse a deleted config root silently.

`registerApp` retains one actual owned app server at a time; `fetchApp` is a private
test-caller channel via isolation.fetchOwned. Tests call this function directly;
global fetch is reserved for validated DUT upstream traffic. App and proxy servers
are tracked by actual object, never a naked-port or all-loopback exemption.
Call trackApp BEFORE route registration; it observes the actual returned handler
promises for used HTTP methods, preserving their return/error behavior. This uses
the existing PromiseTracker pattern, not a fake handler/result. Retain server close
promises when registered: listening=false alone does not prove sockets have closed.
The fixture listen helper enrolls server/error/close ownership first, invokes
existing listenOwnedLoopback(() => server.listen(0,"127.0.0.1")) synchronously,
then awaits listening/error. Failed startup is closed and awaited. Both app and
proxy workers use this recipe, not ordinary listen followed by registration.
Lifecycle clarification approved during B: open starts idle; beginCase explicitly
opens a scenario. A file-scoped fixture uses beforeEach(beginCase) and
afterEach(await finishCase). finishCase moves active→finishing→idle only after all
work/resources settle. beginCase rejects finishing/active/closed state and any
retained violation; only drained per-case observations are reset, never violations.
No respond/listen call silently reopens admission. A per-test fixture also calls
beginCase once. close handles idle or active state and permanently closes it.

`respond` installs a persistent normalization/validation ledger around the handler.
Constructor/text/wire/callback AssertionErrors and unregistered rejections fail
teardown even if DUT converts them to502. `allowFailure` permits only the exact
registered object/value (or exact aborted call.signal.reason); it is not a blanket
permission for responder exceptions. Clear per-case calls only after a drained
scenario, never clear violations to obtain green.

`bridgeProxy` supplies that responder: normalize and validate exact origin/path/
method/headers, then call isolation.fetchOwned(proxyServer,input,init). Preserve
request body bytes and actual signal; don't consume a request stream and reuse it.
Current video requests have JSON string bodies; reject unsupported body shapes.
For the literal artifact path only, wrap the returned original Response with the
shared arrayBuffer prohibition. Record POST/poll/GET independently.

`controller` returns an owned AbortController aborted by close. Every potentially
held call must use it and be tracked. Capture native timer functions before test
mock clocks; bounded drain/watchdogs must still fire. Teardown aborts controllers,
releases held streams/cancel promises, awaits operations, writes and codec children,
then closes retained servers/DB and restores mocks/isolation. Unsettled timeouts
retain protections/handles/root; settled verification failures finish safe cleanup
and are then rethrown. Do not restore underneath live work or hide settled failures.
After isolated module setup, assert the inflight store is empty; all jobs created
in that non-overlapping fixture belong to it. finishCase aborts its outstanding
inflight jobs/controllers and releases fixture barriers, but completion comes from
actual handler/whole-operation/thumbnail promises, not the now-empty inflight map.
It freezes new test-caller/configuration admission while letting already-owned work
enroll its cleanup. Drain tracked work/children, close enrolled case servers through
their close promises, then re-drain late finish/write callbacks to a quiet fixed
point before returning. Global guards remain installed. Every per-case finally
awaits finishCase BEFORE removing its directory; old fire-and-forget close helpers
are removed or made idempotent delegates. drain alone observes settlement; close
uses finishCase before final DB/guard/root teardown.

Wrap actual videoThumb.generateVideoThumbnail after installing the codec guard and
before SUT import. Preserve every export and return the original Promise; observe
it through its catch/unlink cleanup. Its observer settlement is separate from the
caller-visible rejection. An ordinary optional thumbnail failure is expected only
when the exact input/path/invocation has an approved FFmpeg attempt with a recorded
native codec failure/ENOENT and the wrapper's expected failure shape. Unexpected
validation/assertion/write errors go into the permanent violation ledger. Never
feed every rejection into PromiseTracker as a failure, or ignore them all. Track
the neutral observer promise, preserving the original Promise to production.
Tests hold thumbnail cleanup after child close and require finishCase to wait;
an unrelated rejection must fail cleanup. Boundary violations always fail even
when a matching codec failure exists.

Route workers keep original assertions and convert test-caller fetches to fetchApp.
Their actual app route registrations, generator/downloader and persistence remain
real. Inject only existing frame seam where already appropriate; preserved real
FFmpeg cases use codec:true and exact command receipts. The only production seam
change is the above mechanical whole-operation extraction, not a test switch.
Agent does NOT adopt openVideoFixture: it retains its current isolateExecution,
imageTransport activation/call/resolution assertions, tracked writes and owned
app client. It imports only the standalone artifact spy and adds real video-failure
cases. No nested isolation or removal of prior pinned-image checks.

## Integration and mutation gates

Main's harmless process-mock customizer test must fail against the old guard and
pass after the fresh deny replacement, with no actual command. Main builds matching
JS once production is ready, then releases runtime test work. Per-lane failure
repro and synthesis precede repair; no repeat without changed evidence.
Main also updates provider-execution-harness's setup-failure regression: inject a
one-shot throw in the exact descriptor read for childProcess.spawnSync, forwarding
all other reads unchanged. Assert the injection ran and preserve descriptor/env/
root restoration checks. If isolation unexpectedly succeeds, retain its handle
and close it in finally before reporting assertion failure; no leaked fixture.

Before C: focused new reader/generator/caller tests and old shared isolation
consumers, semantic typechecks, server/CLI/UI builds, inventory/line-count/gitleaks.
C uses fresh independent reader/fixture/caller scrutiny, source mutations and exact
head Node22/24 CI. Manual HTTP covers completed-video failures/no persistence using
only tiny fixture bodies; visual regression uses the maintained isolated E2E suite.
No billed provider, aggregate-memory, MP4 decode or universal egress-safety claim.
