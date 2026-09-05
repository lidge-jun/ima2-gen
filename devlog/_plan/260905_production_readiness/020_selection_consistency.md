# WP02 — reconcile persisted selections without crossing lanes

Status: WP00 design only, independently derived at `ecde2bc7`.
Class: C3; persisted preference compatibility receives C4 migration scrutiny.
Archetype: satisfy-spec. Trigger: saved grok-api is restored as grok, model clicks
can create impossible pairs, and Comfy image workflows use the static model field.
Goal: refresh, provider/model clicks and cross-tab sync preserve the selected
authentication lane and legal workflow choice; the next request agrees with it.
Non-goals: server defaults override, provider auth, model discovery redesign,
MCP normalization, graph/history mutation, generation execution abstraction.
Verifier: independent pure reconciliation cases, real setter/persistence behavior,
request-payload capture and focused J6 UI actions. Stop: all named activation
scenarios pass at source and browser boundary with independent review.
Memory artifact: 001 research and this document. Terminal: verified / blocked /
replan; parent owns transitions and any further delegation. Escalate additional
persisted schema changes, model-owner disagreement, or required out-of-scope edits.
Resource limits inherit 000: no paid calls, full local suites, shared browser, or
credential-file inspection during WP00. Early WP02 browser C is allowed ONLY under
the isolated J6 preconditions below; live port 3333 and credential-bearing contexts
are prohibited. WP09 owns durable full network/process isolation later.

## Dependencies and preserved contracts

Semantic: WP01's generated core surface map, runtime-vs-static distinction and
supported model ids. Stack base: WP01. WP03 execution wrappers are not prerequisites.
Main's final ownership decision: NEW server missing-grok-api-key refusal and NAI
multimode reference refusal belong to WP03. This WP does not touch credentials or
server dispatch; preserving the UI lane alone does not prevent server fallback.
WP08/09 consume the completed selection behavior rather than implementing another
reconciler. WP12 inherits visual receipts but still performs integrated acceptance.

`30190da8` invariants: lane-gated displayed value; active Comfy carriers cleared on
exit; arbitrary workflow ids never sent as GPT models; reselecting Comfy preserves
its active selection. `684af450`: unavailable workflow keeps a visible raw-id row,
no badge displacing the trigger text. WP02 extends these, not reverts them.

Preserve `imageModel: ImageModel` as a static model union. A Comfy image workflow
lives in existing `comfyWorkflow`; video stays in `comfyVideoWorkflow`. At the API
boundary Comfy still sends that workflow id in the existing `model` field.
Do not change stored history/XMP model strings, migration ownership or old files.

## Exact future file/write map

