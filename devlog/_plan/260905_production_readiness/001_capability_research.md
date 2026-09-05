# WP00 capability and selection research

Status: independently source-derived design evidence, not implementation completion.
Date: 2026-09-05. Baseline: `ecde2bc79cddc50ff0da38091c1ce0590383090c`.
Scope: WP01/WP02 only; parent owns orchestration, review, git and release.
The unverified execution-lane drafts are not evidence for these findings.

## Sources and boundaries

The working layout is `lib/providers/{types,registry,deriveCore,derive}.ts` →
`scripts/generate-provider-types.mjs` → `ui/src/generated/providers.ts`.
Server consumers include `lib/imageModels.ts`, `lib/capabilities.ts`,
`routes/models.ts`, `lib/providerOptions.ts`, generation pipelines and adapters.
UI consumers include `ui/src/lib/imageModels.ts`, `referenceLimits.ts`,
`storePersistence.ts`, `storeSettingsImpl.ts`, `useAppStore.ts`,
`storeUIImpl.ts`, and `GenProviderModelSelect.tsx`.

Existing SoT: `structure/00-structure-hub.md`, `03-server-api.md:99,301`,
`04-frontend-architecture.md:221,262`; preserve those owners rather than creating
another architecture folder. Runtime facts below were checked in source at the
baseline, not inferred from older SoT snapshots or external provider claims.

## Findings with verified anchors

| ID | Evidence | Consequence |
|---|---|---|
| C01 | `lib/providers/types.ts:46` has only edit/mask/streaming; `deriveCore.ts:24,30,64` treats any true flag as generation support | A generation-only model cannot be represented honestly. |
| C02 | `lib/providers/registry.ts:200` explicitly assigns NAI the EDIT sentinel so generation remains listed | Add an explicit generate bit and make NAI edit false; do not remove its four legal models. |
| C03 | `lib/providers/registry.ts:235` declares Comfy `models: []`, `catalogAccess: "runtime"`; `routes/models.ts:302` loads registered workflows | Empty static sets do not mean unavailable, unsupported, or a request to select GPT. |
| C04 | `routes/models.ts:88` defaults input roles to text+references; NAI explicitly uses text-only at `:273`; Comfy projects `bind.refImage` at `:340` | Preserve runtime per-workflow roles and NAI exclusion while deriving static lane roles. |
| C05 | `lib/multimodePipeline.ts:163`, `lib/nodeGeneration.ts:75` reject Comfy; `routes/edit.ts:304` actually dispatches Comfy i2i | Comfy image/edit/video are supported surfaces; multimode/node are not. Do not broaden based on a generic adapter method. |
| C06 | `routes/edit.ts:191,204`, `lib/generatePipeline.ts:329`, `lib/nodeGeneration.ts:192` preserve NAI mask/edit/reference errors | New contract must retain error precedence and envelopes. |
| C07 | `lib/multimodePipeline.ts:418` calls NAI without forwarding references; no NAI reference guard in that pipeline | API text-only multimode exists, but reference-bearing multimode can silently drop input. Execution lane WP03 must close this explicitly. |
| C08 | `ui/src/store/storeGenerateEntryImpl.ts:17` excludes NAI from hidden persisted multimode preference | API support and product UI exposure are different. Do not use API supported=true to re-enable NAI UI multimode. |
| C09 | `ui/src/lib/referenceLimits.ts:40` hand-codes NAI exclusion, while OAuth/API also have empty referenceLimits | Empty reference limit maps cannot encode no-reference capability; a boolean contract is necessary. |
| C10 | `lib/generatePipeline.ts:530`, `routes/edit.ts:340` do not supply partial-image callbacks; node `:380` and multimode `:470` do | Distinguish upstream wire streaming from client-visible partial-image support and from lifecycle SSE. |
| C11 | `lib/grokImageCore.ts:62` and `lib/grokVideoShared.ts:113` select proxy when directApiKey is absent; `lib/providerOptions.ts:116` has no grok-api key refusal | Main assigns pre-dispatch missing-direct-key refusal and no-billing-reroute tests to WP03, not UI WP02. |
| S01 | `ui/src/store/useAppStore.ts:167` loads separate blobs, then `:170` forces any video or Grok image selection to grok | A saved grok-api choice loses its authentication lane on reload; valid explicit provider must win over legacy inference. |
| S02 | `ui/src/store/storeSettingsImpl.ts:493` always picks grok for a Grok image; `:525` omits grok-api from the OpenAI return branch | A Grok image click changes grok-api to grok; an OpenAI click can leave grok-api paired with a GPT model. Both reproduced below. |
| S03 | `storePersistence.ts:173` validates only global ImageModel membership; `storeUIImpl.ts:66,82` reloads model/video but not provider | Independently valid persisted fields can form an invalid pair after reload or storage sync. |
| S04 | `GenProviderModelSelect.tsx:294` casts every non-video core value into setImageModel; Comfy has no implemented setComfyWorkflow action (only a comment at `storeSettingsImpl.ts:430`) | Comfy image selection is currently stored through a static-model field; loadImageModel rejects it on reload. Existing comfyWorkflow field is the proper owner. |
| S05 | `storeGenImpl.ts:113,320` sends `s.imageModel`; `storeVideoImpl.ts:40` already branches on comfyVideoWorkflow | Fixing only display/persistence leaves Comfy image requests wrong; WP02 must project comfyWorkflow into the existing request model field. |
| S06 | `storePersistence.ts:93` history composer patch contains only prompt/inserted prompts; `storeHistoryImpl.ts:124` preserves dirty drafts | Do not introduce model reconciliation into stored history metadata, or make gallery selection overwrite active lane. |
| S07 | `ui/src/App.tsx:125` only invokes storage sync for inFlight/selectedFilename | WP02 must subscribe to selection keys too; testing syncFromStorage in isolation cannot prove cross-tab activation. |

