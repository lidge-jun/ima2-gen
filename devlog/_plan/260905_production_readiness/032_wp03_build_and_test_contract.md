# WP03 — bounded build ownership and executable verification

Companion to 030/031, same WP03 cycle. No production implementation at P.
All workers read 030/031/032 and applicable cxc-dev routers. Main alone advances
FSM, commits, publishes and integrates. No paid provider requests or full local
suites. Each new helper <400 lines; split cohesive test helpers if needed.

## B ownership and exact additions

| Owner | Exclusive writes |
| --- | --- |
| Main | execution/types.ts, admission.ts, index.ts, legacy.ts; providerOptions.ts; generationErrors.ts; errors/providerMap.ts; SoT, inventory, devlog and goal evidence |
| Classic | execution/legacyClassic.ts, lib/generatePipeline.ts; tests/provider-execution-classic.test.ts |
| Node | execution/legacyNode.ts, lib/nodeGeneration.ts; tests/provider-execution-node.test.ts |
| Edit/sequence | execution/legacyEdit.ts, execution/legacyMultimode.ts, routes/edit.ts, lib/multimodePipeline.ts; tests/provider-execution-edit.test.ts and provider-execution-multimode.test.ts |
| Fixture/boundary | tests/_executionRouteHarness.ts, tests/_executionRouteIsolation.ts if needed; tests/_executionTestProcess.ts, tests/_executionTrackedWrites.ts, tests/provider-execution-harness.test.ts; tests/provider-execution-boundary.test.ts, tests/_executionBoundaryProbe.ts; tests/provider-execution-routes.test.ts admission matrix |
| Test migration | tests/_executionImportEdges.mjs, tests/provider-execution-imports.test.ts and named existing contract tests below |
| Error UI | ui/src/lib/errorCodes.ts; ui/src/i18n/{en,ko,zh-Hans,zh-Hant}.json; tests/error-ui-consumption.test.ts; tests/generation-errors.test.ts; tests/server-code-preservation.test.ts; ui/e2e/fixtures/j6Selection.ts; ui/e2e/execution-admission.spec.ts; .github/workflows/{ci,pr-fast}.yml |

The names above supersede 030's initial three-test-file estimate. All leaf B
packets use explicit `model=gpt-6-astra`, `reasoning_effort=high`; no delegation
below these leaves. Main publishes shared type signatures before surface work.
Surface test workers consume the fixed harness API below; they do not edit it.

### Public implementation names

`index.ts` exports `prepareImageExecution` with the full 030 overload/generic
contract. `legacy.ts` exports `prepareLegacyImageExecution` with that contract.
Four leaf modules export `prepareLegacyClassic`, `prepareLegacyNode`,
`prepareLegacyEdit`, `prepareLegacyMultimode`, each accepting
`(ctx, request: Extract<ImageExecutionRequest,{surface:...}>, progress?)` and
returning `Promise<PreparedImageExecution<the-surface>>`.

`admission.ts` exports 030's `checkImageExecutionAdmission` and
`assertDirectGrokKey(ctx, provider): void`: throws an Error assigned the same
code/status/message for missing/blank direct key. No wrapping for other errors.
Index invokes this presence assertion before preparing and immediately before
each execute. Classic/Node capture after the prepare check, before any await
that could change capture semantics; edit/sequence capture at execute as before.
No new cache, auth discovery, network/client construction or fallback routing.

## Route fixture API (fixed before worker writes)

Use type-only production imports at helper top level. Node test files call
`openRouteHarness()` in before, `harness.close()` in after; cases are serial.

For native module mocking without changing the global test runner, each new
route/harness test file uses `executionTestProcess(import.meta.url): boolean`
from `_executionTestProcess.ts` around registration. In the normal parent it
registers one node:test which launches that exact file with process.execPath,
`--experimental-test-module-mocks --import tsx --test`, and returns false. In
the flagged child it returns true and actual tests register. Child env is a
small platform/path whitelist, never inherited credentials, NODE_OPTIONS or
user config; owned config roots are established by openRouteHarness before DUT
imports. Forward child TAP diagnostics and fail on nonzero/signal/timeout (60s),
never skip unsupported mocks. Only this known test child may launch before the
in-child process trap; production process launches remain denied.