| Action | Path | Responsibility |
|---|---|---|
| NEW | `ui/src/lib/coreSelection.ts` | Pure current selection normalization, provider transition and model targeting; complete design below. |
| NEW | `ui/src/store/coreSelectionPersistence.ts` | Bounded lane-memory key parser, legacy snapshot loader and persistence of selection fields only. |
| NEW | `ui/src/store/storeCoreSelectionImpl.ts` | Selection action implementation extracted from existing mixed settings file; no MCP code or transport. |
| MODIFY | `ui/src/store/persistenceRegistry.ts` | Append ima2.coreSelectionMemory.v1; never insert into indexed keys. |
| MODIFY | `ui/src/store/storeSettingsImpl.ts` | Keep public setters/clearMcpLane; replace only core selection bodies with calls to new actions. |
| MODIFY | `ui/src/store/storeTypes.ts` | Add setComfyWorkflow action; existing optional workflow fields remain compatible. |
| MODIFY | `ui/src/store/useAppStore.ts` | One reconciled initial selection; register new action; do not change asset/node/MCP state. |
| MODIFY | `ui/src/store/storeUIImpl.ts` | Storage sync uses one reconciled provider/model/workflow patch; preserve history/inflight logic. |
| MODIFY | `ui/src/App.tsx` | Subscribe storage listener to generationDefaults/imageModel/videoDefaults, not only inflight/gallery keys. |
| MODIFY | `ui/src/lib/imageModels.ts` | resolveCoreModelValue accepts optional comfyWorkflow and uses it on Comfy image lane; retain all current exports. |
| MODIFY | `ui/src/components/GenProviderModelSelect.tsx` | Route Comfy image values to new action; supply comfyWorkflow to display resolver; keep unknown row. |
| MODIFY | `ui/src/store/storeGenImpl.ts` | Both multimode/classic payload sites project Comfy workflow through request model helper. |
| MODIFY | `ui/src/types.ts` | GenerateRequest.model accepts wire workflow strings; ImageModel/store selection union stays narrow. MultimodeGenerateRequest inherits this field. |
| MODIFY | `ui/src/store/storeGenerateEntryImpl.ts` | Route active Comfy video through runVideoGenerate; exclude unsupported Comfy multimode through WP01. Preserve NAI policy. |
| NEW | `tests/core-selection-reconcile.test.ts` | Node-importable pure function behavior and independent transition matrix. |
| NEW | `tests/core-selection-actions.test.ts` | Execute real actions with Map storage; verify state/persisted values and unrelated-field invariants. |
| MODIFY | `tests/model-select-lane-gating.test.ts` | Add Comfy image display behavior; replace superseded lexical setter assertions with direct behavior coverage. |
| MODIFY | `ui/e2e/j6-model-select-label.spec.ts` | Add reload, Grok API selection, Comfy image/video and request capture scenarios. |
| MODIFY | `ui/e2e/fixtures/appServer.ts` | Minimal typed J6 catalog/capture helper if required, explicitly scoped below; no live providers or general isolation framework. WP09 consumes it later. |
| MODIFY | `docs/migration/runtime-test-inventory.md` | Register new behavioral test files and reclassify replaced lexical checks. |
| MODIFY | `structure/01-file-function-map.md` | New pure/persistence/action owners with dependents. |
| MODIFY | `structure/04-frontend-architecture.md` | Reconciled hydration, workflow ownership and active-vs-remembered semantics. |
| DELETE | `tests/comfy-selection-persistence.test.js` | Replace its two lexical checks with stronger reload/reselect assertions in core-selection-actions.test.ts; inventory updated in same PR. No production data/source deletion. |

No package/dependency/config changes. New modules each <250 lines; function bodies
<50 lines. Large existing store files receive narrow extraction/wiring changes only.
The three new files correspond to pure policy, storage boundary and action side
effects; no general migration engine or generic state orchestration framework.

## NEW coreSelection.ts — complete module design

Imports: type-only Provider/ImageModel from existing types; generated
PROVIDER_MODELS, IMAGE_MODEL_IDS, isCoreProviderId, PROVIDER_SURFACE_SUPPORT;
DEFAULT_IMAGE_MODEL and normalizeVideoModelValue from imageModels. No store,
React, storage, i18n, config, fetch, hooks or generated credential objects.

```ts
export interface CoreSelectionState {
  provider: Provider;
  imageModel: ImageModel;
  videoModelSelected: VideoModel | false;
  comfyWorkflow: string | null;
  comfyVideoWorkflow: string | null;
}
export interface CoreSelectionInput {
  provider?: unknown;
  imageModel?: unknown;
  videoModelSelected?: unknown;
  comfyWorkflow?: unknown;
  comfyVideoWorkflow?: unknown;
}
export interface RememberedCoreSelection {
  image?: string;
  video?: string;
  kind: "image" | "video";
}
export type CoreSelectionMemory = Partial<Record<Provider, RememberedCoreSelection>>;
export function reconcileCoreSelection(input: CoreSelectionInput): CoreSelectionState;
export function selectCoreProvider(
  current: CoreSelectionState, provider: Provider, remembered?: RememberedCoreSelection,
): CoreSelectionState;
export function providerForImageModel(current: Provider, model: ImageModel): Provider;
export function rememberCoreSelection(current: CoreSelectionState): RememberedCoreSelection;
export function coreImageRequestModel(current: {
  provider: Provider; imageModel: ImageModel; comfyWorkflow?: string | null;
}): string | undefined;
```

Import VideoModel as a type from `ui/src/types`; the signatures do not widen its
union. No new public provider enum. Private helpers: canonicalStaticImage(provider,
value), defaultStaticImage(provider), nonemptyWorkflow(value). The latter accepts
nonempty strings only, without static membership or network lookup. The server
retains authoritative workflow-id/binding/media-kind validation.

Deterministic reconciliation algorithm, in order:

