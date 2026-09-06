# Baseline verification and proof limits

Baseline source: ecde2bc79cddc50ff0da38091c1ce0590383090c.
These are WP00 preflight observations, not future WP implementation receipts.

| Command | Observed outcome | What it observes |
| --- | --- | --- |
| npm run typecheck | exit 0 | tsconfig.json includes server/config/lib/routes/bin/types; excludes ui/tests |
| npm run typecheck:tests | exit 0 | tsconfig.tests.json includes tests |
| npm run test:inventory | exit 0 | scripts/classify-tests.mjs compares current root test inventory |
| node scripts/generate-provider-types.mjs --check | exit 0 | generated frontend provider definitions vs server registry |
| node scripts/refresh-structure-line-counts.mjs --check | exit 0 | structure/01 current source-line snapshot |
| node --import tsx --test tests/release-pipeline-contract.test.ts | 32 pass, 0 fail, exit 0 | actual release/provenance helper imports and workflow contracts |
| node --import tsx --test tests/event-bus.test.ts tests/provider-adapter-v1-contract.test.ts | 19 pass, 0 fail, exit 0 | real event bus delivery/replay and V1 auth/model/error adapter contract |

No repository-wide suite was run locally. No paid provider call was made.
No current remote CI success is implied by these local checks.
The frontend must pass its own tsc/build and browser scenarios for changed UI;
the root typecheck does not cover it. E2E source imports server.ts, whereas the
published package uses generated server.js: package installation smoke is a
separate proof and cannot be replaced by source E2E.

## Existing implementation checks discovered

- ProviderAdapterV1 has optional generateImage/editImage fields returning JobHandle,
  but current adapter factories implement auth/listModels/normalizeError only.
  Production getProviderAdapter callers currently live in routes/models.ts.
  19 passing tests above do not prove image execution has a common adapter.
- ui/e2e/fixtures/appServer.ts inherits process.env; fixture isolation must precede
  broader generation scenarios. Default OAuth must not accidentally reach the
  user's real local proxy. WP09 owns isolation, WP12 consumes it.
- bin/commands/doctor.ts still accepts Node major >=20 even though package.json
  engines requires >=22. WP11 must align actual doctor behavior, not only prose.
- ci.yml has three jobs: test honors explicit sha, Windows is schedule-only,
  E2E uses event-sha default. WP12 owns exact-head/cross-platform gate changes.
  Interim CI dispatch MUST use matching branch tip and input SHA.

## Source preservation

git status --short remains only the pre-existing untracked scripts/recording/.
This unit is ignored until explicitly force-added; its text will be published
as the docs-only WP00 layer. No production source delta exists during P.
