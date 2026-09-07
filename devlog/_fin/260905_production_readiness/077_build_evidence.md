# WP07 B — implementation checkpoints and proof boundaries

Main session01a06e88-aa93-77b2-a99a-fc10f8458eb2; branch codex/prod-wp07-jobs.
Base f2b60b647640ebbd8c35ded16e55d700ef1c806e.070–076 audited contract remains
binding. B is not final C/release approval. No WP07 PR published at this checkpoint.

## Implemented checkpoints

| Commit | Changes / impact | Fresh B verification |
| --- | --- | --- |
| 33f236eb | lib/jobs/terminalStore.ts extraction; inflight retains local ownership | original inflight/persistence/restart15PASS |
| 936c43cb | inflight cancel-before-abort, transactional expiry/residual preservation, late-controller/reuse; ssePublish done AND error guard | new6cases2PASS4RED before behavior;6GREEN then extended11GREEN |
| 819735d2 | CLI exact tracking warning in live envelope/legacy/recovery; owned config before producer test import | worker29PASS, main independently29PASS; five live RED and3 recovery RED/restored GREEN |
| 15301917 | Sprite nested-error canonical flattening/terminal guard; node four holds and video cancellation terminal count | Sprite2PASS; Agy12PASS plus video4PASS inside isolated child (13 outer rows) |
| 0a7b1027 | E2E explicit SHA checkout/real guard and wp07 artifacts | actual guard exact/wrong/malformed/absent,3PASS and actionlint0 |
| 5706b44b | eventsPolicy, eventBus future/zero gap, drain-driven events route, browser source/data/control isolation | main31PASS; actual native HWM64 false4/drain4, received1–5, onePOST, owned teardown |
| fdbc2576 | durable expiry and malformed/column-first correlation restore tests |9PASS across exact2paths |
| 08c83b13 | shared inflight snapshots/eligibility, both-await protection, shared real UI bundle, legacy runtime replacements | worker67PASS five paths; main six-path dot run exit0 (includes presentation) |
| 8d0620c7 | canonical/localized tracking warning, video/Undo lifetime, AssetGen/MCP/Sprite, extension advisory | source/test/e2e types and UI build0; focused presentation+locale proof below |

The state checkpoint08c83b13 consumed the companion error export then present in
the shared tree;8d0620c7 immediately records that companion. They are one WP/PR
layer, not independently published PRs. Whole-layer frozen-head C is still required.

Main commands used Node24.17 and existing tsx; runtime tests ran env-cleared with
exact file arguments and owned temp config/DB paths. No full local suite or paid
provider calls. Builds: npm run typecheck, typecheck:tests, build:server, build:cli
and npm --prefix ui run build all exit0 at their checkpoints. UI build includes
tsconfig.e2e and emitted626 modules; existing large-chunk/mixed-dynamic-import
warnings remain, not build failures. Its printed default proxy3333 is configuration
text: no dev server or user3333 request was started.

## Mutation evidence

Main exact commands/results are preserved in
`.codexclaw/evidence/01a06e88-aa93-77b2-a99a-fc10f8458eb2/wp07/server-mutations.json`:
late error guard ->2FAIL, cancel ordering ->1FAIL, admission disk reset ->1FAIL,
late expiry controller ->1FAIL. Each source restored in finally; each restoration
reran the same11 cases with0fail. These are real source mutations, not copied logic.

Pauli transport task01a0725e-fe12-7eb3-82d3-e705f35db880 retained five REDs:
zero cursor predicate, immediate destroy, ignored false write, removed gap handler,
and application-error/transport distinction. Restored31PASS. Immediate destroy
counterexample received only1, sent2 twice, cursor1 repeated, drains0, POST1;
restoration received1–5 with four native drains. Main independently reran31PASS.

Descartes CLI task01a0725f-007f-7090-8b57-7660d5244476 retained actual producer
expiry -> SQLite -> close -> fresh module -> public runMcpJob image/video/upscale
recovery. All use onePOST plus cursor/gap GETs and no raw metadata body in errors.
Mutating only terminalResult's tracking branch fails all3 restored cases.

Kierkegaard UIstate task01a0725e-feb2-7940-bf07-ddc8f97a736a retained original
16PASS baseline and actual runtime RED before state changes, then67PASS. Main
ran five individual snapshot/revision/object-replacement/removal/scope mutations
after all peer windows closed: each went RED then restored GREEN, retained in
wp07/ui-state-mutations.json. No mutation remains active.

## Test changes and scope refinements

- inflight.test.ts's local fake publisher is replaced by the real shared publisher.
  Post-expiry cancel now retains timeout rather than rewriting it as cancellation;
  original late-done suppression assertion remains.
- Two legacy reload .js tests are replaced by .ts actual runtime tests. Only moved
  source-shape assertions in node/multimode contracts are removed; concrete scope,
  metadata and concurrent-state behavior is exercised in the new runtime cases.
- Two legitimate result.extend/result.extendTitle dictionary leaves were absent.
  Add all4 locales and remove exactly those2 entries from i18n KNOWN_MISSING;
  remaining known missing keys stay visible. Six dictionary testsPASS.
- ResultActions/storeSettings baseline506/507 physical lines now498/496 through
  narrow formatting alongside required behavior, with no new production module.
- Native browser fixture allows only logged owned graph PUT in addition to the
  named generationPOSTs, and shared bundle exposes existing public extension
  helper for valid/invalid202 behavior.075 records these before final acceptance.
- Fixture close must await actual response close records before publishing its
  cleanup verdict; hosted fixture's native HTTP-only self-test exposed and repaired
  that race. This is not browser/render proof.

## Still mandatory before C closes

Refresh all checks at frozen complete tip; finish peer test/native-browser artifacts;
run fresh independent source/test/visual review and actual original curl node4/video
failure replays; issue current-head test+QA receipts; exact-head CI/CodeQL; publish
the WP07 stacked PR on parent PR207. Current original WP06 HTTP FAIL artifacts
remain immutable. Automated real-handler PASS is not the missing manual wire PASS.
All later WPs, bottom-up merges, security triage and canonical release remain OPEN.