1. If provider is a known core id, keep it. Never infer another lane from a model
   when an explicit legal provider exists. If absent/invalid (legacy/corrupt),
   infer grok for normalized Grok video, then unique static model family (Grok→grok,
   Gemini→agy, Atlas→atlascloud, MiniMax→minimax, NAI→nai), otherwise oauth. Do not
   infer Comfy from an arbitrary string; explicit comfy is required for workflows.
2. For non-Comfy providers, canonicalStaticImage accepts only that lane's image
   ids intersected with IMAGE_MODEL_IDS (Spark remains rejected); otherwise use
   existing lane fallback values below. Do not choose based on catalog liveness.
   Set both active Comfy fields null; permit normalized Grok video only on grok/
   grok-api. Any other lane's active videoModelSelected becomes false.
3. For Comfy, preserve both explicit nonempty workflow fields without checking a
   static catalog. If comfyWorkflow is absent and raw imageModel is a nonempty
   string NOT in static supported ids, move that legacy workflow carrier into
   comfyWorkflow. Keep imageModel a valid static id or DEFAULT_IMAGE_MODEL; it is
   inactive and never a Comfy request value. Normalize Grok video to false. If both
   workflow fields exist, video remains active, matching the current resolver.
4. Pure function does not write repairs back to storage. Reapplying it returns
   deeply equal state. Availability refresh never invokes a destructive repair.

Explicit lane fallback table (existing behavior, not /api/models defaults):
oauth/api = gpt-5.6-luna; grok/grok-api = grok-imagine-image-2.0; agy = nano-banana-2;
gemini-api = nano-banana-pro; atlascloud = openai/gpt-image-2/text-to-image;
minimax = image-01; nai = nai-diffusion-5-full. Comfy has no automatic workflow.
The table is local selection fallback policy, not a duplicate server default.
Assert each static fallback belongs to the generated supported ids for that lane.

`providerForImageModel`: preserve current lane if model is supported there,
including grok-api, api and gemini-api. Otherwise choose the family defaults in
step 1. Thus grok-api+Grok remains grok-api, grok-api+GPT becomes oauth; api+GPT
remains api. `selectCoreProvider`: same provider returns current unchanged; otherwise
if remembered selection exists, reconcile a target-lane input reconstructed from
its image/video/kind; else preserve a compatible current static model or use lane
fallback, with empty workflows for newly visited Comfy. No first-runtime-row pick.
`rememberCoreSelection` snapshots only lane-owned image/video choices and active
kind; it never stores prompts, auth, status, history, URLs or graph contents.
For Comfy kind=video iff comfyVideoWorkflow is non-null; image=comfyWorkflow when
non-null; for Grok kind=video iff videoModelSelected is truthy. Static non-video
lanes have no video member. `coreImageRequestModel`: Comfy returns comfyWorkflow
or undefined, every other provider returns imageModel; never DEFAULT_IMAGE_MODEL
as a Comfy substitute. Undefined causes the existing server missing-workflow error.
The request helper accepts the actual optional AppState carrier; unlike reconciled
CoreSelectionState, an AppState is not guaranteed to contain comfyWorkflow. Do not
require that field, cast AppState, or change storeTypes' optional field to satisfy
the helper. Its complete body is:
```ts
return current.provider === "comfy"
  ? current.comfyWorkflow ?? undefined : current.imageModel;
```

## NEW coreSelectionPersistence.ts — boundary/storage design

Append `ima2.coreSelectionMemory.v1` to PERSISTED_KEYS, export
CORE_SELECTION_MEMORY_STORAGE_KEY at the new last index, and add generation-domain
registry entry `shape: "json:{version:1,lanes:CoreSelectionMemory}"`, resetSafe:true.
This is bounded by the ten known core provider ids, not an unbounded history.
No authoritative new active-state blob and no removal of legacy keys.

```ts
export function loadCoreSelectionMemory(): CoreSelectionMemory;
export function saveCoreSelectionMemory(memory: CoreSelectionMemory): void;
export function loadCoreSelectionSnapshot(): CoreSelectionState;
export function persistCoreSelection(selection: CoreSelectionState): void;
```

