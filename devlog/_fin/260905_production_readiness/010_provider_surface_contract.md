# WP01 — honest shared provider surface contract

Status: WP00 design only; independently derived at `ecde2bc7`. No future code implemented.
Class: C3 shared contract; HTTP rejection changes receive C4 boundary scrutiny.
Archetype: satisfy-spec. Trigger: generation-only NAI is encoded as edit-capable;
UI/API callers duplicate exclusions. Goal: the same executable surface facts
drive API metadata, existing rejection boundaries and the reference tray.
Non-goals: credentials, availability probing, new provider operations, MCP,
workflow catalog unification, video mode limits, or wholesale pipeline rewrite.
Verifier: focused contract/route tests and generated projection comparison below.
Stop: each activation assertion passes on source and built runtime in C; independent
review confirms no excluded surface opened. Memory artifact: this decade doc and
001 research. Terminal outcomes: verified / blocked / replan, not global readiness.
Escalation: parent resolves signature conflicts or scope growth; worker cannot
delegate or advance FSM. Resource/authority limits inherit 000; no paid requests.

## Dependency and boundary contract

Semantic prerequisite: none beyond the baseline; stack base: WP00 docs PR.
Downstream WP02/WP03/WP08 import this contract; other WPs inherit the git stack
without implying a semantic dependency. Existing public exports remain intact.
Main's final seam decision: WP03 owns both NEW server behavior corrections
(missing grok-api direct key must fail, NAI multimode references must be refused).
WP01 supplies policy metadata and rewires existing guards only. WP02 is UI-only.

```ts
// lib/providers/types.ts — canonical type owner
export type ProviderSurface = "generate" | "edit" | "multimode" | "node" | "video";
export interface ProviderSurfaceSupport {
  supported: boolean;
  references: boolean;
  mask: boolean;
  streaming: boolean;
  catalogAccess: "static" | "runtime";
}
// lib/providers/derive.ts — server consumers import here
export function getProviderSurfaceSupport(
  providerId: string, surface: ProviderSurface,
): ProviderSurfaceSupport | null;
```

Execution lane 030 passes its resolved CoreProviderId (a subtype of string);
map execution surface `classic` to policy surface `generate`, and keep
`node`/`edit`/`multimode` unchanged. The getter has no auth or readiness side effects.
The string input intentionally lets public discovery callers distinguish unknown
ids via null; it is not permission for 030 to accept unvalidated strings or auto.

`supported` means the application dispatches this provider on this API surface,
not that credentials/model entitlement/liveness are ready. `references` means
some valid request on this surface can carry image input, not every workflow
accepts it. `mask` means the edit endpoint accepts masks. `streaming` means this
surface can deliver partial images through its existing callback path: true
only for OAuth/API multimode/node at baseline, not a claim about lifecycle SSE,
wire-level `stream:true`, or guaranteed progress on every request. Image/edit
currently await final results even though their upstream Responses body streams.
`null` means unknown/non-core id (`auto`, MCP ids included); caller retains its
existing provider resolution/error path. Never fall back to OAuth on null.

Core model support additionally gains required `generate: boolean`; it means
the model's own image/video kind can generate. This makes NAI generate=true,
edit=false honest without changing the supported model list.

## Exact change map (future WP01 only)

