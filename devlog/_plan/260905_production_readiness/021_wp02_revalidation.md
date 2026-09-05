# WP02 P revalidation at42c9e5a7

WP01 D closed on exact-head CI33944065261 SUCCESS (Node22/24, E2E12pass),
111 focused tests and source/build/visual receipts. PR200 remains unmerged;
PR199 shallow-history merge blocker remains013/WP12. Current branch
codex/prod-wp02-selection is based on that verified WP01 tip.
WP02 remains the020 C3 consistency unit with C4 persisted-state scrutiny,
same acceptance/authority/rollback/resource bounds. No production edits at P.

## Source and baseline proof

Re-read current imageModels, storeSettingsImpl core setters, useAppStore hydration,
storeUIImpl sync, App storage listener, storeGenerateEntryImpl, persistenceRegistry,
storePersistence snapshot/writers, J6 and appServer. cxc map ui/src/store confirms
the mixed store owners; no architecture changes beyond020 extraction.
29 focused tests (model-select-lane-gating, comfy-selection-persistence,
nai-ui-registration-contract, reference-limits) pass; UI noEmit passes. These read
named source files; the lexical tests do not establish lane continuity.
Actual setImageModelImpl bundled in-memory with esbuild write:false and env={}:
input grok-api/grok-imagine-image-2.0 -> click grok-imagine-image-quality returns
provider=grok, expectedgrok-api. Map-backed storage, fetch forbidden; exit0 with
reproduced=true. No on-disk implementation or provider request.

WP01 lesson applies to020: every generated-map access must first establish a core
key. Persisted auto/constructor/__proto__/toString are not core ids. Reconcile
unknown values; do not reintroduce unchecked property lookup in generate entry.
Canonical isCoreProviderId or existing typed fallback preserves unknown compatibility.

## Audited write partition for B (no speculative future WP)

- MAIN: coreSelection.ts, coreSelectionPersistence.ts, persistenceRegistry.ts,
  tests/core-selection-reconcile.test.ts and NEW tests/core-selection-memory.test.ts.
- Action worker: storeCoreSelectionImpl.ts, storeSettingsImpl.ts, storeTypes.ts,
  useAppStore.ts, storeUIImpl.ts, App.tsx, tests/core-selection-actions.test.ts;
  DELETE obsolete comfy-selection-persistence.test.js only after equivalent actual
  reload/reselection behavior is asserted. Existing NAI lexical setter checks in
  tests/nai-ui-registration-contract.test.ts may be replaced by real action tests;
  no removed identifier may be restored as a comment to fake a pass.
  Impact search also found superseded setter/hydration predicates in
  tests/comfy-ui-contract.test.ts and tests/video-defaults-persistence-contract.test.js:
  action worker owns replacing only those predicates with real behavior (or removal
  only when stronger named action/reload tests cover each assertion); unrelated
  workflow-manager, i18n, video-parameter and continue-from checks stay intact.
- Display/request worker: imageModels.ts, GenProviderModelSelect.tsx,
  storeGenImpl.ts, storeGenerateEntryImpl.ts, ui/src/types.ts,
  tests/model-select-lane-gating.test.ts and NEW tests/core-selection-transport.test.mjs.
  Last file splits020 action/transport proof ownership and uses real bundled
  entry/request paths with fetch capture; no test implementation facsimile.
- Browser worker: existing J6 and appServer.ts; NEW
  ui/e2e/fixtures/j6Selection.ts and ui/e2e/core-selection.spec.ts allowed as
  bounded splits of020's helper/scenarios, each under500lines. Old J6-S1/S2/S3
  remain. MAIN owns small ci.yml/pr-fast.yml upload additions for wp02-*.png.
- MAIN C: structure01/04, runtime inventory, durable receipts/PR. No worker
  commits/pushes, edits FSM, starts paid calls, executes local browser fixture,
  changes package/dependencies, or implements WP03/08/09.

All workers use explicit Astra/high (steering supersedes initial omitted-field
objective); priority is the user's configured setting, not a verified tool flag.
Escalation up: main reclaims after two distinct packet failures. Downward scope
expansion requires a P amendment; bounded ownership above is decided before B.

## WP02 browser C evidence amendments

020's mandatory isolation stays intact. The added helper must fail closed outside
the disposable GitHub-hosted context until WP09 supplies reusable isolation. Verify
fresh checkout has no dotenv overrides, provider secret env/config/auth stores,
that actual OS home is the disposable runner home (never overwrite HOME), and no
signed-in browser/service is reused. Record paths/booleans, not secrets. Auto-start
OAuth/Grok remains disabled; catalogs/readiness and all submission responses are
fixtures. All context routes exist before first navigation, service workers blocked.
No real generation handler may receive a captured submission; default-deny and
assert zero unexpected mutation/non-fixture-origin requests. Same-origin GETs needed
for the actual app may pass; provider catalog/readiness GETs are fixture-owned.

For true reload checks, seed once per fresh context: existing seedBrowser re-applies
on every document and could forge persistence, so J6's helper must avoid reseeding
after navigation/reload. Cross-tab uses a second page with the same context guard.
Record expected provider/model payload, unexpected count and fresh desktop/narrow
screenshots in testInfo.outputPath("wp02-*.png"). Only filtered screenshots and
nonsecret JSON evidence may be uploaded. Existing WP01 capture stays unchanged.
Minimal ci.yml/pr-fast.yml artifact path extension for wp02-*.png and wp02-*.json
is an explicit C-evidence scope amendment, not WP12 CI-history repair.
Fresh scenario cleanup must await owned child exit/stub closure and remove own
routes; no merely scheduled kill is teardown proof. Keep non-J6 behavior compatible.
No local live3333 use, no new isolation framework/launcher; WP09 still owns full
OS egress/process protection. Browser evidence is blocked if any precondition fails.

## Current P verifier status

Existing29 tests0 and UI noEmit0 already executed at42c9e5a7. New named files do not
exist yet and are pending, not claimed green. New test TS files are covered by
tsconfig.tests tests/**/*.test.ts; new MJS by npm-test discovery/inventory. E2E files
are covered by ui/tsconfig.e2e and existing Playwright suite. Typecheck exact real
AppState caller compatibility, no casts to hide optional workflow carriers.
Final full suite/build/package/browser checks run on own exact-head hosted CI.