Each boundary operation has try/catch consistent with current storage policy.
loadMemory JSON-parses a plain object with version===1 and plain lanes; iterates
known provider ids only. Reject arrays/null/malformed per-lane entries, unknown
kind, unsupported static image/video ids. Normalize the known video preview alias.
Accept nonempty Comfy strings without catalog filtering. Unknown versions return
{} without overwriting raw data. Saving uses the same allowlist projection and
merges existing known lane entries; no catch block clears storage. A failed save
does not undo in-session state. Never log raw stored content.
Merge at the provider-record level: each supplied valid lane REPLACES that lane's
record wholesale; an absent provider keeps its old record. Never slot-merge inside
saveMemory: action-owned deliberate slot deletion must not be resurrected there.
If an existing blob has a future version, saveMemory skips that key rather than
overwriting it with v1; active legacy-key writes and in-session actions still work.

loadSnapshot reads generationDefaults through existing loadGenerationDefaults,
video through loadVideoDefaults, and raw IMAGE_MODEL_STORAGE_KEY under try/catch
(not loadImageModel, which would lose legacy workflow ids too early), then calls
reconcileCoreSelection. Reading does not write, including malformed JSON. It does
not consult the memory key: currently active legacy keys take precedence, so old
clients/rollback remain usable and changing another tab does not resurrect an
older remembered selection. Memory is consulted only for explicit provider switches.

persistCoreSelection calls existing saveImageModel, saveVideoDefaults({model:...})
and saveGenerationDefaultsPatch({provider,comfyWorkflow,comfyVideoWorkflow}). No
other settings enter that patch. Snapshot read/legacy writes are not a multi-key
transaction: crash or interleaving can leave mixed legacy fields; reconciliation
guarantees a legal pair on the next read, not exact last-click durability under
quota/crash. State is applied in one in-memory set. Do not advertise transactional
localStorage. Durable atomic storage would require a separate approved migration.

## NEW storeCoreSelectionImpl.ts and existing action diffs

This module imports pure policy and storage boundary, plus type-only StoreSet/Get.
It owns provider/image/video/workflow transitions only. Public signatures:

```ts
export function setCoreProviderSelection(provider: Provider, set: StoreSet, get: StoreGet): void;
export function setCoreImageSelection(model: ImageModel, set: StoreSet, get: StoreGet): void;
export function setCoreVideoSelection(model: string | undefined, set: StoreSet, get: StoreGet): void;
export function setCoreComfyWorkflowSelection(id: string | null, set: StoreSet, get: StoreGet): void;
export function setCoreComfyVideoSelection(id: string | null, set: StoreSet, get: StoreGet): void;
```

Private `commitSelection(current,next,set,clearSlot?:"image"|"video")` loads memory; merges current under its
provider (before active fields are cleared), merges next under its provider;
persistCoreSelection(next); set(next) once. Only known selection fields are copied
from get(); do not pass/serialize the full AppState. Same-provider action may no-op
and must not clear workflows. Model action resolves target provider using
providerForImageModel, clears active video, reconciles and commits. Grok video
action preserves grok-api, chooses grok only when current lane is not a Grok lane,
and uses normalized requested model or existing GROK_VIDEO_MODEL_15 fallback.
Comfy actions explicitly target comfy; image action sets image workflow and clears
active Comfy video; video action sets video workflow and clears active Grok video.
Preserve the non-active Comfy image choice in memory when switching to video.
When merging memory, present image/video ids replace their respective slot,
absent ids preserve the previous inactive slot, and kind always follows the new
active selection. Explicit id=null clears the corresponding remembered slot in
that workflow action, rather than treating a deliberate clear as absence.
Concrete intent path: null image action passes clearSlot="image", null video action
passes "video"; non-null actions omit it. After merging outgoing/incoming slots,
delete that slot from next.provider's remembered entry BEFORE saving. The public
action signatures and v1 memory schema remain unchanged.

Before storeSettingsImpl `:358`: long setProviderImpl branch tree; `:488` model
setter unconditionally chooses grok; `:546` video action lacks get argument.
After: keep their public exports and clearMcpLane call, delegate to corresponding
new selection action. Add setComfyWorkflowImpl(id,set,get) wrapper. Update
setComfyVideoWorkflowImpl to accept get and update its single useAppStore wrapper.
All explicit core choices still leave MCP through the existing owner; hydrate and
storage sync NEVER call these interactive setters or clear MCP state.