| Action | Exact path | Diff responsibility |
|---|---|---|
| MODIFY | `lib/providers/types.ts` | Add the two types above, generate bit, and manifest `surfaces: readonly ProviderSurface[]`. |
| MODIFY | `lib/providers/registry.ts` | Populate surfaces for all ten lanes; set NAI generation-only; leave runtime Comfy models empty. |
| MODIFY | `lib/providers/deriveCore.ts` | Supported/unsupported image derivation reads generate, remove supportsAnything sentinel helper. |
| NEW | `lib/providers/surfaceSupport.ts` | Pure projection design below; no runtime imports or I/O. |
| MODIFY | `lib/providers/derive.ts` | Registry-bound getter, importing pure projector and canonical types. |
| MODIFY | `lib/providers/adapters/comfy.ts` | Runtime listModels adds generate:true to each existing image workflow; preserves edit=Boolean(refImage). |
| MODIFY | `scripts/generate-provider-types.mjs` | Use explicit generate bit and pure projection for generated surface map; --check remains read-only. |
| MODIFY | `ui/src/generated/providers.ts` | Generator-owned map plus type-only canonical exports; no manual edits. |
| MODIFY | `lib/capabilities.ts` | Add top-level providerSurfaces for core lanes; keep runtime lanes optional and all existing fields. |
| MODIFY | `routes/models.ts` | Add optional surfaces to ModelLaneDto; populate only core lanes; derive static input roles from references. Preserve Comfy binding projection. |
| MODIFY | `ui/src/lib/referenceLimits.ts` | Replace NAI hardcoded exclusion with generated generate.references. Keep MCP-first ordering and numeric caps. |
| MODIFY | `routes/edit.ts` | Replace supported-mask/NAI-edit predicates with getter results, retaining existing error builders/order. |
| MODIFY | `lib/generatePipeline.ts` | Replace NAI no-reference predicate with generate.references=false; retain NAI error shape and code. |
| MODIFY | `lib/multimodePipeline.ts` | Existing Comfy early-surface rejection reads supported=false; no dispatch refactor. |
| MODIFY | `lib/nodeGeneration.ts` | Existing Comfy early rejection and NAI reference rejection read node support; keep nested errors. |
| MODIFY | `tests/provider-registry-contract.test.ts` | Update fixture manifests with surfaces/generate; independent generation-only fixture assertions. |
| MODIFY | `tests/provider-registry-parity.test.ts` | Assert NAI edits false and existing model ids/caps unchanged; retain credential/mask checks. |
| MODIFY | `tests/models-endpoint-contract.test.ts` | Assert serialized core surfaces and runtime Comfy role behavior against literals. |
| MODIFY | `tests/capabilities-lane-contract.test.ts` | Check additive providerSurfaces with local/server source semantics. |
| NEW | `tests/provider-surface-support.test.ts` | Pure contract and UI reference-limit assertions, design below. |
| NEW | `tests/provider-surface-boundary.test.ts` | Actual rejection routes with trapped network and fixture runtime, design below. |
| MODIFY | `tests/comfy-routes-contract.test.ts` | Replace only obsolete lexical Comfy predicates with pointer to stronger boundary tests; keep remaining route tests. |
| MODIFY | `docs/migration/runtime-test-inventory.md` | Register the two new TS runtime tests via existing inventory convention. |
| MODIFY | `structure/01-file-function-map.md` | Add surfaceSupport owner/dependents; remove stale sentinel explanation. |
| MODIFY | `structure/03-server-api.md` | Explain providerSurfaces and API-vs-readiness semantics. |
| MODIFY | `structure/04-frontend-architecture.md` | Reference tray now derives capability exclusion, not empty capacity maps. |
| MODIFY | `docs/API.md` | Document additive metadata shape and exact non-supported boundaries. |
| DELETE | none | Do not delete exported types, registry ids, adapter APIs, tests or compatibility routes. |

Generated JS companions for changed server TS are build outputs under the existing
tsconfig.build policy, not hand-edited source; verify package runtime in C. Files
already above size limits get bounded local changes only; their general split is
not part of this contract outcome. New projector stays below 100 lines.

## Diff-level implementation

### Registry and derivation

Before `types.ts`: `supports: { edit: boolean; mask: boolean; streaming: boolean }`.
After: `supports: { generate: boolean; edit: boolean; mask: boolean; streaming: boolean }`.
Before registry EDIT/RESPONSES/UNSUPPORTED: triples with no generate.
After EDIT/RESPONSES add generate:true; UNSUPPORTED adds generate:false;
new `GENERATE_ONLY = { generate: true, edit: false, mask: false, streaming: false }`.
All four NAI entries use GENERATE_ONLY; Spark remains all-false.

Add `surfaces` after each manifest id using these exact values:

| Providers | surfaces |
|---|---|
| oauth, api, agy, gemini-api, atlascloud, minimax | generate, edit, multimode, node |
| grok, grok-api | generate, edit, multimode, node, video |
| nai | generate, multimode, node |
| comfy | generate, edit, video |

`deriveSupportedImageModelsFrom`: replace `supportsAnything(model.supports)` with
`model.supports.generate`; unsupported derivation negates the same field. Do not
change deriveModelsFrom (all catalog entries, including Spark) or aliases.
`adapters/comfy.ts:62` adds generate:true beside its per-workflow edit flag.

### NEW lib/providers/surfaceSupport.ts — complete implementation design

```ts
import type { CoreProviderManifestBase, ProviderSurface, ProviderSurfaceSupport } from "./types.js";

export const PROVIDER_SURFACES = ["generate", "edit", "multimode", "node", "video"] as const;

export function deriveProviderSurfaceSupportFrom(
  registry: readonly CoreProviderManifestBase[],
  providerId: string,
  surface: ProviderSurface,
): ProviderSurfaceSupport | null {
  const provider = registry.find((entry) => entry.id === providerId);
  if (!provider) return null;
  const catalogAccess = provider.catalogAccess ?? "static";
  const runtime = catalogAccess === "runtime";
  const models = provider.models.filter((model) => model.kind === (surface === "video" ? "video" : "image"));
  const runnable = runtime || models.some((model) => surface === "edit" ? model.supports.edit : model.supports.generate);
  const supported = provider.surfaces.includes(surface) && runnable;
  return {
    supported,
    references: supported && (runtime || models.some((model) => model.supports.edit)),
    mask: supported && surface === "edit" && models.some((model) => model.supports.mask),
    streaming: supported && (surface === "multimode" || surface === "node") && models.some((model) => model.supports.streaming),
    catalogAccess,
  };
}
```

