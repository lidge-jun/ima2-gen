# WP00 execution research — independently rederived baseline

Status: P / research only, 2026-09-05. Baseline: `ecde2bc79cddc50ff0da38091c1ce0590383090c`, branch `codex/prod-wp00-roadmap`.
This replaces the earlier Luna draft. Findings below come from source and focused commands, not that draft. Implementation designs are 030/040/050/060; no implementation occurs in WP00.

## Scope and evidence discipline

C3 cross-module extraction planning; C4-level care for credential routing, paid-call multiplicity, input-image loss and cancellation. Parent owns FSM, goal, git, stack, release and independent review. This leaf changes only its five Markdown files. No credential files, paid calls, shared browser or full suites were used. The pre-existing untracked `scripts/recording/` is not ours.

Local source is the authority for this behavior-preserving extraction. No claim is made that a current public provider specification or live upstream generation was independently verified. Tests with stub fetch responses prove local request construction and handling only.

## Verified structural map

| Owner at baseline | Actual responsibilities and anchors |
| --- | --- |
| `routes/generate.ts` → `lib/generatePipeline.ts` | Idempotency before validation (:87), provider resolution (:189), NAI refs refusal (:334), admission (:342), shared Grok plan (:412), per-image branches (:426), OpenAI-only outer retry (:530), allSettled (:565), alpha check before writes (:568), metadata/sidecars and totals (:594 onward). |
| `routes/multimode.ts` → `lib/multimodePipeline.ts` | Comfy rejection (:162), validation/admission, persisted-index dedupe (:290), provider branch chain (:367), partial callback (:470), awaited final callback (:477), final sweep (:494), timeout-after-partials recovery (:550 onward). |
| `routes/nodes.ts` → `lib/nodeGeneration.ts` | Comfy rejection (:75), parent/external image load (:144), parent-only filtered refs (:153), NAI rejection (:191), admission (:204), attempt count (:278), dispatch (:300), partial (:384), saveNode (:487), terminal and finally cleanup. |
| `routes/edit.ts` | Provider resolve (:131), admission **before** input/mask validation (:154), mask refusal (:190), NAI edit refusal (:202), dispatch (:251), cancellation-before-write (:368), alpha verification and sidecar, detailed catch envelope (:468 onward). |
| `lib/providers/adapters/types.ts:40` | V1 control-plane interface: auth/model/error functions plus optional unknown→JobHandle placeholders. No adapter implements the placeholders. |
| `lib/providers/adapters/index.ts:17` | Only minimax/atlascloud/comfy/nai registered. `rg getProviderAdapter lib routes bin --glob '*.ts'` finds production consumers only in `routes/models.ts:211,233,252`. It does not generate images. |
| `lib/runtimeContext.ts:91` | requireRuntimeContext mutates/fills the same context object; live auth/readiness values must not be snapshotted into a global executor singleton. |

Current dependency: four callers → concrete transport adapters. Intended dependency:
four callers → typed execution boundary → one selected execution implementation → existing wire/process helpers.
Admission, transport serialization, file ownership and result presentation remain separate.
The new execution contract is NOT a V1 JobHandle extension.

## Behaviors that must not be flattened

| Surface | OpenAI | Grok/grok-api | Agy | Gemini API |
| --- | --- | --- | --- | --- |
| Classic | Responses generate, up to two outer attempts; only OAuth enables existing inner fallback | Plan once before n parallel executions; preserve incoming providerUrl ahead of b64 refs; resolve quality model | Single call per output, all normalized refs | Single call per output, all normalized refs |
| Node root | Generate; two attempts only when inputImageCount=0; partial_images=2 only when progress enabled; no fallback flag | generateViaGrok, plan per attempt; context-filtered refs | No refs option at baseline even if refs validated | All refCheck.refDetails, even when parent-only filtered refs differ |
| Node child | editViaResponses with parent and filtered refs, no partial callback | generateViaGrok with parent+filtered refs; this is **not** editViaGrok | Prefix effective prompt with “Edit this image: ”; parent only | Prefix effective prompt; parent+all validated refs |
| Edit route | Compressed parent/additional images; PNG mask remains prompt guidance; no retry/fallback | editViaGrok directly, **no planner**, search count 0 | Prefix prompt, one source ref, detected MIME | Prefix prompt, one source ref, detected MIME |
| Multimode | One streamed Responses call, incremental awaited final persistence | Ordered per-item plan→image→download, accumulated cost/search, representative last error if zero outputs | One output regardless of maxImages, no fake stream | One output regardless of maxImages, no fake stream |

