# WP06m — Bounded Grok video body consumption

Status: final docs-only P design; no further scope refinement needed. Ready for
independent parent A; not implemented or independently A-approved.
Source baseline: ecde2bc79cddc50ff0da38091c1ce0590383090c.
Execution order: WP06 → **WP06m** → WP07, after all family source changes.
One meaningful WP/PR: codex/prod-wp06m-video-bounds, based on verified WP06.
Parent owns orchestration, goalplan, c-16, stack, independent audit and release.
This delegated delivery writes ONLY this file; every source/test/doc edit below
is a future implementation manifest, not present authorization to execute it.

## Loop specification and prerequisites

- Class: docs-only with C4 care for an upstream-input availability boundary.
- Archetype: bounded spec satisfaction; no candidate race or universal downloader.
- Trigger: `lib/grokVideoDownload.ts:45` allocates the entire `arrayBuffer()` before
  the actual-size check at :48. Missing/false Content-Length bypasses the precheck.
- Goal: a finished video is accepted only after bounded streaming and MP4 checks;
  rejected/aborted bodies stop consumption and never reach caller persistence.
- Non-goals: generation retries, provider selection/auth changes, URL-policy
  migration, DNS/redirect pinning, disk spooling, aggregate job memory admission,
  MP4 decoding, UI redesign, MCP/Comfy download changes or paid provider probes.
- Verifier: synthetic Web ReadableStreams, exact byte/cancel/read/concat counts,
  public-facade and caller tests, then source and emitted-runtime checks.
- Stop: every V06m case below has fresh evidence and SoT is synchronized; no
  "secure downloader" claim. Terminal outcomes: verified scoped fix or BLOCKED.
- Memory artifact: this unit plus parent-owned C receipt and c-16 evidence.
- Escalation: incompatible post-WP06 helpers/callers or a needed write outside the
  manifest returns to parent P. Leaves do not dispatch; parent reclaims failed
  packets and decides any downward re-delegation before implementation.

Re-read 000/050/006 and current sources at implementation P. WP05 must retain the
`grokError` compatibility export used by video; no image internals are moved here.
WP06 completion is an integration prerequisite, not a dependency on Google code.
WP07 lifecycle edits must not race this patch. Parent must enforce c-16 before
WP13 release despite append-order registration; this doc cannot set gate state.

## Source-grounded scope and caller inventory

Direct search: `rg -n 'downloadVideo|grokVideoDownload|isMp4Container' lib routes
tests bin structure scripts` plus `rg -n 'grokVideoAdapter|generateVideoViaGrok'
lib routes tests`. Read `.ts` as authoritative; `.js` twins are generated.

| Owner / current anchor | Contract to preserve |
| --- | --- |
| lib/grokVideoDownload.ts:5,19,23 | 100*1024*1024 bytes (100 MiB, existing message says 100MB); isMp4Container export; three-argument downloadVideo returns `{buffer,contentType}` |
| lib/grokVideoAdapter.ts:7,28,476 | Internal import and public named re-export; generateVideoViaGrok downloads after poll/moderation and returns videoBuffer plus unchanged metadata |
| routes/videoExtended.ts:130,136,224,406 | saveVideoResult downloads before mkdir/persist; edit and native extension both use it |
| routes/video.ts:530 | generate/continue flow calls generateVideoViaGrok with cancellation and optional direct key |
| routes/videoExtended.ts:199,350 | Last-frame I2V extension defaults to generateVideoViaGrok; injected generator tests alone do not exercise downloader |
| lib/agentImageVideoGen.ts:352 | Agent video uses same generator, then persistAgentVideo; no direct key passed here |
| lib/grokVideoShared.ts:137 | videoEndpoint selects direct/proxy for upstream generation/poll, not artifact download |
| lib/grokVideoAdapter.ts:390,455 | Generation start POST is not wrapped in retry; existing explicit 400 model fallback remains unchanged |
| lib/grokUpstreamRetry.ts:137 | GET helper retries reset failures and transient gateway HTTP statuses; body-read failures occur outside it |