Before useAppStore `:167-172`: three independent loads and Grok-first inference.
After: retain storedGenerationDefaults/storedVideoDefaults for unrelated controls,
but `const initialSelection = loadCoreSelectionSnapshot()` supplies provider,
imageModel, videoModelSelected, comfyWorkflow, comfyVideoWorkflow. Preserve the
assetGenProvider derivation against initialSelection.provider; do not initialize
assetGenModel from a Comfy id. Add `setComfyWorkflow: id => setComfyWorkflowImpl(id,set,get)`.

Before storeUIImpl `:66,82`: loadImageModel/loadVideoDefaults while retaining old
provider. After: loadCoreSelectionSnapshot once and spread that selection into the
existing set callback. Leave currentImage/inflight/history matching and duration,
resolution/aspect ratio intact. Do not call clearMcpLane or edit historical items.
`ui/src/App.tsx:125` before: listener recognizes only ima2.inFlight and
ima2.selectedFilename. After: additionally recognize GENERATION_DEFAULTS_STORAGE_KEY,
IMAGE_MODEL_STORAGE_KEY and VIDEO_DEFAULTS_STORAGE_KEY imported from the registry.
Do not react to the memory key: updating an inactive remembered choice is not an
active selection switch. Keep listener cleanup. Browser test changes storage in a
second same-origin page and waits for the first page's actual label change, proving
the event path rather than calling syncFromStorage directly.

## Display and request diffs

Before imageModels.resolveCoreModelValue on comfy: video prefix or imageModel.
After: video prefix or `comfyWorkflow ?? ""`; add optional comfyWorkflow input.
Before GenProviderModelSelect onModelChange tail: casts all values to ImageModel.
After, before static cast:

```ts
if (provider === "comfy") {
  setComfyWorkflow(value || null);
  return;
}
setImageModel(value as Parameters<typeof setImageModel>[0]);
```

