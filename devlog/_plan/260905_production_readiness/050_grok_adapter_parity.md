# WP05 — Grok execution ownership and search-toggle correctness

Status: P / revalidating against verified WP04 tip30dc2cb4331ea02ca33fdd0a3d911374f3e40521. Read051/052 for current threat model, real baseline reproductions and exact fixture/ownership amendments before B.
One PR outcome: grok/grok-api image execution honors search policy, persists sparse outputs exactly once by original callback index and safely retrieves returned artifacts through one actual family owner. Explicit fixes are search-off forwarding, sparse final-sweep identity and bounded per-hop retrieval; image POST/retry policy stays unchanged.
Semantic dependency: WP03 execution contract and fail-closed server admission; WP01 surface metadata. WP02 is UI selection/persistence only.
Stack base: WP04 tip. No semantic dependency on OpenAI internals.
Security integration: returned-image URL policy is specified below from 006 research; WP06m/doc065 owns video bounds. This future plan is not evidence that downloader security is already implemented.

## Loop-spec / scope

Archetype=family extraction plus named option/identity/download corrections. Trigger=duplicated dispatch, dropped search-off flag, sparse callback/compact sweep mismatch and unbounded DNS wait.
Goal=the requested lane and search policy reach planner/image transport, with unchanged result/progress/persistence contracts.
Non-goals=planner prompt redesign, universal provider retry, paid live probes, video generation migration, V1 catalog/auth registration, new stages on SSE.
Verifier=real family executor with synthetic fetch responses, exact request counts/options and sidecars.
Stop=both lanes and all four surfaces pass extraction/toggle/download cases; compatibility facade remains usable; image helper contracts match this plan; WP06m/doc065 owns independent video bounds.
Artifact=this doc + 002 + parent receipt. Outcomes=verified scoped migration / blocked security-policy seam.
Escalation=parent scope/contract decision, or two failed packets; no leaf dispatch/state/git commands.

## Source anchors and explicit behavior delta

- execution/legacyClassic.ts prepares one plan per batch and executes with plannedPrompt/webSearchCalls, forwarding search and background options.
- execution/legacyNode.ts calls generateViaGrok without webSearchEnabled; refs include parent and context-filtered refs.
- execution/legacyMultimode.ts calls generateMultimodeViaGrok without webSearchEnabled.
- grokImageAdapter.ts:293-322 planGrokImage already supports webSearchEnabled=false; :374-425 generateViaGrok options omit it.
- grokMultimodeAdapter.ts:36-80 options and per-item planner forwarding omit it.
- execution/legacyEdit.ts calls editViaGrok with rawPrompt; preserve no planner/search there.
- grokImageCore.ts:202-257 image POST intentionally has no automatic network retry because billing may already have occurred. Search/planner/download retry via grokUpstreamRetry stays distinct.

After: add optional webSearchEnabled to the two generation APIs, carry resolved value from node/multimode execution mapping into every planner call, default omitted=true as before. This does not disable the prompt planner; only the web-search stage is skipped. Planner calls continue using the configured model. Classic still plans once; edit remains direct and search count zero.

## Exact change manifest

| Action | Path | Design |
| --- | --- | --- |
| NEW | lib/providers/adapters/grokExecution.ts | prepareGrokExecution; four-surface mapping and classic shared preparation |
| NEW | lib/providers/adapters/grokOperations.ts | Actual generateViaGrok and editViaGrok bodies from old adapter |
| NEW | lib/providers/adapters/grokMultimodeOperations.ts | Actual ordered multimode body and representativeItemError |
| NEW | lib/grokImagePlanner.ts | Existing planner/search payload builders, parsers and operations moved from grokImageAdapter |
| MODIFY | lib/grokImageAdapter.ts | Compatibility named re-exports of core, planner and operations |
| MODIFY | lib/grokMultimodeAdapter.ts | Compatibility named re-exports of multimode operation/type/representative helper |
| MODIFY | lib/providers/execution/index.ts | grok/grok-api select new family owner |
| MODIFY | lib/providers/execution/legacy.ts | Narrow remaining provider union |
| MODIFY | lib/providers/execution/legacyClassic.ts | DELETE shared Grok plan + generate branch |
| MODIFY | lib/providers/execution/legacyNode.ts | DELETE Grok branch |
| MODIFY | lib/providers/execution/legacyEdit.ts | DELETE Grok edit branch |
| MODIFY | lib/providers/execution/legacyMultimode.ts | DELETE Grok sequence branch |
| MODIFY | lib/multimodePipeline.ts | Consume originalIndexes in final sweep; retain original callback indexes and existing persistence guard |
| MODIFY | tests/provider-execution-routes.test.ts | Sparse/all-failed/same-content distinct-index persistence cases through real multimode route |
| MODIFY | scripts/run-tests.mjs | Canonical child always receives --experimental-test-module-mocks in WP05, not WP12 |
| NEW | tests/test-runner-invocation.test.ts | Run actual canonical runner in scratch discovery root; child executes module mock without inherited flags; nonzero propagation |
| NEW | tests/grok-execution-parity.test.ts | Fixture transports, option propagation/counts and error/progress assertions |
| MODIFY | tests/grok-planner-adapter.test.ts | Add omitted/true/false search option cases through old exported generate/multimode APIs |
| MODIFY | lib/grokUpstreamRetry.ts | R2-B2: structural RetryResponse and generic inferred return only; retry/cancel algorithms unchanged |
| MODIFY | tests/grok-upstream-retry.test.ts | Structural/full-Response inference, 503 cleanup ordering and cancellation promise regressions |
| MODIFY | tests/provider-execution-imports.test.ts | Assert execution imports real operations/core/planner, not compatibility facade |
| MODIFY | docs/migration/runtime-test-inventory.md | Register grok execution, download-policy and runner-invocation tests |
| MODIFY | structure/03-server-api.md | Search toggle semantics and actual family ownership |
| MODIFY | structure/05-node-mode.md | Search-off now honored for Grok node |
| MODIFY | structure/01-file-function-map.md | Actual moved Grok symbols |
| MODIFY | structure/07-devlog-map.md | WP05 evidence and WP06 |