Source anchors: `lib/generatePipeline.ts:411-564`, `lib/nodeGeneration.ts:277-413`,
`lib/multimodePipeline.ts:367-486`, `routes/edit.ts:251-367`.
Node's outer retry belongs to the caller and covers **all** providers. Classic's outer retry covers **only** Responses. Neither can become a universal retry helper.

OpenAI fallback is not simply “retry without refs”: `lib/responsesFallback.ts:69-92` retains refs/developer for two fallback attempts, then explicitly drops both on the third. It preserves retry metadata; API exits before this chain. Classic OAuth can therefore exceed two network requests; do not claim “max two paid calls” from its outer loop.

Grok classic passes webSearchEnabled to planGrokImage; node and multimode do **not** forward that toggle at baseline. Main explicitly authorized fixing this omission: WP05 forwards false through node/multimode and proves zero search requests while planner/image calls remain. WP06 likewise fixes node Agy input loss and Gemini parent-only inconsistency; the table above describes baseline, not desired behavior.
`lib/grokImageAdapter.ts:293,374,428`; `lib/grokMultimodeAdapter.ts:68-80`.

## Wire/progress/result observations

- Node partial payload is exactly `{requestId,image:dataUrlFromB64(format,partial.b64 ?? ""),index:partial.index}`; dual emit only on the existing stream/async path.
- Multimode partial is `{image:`data:${mime};base64,${partial.b64}`,requestId,sequenceId,index:partial.index}`; preserve its undefined handling rather than silently applying node's default.
- Multimode final callbacks receive (image,index), are awaited, and call persistAndSendImage. Returned-image sweep dedupes with persistedIndexes. Grok uses attempt index in callback, possibly sparse when items fail; do not renumber it during extraction.
- Classic Comfy onQueue receives `{running,position}`; caller maps phase and emits `{requestId,phase,queuePosition:info.position}` only in async mode. Do not replace this with generic “stage/detail” events.
- Results must retain b64, mime, providerUrl, usage, webSearchCalls, revisedPrompt, text, retry metadata, and Comfy promptId/origin/effectiveModel. Sequence results also retain extraIgnored, representative error and Responses diagnostics.
- Existing MIME decisions differ: node excludes Agy from its MIME overwrite; edit excludes Comfy; classic checks bytes for transparent outputs before any persistence. Extraction must not “correct” them unreviewed.
- Signal goes to transport unchanged. Provider transports may combine it with timeouts. Caller throwIfJobCanceled and terminal publishJobEvent guards remain mandatory; a callback is not permission to save after cancellation.

## Transport evidence and residual risks

`lib/responsesImageAdapter.ts:144-161` chooses direct API versus OAuth endpoint; :205-277 handles fetch/timeout/redaction; :304/:384/:431 own generate/multimode/edit. `lib/responsesParse.ts:333-346` awaits final callbacks and moves phase to decoding. Moving this code must preserve those observable side effects.

`lib/grokImageCore.ts:62` uses a supplied direct key or proxy dummy auth. Missing grok-api key can otherwise fall through to proxy. WP03 owns server direct-key admission and execute-time missing-key recheck (new GROK_API_KEY_MISSING, 401, non-retryable); WP02 owns only UI selection/persistence. WP05 consumes that invariant and extracts/hardens image downloads, keeping image POST retry policy unchanged.

`lib/geminiApiImageAdapter.ts:126-174`: public API key versus initialized Vertex state, alias→API model, public snake_case/enums versus Vertex camelCase/imageConfig, auto-size omission. :195-265: rate limit/bad-request/safety/no-image/error handling. TimeoutSignal's TimeoutError is not the same branch as AbortError; do not claim all timeouts currently become GENERATION_TIMEOUT. API/Vertex auth fallback and truncated upstream body messages are existing residuals, not a new security guarantee.

`lib/agyImageAdapter.ts:165-239`: spawn(-p,-), bounded captured output, abort/SIGTERM, timer. :254-285 owns temporary refs and artifact cleanup; :287-403 resolves artifact fallback, path allowlist, stat/read, byte MIME, cleanup finally. Do not launch real agy during this task. Symlink/path allowlist semantics and partial temporary-write cleanup are not newly hardened by relocation.

Specific refusals remain at HTTP boundaries: NAI_REF_UNSUPPORTED (classic/node), NAI_EDIT_UNSUPPORTED, NAI_MASK_UNSUPPORTED, provider-specific mask codes, Comfy unsupported surfaces, ancestry refusal. Baseline multimode does not have the NAI refs refusal; WP03 explicitly fixes it using WP01 getProviderSurfaceSupport; NAI_REF_UNSUPPORTED 400 before admission/transport. Never describe baseline as already safe there.

## Other direct dependents: compatibility scope