No new public field, enum, HTTP envelope, persisted metadata or options object.
Creation→serialization→deserialization for new public values: N/A. The internal
reader's optional cap is trusted module/test input only; neither route request,
config, environment, GrokVideoOptions nor public facade can set it.

### Reuse search and WP05 agreement — explicit bounded choice

Searched `getReader|maxBytes|readBoundedImageBody|openPinnedImageGet|
resolveImageDownloadTarget|readVideoDownloadBody|makeVideoStreamFixture`.

- Existing grokImageCore.ts:146 reader has a fixed 50 MiB image limit and returns
  buffer/base64/MIME; it is not a parameterized video reader. Its awaited cancel
  and image error mapping are not copied blindly.
- lib/minimaxImageAdapter.ts:130 has another fixed 50 MiB image reader with image
  validation/errors. lib/comfyImageAdapter.ts:315 still uses arrayBuffer and
  returns base64/MIME. Neither fits this contract.
- lib/mcp/downloadMediaResult.ts:65 returns a temp-path/cleanup record, defaults
  video to 800 MiB, lacks the caller signal argument, changes DNS process order
  and has different retry/per-hop policy. Not a drop-in replacement.
- Final 050 exports its image policy `resolveImageDownloadTarget(url:URL,policy:
  GrokImageDownloadPolicy,signal:AbortSignal):Promise<PinnedImageTarget>`; its transport helper
  `openPinnedImageGet(target:PinnedImageTarget,signal:AbortSignal):
  Promise<PinnedImageResponse>` is now **private**, with status, headers.get,
  `body:AsyncIterable<Uint8Array>|null`, and `cancel(reason?:Error):void`.