Pass comfyWorkflow selector into resolveCoreModelValue. Preserve both prefix
constants and unavailable-row construction; do not erase a selection on catalog
fetch start/error/empty result. Existing offline rows remain disabled, unknown
selected row still names itself. An unselected Comfy lane uses the existing Select
placeholder prop, never displays GPT as if it were a Comfy workflow. Explicitly
change GenProviderModelSelect's model Select placeholder from `mcpProvider ? ... :
undefined` to `mcpProvider ? ... : provider === "comfy" ? t("mcp.chooseModel") : undefined`;
otherwise the new empty value still renders blank at baseline.

Before storeGenImpl `:113,320`: `model: s.imageModel`.
After both: `model: coreImageRequestModel(s)`; payload transport must omit undefined
as JSON already does. No extra network lookup on submit. This keeps model field
compatible with lib/providerOptions.ts:75. The helper is not used on historical
items or node-specific models; Comfy node remains unsupported through WP01.
R1-02 compile contract: use the real `AppState` import from storeTypes and the real
`s = get()` at BOTH generateMultimodeImpl and runGenerateImpl payload sites;
`coreImageRequestModel(s)` must typecheck without casts/non-null assertions. The
canonical helper declaration above is the only request-input signature. Extend
core-selection-reconcile.test.ts with absent, explicit undefined, null and selected
workflow carriers: JSON.stringify({model: coreImageRequestModel(input)}) is exactly
`{}` for absent/null/undefined Comfy and `{"model":"wf-selected"}` for selected
Comfy; oauth with stray workflow stays `{"model":"gpt-5.6-sol"}`. In actions tests,
capture both real transport payloads independently, including an AppState with
the workflow property omitted; no provider/network execution is needed.

The actual transport type must also accept runtime workflow ids (R1-02). Exact
ui/src/types.ts:237 change inside GenerateRequest, not the ImageModel union:
```diff
-  model?: ImageModel;
+  model?: string; // wire model id, including runtime Comfy workflow ids
```
MultimodeGenerateRequest inherits via Omit<GenerateRequest,"n">. Consumers are
api-generation.ts postGenerate/postGenerateStream/postMultimodeGenerateStream/
postEdit: all serialize this existing model field, none assign it back to static
selection. Server deserialization/validation stays providerOptions.ts; workflow
strings already belong to that wire contract. No new JSON field, storage migration
or node/video type change. The in-memory proof must overlay this transport type
too; optional helper alone still fails both payload-to-transport calls with TS2345.

Before generateImpl `:13`: if(videoModelSelected) runVideoGenerate.
After: run video when the active provider is Comfy and comfyVideoWorkflow is set,
or when a Grok lane has videoModelSelected. Before `:17`: classic && multimode &&
provider!==nai. After: retain all three AND
`PROVIDER_SURFACE_SUPPORT[s.provider].multimode.supported`. This prevents a hidden
Comfy multimode preference from steering to an unsupported endpoint while keeping
the saved preference for other lanes. Do not set multimode=false globally.
The custom-size continuation must use the same dispatch decision established
before showing the modal; do not introduce a second model-selection resolver there.

## Acceptance activation matrix (independent literals)

| Scenario / activation | Exact assertions | Owning test |
|---|---|---|
| Persist provider=grok-api, image=grok-imagine-image-quality, video=false; reload | provider stays grok-api, same model; no grok requests | pure + actions + J6 |
| Same provider, video=grok-imagine-video-1.5-preview | provider grok-api, video normalized to grok-imagine-video-1.5 | pure + reload |
| Persist oauth with stray Grok video and both Comfy ids | oauth/GPT model; active video false and active workflows null; read does not modify raw storage | pure + storage |
| No valid provider and legal Grok image | infer grok, preserve image; explicit gemini-api instead wins and chooses nano-banana-pro | pure, distinct fallback values |
| grok-api user clicks different Grok image | retain grok-api, persist new image, active video false | actual setter + J6 |
| grok-api user clicks gpt-5.6-sol | oauth/gpt-5.6-sol; api clicking same GPT model stays api | actual setter, separate fixtures |
| Comfy legacy raw imageModel=wf-image, provider=comfy | comfyWorkflow=wf-image, static imageModel valid; request.model=wf-image | snapshot + payload |
| Comfy workflow absent from runtime catalog | retain id across load/empty/error/offline; no auto-selection; trigger names id | pure + J6 |
| Comfy image pick while Comfy video selected | comfyWorkflow=new-id, comfyVideoWorkflow=null; generate invokes runGenerate not runVideoGenerate | actions + dispatch spy |
| Comfy video pick, generate with multimode=true | request provider=comfy, model=wf-video via existing video builder; no Grok or multimode call | action + J6 payload |
| Comfy A→OAuth→Comfy | outgoing active fields null on OAuth, remembered A survives, return restores A; same-lane reselect unchanged | actual setters + storage + J6 |
| Identical Comfy imageA/videoV input: select imageA versus clear video with null | both active states imageA/video-null; image selection retains rememberedV, explicit video clear deletesV; leave/return obeyskind; symmetric image-null clears only rememberedimage | paired real actions + raw storage + leave/return |
| No remembered Comfy selection, catalog has multiple workflows | no workflow auto-picked, no hidden default request | pure + J6 |
| NAI selected with saved multimode=true and count=4 | existing direct generation dispatch remains; preference/count stored unchanged; NAI payload n=1 remains | dispatch spy + payload |
| Storage sync changes provider from oauth to gemini-api with nano-banana-pro | provider/model update together in one set; MCP fields, history metadata, selectedFilename and dirty prompt unchanged; actual second-tab storage event changes first-tab label | sync action + J6 |
| Memory JSON malformed, unknown version, unknown provider, unsupported static id | safe empty/filtered memory; raw key not overwritten on read; no throw | storage boundary |
| localStorage.setItem throws quota error | action still updates legal in-memory state; no removeItem/clear calls | actual action |
| Select history item with dirty prompt or custom model metadata | current selection and stored item metadata unchanged, existing composer policy preserved | action + existing history tests |

NEW core-selection-reconcile.test.ts table-drives the pure functions with expected
literal provider/model/workflow outputs. Assert idempotence, no mutation of inputs,
and that all static fallbacks belong to lane-supported ids. Expected values must
not call reconcileCoreSelection or providerForImageModel. Fixture defaults and
overrides differ (sol/terra/luna; wf-first/wf-selected/wf-missing).

NEW core-selection-actions.test.ts uses actual exported actions, not extracted
function bodies or source regexes. Bundle real entry modules in-memory with the
existing esbuild installation, write:false, browser platform, Vite env definitions
as in 001; import their output; inject only Map-backed localStorage and set/get
state fixture. Record every write, ban fetch, and restore globals in finally.
Assert stored JSON values and in-memory state independently. If bundling becomes
unavailable, move action proof to existing J6 browser harness; do not add a test
package or fake the action implementation to make the test green.

J6 additions use startApp/seedBrowser with fixture-only catalogs and captured
requests; no real generation. Drive actual provider/model controls, reload, and
observe text + request body. Retain J6-S1/S2/S3 existing assertions. Add screenshots
of missing-workflow id, Comfy→GPT→Comfy, and Grok API model label after reload at
desktop plus narrow viewport; inspect images, not just screenshot exit status.
No workflow/catalog existence assertion may compare against the static Comfy [].

### Mandatory early J6 isolation preconditions (main-approved ordering)

Before WP09 exists, J6 runs ONLY on an isolated GitHub runner or equivalently
isolated copied checkout. A second browser profile, alternate port or temporary
IMA2_CONFIG_DIR on the maintainer's credential-bearing checkout is NOT sufficient.
Baseline `ui/e2e/fixtures/appServer.ts:109` spreads process.env and `:127` spawns
server.ts from the parent checkout; it does not itself prove isolation.

Before starting any fixture process, main records these conditions in C evidence:

1. Fresh/copied source checkout has no `.env` or other loadable dotenv overrides,
   provider secrets, legacy user configuration, auth stores or credential-bearing
   mounts. Do not copy the user's home/config into it. Provider-secret environment
   variables are absent, not merely masked in logs. Process environment and actual
   OS home resolution point to a disposable synthetic home with no legacy config;
   IMA2_CONFIG_DIR alone does not satisfy this. Record paths and pass/fail facts,
   never secret values. Only clearly fake fixture values may subsequently be seeded.
2. Do not attach to live3333, a shared browser, an existing service, or a saved
   signed-in context. Start the fixture on its own ephemeral loopback port and use
   a new browser context with service workers blocked. No automatic OAuth/Grok
   startup, login/reauth flow, provider probe or production-provider execution is
   allowed as a way to make a selector ready; readiness/catalog responses are fixtures.
3. Install context-level capture routes BEFORE the first navigation, including
   any second page used for the storage-event scenario. Match method plus exact
   origin/path. Expected POST `/api/generate` and `/api/video/generate` requests
   are recorded and fulfilled with deterministic fixture responses; they NEVER
   use continue/fallback/fetch or reach real server generation handlers. Any other
   generation/edit/node/multimode/MCP mutation is recorded, aborted and fails the
   case. Default-deny unexpected API mutations and non-fixture origins. A count of
   zero unexpected requests is a required assertion, not silent suppression.
4. Fulfill async accepted responses and required `/api/events`/inflight/history
   updates from the same fixture contract when a case needs completion; otherwise
   assert submission capture only and make no completion claim. Use deterministic
   requestId correlation, not sleeps. No response generator invokes a provider.
5. Record runner/copied-checkout identity, synthetic-home/config paths, ephemeral
   fixture origin, installed route scope, expected captured payloads, unexpected
   call count, screenshots and process/context teardown. If any prerequisite is
   unproven, browser C is BLOCKED; retain safe pure tests but do not substitute a
   run against the user's checkout or credentials. No early browser run occurred
   during this documentation amendment.

Minimal helper scope, only if existing fixtures cannot express the above: MODIFY
`ui/e2e/fixtures/appServer.ts` and `ui/e2e/j6-model-select-label.spec.ts` in WP02.
Add typed fixture entries for image/video workflow catalogs and a narrow helper
`installJ6SelectionCapture(context: BrowserContext, fixtureOrigin: string):
Promise<{ requests: Array<{ path: string; body: unknown }>; unexpected: string[];
dispose(): Promise<void> }>`; request bodies are narrowed in tests before assertions.
The helper installs the strict fixture routes above; dispose removes only its own
handlers. Existing non-J6 startApp behavior is not broadened. A route fixture is
not an OS egress/process sandbox; the isolated execution environment remains a
separate mandatory precondition. New helper files, workflow changes or a reusable
isolation runner require a plan amendment rather than unlisted WP02 writes.
WP09 consumes these typed entries and owns durable full network/process isolation;
WP02 does not claim to have delivered that later infrastructure.

## Baseline and future verification commands

Run/observed in WP00 (001): four targeted registry/selection files → exit 0,
22 tests; models endpoint → exit 0, 11 tests; server and UI noEmit → exit 0;
provider generator --check → exit 0. Direct tsx store import → exit 1 (Vite env),
full in-memory bundle with env object → exit 0 and both S02 defects reproduced.
Those are baseline observations, not fixes or future-test passes.

Future new command:
`node --import tsx --test tests/core-selection-reconcile.test.ts tests/core-selection-actions.test.ts`.
Not run in WP00: files do not exist yet. The direct test arguments observe these
targets; typecheck tsconfig.tests includes tests/**/*.test.ts. Existing UI check
`./ui/node_modules/.bin/tsc --noEmit -p ui/tsconfig.app.json` observes src including
new modules. Re-run generator --check to prove WP01 projection remains intact.
R1-02 A-proof uses TypeScript's in-memory CompilerHost: overlay the proposed helper
and GenerateRequest.model plus both real storeGenImpl payload replacements; add a virtual type-only import
of actual AppState and call the helper with that declared value. Compile under
ui/tsconfig.app.json (`include: ["src"]`, strict=true), noEmit, with no disk writes
or module execution. Required-input variant must reproduce TS2345; optional-input
variant must have zero diagnostics. This is signature/caller proof only, not a
claim that future reconciliation/action tests or the whole WP02 are implemented.
WP00 A round1 observed: in-memory actual UI compile with the transport-type fix
gave required-input TS2345 x3 (AppState probe + both payloads), optional-input
diagnostics=[]; command `node --input-type=module` + CompilerHost/noEmit exited0.
Future J6: `cd ui && npx --no-install playwright test e2e/j6-model-select-label.spec.ts`;
run ONLY inside the isolated runner/copied checkout after every mandatory J6
precondition above is proven. Existing test path is real, but this command is
intentionally not run in WP00 or the maintainer's live/credential context. Parent
records actual exit, captures and screenshots during WP02 C. Inventory follows edits.
Full suites/build/release gates remain main-owned exact-head CI/remote checks.
`npm run test:inventory` was subsequently run at WP00 baseline and exited 0;
the future post-edit inventory receipt is still required. Direct Markdown reads
also confirmed all MODIFY/DELETE paths exist, balanced fences and no trailing
whitespace, exit 0. The unit is gitignored; ordinary git diff does not verify or
stage these docs. Parent owns their explicit inclusion in the WP00 PR.

## Field chain, compatibility and rollback

New memory key creation: persistenceRegistry + explicit core action snapshot.
Serialization: version:1, known provider keys, lane-owned ids/kind only.
Deserialization: guarded loadCoreSelectionMemory, no static Comfy membership test.
Consumers: explicit setProvider transition only; no catalog effect, history reader,
MCP hydration or server consumer. Workflow action creation: dropdown → wrapper →
action → active comfyWorkflow → generationDefaults → snapshot → display/request.
Both image/video carriers are covered; no new provider/model enum value is added.

Older clients continue reading legacy active keys; new clients prefer those same
keys over remembered choices on load. New key is ignored by old builds. Reverting
WP02 code leaves memory data untouched and current legacy preferences readable;
no bulk localStorage clear, downgrade rewrite, history rewrite or credential reset.
Quota/crash can lose last preference changes, but never justifies clearing all
settings. Missing runtime choices stay visible and server-validatable, not silently
substituted with potentially paid hosted generation.

Bypass record: E7 design/review and client-state early warning; executing surface
is browser state boundary; direct API clients bypass it; raw DevTools edits can
still inject invalid values after normalization. Residual risk is handled by
existing server provider/workflow validation plus WP03, not trusted client state.
Wording: consistency guarantee for named entry paths, not a security boundary or
upstream-success claim. Final enforcement layer: server request validation.

At C update the two named structure files and runtime test inventory with new
owners and observed assertions. Human-review SoT consistency (not phrase tests).
Cross-lane agreement required: WP08 must use dedicated comfyWorkflow for images,
not reintroduce the ImageModel cast; WP03 must continue accepting raw workflow ids
in request.model; WP09 fixture changes must not collide with WP02 J6 additions.
