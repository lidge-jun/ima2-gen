# WP07 A — native browser tracking fixture

Depends on070–074 and existing ui/e2e/fixtures/{appServer,j6Selection}. Replaces
the finite SSE fulfillment described in the initial070/072. Tests are planned,
not executed proof. This is an intentional repository E2E suite, not a new browser
driver. Use existing Playwright/Chromium and strict J6 cleanroom preflight.

## Manifest and ownership

UI presentation worker owns NEW ui/e2e/fixtures/jobTrackingStream.ts and
NEW ui/e2e/fixtures/jobTrackingMedia.ts plus NEW ui/e2e/j7b-tracking-timeout.spec.ts.
No changes to appServer/j6Selection or production test backdoors are required.
Reuse withJ6(...), preflightJ6, requestObject and its persistent denial ledger.
The worker may split the spec into another j7b-*.spec.ts if the500-line ceiling
requires it; record that exact path before writing. No unscoped server/provider I/O.

jobTrackingStream imports node:http/crypto and Playwright types only. Contract:

```ts
export interface TrackingStream {
  connections: Array<{ id: number; closed: boolean; frames: number }>;
  violations: string[];
  routeEvents(route: Route): Promise<void>;
  ready(): Promise<void>;
  emit(event: string, data: Record<string, unknown>, id: number): void;
  close(): Promise<void>;
}
export function startTrackingStream(appOrigin: string): Promise<TrackingStream>;
```

Bind one owned127.0.0.1:0 HTTP server; validate the supplied app origin is the owned
ephemeral J6 origin, never3333. Route only GET on a per-instance unpredictable path;
all other requests become violations and receive404. Accept no caller-supplied
destination URL. routeEvents validates method/original app origin/path=/api/events
before continuing to that one owned stream URL, preserving its cursor query.
No fallback/native fetch from a denied route. If CORS is needed, allow only the
validated original app origin; no credential forwarding/wildcard origin.

The server sends text/event-stream, no-cache and connection headers and calls
flushHeaders immediately, before any generation POST. Keep the response OPEN.
Record ready after headers are flushed; browser OPEN is separately observed via
nativeEventSource events before the real UI action submits. ready waits for a
currently open connection, not a historical closed one. Use a bounded5s deadline
only while waiting; cancel it on readiness/rejection/close. emit serializes the
supplied observed request ID and canonical/flat error data as ordinary SSE frames.
No fake EventSource, copied dispatcher, finite SSE body or sleep-based release.
Tiny bounded frames only; throw on an unexpected blocked write/closed connection,
persist the violation, and fail the fixture rather than claiming delivery.

Install exact context-route overrides AFTER withJ6's base guard and BEFORE app
navigation/action. LIFO overrides handle only GET/events, named POST endpoint(s),
named fixture media GETs, and explicit scoped inflight/history/session GETs. Each
override verifies exact original origin/method and records its calls before work;
all unassigned requests continue to the base denial guard via route.fallback.
Captured actual POSTs append to J6Capture.requests so expectedSubmissions still
enforces the total. No catch may hide an unexpected request from the final ledger.
The real node UI also schedules graph saving: allow only intercepted PUT to the
owned /api/sessions/wp02-session/graph, require nodes/edges arrays, retain actual
path/body in a separate graphSaves ledger, and answer with the fixture graphVersion.
Never forward it or count it as a generation POST. This B-level fixture refinement
preserves actual UI autosave without opening an unlogged mutation bypass.

## Native sequencing and acceptance responses

Before app load, instrumentation may OBSERVE native EventSource instances, open,
error event data/type, and explicit close calls, but must delegate to the original
constructor/methods and preserve Event/MessageEvent dispatch. Do not replace
readyState, synthesize OPEN or intercept product subscribers. Native application
error must settle the actual watcher without calling close from that MessageEvent.
Keep the stream open through the assertion so EOF is not mistaken for app error.

Sequence: native OPEN -> real UI action -> observed exact POST -> complete202 ->
correlated terminal SSE -> actual rendered warning/state. The subscriber is installed
by production code before POST; fixture readiness never waits for that POST.
For /api/generate or /api/video/generate, require nonempty captured requestId and
async:true; respond202 with that same requestId. For /api/video/extend, also require
the submitted sourceVideoId and respond exactly:

```ts
{ requestId: body.requestId, sourceVideoId: body.sourceVideoId,
  workflow: "last-frame-i2v" }
```