- Final 050's **private** `readBoundedImageBody(response:PinnedImageResponse,
  options:{maxBytes:number;signal:AbortSignal}):Promise<Buffer>` with
  GROK_MEDIA_TOO_LARGE / GROK_MEDIA_EMPTY / GENERATION_CANCELED discriminants.
  Its limit is suitable, but fetch Response.body is a Web ReadableStream, not
  that response contract. Reuse would require an iterator/cancel/lock adapter
  and error translation. The video-specific reader below directly owns those
  operations and pre-concat MP4 validation. Do not export image internals or add
  an adapter just for video reuse.

Decision: reuse grokFetchWithRetry and grokError; retain the existing named cap,
URL guard and isMp4Container; add only video-local stream lifecycle helpers.
Do nothing/delete/configure cannot fix post-allocation enforcement. No dependency,
new configuration knob, generic downloader, or changes to WP05 helpers are needed.

**Ownership alignment resolved:** parent amended 050's “Image-internal helper
contract and WP06m boundary” before A: image transport/body helpers remain private;
WP06m uses an independent bounded Web-stream reader and retains video URL policy.
The amendment was re-read in this lane. No cross-document reuse blocker remains,
no caller-policy refinement is requested, and this leaf made no write to 050.

### URL/per-hop boundary, deliberately unchanged

downloadVideo receives `(ctx,url,signal)`; it does NOT receive the selected lane
or directApiKey. Merely finding ctx.xaiApiKey does not prove that a proxy request
was direct. saveVideoResult is proxy-backed; generateVideoViaGrok serves both
lanes; the Agent path is another consumer. No complete trusted-policy propagation
is proposed. A future per-hop migration must enumerate all of those callers.

Keep current initial URL parsing: HTTPS accepted; HTTP accepted only for the
existing literal hostname list localhost/127.0.0.1/::1. Preserve the code verbatim,
including the existing bracketed IPv6 hostname limitation; do not silently fix or
advertise IPv6 support here. fetch default redirects remain. There is no DNS
private-address check, per-hop revalidation, destination pinning, or new redirect
hop policy in this WP. No Authorization/Cookie headers are added to artifact GET.
The streamed cap applies to the final response exposed by fetch, not a claim to
bound every hidden redirect response. HTTPS alone is not SSRF protection.

Threat: an upstream/CDN can return absent/lying length, too many bytes, invalid
media, or a stalled stream. Asset: local process availability and completed-video
integrity. Control: stop retaining/reading after the cap; abort promptly and reject
before persistence. Residuals: fetch/transport buffering, one already-delivered
oversized chunk, concurrent downloads, chunk metadata overhead and downstream
copies. Retained accepted bytes ≤100 MiB; concat adds at most another 100 MiB.
This is NOT a 100 MiB RSS ceiling, an aggregate memory guarantee, or MP4 decode
validation. Skip empty chunks so they cannot grow the retained chunk list.

## Exact future change manifest

| Action | Path | Delta |
| --- | --- | --- |
| MODIFY | lib/grokVideoDownload.ts | Incremental reader, deterministic abort/error mapping and finally cleanup; existing exports preserved |
| NEW | tests/grokVideoDownload.test.ts | Synthetic stream boundary, cleanup, validation and public-wrapper mapping tests |
| MODIFY | tests/grokVideoAdapter.test.ts | Replace arrayBuffer-only fixtures with real Response streams; strengthen public re-export/retry/caller negatives |
| MODIFY | tests/videoExtendedRoute.test.ts | Download-invalid/oversized-header negatives for edit and native extension; prove no artifact persisted |
| MODIFY | docs/migration/runtime-test-inventory.md | Register new runtime-importing test using existing generator after source work |
| MODIFY | docs/API.md | Download limit, byte/MIME check, timeout/cancel taxonomy and unchanged URL-policy caveat |
| MODIFY | structure/03-server-api.md | Video Runtime adds bounded download and ownership statement |
| MODIFY | structure/01-file-function-map.md | Correct downloader description (not persistence), new reader/helper counts |
| MODIFY | structure/07-devlog-map.md | Link this outcome/evidence and next WP07 |
| MODIFY | this document | Record current anchors, actual red/green/C proof and remaining residuals |

Generated: lib/grokVideoDownload.js via existing build:server only; already paired
in scripts/paired-generated-paths.txt:11, so no pairing-manifest edit. No new
production module, no deletes. Tests/docs widen the one-file fix only to prove
its direct consumers; they remain one cohesive WP/PR. Parent owns 000/050/006 and
goal/release-gate alignment; do not edit them opportunistically in implementation.

## Diff-level production design

Before, the core body is:

```ts
const contentLength = Number(res.headers.get("content-length") || "0");
if (contentLength > MAX_VIDEO_DOWNLOAD_BYTES) throw /* existing 502 */;
const contentType = res.headers.get("content-type") || "video/mp4";
// existing MIME guard
const buffer = Buffer.from(await res.arrayBuffer());
clearTimeout(timer);
if (buffer.length === 0) throw /* existing empty error */;
if (buffer.length > MAX_VIDEO_DOWNLOAD_BYTES) throw /* existing size error */;
if (!isMp4Container(buffer)) throw /* existing invalid-container error */;
return { buffer, contentType };
```

After: replace downloadVideo's body with this complete control flow. Existing
downloadTimeoutMs and withTimeoutSignal stay local and unchanged. The default
300_000 fallback is not substituted for config's actual configured value.

```ts
export async function downloadVideo(ctx: RouteRuntimeContext, url: string,
  signal?: AbortSignal): Promise<{ buffer: Buffer; contentType: string }> {
  const { combinedSignal, timer } = withTimeoutSignal(signal, downloadTimeoutMs(ctx));
  let response: Response | undefined;
  let readerOwnsBody = false;
  try {
    combinedSignal.throwIfAborted();
    assertVideoDownloadUrl(url);
    response = await grokFetchWithRetry(
      () => fetch(url, { signal: combinedSignal }),
      { signal: combinedSignal, label: "video-download" },
    );
    combinedSignal.throwIfAborted();
    const contentType = videoDownloadContentType(response);
    readerOwnsBody = true;
    const buffer = await readVideoDownloadBody(response, combinedSignal);
    combinedSignal.throwIfAborted();
    return { buffer, contentType };
  } catch (error: unknown) {
    throw mapVideoDownloadError(error, signal, combinedSignal);
  } finally {
    clearTimeout(timer);
    if (!readerOwnsBody) cancelVideoBodyBestEffort(response?.body);
  }
}
```

Exact new helpers, all in lib/grokVideoDownload.ts, each <50 lines:

1. `assertVideoDownloadUrl(url:string):void`: move existing new URL/hostname/
   protocol guard verbatim. Do not interpret userinfo, DNS or redirect policy anew.
2. `videoDownloadContentType(res:Response):string`: existing !res.ok error and
   Content-Type fallback/regex guard verbatim, returning header value unchanged
   (including parameters). Move Content-Length into reader below.
3. `videoDownloadFailure(message:string)`: return
   `grokError(message,502,"GROK_VIDEO_DOWNLOAD_FAILED")`; shared local constructor
   for the reader's current messages, not a new error taxonomy.
4. `cancelVideoBodyBestEffort(target?:{cancel(reason?:unknown):Promise<void>}|null):
   void`: try `target?.cancel("video download rejected")`, attach `.catch(()=>{})`
   immediately; swallow only cleanup errors. Never await a hostile cancel promise.
   Same best-effort principle as grokUpstreamRetry.ts:91, whose helper is private.
5. `readVideoChunk(reader:ReadableStreamDefaultReader<Uint8Array>,signal:
   AbortSignal):Promise<ReadableStreamReadResult<Uint8Array>>`: below. Use explicit
   node:stream/web type-only imports if required by root tsconfig's ES2022 lib.
6. `readVideoDownloadBody(res:Response,signal:AbortSignal,maxBytes =
   MAX_VIDEO_DOWNLOAD_BYTES):Promise<Buffer>`: exported **internal test seam**,
   not re-exported by grokVideoAdapter and not configurable at public boundaries.
7. `mapVideoDownloadError(error:unknown,caller:AbortSignal|undefined,combined:
   AbortSignal):Error`: precise priority table after the reader. Use a narrow
   code/status/name inspection; no new broad any escape or provider error wrapper.

Read operation must settle on abort even when a synthetic or broken body ignores
fetch's signal. Promise.race attaches rejection handlers to the losing read;
remove the one temporary listener in finally on success, error and abort.

```ts
async function readVideoChunk(reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal): Promise<ReadableStreamReadResult<Uint8Array>> {
  signal.throwIfAborted();
  let onAbort = () => {};
  try {
    const aborted = new Promise<never>((_resolve, reject) => {
      onAbort = () => reject(signal.reason);
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) onAbort();
    });
    return await Promise.race([reader.read(), aborted]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

export async function readVideoDownloadBody(res: Response, signal: AbortSignal,
  maxBytes = MAX_VIDEO_DOWNLOAD_BYTES): Promise<Buffer> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const chunks: Buffer[] = [];
  const prefix = Buffer.alloc(12);
  let total = 0;
  let complete = false;
  try {
    signal.throwIfAborted();
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_VIDEO_DOWNLOAD_BYTES)
      throw new RangeError("Invalid internal video byte limit");
    const declared = Number(res.headers.get("content-length") || "0");
    if (declared > maxBytes)
      throw videoDownloadFailure("Grok video download exceeds the 100MB limit");
    if (!res.body) throw videoDownloadFailure("Grok video download was empty");
    reader = res.body.getReader();
    while (true) {
      const { done, value } = await readVideoChunk(reader, signal);
      signal.throwIfAborted();
      if (done) break;
      if (value.byteLength > maxBytes - total)
        throw videoDownloadFailure("Grok video download exceeds the 100MB limit");
      if (value.byteLength === 0) continue;
      const chunk = Buffer.from(value);
      if (total < 12) chunk.copy(prefix, total, 0, Math.min(chunk.length, 12 - total));
      total += chunk.byteLength;
      chunks.push(chunk);
    }
    if (total === 0) throw videoDownloadFailure("Grok video download was empty");
    if (!isMp4Container(prefix.subarray(0, Math.min(total, 12))))
      throw videoDownloadFailure("Grok video download returned an invalid MP4 container");
    signal.throwIfAborted();
    const buffer = Buffer.concat(chunks, total);
    complete = true;
    return buffer;
  } finally {
    chunks.length = 0;
    if (!complete) cancelVideoBodyBestEffort(reader ?? res.body);
    try { reader?.releaseLock(); } catch { /* cleanup must not replace original error */ }
  }
}
```

The size guard runs BEFORE copying/retaining each chunk; Buffer.from(value) copies
accepted bytes rather than retaining a possibly oversized backing ArrayBuffer.
The first 12 bytes reproduce isMp4Container exactly across arbitrary chunk splits;
empty/invalid/overflow/read-error/aborted streams do not reach Buffer.concat.
Completed valid bodies concat exactly once. No fallback to arrayBuffer/text/blob.
Null body maps to the existing empty/download error, not TypeError or success.
Header parsing stays compatible: absent/zero/malformed/negative length cannot
disable the actual byte counter; strict HTTP header grammar is not added here.

Error mapping priority (checked at catch time, including non-Error abort reasons):

| Trigger | Public result |
| --- | --- |
| caller signal aborted, regardless of reason/name; both signals aborted | 499 / GENERATION_CANCELED / Generation canceled |
| combined signal aborted with caller not aborted | 504 / GROK_VIDEO_TIMEOUT / Grok video download timed out |
| Existing structured Error carrying truthy code/status | Preserve exact Error (especially 502 validation failures) |
| AbortError without observable caller abort (legacy behavior) or TimeoutError | 504 / GROK_VIDEO_TIMEOUT |
| Other fetch/read/parse failure | 502 / GROK_VIDEO_DOWNLOAD_FAILED, existing request-failed prefix; no new raw URL/body logging |

Do NOT abort the timeout controller to implement overflow cleanup: that would
mislabel the intended 502 as 504. Reader.cancel is the body termination mechanism.
An upstream route's own deadline passed as the caller signal still maps to 499,
as the existing contract does; this WP distinguishes the downloader's own timer.
Finally clears the timer on every exit, including malformed URL and early headers.
Pre-reader failure cancels Response.body; reader-owned failure cancels reader and
releases lock. EOF success releases without cancel. Already-errored streams may
not invoke the underlying source cancel callback; assert reader.cancel invocation
and released lock, not an impossible source callback in that scenario.

Retry stays around GET-to-headers only: existing reset/transient-status budgets,
delays and discarded-response cleanup unchanged. Overflow, bad MIME/MP4, body
reset, cancellation and timeout do not restart body download or generation.
The existing 400 model fallback remains a separate existing rule, not a new
transport retry. Never wrap generateVideoViaGrok/startVideoRequest/saveVideoResult.

## Exact fixture and test design

NEW tests/grokVideoDownload.test.ts imports the internal reader directly and the
public downloadVideo via grokVideoAdapter, plus node:test/mock and strict assert.
Use type-only imports where appropriate. No real fetch, server, credentials or
large allocations. Stub all fetch targets; unexpected targets throw immediately.

Local test helper `makeVideoStreamFixture(chunks:Uint8Array[],options?:{
  headers?:Record<string,string>;status?:number;holdOpen?:boolean;
  failAfterChunks?:Error;cancelBehavior?:"resolve"|"reject"|"pending"
})` returns `{response,body,stats,waiting,close,error}`. It constructs a real
`ReadableStream<Uint8Array>` with highWaterMark:0 and pull-driven one-chunk enqueue;
stats record pulls, bytesEnqueued, cancelCalls and cancelReason. `waiting` resolves
when the first post-chunk pull is held. cancel rejects/pends only when requested;
capture its invocation before returning the promise. close/error release held
fixtures in teardown. Return real Response(body,{headers,status}); stub that
instance's arrayBuffer with a throwing mock and assert its call count is zero.
Use the existing 16-byte fakeMp4Bytes literal, split as [5,2,1,8] across ftyp;
new helper stays local, no fixture package or production dependency injection.

For internal threshold tests use maxBytes=16 and bytes of 15/16/17 total (all
valid 12-byte prefix where intended), not a fake byteLength or 100 MiB allocation.
Public tests use default cap and assert a `104857601` declared length is refused
before any pull. Together assert public call omits the seam argument and the
production named constant remains exactly `100 * 1024 * 1024`; a runtime config
value cannot lower/raise it. No test-only environment security limit.

`mock.method(Buffer,"concat",...)` counts assembly only during the internal reader
call; construct fixtures before installing it and restore in finally. Run tests
serially so this process-global mock never contaminates unrelated cases. For
read cancellation/lock release wrap the fixture reader methods with test mocks,
delegating to the actual reader; also assert body.locked=false after settlement.
Do not use RSS snapshots or GC timing as the oracle for released local references.

| ID / named test case | Activation and observable proof |
| --- | --- |
| V06m-01 accepts below and exactly internal cap across split MP4 header | 15/16 bytes, exact Buffer content, concat once, arrayBuffer zero, unlocked, no cancel |
| V06m-02 rejects missing-length and lying-length overflow before copying | 16+1 bytes, no header / length=1 variants; 502, cancel once, no next pull, concat zero; rejected chunk not retained |
| V06m-03 rejects oversized declared length before reading | Public default header=104857601 with held stream; 502, pulls zero, cancel once, arrayBuffer/concat zero |
| V06m-04 rejects empty/null and invalid MP4 | Empty closed body, Response(null), <12 bytes, wrong ftyp with video/mp4; 502 and no concat; already-closed body need not call underlying cancel |
| V06m-05 preserves accepted MIME and rejects other types | video/mp4 with parameters, octet-stream and absent header succeed; text/html held body fails/cancels before read |
| V06m-06 cancels after headers and during a pending read | Fetch stub aborts before return; separately await waiting then caller.abort(new Error("custom")); 499, no bytes returned, no concat, unlocked, no listener leak |
| V06m-07 times out before headers and after headers | Existing fetch-abort fixture; separately held body ignoring fetch signal, existing videoDownloadTimeoutMs set to 10ms; 504, one GET, cancel/unlock, no concat |
| V06m-08 cleanup rejection or never-settling cancel cannot hide failure | Overflow and abort with cancelBehavior reject/pending; original 502/499 settles under a 1s test watchdog, no unhandled rejection, no stuck lock |
| V06m-09 stream error is not download retry | Actual controller.error(reset error) after valid prefix; 502, one GET, reader cancellation attempted, no concat |
| V06m-10 keeps one absolute timer and clears resources | Retry then held body uses same deadline; success/HTTP400/header/MIME/read failure remove read listeners and clear timer; observe via narrowly scoped timer/listener mocks, restore every mock |
| V06m-11 no late success or misclassified overflow | Abort on final read completion; 499 and concat zero. Overflow without aborted signal stays 502; abort both signals before catch yields 499 |
| V06m-12 preserves public export and URL behavior | public downloadVideo === direct export; existing HTTPS/HTTP127.0.0.1/localhost tiny fixtures accepted, external HTTP/malformed URL rejected with fetch count zero; fetch init gains no policy/auth headers |
| V06m-13 ignores zero chunks and rejects internal invalid cap | Empty chunk interleaving does not add retained entries; 0/negative/NaN/>default seam cap rejects; public signature unchanged |
| V06m-14 honors safe GET retry but never restarts billed generation | Reset→success and 503→success reach GET twice; transient responses canceled; body-failure via full generator retains start count=1 and poll count=1 |

In tests/grokVideoAdapter.test.ts change `videoBytesRes` from arrayBuffer-only
object to `new Response(fakeMp4Bytes(),{headers:{"content-type":"video/mp4"}})`
with throwing arrayBuffer spy. In “rejects unsafe video download responses”, replace
empty/bad/too-large object mocks with actual stream fixtures, keep each existing
assertion and strengthen status/message branch assertions so null-body failures
cannot accidentally satisfy the wrong test. Keep “maps video download timeout to
GROK_VIDEO_TIMEOUT”. Add V06m-14 to installFetch's routing with counters for
start/poll/artifact requests and tiny invalid/held responses. All happy generator
cases (T2V, settings precedence, I2V, model fallback, 1080p canvas) must still pass.

In tests/videoExtendedRoute.test.ts extend existing makeProxy with test-local
`downloadCase:"ok"|"invalid-mp4"|"declared-too-large"` and start/download counters.
Run edit and native extension for both negative cases with local ports; invalid
bytes are tiny and oversized header uses a zero/held body. Assert status502/code
GROK_VIDEO_DOWNLOAD_FAILED, start=1, artifact GET=1, and generated directory empty.
Add a successful native-extension case (current native cases stop at moderation),
checking real streamed tiny bytes and sidecar. No production dependency seam needed.

### Every affected existing test file / public re-export blast radius

Mandatory stream/caller regression: tests/grokVideoAdapter.test.ts,
tests/videoRoute.test.ts, tests/videoExtendedRoute.test.ts,
tests/videoExtendI2v.test.ts (real last-frame case at :388, not just injected result),
tests/agent-mode-runtime-contract.test.ts (1080p I2V/T2V at :263/:354 use real
Response bodies, so no fixture migration needed), tests/grok-upstream-retry.test.ts,
tests/error-envelope-contract.test.ts, tests/server-code-preservation.test.ts.

Public adapter imports/source-contract matches, unchanged but parent CI coverage:
tests/grokVideoPlannerFallback.test.ts, tests/video-single-reference-mode-contract.test.ts,
tests/capabilities-video-modes-contract.test.ts, tests/video-reference-audio-contract.test.ts,
tests/background-presets.test.ts, tests/model-default-projection-contract.test.ts,
tests/agent-video-reference-contract.test.ts, tests/agent-mode-right-sidebar-contract.test.js.
Route/Agent source/import closure also names tests/backend-hardening-contract.test.js,
tests/video-frame-local-file.test.js, tests/structured-filename-pipelines.test.ts,
tests/comfy-routes-contract.test.ts, tests/nai-options-contract.test.ts,
tests/nai-routing-contract.test.ts, tests/video-request-contract.test.ts and
tests/agent-image-reference-contract.test.ts. These do not establish stream-cap
coverage just by importing a caller; no unneeded edits are proposed for them.
Re-run the symbol searches after WP06 to catch moved/new consumers, not just this list.

## Verification, SoT sync, compatibility and rollback

This docs lane ran read-only source/manifest/symbol checks (exit0); it ran no
tests/build/code, Git mutations, FSM/goal commands, browser or live provider calls.
Future commands below are **not executed/pass evidence**. This is an explicit
docs-only deviation from PLAN-VERIFIER-REAL-01; new test does not exist yet.

Implementation C, under parent's isolated env/config/DB test fixture policy:

```sh
node --import tsx --test --test-concurrency=1 tests/grokVideoDownload.test.ts tests/grokVideoAdapter.test.ts tests/grok-upstream-retry.test.ts
node --import tsx --test --test-concurrency=1 tests/videoRoute.test.ts tests/videoExtendedRoute.test.ts tests/videoExtendI2v.test.ts tests/agent-mode-runtime-contract.test.ts tests/error-envelope-contract.test.ts tests/server-code-preservation.test.ts
npm run typecheck
npm run typecheck:tests
npm run test:inventory
npm run build:server
```

Run existing inventory generator `node scripts/classify-tests.mjs` only after
source changes and with manifest write authority; --check does not update it.
Direct test paths observe this change; tsconfig includes lib/**/*.ts and
tsconfig.tests includes tests/**/*.test.ts; build includes lib/**/*.ts and emits
the paired .js. Scripts exist in package.json. Root typecheck does not test UI
or prove prose. Plain emitted-JS smoke must import grokVideoDownload.js and
grokVideoAdapter.js without tsx, stub fetch with the tiny stream, and prove
successful bytes plus header rejection; parent owns isolated artifact/build output.
Do not run repository-wide npm test/verify:release locally. Full/exact-head and
cross-platform CI belong parent. FFmpeg-dependent skips are not positive evidence.

Red/green: new public no-arrayBuffer assertion must fail against baseline's
arrayBuffer call; new overflow test must drive real reader behavior, not only
match source text. Parent records baseline failure and fixed outcome in isolated
test work without resetting shared work. Record all V06m observations, not just
aggregate pass count. Until implemented, c-16 remains unfulfilled.

SoT C edits are concrete: docs/API.md Video error table adds 502
GROK_VIDEO_DOWNLOAD_FAILED, 504 GROK_VIDEO_TIMEOUT and 499 GENERATION_CANCELED
with download-stage meaning; adjacent prose states 100 MiB inclusive, declared
and actual-stream enforcement, MIME/ftyp checks, unchanged initial URL/default
redirect policy, and no automatic regeneration. structure/03 Video Runtime adds
the same scoped contract; structure/01 replaces “download and persistence helpers”
with “bounded video download, validation and cleanup” and refreshed actual counts.
structure/07 links this WP/C evidence→WP07. Inventory adds exactly the new test
and actual counts from current tree, not baseline totals copied from this plan.

Compatibility: callers still receive in-memory Buffer/contentType; MP4 sniff and
100 MiB ceiling unchanged, now applied before whole-body allocation. No storage
format, config key, public export removal, request option, billing or route change.
Earlier rejection and reliable custom-reason cancellation are intentional fixes.
Null/invalid bodies never reach persistence; cancellation AFTER a completed return
and caller-persistence races remain caller/WP07 ownership, not this reader's claim.

Rollback: parent reverts only this PR's source/tests/docs, rebuilds emitted twin,
revalidates dependent stack and reopens c-16. Do not revert WP05 family code or
delete user media/sidecars. Returning to arrayBuffer restores the vulnerability:
rollback is compatibility recovery, not a passing production-readiness state.

Enforcement/bypass record: E7 focused runtime checks plus parent exact-head CI are
early warnings; executing surfaces=node:test/CI and human c-16 release review;
bypass=skip tests, omit this caller or release stale JS; residual=unverified real
transport/aggregate resources/URL policy; wording downgraded to “bounded Grok
video response-body consumption.” Runtime reader enforces its own byte boundary,
not universal egress security. Final unbypassable repository release layer: none
claimed; parent must enforce the named gate with actual source/artifact evidence.

Handoff: FINAL / ready for independent A; no unresolved scope or ownership blocker
and no implementation claimed. Parent owns audit/roadmap lock, any research-index
sync, WP06m execution after WP06 and before WP07, and c-16 before release. Existing
downloadVideo(ctx,url,signal) arguments remain unchanged; no unused video architecture.