DELETE files: none. Search forwarding uses WP03's existing options.webSearchEnabled. Classic/node/edit callers remain on the integrated seam; multimodePipeline explicitly changes its final sweep in this WP (R1-03), not a hidden extraction exception.
Generated runtime: NEW four matching JS modules, MODIFY JS for two facades/index/five legacy modules AND lib/multimodePipeline.js via build only; do not manually edit/add ignored artifacts.
grokUpstreamRetry.ts receives only R2-B2's type/generalization diff below; video callers are read-only compatibility consumers. The image-download hardening also modifies grokImageCore.ts and the exact named image operation/test/docs paths below. Emit grokUpstreamRetry.js through build:server only; no new runtime policy or image POST retry.

## Full new-module designs

### lib/grokImagePlanner.ts

Move these existing symbols/bodies from grokImageAdapter.ts :42-371:
buildGrokPlannerPayload, buildGrokSearchPayload, searchGrokVisualContext, parseGrokImagePlan, planGrokImage.
Dependencies remain logger, promptSafetyPolicy, runtimeContext, grokSizeMapper, config.DEFAULT_GROK_PLANNER_MODEL, grokImageCore and grokUpstreamRetry.
No import of grokImageAdapter facade or grokOperations. Preserve existing tool choice/schema, fidelity/safety instructions, search count, timeouts and error codes. This separate planner breaks the cycle that would result if moved operations imported a facade that re-exports those operations.

### lib/providers/adapters/grokOperations.ts

Move generateViaGrok :374-425 and editViaGrok :428-447, rebasing imports.
Imports: ../../grokImagePlanner.js for planGrokImage, ../../grokImageCore.js for wire/result types/helpers, ../../logger.js, ../../refs.js, ../../runtimeContext.js, ../../grokSizeMapper.js for mapSizeToGrokImageParams, and ../../grokRuntime.js for server-owned proxy-origin derivation.
Existing result type remains GrokGenerateResult from grokImageCore.

Concrete signature delta:
```diff
 export async function generateViaGrok(
   prompt: string, ctx: RouteRuntimeContext,
   options: {
     model?: string | undefined; size?: string | undefined;
     signal?: AbortSignal | undefined; requestId?: string | undefined;
     plannedPrompt?: string | undefined; webSearchCalls?: number | undefined;
     references?: GrokReferenceImage[] | undefined;
     directApiKey?: string | undefined; plannerModel?: string | undefined;
+    webSearchEnabled?: boolean | undefined;
   } = {}
 ): Promise<GrokGenerateResult>
```
Existing `planGrokImage(prompt, ctx, {...options, referenceCount:references.length, directApiKey:options.directApiKey})` now transports that declared field. Add an explicit assertion for its value; don't assume spread syntax is proof.
When plannedPrompt is supplied, do not perform a new plan/search and preserve supplied webSearchCalls, including numeric zero.
editViaGrok's signature and image operation remain identical except the explicitly mapped trusted-origin download argument: one source image, no planner or added search option.

### lib/providers/adapters/grokMultimodeOperations.ts

Move entire GrokMultimodeResult, representativeItemError and generateMultimodeViaGrok implementation from grokMultimodeAdapter, importing core and planner directly.
Add optional webSearchEnabled:boolean|undefined to options and forward it:
```diff
 const plan = await planGrokImage(indexedPrompt, ctx, {
   model, size: options.size, signal: options.signal,
   requestId: options.requestId, references, directApiKey: options.directApiKey,
+  webSearchEnabled: options.webSearchEnabled,
 });
```
Keep planner outside item catch; keep canceled errors rethrown, last-error selection only for zero returned images, sparse callback index, awaited final callback, count clamping, image URL/download/MIME, usage aggregation and extraIgnored=0. No extra retries or repeated final callbacks.

R1-03 chooses an aligned result array, not per-image metadata or content hashes. Smallest full chain: operation success -> GrokMultimodeResult.originalIndexes -> native result returned unchanged by grokExecution -> canonical SequenceImageExecutionResult.originalIndexes (declared in WP03) -> caller sweep. The field is optional for legacy/dense producers; Grok now always supplies it, including [] on all-failed. Exact additions in grokMultimodeOperations:
```diff
 export interface GrokMultimodeResult {
   images: Array<{ b64: string; revisedPrompt?: string; mime?: string; providerUrl?: string }>;
+  originalIndexes?: number[] | undefined;
@@
   const images: Array<{ b64: string; revisedPrompt?: string; mime?: string; providerUrl?: string }> = [];
+  const originalIndexes: number[] = [];
@@
         images.push(img);
+        originalIndexes.push(i);
@@
-  return { images, usage, webSearchCalls: totalWebSearchCalls, extraIgnored: 0, ...(representative !== undefined ? { error: representative } : {}) };
+  return { images, originalIndexes, usage, webSearchCalls: totalWebSearchCalls, extraIgnored: 0, ...(representative !== undefined ? { error: representative } : {}) };
```
Append index in the same success block before awaited onFinalImage, so even a callback failure retains aligned identity; do not move planner into item catch. For every position, originalIndexes[position] equals the attempted loop index and the callback index; entries are unique/increasing and length equals images.length.