```ts
type Surface = "classic" | "node" | "multimode" | "edit";
interface UpstreamCall {
  url: string; method: string; headers: Headers; body: string;
  signal: AbortSignal | undefined;
}
interface RecordedEvent { event: string; data: Record<string, unknown> }
interface RouteCase {
  requestId: string; generatedDir: string; ctx: RuntimeContext;
  calls: readonly UpstreamCall[]; events: readonly RecordedEvent[];
  post(body: Record<string, unknown>, headers?: Record<string, string>): Promise<Response>;
  waitFor(predicate: (event: RecordedEvent) => boolean, timeoutMs?: number): Promise<RecordedEvent>;
  waitTerminal(timeoutMs?: number): Promise<RecordedEvent>;
  waitSettled(timeoutMs?: number): Promise<void>;
  cancel(): void;
}
interface RouteHarness {
  run(surface: Surface, options: {
    upstream: (call: UpstreamCall) => Response | Promise<Response>;
    context?: Partial<Omit<RuntimeContext, "config" | "rootDir">>;
  }, body: (fixture: RouteCase) => Promise<void>): Promise<void>;
  close(): Promise<void>;
}
export function openRouteHarness(): Promise<RouteHarness>;
export function responsesSse(events: readonly unknown[]): Response;
```

POST chooses one fixed endpoint and writes its own unique legal requestId last;
no hidden provider/prompt/model defaults. Test bodies supply explicit fixtures.
Small PNGs are generated with sharp, distinct colors/alpha as needed.

### Isolation and ownership

Based on current provider-surface-boundary isolation, not the older broad
loopback passthrough in api-provider-parity. Before production dynamic imports:
create mkdtemp, save/clear inherited IMA2 settings, set owned config/DB/generated/
trash/request-log paths, disable dotenv, write valid empty config.json. Install
fetch/process traps, then import config/runtime/logger/DB/inflight/eventBus/routes.
Assert resolved stores are beneath the exact owned root. Use synthetic keys.
No environment switch between cases to pretend module caches reset.

Only private native fetch inside fixture.post may contact the owned app URL.
Global fetch never falls through, including loopback. Normalize Request/URL/string,
record, then call fixture upstream. Unmatched endpoints throw AND record violations
which must be empty after settlement even if application catches the error.
Guard actual child_process spawn and other launch variants before imports and
syncBuiltinESMExports on installation/restoration. Restore only owned mocks.

Per-case unique generatedDir/id, selected real Express router, 127.0.0.1:0.
Subscribe before POST, filter by id, collect live complete event objects (replay
strips image fields). waitFor searches existing journal then installs bounded
waiter. waitTerminal recognizes done OR error; tests assert which. Edit uses HTTP
plus settlement, not a nonexistent bus terminal. Keep journal after first terminal.

Track actual registered app.post handler promises with a test-only wrapper that
invokes and returns them unchanged; waitSettled must not equate HTTP 202 or job
absence with completion. Default bounded waits 5s; explicit max 15s for fixtures.
Cleanup aborts owned active job, requires held upstream promises honor AbortSignal,
waits handler settlement while traps remain, clears waiters/unsubscribes/closes
connections/server, resets owned state, removes case data. Final close shuts DB,
restores fetch/process/env, removes owned root. On settlement timeout fail and
retain scratch rather than restoring real fetch or deleting active storage.

### A correction: drain detached writes, not just route handlers

Real classic completion/refusal queues appendGenerationRequestLog; successful
classic/edit/multimode detach generateImageThumbnailFromBuffer. Handler settlement
does not imply these writes settled. After environment isolation but before DUT
route imports, load real generationRequestLog.ts and imageThumb.ts, keep their
function references, then use native module mocks with pass-through exports.
Wrap ONLY appendGenerationRequestLog and generateImageThumbnailFromBuffer in a
test-owned pending-promise tracker; invoke the original functions with identical
args, return their real promise semantics and preserve all other exports.
Track rejection diagnostics without converting failures to success. This is
observation, not fake logs/thumbnails or a production-awaiting change.

