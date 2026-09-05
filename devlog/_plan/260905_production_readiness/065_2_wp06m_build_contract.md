# WP06m — frozen helper interfaces and disjoint build map

Read with065/065_1. Plan-only until current A passes. No change to production
download callers or video URL policy. All helpers below are test-only and stay
outside package runtime exports. New files<500lines, functions<50lines; main
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
| Last-frame | tests/videoExtendI2v.test.ts |
| Agent/envelope | tests/agent-mode-runtime-contract.test.ts, tests/error-envelope-contract.test.ts |
| Main | tests/_executionRouteIsolation.ts, tests/execution-process-isolation.test.ts, inventory/SoT/plan/evidence |

Workers read sibling files but never change their write sets, shared raw-network
guard or Git/FSM/goal. Main owns integrated emit/typechecks; test workers wait for
helper/DUT graph-ready. No full local suite, large allocation, real provider or
user3333. Codec lane may run only the approved tiny owned FFmpeg checks after
its guard is implemented; other process operations remain denied.

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
  calls:UpstreamCall[]; violations:unknown[];
  ffmpeg:Awaited<ReturnType<typeof installVideoFfmpeg>> | null;
  trackApp(app:Express):void;
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
then closes retained servers/DB and restores mocks/isolation. If drain fails, keep
protections/handles/root for explicit cleanup instead of restoring underneath work.
After isolated module setup, assert the inflight store is empty; all jobs created
in that non-overlapping fixture belong to it. finishCase aborts its outstanding
inflight jobs/controllers, releases fixture barriers, then drains handlers/native
children/writes. It does not restore global guards. Every per-case finally awaits
finishCase BEFORE closing servers or removing the case directory; otherwise a
detached thumbnail could still read/write deleted files. drain itself observes
settlement without changing outcomes; close calls finishCase before final teardown.

Route workers keep original assertions and convert test-caller fetches to fetchApp.
Their actual app route registrations, generator/downloader and persistence remain
real. Inject only existing frame seam where already appropriate; preserved real
FFmpeg cases use codec:true and exact command receipts. No new production seam.

## Integration and mutation gates

Main's harmless process-mock customizer test must fail against the old guard and
pass after the fresh deny replacement, with no actual command. Main builds matching
JS once production is ready, then releases runtime test work. Per-lane failure
repro and synthesis precede repair; no repeat without changed evidence.

Before C: focused new reader/generator/caller tests and old shared isolation
consumers, semantic typechecks, server/CLI/UI builds, inventory/line-count/gitleaks.
C uses fresh independent reader/fixture/caller scrutiny, source mutations and exact
head Node22/24 CI. Manual HTTP covers completed-video failures/no persistence using
only tiny fixture bodies; visual regression uses the maintained isolated E2E suite.
No billed provider, aggregate-memory, MP4 decode or universal egress-safety claim.