WP05 caller patch against WP03's inferred canonical generated result:
```diff
-      for (const [index, image] of generated.images.entries() as IterableIterator<[number, MultimodeImage]>) {
+      for (const [position, image] of generated.images.entries()) {
+        const index = generated.originalIndexes?.[position] ?? position;
         await persistAndSendImage(
           image,
           index,
           generated.images.length,
           sequenceStatus(generated.images.length, maxImages),
         );
       }
```
persistedIndexes remains index-based. Two identical bytes/prompts/URLs at indices 1 and 2 are two outputs; never hash/dedupe their content. No callback renumbering, no new progress events. Callback-time totalReturned metadata keeps its existing timing semantics; final returned/status use actual persisted image count. Serialization/deserialization of originalIndexes=N/A (in-process only). The facade re-exports the additive result type; agent/direct consumers may ignore it. No request, SSE, history, sidecar, or image metadata field is added. Existing explicit serializers persist only the selected index and existing image fields.

### lib/providers/adapters/grokExecution.ts

```ts
type GrokRequest = ImageExecutionRequest & { provider: "grok" | "grok-api" };
export function prepareGrokExecution<R extends GrokRequest>(
  ctx: RuntimeContext, request: R, progress?: ExecutionProgress
): Promise<PreparedImageExecution<R["surface"]>>;
```

Uses canonical ../execution/types.js, new operations/planner/core, imageModels.resolveGrokQualityModel, nodeHelpers.toGrokReferences. No HTTP Response, SSE emitter or file store imports.

| Surface | Prepare / execute contract |
| --- | --- |
| classic | Resolve quality model; prepend providerUrl ref if present; prepare exactly one plan with webSearchEnabled/backgroundConstraint, then execute uses plannedPrompt and webSearchCalls for each image. |
| node | No provider work in prepare, but capture direct key once there; execute generateViaGrok(request.prompt) with parent+filtered refs, effective model and options.webSearchEnabled. Caller retries retain captured key; this keeps planner-required node edit semantics. |
| edit | No work in prepare; execute editViaGrok(request.rawPrompt,sourceImage), model/size/signal/requestId/direct key captured per execute. No planner; webSearchCalls remains 0. |
| multimode | No work in prepare; execute generateMultimodeViaGrok with maxImages, Grok refs/providerUrl, model/size/signal/requestId, onFinalImage and options.webSearchEnabled. |

directApiKey is supplied only for grok-api, at the same capture point as WP03. Never use `ctx.xaiApiKey` for grok proxy merely because present. Conversely, direct-key absence must be refused by the WP03 admission contract before entry, and the credential-race negative must not silently switch to proxy. See seam agreement below.
Classic captures key before its shared plan and reuses it for the batch; node
captures at prepare and reuses across attempts; edit/multimode capture at each
execute, and multimode retains that value throughout its sequence. Keep current
index presence checks. Legacy excludes oauth/api already; add grok/grok-api to
both its provider Exclude and runtime guard without reintroducing OpenAI.
Return native value unchanged under kind=single/sequence; no invented partial/stage events or error wrapping.

## Before/after routing and facade

Before WP05: execution/index routes Grok to legacy helpers, whose branches call lib/grokImageAdapter.
After: index selects prepareGrokExecution by the two exact provider IDs; remove those branches and narrow legacy provider IDs in the same commit. OpenAI remains selected by WP04 independently.

grokImageAdapter becomes named compatibility exports:
```ts
export {
  grokError, imagePayload, imageEditPayload, postGrokImages, downloadGrokImageUrl,
  type GrokImageResponse, type GrokChatResponse, type GrokImagePlan,
  type GrokGenerateResult, type GrokReferenceImage, type GrokSearchResult,
} from "./grokImageCore.js";
export {
  buildGrokPlannerPayload, buildGrokSearchPayload, searchGrokVisualContext,
  parseGrokImagePlan, planGrokImage,
} from "./grokImagePlanner.js";
export { generateViaGrok, editViaGrok } from "./providers/adapters/grokOperations.js";
```
grokMultimodeAdapter re-exports generateMultimodeViaGrok, representativeItemError and GrokMultimodeResult from the new operation module.
Agent imports keep their signatures; optional new flag defaults preserve old callers.

## Acceptance with independent oracles