`derive.ts` adds a direct wrapper returning
`deriveProviderSurfaceSupportFrom(REGISTRY, providerId, surface)`. No class,
request execution, config import, auth status or generic strategy factory.
The pure file's type-only import is erased by transpilation, so the existing
generator's data-URL module loading can load it without resolving runtime imports.

### Generation and serialization

Before generator `:32`: supportedImages uses Object.values(supports).some(Boolean).
After: only model.supports.generate. Factor current loadRegistry source-transpile
logic into `loadTsModule(relativePath)`; load the registry and pure projector,
then retain buildOutput(registry) plus a `surfaceSupport` argument. Construct
the map by iterating registry ids and PROVIDER_SURFACES through the projector.
Generated output adds only:

```ts
import type { ProviderSurface, ProviderSurfaceSupport } from "../../../lib/providers/types";
export type { ProviderSurface, ProviderSurfaceSupport } from "../../../lib/providers/types";
export const PROVIDER_SURFACE_SUPPORT = /* literal generated map */ as const
  satisfies Record<CoreProviderId, Record<ProviderSurface, ProviderSurfaceSupport>>;
```

The comment above describes a generator substitution, not a placeholder to ship.
Keep all prior generated exports and exact model union members. No credential
manifest object is emitted. `buildIma2Capabilities` adds
`providerSurfaces: Object.fromEntries(deriveProviderIds().map(id => [id,
Object.fromEntries(PROVIDER_SURFACES.map(surface => [surface,
getProviderSurfaceSupport(id, surface)]))]))` using the public getter.
`lanes` remains runtime-only/optional; static providerSurfaces exists in local mode.

`ModelLaneDto` adds `surfaces?: Record<ProviderSurface, ProviderSurfaceSupport>`.
In buildCoreLanes collect existing lanes, then decorate each with its projection;
MCP builders remain unchanged. For static image entry construction, change default
`["text", "image_references"]` to the provider's generate.references ? both : text.
Pass provider id explicitly to `entries` at every static image caller (oauth/api,
grok, agy, gemini-api, atlascloud, minimax, nai); preserve explicit video caps.
Do not replace Comfy projectWorkflow or its bind.refImage test with lane-wide true.

### Existing request and UI consumers

`referenceLimits.ts` before: LANES_WITHOUT_REFERENCE_SUPPORT.has(provider).
After: `!PROVIDER_SURFACE_SUPPORT[input.provider].generate.references`; remove the
hardcoded set. Preserve serverLimit, all provider numeric caps, and MCP-first
branch; video requests still use mode-specific video owners.

`routes/edit.ts:191` before: eight-provider disjunction && rawMask.
After: `getProviderSurfaceSupport(activeProvider, "edit")?.mask === false && rawMask`.
Preserve existing provider code/label selection and 400 envelope. At `:204`, use
`...?.supported === false` in the NAI-edit refusal; currently NAI is the only known
core lane that rejects this whole surface. Existing unknown-provider handling
runs first. Preserve mask refusal BEFORE NAI_EDIT_UNSUPPORTED.

`generatePipeline.ts:329` uses `...("generate")?.references === false && providerRefCount > 0`.
`nodeGeneration.ts:192` uses `...("node")?.references === false && inputImageCount > 0`.
Both keep NAI_REF_UNSUPPORTED and current payload shape. Existing Comfy surface
guards in node/multimode become `...?.supported === false` at the same position,
before providerOptions and any dispatch, preserving COMFY_SURFACE_UNSUPPORTED.
WP03 later owns a new NAI multimode reference guard; WP01 does not claim the
advertisement alone prevents that known silent-drop path.

## Field chain, threat boundary and bypass accounting

Creation: types/registry plus Comfy runtime adapter create generate/surfaces.
Serialization: generator emits only surface facts; capabilities and models serialize
allowlisted projections. Deserialization: existing jsonFetch consumers ignore added
fields; referenceLimits uses build-time typed projection, not unvalidated network
booleans. Consumers: deriveCore, generator, capability/model API, four existing
rejection owners, UI referenceLimits. MCP/auto return null; no new enum values in
provider ids or persistence. Model aliases and runtime workflow ids are unchanged.

