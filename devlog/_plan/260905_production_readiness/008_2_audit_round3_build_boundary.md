# A round3 root-cause review — separate product builds from fixture certification
SEC-R2 findings are closed. SEC-R3-01/02 are two new High design regressions from
integrating a strict fixture receipt into the normal UI build command.
No production code was changed. Main uses cxc-dev-debugging structural RCA before
another amendment; this is a caller-boundary design error, not a dependency outage.

## Competing hypotheses and falsifiers
- H1: missing dependency/toolchain installation causes both failures. Falsifier:
  the proposed wrapper rejects before compiler execution; dependencies/install scripts
  are unchanged. Current source/npm test contracts remain green. Rejected as cause.
- H2: ordinary UI builds intrinsically require emitted server JS and forbid .env.
  Falsifier: package.json prepack/verify explicitly run UI before server emit, .js
  siblings are ignored, and .env setup/source auto-rebuild are documented. The
  old build contract has no such rejection. Rejected; these are fixture-only rules.
- H3: the strict fixture producer was accidentally installed as the product build.
  Falsifier would be no ordinary caller reaching it; actual proposed ui/package.json
  replaces build, so ui:build/prepack/release/serve auto-build all reach it. Confirmed.
Both high findings are the same boundary mistake. Do not patch by weakening strict
receipts or moving all ordinary lifecycle behavior merely to suit tests.

## Accepted architectural correction
- ui/package.json build stays EXACTLY the original tsc/tsc/Vite command.
- Add build:fixture invoking the existing proposed strict parent receipt wrapper.
- Only WP09 E2E and PR-fast browser jobs call build:fixture, AFTER server/CLI emit.
- The fixture's appProjection still requires matching strict receipt; ordinary
  build output cannot fall back into certified mode.
- Root ui:build/prepack/verify:release:source and source auto-rebuild stay normal.
  Existing .env usage remains supported; strict fixture mode still rejects it.
- Tests exercise both callers: ordinary command retained and succeeds with synthetic
  allowed .env/no pre-emitted JS; strict mode refuses poisoned environment/missing
  prerequisite; clean strict fixture path emits a valid full asset receipt.
- Published-artifact QA uses downloaded tarball provenance and artifact digest on
  a clean isolated runner, not a source fixture receipt forged for installed output.
  This is a separate stronger origin proof, not appProjection's permissive fallback.

Assigned corrections: main090/003/120/130; no producer/guard semantics weakened.
Same security/delivery auditor rechecks the two High findings; backend/UIops prior
scoped PASS remains valid because their source/type/lifecycle plans are unchanged.
This amendment does not claim actual builds passed: implementation C must run the
named ordinary/strict clean-checkout and .env compatibility scenarios.