| ID | Trigger | Literal observable assertion |
| --- | --- | --- |
| G05-1 | grok proxy vs grok-api direct with distinct fake keys/endpoints, root and edit | Proxy uses its configured URL/dummy header, direct uses api.x.ai + supplied fake key; no wrong-lane request |
| G05-2 | Node grok/grok-api searchMode=off and webSearchEnabled=false; maxImages=2 multimode false | Zero /v1/responses search POSTs, node planner=1/image=1, multimode planner=2/image=2, total webSearchCalls=0 |
| G05-3 | Same fixtures with true and omitted option via compatibility API | Search count=one per plan, not hardcoded zero; distinct prompts verify no accidental plan reuse across multimode items |
| G05-4 | Classic n=3 with search off/on | Search=0/1, planner=1, generation=3; all image payloads use prepared prompt; false preserves backgroundConstraint |
| G05-5 | Node child parent + supplemental refs vs edit route same source | Node hits planner then images/edits; edit route hits only images/edits; source URL/MIME ordering exact; edit search count 0 |
| G05-6 | Classic/multimode providerUrl plus b64 refs | URL ref first, no base64 encoding of URL; edit endpoint selected; result providerUrl and grok_cost_usd_ticks retained |
| G05-7 | Item 0 fails, item 1 succeeds; then separate case 0 fails and 1/2 return identical bytes/prompt/URL; all-failed with distinct errors | Callbacks [1] / [1,2], originalIndexes [1] / [1,2], real route persists exactly 1 / 2 images and image events, original sequenceIndex 2 / [2,3], final returned=1 / 2 and partial status; mixed success has no representative error; all-failed images/indexes=[] and last error, zero persistence |
| G05-8 | Planner bad tool arguments/search error/image HTTP500/no URL/download failure | Exact stage codes; image POST count=1 per attempt (never transport retry), no fallback OAuth; caller outer retry counts unchanged. Generate/edit no URL throws GROK_EMPTY_RESPONSE502; multimode no URL silently skips without an item error. Planner/search failures remain outside item catch; image/download/callback failures remain inside, representative last error only when no image returned. |
| G05-9 | Abort in held planner/image/download or before next sequence item | Signal observed, GENERATION_CANCELED, no further item or saved final; callbacks awaited and cancellation guards honored |
| G05-10 | Existing downloader oversized declared/chunked content, empty body, valid image | 50MiB cap and streamed cancellation remain active; no “full private-IP/redirect protection” claim from this test |
| G05-11 | Old facade and new modules loaded into same built graph | Functions identical, no circular facade import, no Grok branch left in legacy helpers |
| G05-12 | Canonical runner launched without inherited module-mock flags on Node22/24 | Tiny discovered child actually mocks and dynamically imports a module; execArgv contains flag exactly once, no skip; deliberate failing child yields runner exit1 |

For G05-2, use a real route-normalized search-off request and a direct execute request; don't assert only that a type contains the flag. Use distinct override/default values. Search-off changes are proven by **absence of search network calls plus presence of planner/image calls**, not a snapshot generated from implementation.
No paid generation; synthetic fetch output and in-memory PNG fixtures only. Provider mocks cannot prove upstream service/account health.
G05-7 also runs success-then-failure, no callbacks (final-sweep fallback), dense
producer without originalIndexes, and a callback persistence failure before the
index is marked (sweep retries using the same original index). In the real route,
assert file/image-event counts, unique filenames and final envelope independently;
assert no originalIndexes field in SSE/sidecar JSON. Baseline sparse case must
reproduce duplicate count=2 for one success; patched case must produce count=1.
Reverting only the sweep index expression must make that regression fail. These
are required future RED/GREEN observations, not already-executed WP00 tests.

## Canonical runner and verifier gates

Read053_wp05_runner_and_security_gates.md for mandatory R1-01 runner activation,
actual child-invocation proof, exact commands and security scan/CodeQL gates.

## Image result-download hardening — explicit WP05 patch

Parent authorized this bounded security correction after 006 review. Only the image paths used by grokOperations/grokMultimodeOperations are in scope. Grok video streaming bound is assigned to WP06m (decade doc 065, after WP06 and before jobs integration), not solved by this PR. WP06m keeps its current video URL/transport policy and implements an independent bounded body reader; no pinned-image policy reuse is assumed. MCP DNS re-resolution remains an explicitly disclosed unchanged residual; no universal MCP downloader rewrite or pinning claim is part of this plan.

Threat distinction: operator-configured Grok proxy origin is trusted configuration; an artifact URL returned by provider JSON (including redirect Location) is untrusted input. A local configured proxy may serve its own artifact, but cannot grant returned URLs access to arbitrary private hosts. Direct grok-api has no local-origin exception. Public HTTPS CDN redirects remain supported; API credentials are never forwarded on artifact GETs.

Additional exact manifest:
- NEW lib/grokImageDownload.ts — public download implementation, manual redirects, streamed byte cap, private pinned-to-retry adapter and retry orchestration below.
- NEW lib/grokImageDownloadPolicy.ts — URL/address decision and pinned-address resolution for the downloader, no provider generation logic.
- MODIFY lib/grokImageCore.ts — replace download body and MAX_IMAGE_DOWNLOAD_BYTES with named re-export; retain other core wire behavior.
- MODIFY lib/providers/adapters/grokOperations.ts and grokMultimodeOperations.ts — pass trusted configured proxy origin only when not direct API.
- NEW tests/grok-image-download-policy.test.ts — per-hop/private-address/credential/abort/stream-cap assertions plus real helper/public wrapper held-response cleanup cases (R2-B2).
- MODIFY tests/backend-hardening.test.ts:105 — existing loopback byte-cap test supplies its exact trusted fixture origin explicitly, so it still reaches the cap rather than passing on a URL refusal.
- MODIFY tests/grok-planner-adapter.test.ts — synthetic download setup uses an explicitly scoped local artifact server or the new HTTP transport fixture; global fetch mock no longer intercepts pinned GET transport.
- MODIFY docs/migration/runtime-test-inventory.md, structure/03-server-api.md, structure/01-file-function-map.md, docs/API.md — actual returned-URL policy and error contract.
- NEW generated JS twins for new download modules; MODIFY grokImageCore.js through server build only. DELETE files=none.

