# WP01 P revalidation and implementation ownership
Current code head8c4038720fe8dc8858de9bd5a5963efcb8381c0c, branchcodex/prod-wp01-capabilities.
WP00 D completed through the main FSM; next direction is010 provider surface contract.
Only documentation differs from original ecde2bc7 source;010 paths/signatures remain current.
No WP01 implementation yet.

## Fresh verification
25focused tests pass/0fail at current tree:
node --import tsx --test --test-concurrency=1
tests/provider-registry-contract.test.ts tests/provider-registry-parity.test.ts
tests/models-endpoint-contract.test.ts tests/capabilities-lane-contract.test.ts.
Executed with env-i PATH, owned mktemp IMA2_CONFIG_DIR/DB/generated paths and
DOTENV_CONFIG_PATH=/dev/null. Model-route tests inject Agy/Comfy/MCP dependencies
and use loopback servers; no real provider/credential probe.
Source searches: CoreProviderManifestBase,CoreProviderModel,supportsAnything,
supports literals across lib/ui/tests/scripts; only one directly typed fixture
registry in tests/provider-registry-contract requires explicit surfaces/generate.
Current generator only loads registry; add pure source-transpiled projector safely.

## Existing source owners re-read
lib/providers/types/registry/derive/deriveCore,adapters/comfy;
scripts/generate-provider-types.mjs,ui/generated/providers,ui/lib/referenceLimits;
lib/capabilities,routes/models (DTO/buildCoreLanes/entries), current route guard
blocks and four focused test files. Existing module patterns reused; no dependencies.
010 exact getter and unsupported-operation envelopes remain binding.
Backend style references do not override existing API envelopes or justify unrelated
controller/database/architecture rewrites.

## B write partition (only after this WP's independent A)
- MAIN: provider types/registry/derivations/surfaceSupport/comfy model projection;
  generator+generated UI map+referenceLimits; pure/regression tests
  provider-registry-contract,provider-registry-parity,provider-surface-support.
- API worker: lib/capabilities.ts,routes/models.ts,
  tests/models-endpoint-contract.test.ts,tests/capabilities-lane-contract.test.ts.
- Boundary worker: routes/edit.ts,lib/generatePipeline.ts,lib/multimodePipeline.ts,
  lib/nodeGeneration.ts,tests/provider-surface-boundary.test.ts,
  tests/comfy-routes-contract.test.ts.
- MAIN C: docs/API,structure01/03/04 and runtime-test inventory; generated JS/UI
  emitted by normal build commands, not manual edits/commits.
Workers receive010+011, exact getter signature, no shared writes or parent FSM.
They do not start future WP02/WP03 implementation. New direct-key/NAI multimode
behavior remains WP03; this WP only rewires existing boundary predicates.

## Source-bound acceptance and visuals
010 activation matrix and negative tests unchanged. Match runtime/static Comfy
distinction; NAI generates without being mislabeled edit-capable; Spark remains
unsupported. Independent 50-row pure matrix plus actual API serialized rows.
Local typecheck/source-focused checks, matched server/CLI emit and UI build;
own exact-HEAD hosted CI before completion/merge. Reference tray visible affordance
must be observed in isolated browser/CI (NAI absent, OAuth present), no paid request
or live3333 mutation. Use clean environment before WP09's stronger fixture exists.

## Delivery anchors
PrerequisitePR199 head ecde2bc79cddc50ff0da38091c1ce0590383090c, basedev.
DocsPR198 head8c4038720fe8dc8858de9bd5a5963efcb8381c0c,basecodex/prod-prereq-nai.
Exact CI runs33941316446 prerequisite /33941317918 docs were dispatched;
state queued at capture, not green evidence. Rootsource userscripts/recording
remain untouched. WP01 PR will base oncodex/prod-wp00-roadmap.
