# WP06m P — current contracts and executable verifier ownership

Baseline9c87c943 after WP06 D; this companion amends065 before A. One WP/PR remains
bounded Grok video response-body consumption. No video URL/DNS/redirect migration,
aggregate RSS claim or provider/billing change. Main owns FSM/goal/stack/CI.
Existing repo/GitHub/local tools and owned temporary fixtures only; zero paid calls,
no live server3333, no user auth/config/media. Local tiny focused checks and
type/builds; full suites only exact-head CI. Reassess4hours/WP,72hours/goal; no
numeric token budget. Useful workers/reviewers explicitly Astra/high.

## Current evidence and accepted P findings

Main baseline-video.mjs used only16bytes and strict pre-import isolation:
actual downloadVideo invoked the prohibited arrayBuffer1time, performed0 stream
pulls and0 production cancellation on the resulting error. Separate held body
ignored the fetch signal: after an observed pull barrier and caller abort, the
operation remained pending; releasing16valid bytes produced success despite abort.
Fixture cleanup passed, no real network. This proves the old mechanisms and a
direct downloader failure, not cancellation-after-persistence at a caller.

Two P reviewers independently source-verified the following adjustments:

- Preserve HTTP status → declared length → MIME ordering. A combined oversized
  length/text-html case asserts the exact size message, not merely shared502/code.
- Caller-aborted499 and combined-aborted504 intentionally precede other failures.
  For unobserved signals, legacy AbortError wins before truthy code/status; preserve
  structured objects/functions by identity, not only instanceofError. An unstructured
  TimeoutError becomes504 explicitly. mapVideoDownloadError returns unknown because
  its result is thrown and preserving an object is not an Error-return guarantee.
- Unstructured primitive/null failures use the existing request-failed prefix and
  a generic detail; do not newly stringify arbitrary URL/body-containing values.
- Use one timeout started at entry, not reset across retries or chunks. This is not
  a strict elapsed-clock deadline when the event loop cannot schedule callbacks.
- Current image-body helpers are private grokImageDownload owners with private
  ImageBodyFailure;050 is byte-identical to its verified WP05 document and its
  current helper section was re-read. Independent Web-stream video design stands.
- Retry has nested reset/transient budgets, not a universal maximum3GETs. HTTP504
  responses are retryable; thrown AbortError/TimeoutError are not. Body failures
  never re-enter GET retry or billed generation. Preserve existing400 model fallback.

## Exact production refinements

Production body-policy edits stay in lib/grokVideoDownload.ts. The narrow
whole-last-frame-operation extraction in065_2 is the only extra production change;
its body/order/route behavior remain unchanged. Keep cap100*1024*1024 and
three-argument public downloadVideo. Add private assertDeclaredVideoLength(res,cap)
used by header preflight (default cap) and reader (trusted internal cap). Header
preflight preserves status/length/MIME precedence. No input/config can supply the
reader cap at public callsites. Helpers and new functions remain<50lines each.

Mandatory cap proof: internal15/16/17bytes; public declared104857600 plus tiny valid
body succeeds,104857601 refuses without pulling. Exact default constant and omitted
public seam argument are inspected. No100MiB allocation is required or permitted
locally. A rejected chunk is never passed to Buffer.from; accepted subarray bytes
are copied, demonstrated by mutating their backing store after a read barrier.
Empty chunks do not enter concat inputs. Invalid/empty/error/abort never concat;
valid complete input concats once and releases the reader lock.

Separate late-abort windows: abort before EOF is returned by reader → no concat;
abort after reader completion but before public wrapper resumes → reject499 even
though concat may already have occurred. Do not give the second test an impossible
zero-concat requirement. Cancel rejection/pending promises cannot replace the
primary502/499 or hold it beyond the bounded test watchdog. Read and cancel losing
promises have rejection observers; no listener/lock leaks.

## Expanded exclusive manifest

In addition to065 source/docs owners:

| Action | File | Purpose |
| --- | --- | --- |
| NEW | tests/_videoStreamFixture.ts | shared tiny real ReadableStream, pull/cancel/read/copy/arrayBuffer observations |
| NEW | tests/_videoExecutionFixture.ts | pre-import env/config/DB isolation, exact owned app/proxy bridge, persistent violations and drain |
| NEW | tests/_videoFfmpegFixture.ts | narrow test-only FFmpeg capability, real trusted tiny codec cases and child cleanup |
| NEW | tests/execution-process-isolation.test.ts | harmless async-customizer sentinels and descriptor restoration |
| MODIFY | tests/_executionRouteIsolation.ts | fresh deny replacements so promisify cannot retain an original custom executor |
| MODIFY | tests/provider-execution-harness.test.ts | retarget setup-failure injection, retain restoration checks |
| NEW | lib/videoExtendI2vOperation.ts | mechanically extracted detached operation returning its full Promise |
| MODIFY | routes/videoExtended.ts | invoke operation with original captures; retain void/background semantics |
| MODIFY | scripts/paired-generated-paths.txt | register new required operation JS twin |
| MODIFY | tests/videoRoute.test.ts | artifact reader spy, generate failures/no persistence, safe fixture and explicit FFmpeg skip |
| MODIFY | tests/videoExtendI2v.test.ts | real default generator/downloader failure path, parent preserved, safe fixture |
| MODIFY | tests/agent-mode-runtime-contract.test.ts | artifact spies and actual Agent video failure/no handle or success-turn persistence |
| MODIFY | tests/error-envelope-contract.test.ts | pre-import isolation, owned caller and no native fallback |

065 already owns grokVideoDownload.test, grokVideoAdapter.test,
videoExtendedRoute.test and SoT. Existing fixed /tmp/ima2-outside-secret.mp4 fixture
must become an owned root file outside only its generated subdirectory. Do not
overwrite a shared fixed temp path. Frame endpoint response.arrayBuffer is a
consumer assertion, not a downloader stub: keep it. Only artifact Responses get
the no-arrayBuffer spy.

## Process mocking prerequisite — proved without a process

Main ran a plain-object Node mock/promisify probe (no child_process call): a method
with util.promisify.custom kept its custom function through mock.method even when
the replacement would throw. Observed custom1,denied0. Current shared isolation
uses mock.method for exec/execFile; those native APIs have custom async wrappers.
The new video fixture must not assume that replacing their apply behavior also
replaces the custom async entry point.

Change shared process denial to fresh ordinary function values installed with
saved own descriptors, and syncBuiltinESMExports. Fresh deny functions expose no
native promisify.custom; generic promisify therefore calls the deny and records
its violation. Restore exact descriptors/functions/symbols without mutating the
original function object. Add harmless preinstalled callback/custom sentinels for
exec/execFile: both direct and promisified calls must fail before reaching either
sentinel, fail close even if caught, and restore original descriptors. No real
process is used by these negative tests. Re-run every affected shared fixture.

## Video fixture interfaces and network boundary

`openVideoFixture()` installs executionChildEnv/isolateExecution before config/SUT
imports. It validates owned config/DB/generated paths, resets only owned state and
exposes config/root, `fetchApp(server,input,init)`, controlled responder/proxy bridge,
tracked work/stream/writes and close. Source/emitted native smoke use separate
children, not mixed module graphs. No buildApp or real credential loaders.

Application callers use actual owned HTTP Server capabilities. DUT upstream calls
use a controlled fetch wrapper: constructor/body/URL/method/header assertions are
inside a persistent violation catch. Explicit expected synthetic transport errors
are registered by identity (or exact aborted signal reason), never all exceptions.
Do not normalize an AssertionError into a passing network-failure scenario.

For existing real proxy servers, validate exact origin and supported video paths,
method, request body shape and headers BEFORE forwarding with fetchOwned(proxy,
...). POST/poll expect Bearer dummy in the proxy lane; direct fixture keys remain
synthetic and exact; artifact GET has no body/Authorization/Cookie. Allowed paths
are the known /v1/responses, /v1/chat/completions, /v1/videos generation/edit/extension
POSTs, a bounded single-id poll path, and the fixture's literal artifact path.
No substring matching, arbitrary loopback origin or real public-provider fallback.
Stream the original artifact Response unchanged, adding only an instance spy that
records and rejects arrayBuffer. Never prebuffer and reconstruct the Response.