### Concrete signatures and whole-module design

Preserve existing public three positional arguments, add an optional policy object:
```ts
export interface GrokImageDownloadPolicy {
  trustedProxyOrigin?: string | undefined; // server-owned config, never req.body
}
export function downloadGrokImageUrl(
  url: string, signal?: AbortSignal, timeoutMs?: number,
  policy?: GrokImageDownloadPolicy
): Promise<{buffer:Buffer;b64:string;mime:string}>;

export interface PinnedImageTarget {
  url: URL;
  addresses: readonly {address:string;family:4|6}[];
}
export function resolveImageDownloadTarget(
  url: URL, policy: GrokImageDownloadPolicy, signal: AbortSignal
): Promise<PinnedImageTarget>;
```

grokImageDownloadPolicy imports node:dns/promises.lookup, node:net.isIP/BlockList only. Validate URL protocol and credentials before resolution. Reject username/password, invalid schemes, empty hostname, IPv6 zone ids. Exact configured proxy origin (scheme+host+effective port) is allowed HTTP/HTTPS and may resolve locally. Compare to normalized new URL(policy.trustedProxyOrigin).origin; do not allow all localhost, matching hostname on another port, or arbitrary user-provided URLs.

All other targets require HTTPS and conservatively allowed destination addresses.
Normalize bracketed IPv6 and IPv4-mapped IPv6; reject empty DNS sets or ANY rejected
answer. Numeric BlockList CIDRs: IPv4 0/8,10/8,100.64/10,127/8,169.254/16,
172.16/12,192.0.0/24,192.0.2/24,192.88.99/24,192.168/16,198.18/15,
198.51.100/24,203.0.113/24,224/4,240/4. Mapped IPv6 is classified as IPv4
first; all other IPv6 requires2000::/3 and excludes2001::/23,2001:db8::/32,
2002::/16 and3fff::/20. This intentionally also rejects some globally reachable
special protocol allocations; it does not guarantee that all public addresses
are allowed/reachable. No universal classifier or MCP pinning claim.051 records
primary IANA sources and the dated policy decision.

grokImageDownload imports node:http.request, node:https.request, node:stream.Readable and existing grok retry helpers. To avoid a grokImageCore↔download cycle, download errors are constructed locally with existing public code/status (no import of grokImageCore); private error constructor is <=10 lines.
Private openPinnedImageGet(target,signal) uses the URL hostname for Host/TLS SNI and a custom lookup callback that returns **only the prevalidated addresses**. Disable connection pooling with agent:false so an unrelated cached connection/lookup cannot evade that decision. It must never invoke DNS again after validation; retry re-resolves and re-validates rather than changing to a default fetch fallback. Honor lookup callback family/all options and preserve address family types. No proxy env interpretation, Authorization/Cookie forwarding, or credential-bearing Referer. Convert IncomingMessage to the existing bounded reader shape (or async iterable) without buffering first.

Manual redirects: process only 301/302/303/307/308 with valid Location; resolve relative URL against current URL; maximum five redirects. Close/cancel every redirect body before next hop, then call resolveImageDownloadTarget again. A public CDN cannot redirect to a private address; a configured local origin can redirect only to itself or an independently valid public HTTPS target. Missing Location, sixth hop or policy refusal fails with existing status502/code GROK_IMAGE_DOWNLOAD_FAILED and a safe message without raw URL/query. Keep public service/endpoint config untouched.

Origin-exception state is monotone per public download invocation: enable only
when the INITIAL URL matches the configured trusted origin. Pass that origin only
while every prior/current hop stays there. Once a redirect leaves it, permanently
remove the exception for subsequent hops/retries. A public initial URL cannot
redirect into the configured private proxy; trusted→public→trusted cannot regain
trust. Standalone resolveImageDownloadTarget obeys only its supplied hop policy;
the public wrapper owns this monotone state, never mutates the caller's policy.

openPinnedImageGet preserves original pre-header ECONNRESET/EPIPE errors for the
existing retry classifier; safe public wrapping happens outside retry. It owns
ClientRequest and IncomingMessage error listeners until their close, not merely
until the header promise resolves. Destroy/late response/error after cancellation
must stay handled and closed. Promise rejection handling is not a substitute for
Node error-event handling. SNI uses DNS hostname only, omitted for IP literals;
Host remains the original authority. Custom lookup handles family/all and fails
closed when no prevalidated address matches; it never falls back to default DNS.