`lib/agentImageVideoGen.ts:12-14,109,141,149` imports Responses/Grok/Agy functions.
`lib/spriteRowPipeline.ts` imports Responses multimode. These are not additional WP03 migrations.
Keep existing exported names and positional signatures through compatibility facades when WP04–06 relocate bodies.
`lib/nodeHelpers.ts:88` toGrokReferences is reused (no second reference normalizer).

## Observed baseline commands (2026-09-05)

All commands executed at the baseline, with no source writes.

| Command | Exit / observation | What it actually observes |
| --- | --- | --- |
| `git branch --show-current`; `git rev-parse HEAD` | 0; codex/prod-wp00-roadmap / ecde2bc79… | Checkout identity, not future correctness |
| `npm run typecheck` | 0 | tsconfig.json includes lib/**/*.ts, routes/**/*.ts, bin/**/*.ts; excludes tests/UI |
| `npm run typecheck:tests` | 0 | tsconfig.tests.json includes tests/**/*.test.ts and .js; weaker null/any settings than production |
| `npm run test:inventory` | 0 | classify-tests reads test imports and compares docs/migration/runtime-test-inventory.md; not behavior |
| `git diff --check` | 0 | Whitespace only, not design validity |
| Focused command below | 0; 51 tests, 51 passed, 0 failed/skipped | Existing adapters, parsers, retry and isolated artifact discovery, not yet-created execution files |
| `node --version` | 0; v24.17.0 | Local runner only; package requires >=22 |

```sh
node --import tsx --test tests/provider-adapter-v1-contract.test.ts tests/responses-adapter-safety.test.ts tests/grok-planner-adapter.test.ts tests/grok-upstream-retry.test.ts tests/gemini-api-wire-contract.test.ts tests/agy-artifact-fallback.test.ts tests/agy-cli.test.ts
```

Runner syntax is grounded in scripts/run-tests.mjs:18, but the command explicitly lists only seven files. Mixed .ts/.js imports mean this baseline is not proof against stale generated JS after edits. Future implementation must rebuild matched server artifacts or execute a proven TS-source resolution setup before claiming runtime parity. No build command was run in docs-only WP00. Missing guessed discovery paths (structure/00-overview.md and grokImageTypes/Shared/Transport) failed with exits 1/2; corrected via rg --files and imports to structure/00-structure-hub.md and lib/grokImageCore.ts. They are not plan targets.

## Coordination decisions

Final WP00 verification addendum: the full canonical TypeScript contract from 030 was extracted from its fenced block and typechecked in memory using the repository's TypeScript compiler options and actual baseline imports (virtual lib/providers/execution/types.ts, no source file created): exit 0. All five Markdown files passed balanced-fence/trailing-whitespace checks; this is formatting/type compatibility evidence, not implementation proof. The seven-file focused command was re-run: exit 0, 51 passed, 0 failed/skipped. `node --experimental-test-module-mocks --input-type=module -e 'import {mock} from "node:test"; if(typeof mock.module !== "function") process.exit(1);'` exited 0, proving fixture capability only. `git check-ignore devlog/_plan/260905_production_readiness/030_execution_boundary.md` confirmed this plan directory is ignored: parent must explicitly include approved docs in its WP00 commit; this leaf does not stage or alter git refs.

Final ownership: WP03 server direct-key/NAI admission; WP05 Grok image execution/search-off/returned-image policy; WP06 Google operation extraction/node reference correctness; WP06m/doc065 video streaming bound after WP06, reusing the exact policy and byte-reader exports in 050. MCP remains unchanged with its DNS re-resolution residual disclosed. No remaining video-cap assignment request is imposed on WP05.

WP03 canonical types/signatures and branch extraction are in 030. WP04–06 depend semantically on WP03, while consecutive PR bases express cumulative integration only. V1 control adapters stay untouched; adding auth/model facades is not counted as an implementation outcome.

WP01 supplies getProviderSurfaceSupport(providerId:string,surface:ProviderSurface):ProviderSurfaceSupport|null; WP03 maps classic to generate and owns server admission. Existing resolveProviderOptions supplies resolved provider/model/size/reasoningEffort/webSearchEnabled; WP03 narrows that existing result into its typed request, without inventing a WP02 backend type. WP02 is UI-only. No auto/unknown provider or fallback provider enters execution. WP07 must agree: it owns job lifecycle, and must not move startJob/finishJob/sidecars into prepare/execute. WP08/09 must consume the existing progress JSON unchanged. WP12 must label deterministic provider-fixture visual evidence as local integration proof, not real upstream success.

SoT targets for implementation: structure/03-server-api.md, structure/05-node-mode.md, structure/01-file-function-map.md, structure/07-devlog-map.md and generated runtime-test inventory. Parent, not this leaf, updates index/state. No new top-level docs system or universal plugin framework.
