# Production readiness — master roadmap and continuity spine

Status: WP00 / B, independent design audits PASS; final C/D lock pending.
Baseline: ecde2bc79cddc50ff0da38091c1ce0590383090c.
Branch: codex/prod-wp00-roadmap.
FSM session: 01a06e88-aa93-77b2-a99a-fc10f8458eb2.
Goalplan: .codexclaw/goalplans/bring-ima2-gen-to-explicitly-verified-production/goalplan.json.

## Loop specification and objective

Class C4 overall (API/credential/installation/release boundaries); per-WP C3/C4
classification in decade docs. Archetype: spec satisfaction. Deliver 14 substantive
implementation WPs as at least ten stacked PRs, merged bottom-up, then canonical
release with fresh provenance/install/visual proof. Production readiness means the
named scenarios, not unlimited scale or universal internet-service security.

WP00 is docs-only: source-grounded 000-009 research plus full path/diff-level plans
for EVERY implementation WP, independent A audit, C receipt, D roadmap lock.
One implementation WP = one real PABCD. Each next P revalidates its prewritten
document against the integrated lower layer. No two decades implemented in one B.
Stop only after all recorded outcomes and actual release proof, or a genuine
external/authority/resource blocker. Context pressure is not budget exhaustion.

## Scope and authority

Preserve CLI/API compatibility, provider billing lanes, reference/mask semantics,
SSE/cancellation, local history/media/config and the prior ecde2bc7 NovelAI fix.
Preserve scripts/recording, all stashes and unrelated refs. No cloud multi-tenancy,
new billing product, speculative framework, dependency churn, destructive migration,
wholesale rewrite, shared-branch forced update or branch-protection bypass.
User authorizes task push, >=10 stacked implementation PRs, bottom-up merge and
canonical release. Existing unrelated dependency PRs are out of scope.

Dispatch amendment: explicitly gpt-6-astra / high for every work/review agent;
priority is user-confirmed. This supersedes the original omit-field clause in the
host objective. Five Luna execution drafts required independent Astra rederivation.
Workers are leaves; main owns FSM/goal/remote decisions. Failed A rounds synthesize
then reuse the auditor; C uses fresh independent scrutiny.

## Existing structure and source-of-truth reused