After handler settlement drain tracked writes until no pending entries remain,
with the same bounded timeout, before directory removal or global restoration.
On timeout preserve traps/root and fail. `_executionTrackedWrites.ts` exposes
`track<T>(work: Promise<T>): Promise<T>` and `drain(timeoutMs?): Promise<void>`;
each wrapper tracks immediately, including the request logger's whole queue
promise, not merely its first filesystem call. `provider-execution-harness.test.ts`
holds a pass-through writer before its real operation and proves cleanup remains
pending/root exists until release, then confirms the real file was written before
normal removal. Cover request-log and thumbnail wrappers, and rejected/timeout
cleanup paths. No production injection flag or export is added for testing.

### Runtime assertions by owner

- Classic: E03-1 API async 202 then release held final; assert literal wire options,
  paired sidecar, one done; E03-2 Grok shared search/planner and image count; E03-3
  classic retry rules; E03-5 cancellation; E03-7 Comfy queue callbacks; E03-9 alpha
  batch refusal before any save. Reuse exact current fixture wire protocols.
- Node: E03-1 API, E03-3 root two/child one attempts, E03-6 legacy and async partials;
  all parent/ref ordering and effective/raw prompt branches. Assert captured initial
  key across nonblank replacement and refusal after removal; no extra attempts.
- Edit/sequence: E03-1 API masked edit + two-image legacy/async sequence;
  E03-4 repeated A,A,B dedupe/awaited callback/persisted outputs; E03-10 native
  diagnostics/error/provider metadata. No sparse-index correction (WP05).
- Fixture/boundary: E03-8 exact code/envelope/no transport for missing,
  blank and removed keys, NAI refs/edit/mask, Comfy unsupported and ancestry.
  No admitted job applies only to the new pre-admission missing/blank-key and
  NAI multimode-ref refusals. Existing edit validation happens after startJob;
  preserve its owned terminal bookkeeping. Removed-after-prepare key checks may
  run after admission and must finish that owned job, not pretend none existed.
  Positive proxy Grok and invented direct key prevent universal rejection.
  Four actual callers' normal success tests remain in surface files.

Boundary probe launches only a sanitized child running Node with
`--experimental-test-module-mocks --import tsx`; dynamic DUT import follows native
module mocks of concrete transports. Actual facade/legacy branches execute.
Test caller surface/provider matrix, literal effective/raw prompts, reference
ordering, mask fields, original callback object identity + awaited promise,
context identity, native result metadata/nullability, no facade error wrapping,
explicit unsupported branch refusal and credential capture. Direct mock callbacks
prove seam semantics, not network availability. No production dependency or flag.
Node22 and24 exact-head CI must pass; no conditional skips for mock support.

## Existing contract migration (no blanket deletes)

- edit-mask-api-contract.test.js / oauth-proxy-edit-mask-contract.test.js:
  replace only route-local editViaResponses checks; preserve mask/legacy OAuth.
- multimode-backend-contract.test.js: replace direct dispatch check; preserve
  callbacks/dedupe/metadata/timeout; relocated body remains accountable.
- provider-registry-parity.test.ts: keep mask matrix/getter, replace edit call oracle.
- node-child-refs-contract.test.js: move refsForRequest owner check to legacyNode;
  preserve refusal/diagnostics and positive actual source+ref ordering.
- nai-routing-contract.test.ts: scan legacyClassic/Node/Multimode plus unchanged
  agent; require actual expected call sites (no zero-match pass), preserve NAI
  no-reference options and PNG/MIME expressions.
- node-studio-ui-contract.test.js: replace vacuous removed-branch regex with
  positive effective-prompt execution assertion; keep raw-prompt lane exceptions.
- provider-surface-boundary.test.ts: existing direct-Grok mask case gets an
  invented xAI key so it still tests mask 400, not new earlier key 401.
- generation-limit-unlock-contract.test.js: include new execution owners in
  no-eight-cap scan. nai-ui-registration-contract.test.ts: include new admission
  error emitters. Never weaken error-class-coverage's all-source scanner.