This matches ui/src/lib/videoExtendStream.ts:24-26; a requestId-only acceptance is
invalid and must fail the test. Include invalid-response negative coverage in
the existing focused stream contract, not in a supposed successful browser case.
No existing runtime stream suite was found (only a source-shape contract): expose
the existing public postVideoExtendStream export through072's shared test bundle,
and add full202/requestId-only/mismatched-source/workflow cases to the already
owned job-tracking-timeout-ui.test.ts. No production test export or duplicate fixture.
Emit only after the route fulfillment resolves; assertion observes the real
rendered terminal, never treats an accepted response as completion.

Reload scenario seeds locale+aged inflight record ONCE before boot, overriding
the existing context storage state in that first document only. Do not use an
initScript that reseeds every reload. Serve the scoped terminal snapshot; reload
without reseeding and observe warning/removal; second reload has no warning and
no generation POST. SQLite restart durability is separately tested with an actual
owned DB and fresh producer module, not claimed by copied browser snapshot JSON.

## Reachable rendering and media

Use existing controls, history/session responses and saved graph input, not a new
window.store export or test-only component. Cases cover four independent literal
locale warnings live/reload, video-node no-Retry, extension tracking-disabled vs
ordinary Retry after deliberate source change, pending-source switching, AssetGen
inline warning, and animation false on tracking/ordinary/cancel vs true on success.
Sequential same-node errorInfo and save/reload chains also run through the shared
actual-module fixture per074; screenshots do not replace those state assertions.

Media source must be task-owned and playable. Existing local ffmpeg is available
at /opt/homebrew/bin/ffmpeg (presence checked, no install). Generate a single tiny
64x64 silent color clip <=1s as a normal test-artifact generation step in a fresh
owned temp directory, using lavfi color -> libx264/yuv420p with faststart. Validate
exit0 and size <16KiB, then add its base64 bytes with apply_patch to the test-only
jobTrackingMedia.ts, alongside generation command and SHA256. Do not copy user
recording/generated media. CI needs no ffmpeg: it decodes the committed test bytes.
The helper exports the bytes/mime and a synthetic filename for exact GET fixtures.
Actual browser metadata must report finite positive duration and64x64 dimensions;
console/media decode errors fail the case. A known tiny synthetic PNG may be reused
for image anchors. These are fixture assets, not provider results or UI design art.

If existing production navigation cannot reach one claimed surface from its real
serialized input, report the specific boundary to main before adding test hooks or
dropping the row. AssetGen/Sprite share the runtime fixture API from072 and test
their public actions; Sprite reload and nonwatching UI upscale remain explicitly
outside the new persisted-warning claim as074 states.

## Cleanup, evidence and gates

Inside withJ6 callback finally, close every owned context page while route guards
remain active, THEN destroy/close this stream's owned responses/sockets/server.
The outer withJ6 finally disposes base capture, closes context, app child and stub.
Close is idempotent, rejects pending ready waits and clears timers/listeners;
never leave a live page to reconnect after its fixture server has been removed.
No user process/port is touched. Teardown runs even if setup/assertion fails.

Write wp07-*.json with observed OPEN/POST/terminal order, acceptance fields, counts,
stream connections/frames/violations, native error/close attribution, warnings,
source-state transitions and final server/context/process cleanup. Write wp07-*.png
after fonts/render settle; C downloads exact-head artifacts and directly views all
new screenshots. Expect no unexpected requests, no provider-stub calls, no extra
POST on warning/reload/reset, no lingering fixture resources. Keep the J6 evidence
as well; main's072 CI upload includes all wp07 artifacts on success or failure.
For the new long four-locale warning, additionally drive existing WP02_VIEWPORTS
(1440/1024/768/390/320) against the persistent AssetGen inline alert after its live
terminal. Record literal DOM text, alert/page containment metrics and each viewport
PNG. Initial toast assertion remains; do not demand a transient toast survive all
viewport captures or resubmit generation just to keep it visible.

Commands after B: existing UI build and
`npm --prefix ui run test:e2e -- e2e/j7b-tracking-timeout.spec.ts` on the guarded
cleanroom CI runner; no local credentialed-host E2E. Existing full E2E command
discovers all j7b specs. E1 fixture guard has page/SW/route bypass boundaries;
E7 native assertions and E8 retained artifacts are proof layers, not a claim of
network sandboxing. No application behavior is certified by route JSON alone.