One overall timeout timer starts before first resolution and is never reset for a
hop/retry. Its combined AbortSignal covers DNS wait, every GET, redirects, retry
delays and streaming. resolveImageDownloadTarget receives this same signal on
every hop/attempt; checking only after await lookup is insufficient (R1-04).
Private policy helper signature is `lookupWithSignal(hostname:string,
signal:AbortSignal):Promise<import("node:dns").LookupAddress[]>`. Exact bounded
await algorithm, with the existing lookup import:
```ts
async function lookupWithSignal(hostname: string, signal: AbortSignal) {
  signal.throwIfAborted();
  let onAbort: () => void = () => {};
  try {
    return await new Promise<import("node:dns").LookupAddress[]>((resolve, reject) => {
      onAbort = () => reject(signal.reason);
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) { onAbort(); return; }
      Promise.resolve().then(() => {
        signal.throwIfAborted();
        return lookup(hostname, { all: true });
      }).then(resolve, reject);
    });
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}
```
Resolution validates URL before calling this helper; literal IPs skip DNS but still check the signal. After the helper resolves, check signal again before address validation/return, and the downloader checks it before openPinnedImageGet. Late DNS fulfillment only settles an already-settled promise, never initiates GET; late rejection has the attached reject handler, never an unhandled rejection. Underlying OS DNS may finish later: this bounds caller wait, not OS DNS lifetime. No independent per-DNS timer or public cancellation bypass is introduced. Wrapper catch first checks caller signal.aborted ->499 GENERATION_CANCELED, then timeout controller.signal.aborted ->504 GROK_IMAGE_TIMEOUT, regardless of rejection name (AbortError/TimeoutError/arbitrary reason). Otherwise preserve safe policy/download codes. Destroy request/response on abort and clear timer/listeners in finally, including failures after headers; no success return after cancellation.

Move existing 50*1024*1024 cap without increasing it. Reject oversized declared Content-Length **and** enforce accumulated bytes while consuming chunks when header absent/false. On overflow cancel/destroy stream before Buffer.concat; exactly limit succeeds, limit+1 fails. Retain existing zero-body/zero-byte rejection, byte/MIME return fields and current content-type fallback. Never use arrayBuffer before cap. GET retries use the real grokFetchWithRetry through the exact structural adapter below; image POST is never retried. Policy errors are permanent and not retried.

### R2-B2 — real retry-response boundary, no buffering or policy redesign

Actual grokUpstreamRetry.ts:93/108/134 requires Response, reads ok/status/Headers,
and discards transient responses via body.cancel before sleep/next attempt. A raw
PinnedImageResponse is not assignable (TS2322); a cast also loses cleanup. Exact
type-only edits in that existing leaf module (all function bodies stay unchanged):
```ts
export interface RetryResponse {
  ok: boolean;
  status: number;
  headers: Headers;
  body: { cancel(reason?: unknown): Promise<void> } | null;
}
```
```diff
-function cancelResponseBodyBestEffort(res: Response): void {
+function cancelResponseBodyBestEffort(res: RetryResponse): void {
@@
-async function fetchWithResetRetry(
-  doFetch: () => Promise<Response>,
+async function fetchWithResetRetry<R extends RetryResponse>(
+  doFetch: () => Promise<R>,
   opts: GrokRetryOptions,
-): Promise<Response> {
+): Promise<R> {
@@
-export async function grokFetchWithRetry(
-  doFetch: () => Promise<Response>,
+export async function grokFetchWithRetry<R extends RetryResponse>(
+  doFetch: () => Promise<R>,
   opts: GrokRetryOptions = {},
-): Promise<Response> {
+): Promise<R> {
```
Preserve retryAfterDelayMs/RetryBackoffOptions with actual Headers, all constants,
reset/transient classification, jitter, attempts, slow-attempt cutoff, abort and
non-awaited best-effort cancellation. Existing fetch callers infer Promise<Response>
and retain json/text/arrayBuffer/body methods: grokImagePlanner (moved search/plan),
grokVideoAdapter, grokVideoPoll, grokVideoDownload and old image-core facade. No
caller casts, Response construction around a stream, or new retry policy.

Private additions in lib/grokImageDownload.ts; import RetryResponse as type and
grokFetchWithRetry from ./grokUpstreamRetry.js. Keep PinnedImageResponse below
unchanged. Its cancel synchronously initiates idempotent request/response destroy;
any returned cleanup promise is advisory and may reject or never settle.
```ts
interface PinnedRetryResponse extends RetryResponse { source: PinnedImageResponse }
function cancelPinnedImageResponse(response: PinnedImageResponse): Promise<void> {
  try { void Promise.resolve(response.cancel()).catch(() => {}); } catch { /* cleanup only */ }
  return Promise.resolve(); // never await an advisory cleanup promise
}
function toRetryResponse(source: PinnedImageResponse): PinnedRetryResponse {
  const headers = new Headers();
  const retryAfter = source.headers.get("retry-after");
  if (retryAfter !== null) headers.set("retry-after", retryAfter);
  return { ok: source.status >= 200 && source.status < 300, status: source.status,
    headers, source, body: { cancel: () => cancelPinnedImageResponse(source) } };
}
async function fetchPinnedImageWithRetry(
  url: URL, policy: GrokImageDownloadPolicy, signal: AbortSignal,
): Promise<PinnedImageResponse> {
  let active: PinnedImageResponse | undefined;
  try {
    const result = await grokFetchWithRetry(async () => {
      const target = await resolveImageDownloadTarget(url, policy, signal);
      signal.throwIfAborted();
      active = await openPinnedImageGet(target, signal);
      return toRetryResponse(active);
    }, { signal, label: "image-download" });
    signal.throwIfAborted();
    return result.source;
  } catch (error) {
    if (active) void cancelPinnedImageResponse(active);
    throw error;
  }
}
```
The retry body is a cleanup handle even when source.body=null; it never iterates,
reads, locks or copies body bytes. Only Retry-After is projected into real Headers;
download MIME/length/Location use untouched source.headers. source is in-memory
only, never wire/sidecar metadata. Full Response callers keep their own object.
In downloadGrokImageUrl each hop obtains `const response = await
fetchPinnedImageWithRetry(currentUrl, effectiveHopPolicy, combined)` in place of raw GET. Wrap
that response's redirect/status/body handling in try/finally with
`void cancelPinnedImageResponse(response)` in finally, including last-attempt 503,
nonretryable status and successful read. No await before redirect/next operation;
on abort during helper sleep, its catch above cleans active before outer 499/504
mapping. Abort after headers may make the helper return its last response; post-await signal check
handles that existing behavior without changing helper policy. Destroy is idempotent;
repeated cleanup handles must not double-close or delay the overall R1 deadline.