## Existing fixes that remain invariants

`git show --stat 30190da8` and `git show --stat 684af450` were read directly.
The first separates displayed values by provider in `resolveCoreModelValue`
(`ui/src/lib/imageModels.ts:195`) and clears active Comfy carriers on outbound
transitions. The second retains a named fallback row for a workflow absent from
the current catalog (`GenProviderModelSelect.tsx:438`), with the unavailable
explanation in the row title rather than a trigger badge obscuring the id.

Preserve both behavioral guarantees. A remembered inactive workflow is different
from a stray active workflow: WP02 may remember the former in a lane-specific
selection store but must still clear the latter when leaving Comfy. Missing or
offline catalog entries must not erase user choices or auto-pick another graph.
Existing `tests/model-select-lane-gating.test.ts` has real resolver assertions
plus lexical setter checks. `tests/comfy-selection-persistence.test.js` is
lexical only. Those checks do not prove actions or reload behavior.

## Observed baseline commands

All commands were run locally without full suites, provider generation, shared
browser interaction, or reading credential files. Node reported `v24.17.0`.

| Command | Exit / observed result | What it observes |
|---|---|---|
| `git status --short; git rev-parse --abbrev-ref HEAD; git rev-parse HEAD` | 0; branch codex/prod-wp00-roadmap, baseline SHA above; pre-existing `?? scripts/recording/` | Checkout identity only; that directory was not touched. |
| `node --import tsx --test tests/provider-registry-contract.test.ts tests/provider-registry-parity.test.ts tests/model-select-lane-gating.test.ts tests/comfy-selection-persistence.test.js` | 0; 22 tests, 0 failures | Direct test paths and imported registry/resolver; some assertions are source-text checks. |
| `node --import tsx --test tests/models-endpoint-contract.test.ts` | 0; 11 tests, 0 failures | Real local Express endpoint with injected catalog/liveness fixtures, no upstream generation. |
| `node scripts/generate-provider-types.mjs --check` | 0 | Reads registry and generated UI artifact; no writes. |
| `npm run typecheck` | 0 | tsconfig includes lib/routes/bin/server/config TS; excludes UI/tests/scripts/Markdown. |
| `./ui/node_modules/.bin/tsc --noEmit -p ui/tsconfig.app.json` | 0 | `include: ["src"]` relative to ui; checks UI imports, not prose. |
| Direct Node/tsx import of storeSettingsImpl | 1; TypeError reading `import.meta.env.DEV` in devMode.ts | Failed harness, not a product test failure. |
| In-memory esbuild bundle of real storeSettingsImpl with Vite env definitions | 0 after defining the whole env object | Real setter behavior with Map-backed localStorage; outputs below. First incomplete-env attempt exited 1 and is not a pass. |

`npm run test:inventory` subsequently exited 0. Direct reads of these three assigned
Markdown docs confirmed all MODIFY/DELETE paths exist, balanced fences and no
trailing whitespace, exit 0. `git check-ignore` returned the assigned 010 path:
this unit is gitignored. Final git status still shows only pre-existing
scripts/recording and HEAD is unchanged. Parent must explicitly admit these docs
into WP00 delivery; leaf did not stage them. Inventory does not check plan prose.

Reproduction inputs and independently observed outputs:

| Input provider | Selected model | Actual provider/model | Required WP02 result |
|---|---|---|---|
| grok-api | grok-imagine-image-quality | grok / grok-imagine-image-quality | grok-api / grok-imagine-image-quality |
| grok-api | gpt-5.6-sol | grok-api / gpt-5.6-sol | oauth / gpt-5.6-sol |

The reproduction used `esbuild.build({entryPoints:["ui/src/store/storeSettingsImpl.ts"],
bundle:true,write:false,format:"esm",platform:"browser",define:{"import.meta.env.DEV":"false",
"import.meta.env.VITE_IMA2_DEV":"\"0\"","import.meta.env":"{}"}})` and imported its
in-memory output as a data module. `setImageModelImpl` received a minimal state,
a merge-set function, and Map-backed getItem/setItem/removeItem; no function body
or validator was replaced. This diagnoses the two actions, not browser rendering.

## Decision and inter-lane seams

WP01 owns the five-surface capability vocabulary and pure projection, not new
provider execution abstractions or readiness/auth probes. WP02 owns one-set active
selection reconciliation and bounded per-core-lane memory, not a generic store
migration framework, server defaults ownership, or MCP catalog behavior.

The exact shared signature and field chain live in `010_provider_surface_contract.md`.
WP03 must distinguish `null` (not a core provider) from a known unsupported
surface, retain NAI/Comfy error codes, close NAI multimode references, and fail an
explicit grok-api selection with no direct key before provider execution rather
than using the proxy. Both server behavior fixes belong to WP03 by main's final
ownership decision; WP02 remains UI selection/persistence. WP08 must preserve NAI UI multimode exclusion despite
the API accepting text-only requests. WP09/WP12 own cumulative visual evidence;
WP02 still requires focused real-action proof in its own implementation check.

No mock/probe here establishes current upstream entitlement, image quality,
paid-call success, full production readiness, or release/installation success.
