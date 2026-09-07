# WP10 P — current-tree revalidation and delivery boundary

Consumes100, preserves098 owner instruction against test-infrastructure expansion.
Base6fd1bfd9 (WP09 verified sourceef37a9b5, PR211 ready). Current branch
codex/prod-wp10-diagnostics; one WP10 PABCD cycle, C4 credential/redaction boundary.
Goal remains an actionable CLI doctor, not a diagnostic platform or new health API.
Tool/cost scope: repo edits, synthetic test data, existing GitHub workflows. No
paid generation, account mutation, real credential/keyring or operator-port probe.
Four-hour reassessment/72-hour overall bound; no numeric token budget requested.

## Confirmed current gaps

- package engines.node is>=22; doctor.ts145 still checks>=20.
- standardDoctor prints its banner before optional bundle JSON; --json alone has
  no structured branch. Configuration and advertisement JSON parse can escape.
- verifyConfiguredKeys has no timeout/redirect policy and labels429/503/network
  exceptions AUTH_INVALID, interpolating raw errors.
- inspectLocalHttp prints invalid raw origin; bundle's prefix regex cannot secure
  opaque userinfo/query strings. Machine output must use fixed code messages.
- Fresh six focused baseline tests pass, but a synthetic sanitizeError probe
  confirms `leaked:true` for opaque URL userinfo; code/status remain observable.
  This is a reproduced defect, not green acceptance.
- Early installation path still requires deferring config, doctor and star-prompt
  static imports. Other early imports were traced: output/error-hints, platform/
  errInfo, ui-build, codexDetect/packageCli have no import-time config/auth execution.
  Registry runtime imports are type-only and pure data. No real doctor was executed.

## Clarifications to100, not additional product scope

1. Preserve standard doctor failure policy as actually shipped: OAuth provider
   checker currently emits fail when no file-backed session even if another lane
   is selected. Do not silently downgrade it. Installation mode excludes provider
   checks entirely and is the safe dependency/install verdict. Tests reflect this
   difference, rather than using missing credentials to fail installation.
2. The machine collector owns fixed codes for its checks and one print boundary.
   Invalid flags/combinations fail2 before collection; malformed config yields
   CONFIG_INVALID and safe report instead of a raw parse exception. Standard
   human-only storage detail stays out of machine reports and installation mode.
3. doctor-runtime resolves dependencies and declared bins relative to its root
   argument, never the test runner's checkout. Reuse the existing resolution list
   and bin semantics; no generic package resolver framework. Shared native/skill
   check functions can move from doctor-checks into the config-free runtime owner
   and be reused by hardening checks. Avoid duplicate native probes in one report.
4. Node/parser success and installation success need explicit fixed success codes
   INSTALL_PACKAGE_OK/INSTALL_DEPENDENCIES_OK/INSTALL_NATIVE_OK/INSTALL_SKILLS_OK/
   INSTALL_UI_OK. Unknown code stays DIAGNOSTIC_UNKNOWN/warn. Fixed table ignores
   input text, uses allowlisted lane IDs and valid evidence enum only; summaries
   derive from emitted checks. No opaque value copied from a caught error.
5. --runtime calls only the explicitly supplied loopback /api/health with no
   credentials, redirects:error and a whole-response deadline. Consume/cancel
   bodies inside the deadline, validate ok/version/optional finite pid, retain
   auth-required vs timeout vs invalid-health vs version-mismatch distinctions.
   No localhost3333 autodetection in tests or operator diagnostics.
6. Key verification remains explicit remote-auth only. Tests inject fetch with
   synthetic keys/env and abort behavior; they must not call buildProviderDoctorLines
   against real OS home. Rewrite only this existing unsafe test boundary with
   Node module mocks or owned emitted child. No WP09 guard/tooling expansion.
7. Logger patch stays in existing lib/logger.ts with existing tests/logging.test.ts;
   preserve scalar codes/status (including0), redact URL-shaped/userinfo/query/Bearer
   tokens before truncation, omit nested bodies/causes/stacks, no new sink/framework.

## Implementation ownership and verification

Main: doctor-runtime/report, doctor command/earlyentry, codes across existing
checks/providers/media/bundle, config knobs/env/docs, runtime/report/provider tests,
CI and SoT. One independent B worker MAY own only lib/logger.ts and logging.test.ts
after A; disjoint product fix from main CLI work. Upward reclaim after two failed
actors; no spontaneous broader worker packet. Model/effort fields omitted.

Existing baseline commands actually run at P: node --import tsx --test
tests/logging.test.ts tests/cli-doctor-status-contract.test.js =6pass. Both typecheck
commands observe existing tsconfig inclusion; output recorded separately. Future
runtime/report files must exist before their named verifier can run. Process-level
installation/standard JSON verification uses the actual emitted CLI in hosted CI,
owned temporary package/config paths and counters proving zero forbidden imports,
network/keyring/paidprobe in installation mode. Local execution is limited to pure
logic/module mocks and synthetic fixtures; no full local suite or real doctor.

Acceptance remains100's product contract with bounded regression proof. Diagnose
failures using one minimum relevant CI job, then run the grouped final candidate
through required full CI. WP09 existing app guards/UI cases remain unchanged. D
requires source-bound CLI stdout/exit/negative proof, redaction corpus, SoT sync,
review and stacked PR above211; no current merge/release or test-foundation claim.

Enforcement limits: fixed-code report serialization is product code (E2); test
fixtures/CI are regression evidence, not an OS sandbox. Caller-controlled native
dependencies and directconsole sinks outside this slice are not newly constrained.
Missing current external docs is not permission to invent endpoints; reuse registry.