Required independent tests (real helper, never a stub of grokFetchWithRetry):

- tests/grok-upstream-retry.test.ts: infer Response with .json/.text available and a structural subtype retaining its literal marker; native Response identity preserved. Structural 503 with Headers Retry-After=2 ->200: fake clock observes exactly 2000ms, cancel-before-second-fetch order. Keep all existing classification/attempt tests, plus 400 no retry and attempt exhaustion.
- tests/grok-image-download-policy.test.ts: public download wrapper + actual retry helper + intercepted DNS/HTTP gives held 503 body then valid200. Assert first request/response destroy before GET2, no discarded-body reads, exact200 bytes, Retry-After delay, two vetted resolutions, zero public connections. A cast/raw-pinned mutation must fail typecheck or show cancel0 (RED).
- Private adapter source-unit test with actual retry helper: cancel invokes synchronous destroy then separately returns rejected/never-settling promise or throws. Cleanup cannot change attempt budget or leak rejection. Public wrapper separately proves real request/socket close; do not claim its private cancel was replaced through a nonexistent injection hook. See052 for the source-unit mechanism.
- Abort during the Retry-After wait with cleanup pending: caller rejects499, timeout-only variant rejects504 at original overall deadline, GET2=0, destroy observed, retry timer and wrapper-owned timers/listeners removed. Also abort after headers but before helper classifies503 (existing early-return path); wrapper still cleans it. Release/reject held cleanup later and assert no late GET/unhandledRejection. Exercise third503 exhaustion ->502 with exactly3 GETs and final response destroyed; reset budgets remain the existing nested helper budgets, never an image POST retry.
Use node:test mock timers plus entered/closed latches, not real sleeps or a test-side
timeout declared as success. Both Node22/24 canonical WP05 CI must run these cases.
These are future helper+wrapper integration gates; standalone adapter proof is not
evidence that the not-yet-implemented public downloader passed them.
Caller contract:
```diff
- downloadGrokImageUrl(imageUrl, options.signal)
+ downloadGrokImageUrl(imageUrl, options.signal, undefined, {
+   trustedProxyOrigin: options.directApiKey
+     ? undefined : new URL(getGrokProxyBaseUrl(ctx)).origin,
+ })
```
Use getGrokProxyBaseUrl from grokRuntime, not a URL passed by the user/provider. WP03's direct-key invariant prevents missing direct API key from activating proxy trust. Classic/child/edit/multimode preserve providerUrl in their current return/sidecar fields for compatibility; no URL/key logging is introduced.

### Required independent download tests

- Public URL fixture `https://artifact.fixture.invalid/a` -> public HTTPS redirect -> valid bytes: DNS returns synthetic 8.8.8.8 (allowed by the exact CIDRs above). Both node:http.request and node:https.request are completely intercepted before module import, fail on unmatched calls and never delegate to native transport; call supplied lookup callback and assert its address/family/all results. No real connection to 8.8.8.8 occurs. 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 and 2001:db8::/32 are rejection fixtures, never successful public-policy fixtures.
- HTTPS hostname resolving 127.0.0.1/private IPv4/IPv6/mapped IPv4 or mixed public+private answers: reject before GET. Tests must use HTTPS so scheme check does not mask address guard.
- Direct grok-api returned localhost URL: reject; proxy configured exact loopback origin: valid local image accepted; same host different port: reject.
- Relative redirect within trusted local origin allowed; trusted local→another private origin and public→private reject at that hop before request. Test normalized numeric hosts, userinfo and redirect count separately.
- Real socket pinning (separate fixture/import isolation from mocked transport): bind real node:http server to 127.0.0.1 ephemeral port, request `http://pinning.fixture.invalid:<port>/image`, and set trustedProxyOrigin to exactly that named origin. Mock node:dns/promises.lookup before download-module import to return [{address:"127.0.0.1",family:4}] for only that name, and throw on a second invocation. Keep native http.request/https.request, TCP connect and server unmocked. Replace default node:dns.lookup with a throwing sentinel (syncBuiltinESMExports before importing downloader); any default re-resolution fails without public DNS/network. Real custom lookup must return the pinned loopback address. Assert one resolver call, one server request, Host equals named host+port, client socket.remoteAddress=127.0.0.1 and client socket.remotePort equals fixture port, exact response bytes and clean socket/server close. Removing custom lookup must fail via the sentinel. No IP-literal request (which would bypass lookup), public socket, global hosts-file edit or production test bypass. This proves new Grok lookup wiring, not public-policy enforcement or existing MCP pinning; public-policy fixtures above prove that separate boundary.
- Existing chunked 51MiB cap test remains active with explicit origin; add small injectable-stream boundary fixture to assert limit, overflow cancellation, declared-size lie and no Buffer.concat on rejection.
- Abort after headers/mid-stream/redirect delay: request and body close, no returned bytes, correct 499; timeout separate 504. Tests register cleanup and no long sleeps.
- DNS held forever: wait for resolver-entered latch, abort caller, and assert rejection499 BEFORE releasing resolver with GET count=0. Separate fresh case advances mocked wrapper timeout to its deadline with no caller abort and asserts504 while DNS is still pending. Afterwards fulfill, then in another case reject the resolver; drain microtasks/event turn and assert GET count remains0, no unhandledRejection, all abort listeners/timer cleaned. Pre-aborted signal invokes neither DNS nor GET. A multi-hop/retry case consumes part of the original timer before holding next DNS and proves only the remaining budget exists. Tests must observe actual public download promise settlement; a timeout raced by the test itself is not a passing oracle.
- No generated provider/API key, URL userinfo or signed query sentinel in errors/log exports; only machine-readable code/status survive.
- Fixtures must replace the low-level HTTP request/DNS boundary or use dedicated loopback servers with explicit trust; never fetch real public addresses.