lib/providers owns registry/derivations/control adapters; lib/*Pipeline and
nodeGeneration plus routes/edit own execution. lib/jobs/inflight/eventBus/ssePublish
own job state and recovery. ui/src/store/lib/composer components/styles own UI.
bin/scripts own CLI/install/runtime. tests and ui/e2e retain current harnesses.
structure/00-07, docs/API, docs/CLI, AGENTS.md are existing SoT; no new docs system.
.ts is authoritative, .js and ui/dist are generated package outputs.

## Research index

001 capability/selection; 002 execution topology; 003 visual/fixture; 004 lifecycle/
diagnostics/install; 005 remote/authority/dispatch; 006 trust boundaries;
007 executed main baseline verifiers;008 A-round1 synthesis;009 publication-order
decision. WP11's 111 sub-plan defines the Pages compatibility gate.
Research observations and proposed fixes are not future success.

## Dependency-ordered WP/PR map

All branch names prefix codex/prod-. Each implementation PR bases on the preceding
verified branch. Semantic prerequisites below differ from cumulative stack order.

| ID/order | Decade document | Standalone outcome | Semantic inputs | Branch suffix |
| --- | --- | --- | --- | --- |
| wp00 / 0 | 000-007 and all decade docs | audited docs-only roadmap lock | baseline | wp00-roadmap |
| wp01 / 1 | 010_provider_surface_contract | truthful generated provider surface policy and existing boundary consumers | baseline | wp01-capabilities |
| wp02 / 2 | 020_selection_consistency | valid provider/model/workflow restore and transitions | wp01 | wp02-selection |
| wp03 / 3 | 030_execution_boundary | typed real execution seam, no wrong-key fallback or silent refs loss | wp01-02 | wp03-execution |
| wp04 / 4 | 040_openai_adapter_parity | OpenAI executable family migration with callback/retry parity | wp03 | wp04-openai |
| wp05 / 5 | 050_grok_adapter_parity | Grok migration, truthful search toggles, bounded artifacts | wp03, integrated interface | wp05-grok |
| wp06 / 6 | 060_google_adapter_parity | Agy/Gemini migration preserving API/Vertex/process behavior | wp03, integrated router | wp06-google |
| wp06m / 6b | 065_video_download_bounds | incremental video size cap and cancellation cleanup | wp06 integrated transports | wp06m-video-bounds |
| wp07 / 7 | 070_job_lifecycle | durable expiry/cancel/replay recovery, bounded subscribers | stable caller-owned lifecycle | wp07-jobs |
| wp08 / 8 | 080_composer_contract | shared pane geometry/scroll/interaction ownership | wp01-02, ecde2bc7 | wp08-composer |
| wp09 / 9 | 090_user_journeys | isolated behavior-based UI regressions, real state/error/layout paths | wp02, wp07-08 | wp09-journeys |
| wp10 / 10 | 100_runtime_diagnostics | safe actionable structured diagnostics/runtime gate | wp07 | wp10-diagnostics |
| wp11 / 11 | 110_installation_docs_contract | safe installers and metadata-derived requirements | wp10, wp01 | wp11-install |
| wp12 / 12 | 120_integrated_acceptance | exact-head cross-platform stack CI and integration acceptance | wp01-11 | wp12-acceptance |
| wp12s / 13 | 125_local_lan_security | LAN credential transport/private media and local origin boundary | wp09-10, wp12 | wp12s-lan-security |
| wp13 / 14 | 130_merge_and_release | all layers merged and canonical released artifact proved | ALL including wp12s | promotion via dev/main |

Each listed document has .md suffix. Prior ecde2bc7 is explicitly published as
codex/prod-prereq-nai (base dev), then docs layer, then implementation stack;
prerequisite/docs/release promotion do not count toward ten implementation PRs.
The user's >=10-layer request overrides shallow-stack heuristics, not per-layer
tests, exact-head CI, honest dependencies or bottom-up merge.

WP12s was appended before lock. It depends on wp12; select it before wp13 despite
array order. Existing wp13->wp12 CLI dependency is necessary but insufficient:
wp13 security-gate task and c-15 MUST pass before any merge/release action.
Cumulative WP12 acceptance repeats after security on the final top. WP06m was
also added before lock: execute its bounded video download fix after WP06 and
before WP07, regardless of append position; wp13 media-gate task and c-16 are
mandatory. No historical dependency rewrite to conceal initial registration.

## Cross-WP contract resolutions

- Capability surface generate maps to execution surface classic; node/edit/
  multimode names otherwise map directly. Supported != authenticated != ready.
  Runtime Comfy catalogs are not empty static model lists.
- WP02 is UI selection/persistence. WP03 owns missing grok-api direct-key failure
  and NAI multimode refs refusal before dispatch, using WP01 surface facts.
- Execution gets resolved CoreProviderId, validated refs/options, signal/callbacks.
  Callers retain admission, retry policy, transport SSE, persistence and job finality.
  V1 auth/model/error descriptors are not generation executors. Compatibility
  facades preserve real existing direct import paths during family extraction.
- WP07 preserves envelope v1 and terminal vocabulary used by UI/CLI; expiry reports
  completion unknown, not automatic permission to rebill/retry.
- WP08 preserves product styling/IME/mentions/shortcuts and non-NAI behavior.
  It is ownership consolidation, not redesign. Visual proof must be isolated.
- WP09 owns fixture process environment/config/auth/network/teardown isolation.
  WP12 consumes that fixture, WP12s extends it for LAN; no parallel fixture system.
- WP10 defines doctor report/installation mode, WP11 consumes it and derives
  requirements from package metadata. No hand-maintained second runtime table.
- WP12s protects generated user media in LAN, preserves local single-user defaults,
  handles cookie/token UI/SSE/CLI and updates API/Docker/CLI docs in its own cycle.
- Catalog stubs, no-cost canaries, billed generation and installed-artifact smoke
  are distinct evidence classes. No paid image/video generation is authorized.

## Acceptance and verifier floor

Detailed per-WP activation tables are binding. Common outcomes:
1. Unsupported operations/refs fail server-side without changing billed provider.
2. Persisted grok-api stays grok-api; workflow ids do not contaminate static models.
3. Execution preserves allowed wire fields, callback order, metadata, errors/masks,
   signal behavior and caller-specific retry counts; changed bug tests turn red/green.
4. Expiry retains recovery evidence, late controller honors cancel, replay gaps
   resync and blocked SSE writers clean up.
5. Editors have usable height; labels/hints contained; tools hit-testable on
   narrow/short/mobile screens and long localized content; keyboard/IME works.
6. Diagnostics are parseable and redact synthetic secrets; runtime floor matches
   manifest; installers cannot kill unrelated Node processes.
7. LAN bootstrap/API/SSE/media/Range work with credentials; unauthorized and
   hostile-origin requests fail; default loopback works and cache limits are honest.
8. >=10 implementation PRs actually merged; CI is current-tip, ancestry verified;
   version/tag/package gitHead/digest/provenance/install/observed UI agree.

Local checks: focused tsx tests, typechecks, generated drift and bounded visual
scenarios. Full suites use exact-head CI or verified remote worker, not this laptop.
Root typecheck excludes UI; source E2E does not replace published .js install smoke.
Every verifier must read its target; planned/unavailable tests are not passed gates.
Screenshot creation alone is not observation: read the actual rendered result.

## Resource/safety and rollback

Existing repo/GitHub/npm workflow credentials and browser tools; synthetic isolated
temporary homes. No purchases, extra subscriptions, credential dump or paid images.
Explicit Astra/high uses account allowances; no numeric token budget requested.
Reassess at four hours per WP and 72 hours overall. Main reclaims a slice after two
failed agent packets. Failed reviews change the plan; do not forge/fake evidence.
Single trusted local operator, uncredentialed LAN peers untrusted; no cloud accounts
or universal internet/TLS guarantee. Preserve admin nonce and OAuth callback state.
Public provider artifacts differ from operator-configured local services like Comfy.

Rollback uses exact revert PRs or previous immutable package reinstall. No reset,
tag rewrite or user-data erase. New preferences additive; no irreversible DB schema
change. Security compatibility changes documented with complete consumer chain.

## Continuity

WP00 P: initial baseline and source-grounded plans are being finalized by Astra.
WP00 A round1: three independent FAIL verdicts, eleven unique accepted blockers;
008 records causes/decisions and exact reviewer IDs. R2 closed those and identified
six Medium issues (008_1); R3 independently passed backend and UI/ops but identified
two High normal-build/fixture-boundary regressions. Main's structural RCA in008_2
separates ordinary build from strict build:fixture without weakening certification.
Security/delivery same-reviewer R4 PASS closes the last two High issues.
008_3 records accepted scoped verdicts and the fourteen-implementation map.
WP00 B finalizes only these docs; C/D remain pending, no production source change.
Next: source-bound docs-only C/D lock, publish prerequisite/docs layers, then
WP01 P revalidation. Do not implement before the lock.