- Error owner adds missing-key semantics to generation-errors,
  server-code-preservation and error-ui-consumption; existing cases remain.

AST helper parses exactly four callers, normalizes .ts/.js module paths, rejects
runtime edges to concrete Responses/Grok/multimode/GrokCore/Agy/Gemini/Atlas/
MiniMax/NAI/Comfy adapters or execution/legacy*. Include named aliases, namespace,
default, side-effect, mixed type/value and literal dynamic imports/reexports;
allow genuine type-only imports and policy/NAI/MIME/errors/lifecycle helpers.
No generic substring bans. Require an actual prepareImageExecution call and execute
call, not just an unused allowed import. Fixture permitted internal execution
edges vs forbidden caller edges; comments/string lookalikes are inert.
Residual: computed dynamic imports and arbitrary indirect barrels are not a
universal graph proof; unchanged agent/sprite callsites are intentionally outside.

## Missing-key UI and visual scope

New ErrorCode/spec/SELF_DESCRIBING_AUTH_CODES entry `GROK_API_KEY_MISSING`,
server AUTH_INVALID mapping, status401, passthrough normalization. Locale keys:
`errorCard.grokApiKeyMissing.title/body/cta`. CTA `reauth` retains existing
openSettings("providers") wiring. No OAuth/login request is introduced.

| Locale | Title | Body | CTA |
| --- | --- | --- | --- |
| en | Grok API key required | Add an xAI API key in Settings > Providers, then retry. This image request will not fall back to the Grok proxy. | Open provider settings |
| ko | Grok API 키가 필요합니다 | 설정 > 제공자에서 xAI API 키를 추가한 뒤 다시 시도하세요. 이 이미지 요청은 Grok 프록시로 전환되지 않습니다. | 제공자 설정 열기 |
| zh-Hans | 需要 Grok API 密钥 | 请在设置 > 提供商中添加 xAI API 密钥，然后重试。此图像请求不会回退到 Grok 代理。 | 打开提供商设置 |
| zh-Hant | 需要 Grok API 金鑰 | 請在設定 > 供應商中新增 xAI API 金鑰，然後重試。此圖像請求不會改用 Grok 代理。 | 開啟供應商設定 |

J6Capture gains optional test-only `submissionFailure?: "grok-api-key-missing"`.
Only matching POST /api/generate with record.provider=grok-api is fulfilled with
literal401 `{error,code,requestId}`, matching classic's actual pre-admission flat
response. Unit consumer tests separately cover rawCode/AUTH_INVALID precedence
for decorated post-admission failures. Every other
request follows existing safe default202; no real handler or extra endpoint.
Expected submissions=1 for each error test. New E2E uses withJ6/preflight guards.

After openCreate(en), set ima2.locale and true reload; use CSS controls thereafter
to avoid English action names. Four locales × desktop1280/mobile390 = eight
scenarios. Fill visible composer, submit, verify 401 and `.toast--card[role=alert]`
text/CTA (not generic re-login), visible nonclipped body and hit-testable CTA,
no page horizontal overflow. Font-ready before geometry. Capture wp03-*.png and
wp03-*.json per scenario; use existing viewport/sheet settling if relevant.
Keep WP02 isolation/evidence files. Add separate wp03-error-evidence upload steps
to both ci.yml and pr-fast.yml using their existing pinned upload action and
`if: always()`. Hosted fixture proves rendered guidance, not real authentication.
Main and an independent visual reviewer inspect all eight final-head screenshots.

## C and rollback

Focused new surface/boundary/import and named impacted tests; server/tests/UI
typecheck; build:server; UI build; regenerated test inventory; diff check.
Full suites + all E2E run on exact-head hosted CI Node22/24. Failed runs remain
recorded. Do not label a local focused pass global green. Fresh independent C
code and visual reviews before D. Rollback is030's inverse extraction, with
UI error map/locales/tests reverted together; no user data migration or deletion.

Existing ci.yml E2E checkout ignores dispatch sha input: dispatch from the exact
final-head branch (not another ref with only a sha field), verify run.headSha and
checkout log before attributing screenshots. Broader CI checkout cleanup belongs
WP12; WP03 adds only its artifact upload steps.