Future command adds tests/grok-image-download-policy.test.ts as direct argument to the WP05 focused command. Baseline file absent, no claimed test exit. The existing backend-hardening chunk test was source-inspected, not executed in WP00; it is an additional targeted future gate after safe import/isolated runtime validation. Compile includes new lib/**/*.ts. Parent exact-head CI must exercise the public/private and cap cases before readiness acceptance.

Before docs/API.md: returned artifact URL accepted on HTTP(S), default redirects.
After: untrusted returned URLs require public HTTPS with per-hop pinned resolution; exact configured proxy origin is the explicit local exception. Document existing code/status and safe errors, not a new response envelope. Compatibility break is deliberately limited to unsafe returned URL destinations; proxy configuration and Comfy policy are not globally rewritten.

New optional webSearchEnabled field chain: resolved existing caller boolean → WP03 request.options → grokExecution → generateViaGrok/generateMultimodeViaGrok options → planGrokImage → zero/one search call → usage/result → existing response/sidecar. It is not serialized as a new request schema field; caller's public webSearchEnabled/searchMode already exist. Other consumers agent/old API omit it and retain true default. No persisted enum/migration.
SoT before: node/multimode can request search-off but planner still searches.
SoT after: structure/03 and 05 say search-off suppresses search, not planner; file map points to actual operation owners; 07 records evidence.
### Image-internal helper contract and WP06m boundary

The policy module exports its real image boundary. Transport/body helpers remain private to the image downloader; no speculative shared video framework is added.
- lib/grokImageDownloadPolicy.ts: GrokImageDownloadPolicy, PinnedImageTarget, resolveImageDownloadTarget(url:URL,policy:GrokImageDownloadPolicy,signal:AbortSignal):Promise<PinnedImageTarget>; private lookupWithSignal owns abort-aware wait, not another timer.
- lib/grokImageDownload.ts private helpers: openPinnedImageGet(target:PinnedImageTarget,signal:AbortSignal):Promise<PinnedImageResponse>, readBoundedImageBody(response:PinnedImageResponse,options:{maxBytes:number;signal:AbortSignal}):Promise<Buffer>; R2-B2's exact toRetryResponse/cancelPinnedImageResponse/fetchPinnedImageWithRetry signatures above; public downloadGrokImageUrl unchanged.

```ts
interface PinnedImageResponse {
  status: number;
  headers: { get(name: string): string | null };
  body: AsyncIterable<Uint8Array> | null;
  cancel(reason?: Error): void; // idempotently destroy request and response
}
```
openPinnedImageGet performs one pinned GET without redirects/prebuffering.
readBoundedImageBody enforces declared/streamed limits, rejects null/empty bodies,
cancels onoverflow/abort and returns onlycomplete boundedbytes. Its private
ImageBodyFailure reason is too-large or empty (052); outerwrapper maps toexisting
GROK_IMAGE_DOWNLOAD_FAILED502. Cancellation/timercome fromwrappersignal and map
toexisting499/504. No newpublicGROK_MEDIA errorcodes, image/videoMIME/persistence/
redirect/retry/auth decision insidebodyreader.

Image wrapper owns its max-five manual redirect loop and50MiB cap. WP06m/doc065
independently handles video body bounds and does not reuse image pinning policy.
Default image destinations require HTTPS and the explicit conservative address
policy; the exact server-owned proxy-origin exception follows the monotone chain
rule above. Image helpers stay private and are tested through the public downloader.

Module mocking for DNS/HTTP tests is registered before dynamic import of emitted
download modules; public-policy fixtures mock DNS/HTTP completely, while the named
loopback socket test mocks resolution only and exercises native request/connect.
Use isolated child/module contexts so cached mocked transport cannot contaminate
the real-socket case; restore builtins/mocks and await cleanup in finally. R1-01's
canonical runner flag and Node22/24 child-invocation gate above are mandatory for
this WP; focused --experimental-test-module-mocks alone does not activate npm test.

## Cross-lane and rollback contract

Read051's inherited cross-lane/rollback section; the whole WP05 layer must be
reverted together, preserving WP03/04 admission and all user media/credentials.