Threat: a stale/hostile client bypasses UI and submits an unsupported operation,
potentially billing another lane or dropping input. Asset: intended provider and
reference input, not authentication state. Controls remain server route guards.
Bypass record: E7 design/review and client-side early warning; executing surfaces
are UI and existing server handlers; direct API calls bypass UI; downstream direct
adapter calls bypass route guards; residual NAI multimode reference gap belongs
to WP03. Wording: no universal enforcement/security claim. Final layer: existing
named server guards only, not this metadata document.

## Activation and independent assertions

NEW provider-surface-support.test.ts imports the pure projector, real registry,
generated map and effectiveReferenceLimit. Hand-author expected rows, never obtain
expectations with the projector under test. Cases:

1. NAI generate: true/false/false/false/static; edit all false/static; all four
   NAI ids remain supported; Spark remains unsupported. A fixture model with only
   generate:true must remain supported even with no edit/mask/streaming bits.
2. Comfy generate/edit/video supported, references true (conditional workflow),
   mask/streaming false/runtime; multimode/node all false/runtime; static ids []
   even with two supplied workflow fixtures elsewhere. Unknown id returns null.
3. OAuth/API edit mask true but streaming false; node/multimode streaming true.
   Grok generate/edit references true, masks false; grok video supported;
   gemini-api video unsupported. Check all 50 rows against a hand-written matrix.
4. effectiveReferenceLimit with serverLimit=12 returns nai=0, oauth=12,
   atlascloud=10, minimax=1, comfy=4, MCP=3. These different numbers detect a
   mistaken fallback. Generated map equals canonical projection as a drift check,
   in addition to independent literals (not as the sole semantic oracle).

NEW provider-surface-boundary.test.ts reuses the ephemeral Express/context pattern
in tests/api-provider-parity.test.ts, with a fake upstream that records calls and
fails any unexpected request; never use actual provider credentials. Send valid
prompt/image shapes to avoid earlier INVALID_EDIT_INPUT masking the tested branch.
Assert: Comfy node and multimode return 400 COMFY_SURFACE_UNSUPPORTED with zero
upstream calls; NAI edit with source/no mask returns NAI_EDIT_UNSUPPORTED; with
source/truthy mask returns NAI_MASK_UNSUPPORTED; NAI generate reference and node
parent-image return NAI_REF_UNSUPPORTED, no job/dispatch. At node parent activation
seed an actual fixture parent image, not a nonexistent parent consumed earlier.
Include oauth/api positive masked-edit forwarding fixture with independent captured
request assertions; mocks prove routing/serialization only, not upstream success.

Existing models endpoint tests add two Comfy graphs, one with refImage and one
without, plus one video workflow; assert partition and exact inputRoles despite
both sharing the same lane-wide surface record. A disconnected lane still returns
the same supported facts. Capability local mode has providerSurfaces but no lanes.

## Verifiers and baseline receipts

Observed WP00: generator --check exit 0; server and UI noEmit checks exit 0;
22 registry/selection tests and 11 models endpoint tests pass (001 has exact commands).
They inspect current source, not future implementation or this prose.

Future additional direct test command:
`node --import tsx --test tests/provider-surface-support.test.ts tests/provider-surface-boundary.test.ts`.
Not executable at WP00 because the named new files do not exist; status is
PENDING, never a claimed baseline pass. Existing `npm run test:inventory` must be
run after inventory edits. Generated runtime/build checks must be run by main in
C, not during this documentation task. Full suites run only exact-head CI/approved
remote host. For reference-tray visual interaction, main must observe NAI no-attach
and OAuth attach affordances; no screenshot has been taken in WP00.

WP00 final document check: direct reads of the three assigned Markdown files
confirmed balanced fences, no trailing whitespace and all MODIFY/DELETE paths
existing, exit 0. `npm run test:inventory` also exited 0 on the unchanged baseline;
it checks inventory, not these documents. This devlog unit is gitignored, so
`git diff --check` exit 0 alone does NOT observe the new plan content. Parent owns
explicit admission of the docs into its WP00 PR; this leaf did not stage anything.

## Compatibility, rollback and SoT sync

No API removals, provider renames, active defaults or on-disk data changes. Existing
CLI ignores additive metadata. Older UI stays compatible; newer UI uses generated
facts, so capability-fetch failure cannot change selection. Revert WP01 source and
regenerate UI projection together if tests expose behavior drift; do not revert
30190da8/684af450 or ecde2bc7. No data rollback/migration necessary.
At C update named structure/API/inventory paths with the deployed shape and test
evidence; prose checks are human review, not phrase-existence tests. WP03/WP08 must
acknowledge the exact signature and NAI API/UI distinction before roadmap lock.