Shared raw-deny guards remain intact. A validated bridge's explicit owned-proxy
capability is distinct from leaking the application caller's capability into its
handler. Unexpected attempts remain in the ledger even when production catches
their errors. close waits handlers, streams, detached writes and authorized native
children, then closes servers/DB, restores guards and removes only owned roots.

## FFmpeg boundary and honest evidence

Local preflight found /opt/homebrew/bin/ffmpeg. Previous9c87 hosted logs show real
last-frame/frame/analyze tests skipped for missing ffmpeg; continueFromVideo silently
returned and appeared passed. Replace that return with explicit test.skip. Skips
never establish real codec coverage.

Preserve existing real-FFmpeg cases rather than replacing generator/persistence
with fabricated results. `_videoFfmpegFixture` captures the native execFile value
before isolation, resolves one installed executable from the original trusted PATH
using filesystem checks, and installs its guarded fresh function BEFORE importing
videoFrameExtract/videoThumb (they capture promisify(execFile) at import).
The custom promisify wrapper, if provided for native return-shape compatibility,
must call the guarded function—not the original native custom executor.

Only literal ffmpeg and exact approved argv families may reach the pinned native
executable: version; fixed lavfi color 64x64 one-second test clip; current frame
extraction forms; current one-frame thumbnail form. Input paths must be real regular
files under the owned fixture root, outputs have owned canonical parents and fixed
media extensions; no URL/protocol input, shell, user path or arbitrary options.
Preserve/validate current timeout<=30000ms, bounded maxBuffer and signal; add owned
child environment (home/temp/path/platform only, no credentials). Record attempts,
actual PIDs, argv, close, cancel and output cleanup. Unmatched calls throw AND enter
the persistent violation ledger. Shared spawn/other command denial is not relaxed.

If ffmpeg is absent, use a guaranteed absent owned executable for the approved
attempt so native ENOENT behavior is preserved without PATH fallback; positive
codec tests explicitly skip. Background thumbnail failures for intentionally tiny
non-decodable MP4 fixture bodies are expected optional behavior, not guard violations.
All created native children are retained, bounded, killed by handle on failure and
awaited through close before restoring any process guard or deleting their files.

At C, require the small real-codec cases to run unskipped locally at the exact head
with the discovered tool; no full suite or large media. Hosted Node22/24 must run
all mandatory reader/generator/persistence cases; report any optional codec skips
separately. Do not call a synthetic stream or optional-codec skip real FFmpeg proof.
No real provider calls or image/video generation charges are involved.

## Required caller/ablation closure

- Generator plannedPrompt + base model + first done poll: invalid/read-reset body
  means start1,poll1,artifact1. Reset/503 before headers may repeat only GET; no
  automatic billed generation retry. Independent existing400 fallback remains.
- Edit/native extension invalid MP4 and oversized header: exact JSON502/code,
  start1/download1, no new MP4/sidecar. Native-extension positive persists tiny bytes.
- Generate emits SSE error(status502), no done/no artifact; default last-frame
  extension emits202 then terminal error, preserving parent. Actual Agent promise
  rejects with no new video handle/sidecar/success tool or assistant turn.
- Public facade identity, source and plain emitted smoke; cap/header precedence,
  arbitrary caller reasons, structured AbortError/non-Error objects and unstructured
  TimeoutError. Repeat/bounded clocks prove one non-resetting timer through retry.
- Real mutations: old whole-body API forbidden; remove pre-copy cap guard; remove
  pending-read abort protection/final wrapper barrier as separate observable cases.
  A later guard must not mask the selected mutation; synthesize any failing oracle.

Disjoint lanes and exact interfaces are in065_2. Last-frame also owns the approved
operation extraction; main owns shared process-denial/setup-failure tests and
docs/inventory/pairing. Agent retains its existing pinned-image fixture rather
than opening a second isolation.

## Separate auxiliary probe limitation

An additional066 artifact-content/provenance candidate was queued from source
observations. Its delegated probe was stopped by a tool safety restriction. A probe
file exists but no execution/result evidence was recorded; it is not to be retried
through another channel or called reproduced. This does not alter c-16 or authorize
066 implementation here. Preserve the limitation and source-only candidate for
honest consideration of the existing separately gated artifact design.
