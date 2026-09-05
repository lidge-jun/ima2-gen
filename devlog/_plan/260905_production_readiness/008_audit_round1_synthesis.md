# WP00 A round 1 — synthesis and accepted repair plan
Snapshot: HEAD ecde2bc79cddc50ff0da38091c1ce0590383090c; staged 23 documentation files.
Audited staged-diff SHA256 572d0d9c58c304ce58bd0780785c006957c6361d1e01798fa1f678b61ab68da0.
Reviewers: Mencius (backend), Chandrasekhar (UI/ops), Bacon (security/delivery),
all independently verified Astra/high. All verdicts FAIL. No production change exists.

Persistent reviewer IDs (reuse these for round2, not the authors):
- backend: 01a06f65-87e0-7462-9a15-31ee98c9912e
- UI/ops: 01a06f65-88e7-7300-9754-95814fa92c71
- security/delivery: 01a06f65-8a10-7d71-a9cb-1e48ebf4c268
Repair authors (docs only, all Astra/high): backend01a06f6d-214d-70f3-9df9-cf4de8803615,
fixture01a06f6d-21cc-7eb1-9f51-c179edbebf32,ops01a06f6d-2277-7482-a96f-334f5800ebc7.
Main owns125 pre-close disposal,009 publication decision,111 detailed Pages gate,
130 operational sequence. No re-audit verdict has yet been accepted.

## Deduplicated blockers and decisions
Every finding accepted; no severity waived. Eleven unique issues: six High, five Medium.
Source/doc line anchors below describe the round1 snapshot and move after repair.

| ID | Review source / severity | Root cause and consequence | Accepted design repair / owner |
| --- | --- | --- | --- |
| R1-01 | backend1 High | 050:285/060:186 need mock.module, but scripts/run-tests.mjs:19 never enables it; focused pass cannot yield standalone CI | WP05 explicitly changes canonical runner to include experimental module-mock flag with supported Node22/24 capability and runner invocation tests. WP06 consumes same runner; no skip. Backend docs worker. |
| R1-02 | backend2 High | 020:108/283 accepts required comfyWorkflow but AppState field is optional (storeTypes:506), reproducing TS2345 | Request builder accepts optional nullable workflow carrier (or caller normalizes it); keep JSON omission on absent Comfy workflow. In-memory compile actual AppState + both payload callsites. Backend docs worker. |
| R1-03 | backend3 Medium | G05-7 no-duplicate promise conflicts with sparse callback index1 vs compact result index0 in multimodePipeline:291/488 | Explicit bounded identity-preserving correction in WP05, not false parity: preserve callback indices and use an internal stable original-index mapping for final sweep, propagate through existing in-memory result seam only, test partial failures and same-content distinct outputs. Backend docs worker; record new field whole chain in030/050. |
| R1-04 | backend4 High | 050 resolution awaits DNS without signal; check-after-await cannot honor deadline | Add abort-aware bounded await using same overall deadline, handle late resolver rejection and forbid late GET, held-DNS cancel/timeout negatives; underlying OS DNS may finish after caller returns. Backend docs worker. |
| R1-05 | backend5 Medium | Public fixture uses documentation IPs blocked by its own policy; mocked HTTP alone does not exercise real lookup | Policy-allowed synthetic address only behind fully intercepted transport; real trusted named-loopback HTTP socket case with mocked DNS answers proves custom lookup is actually used. No public network or bypass option. Backend docs worker. |
| R1-06 | UI F1 + security A1 High | 090:123 omits HOME but os.homedir still finds real account; startup storageMigration:99 and key loader fallback can read/copy user inputs | Keep all browser/server execution on disposable credential/media-free runner until filesystem isolation proved. Fixture copies allowlisted source/assets into owned scratch root, never package fallback/config/generated dirs; preloader provides synthetic home to app and blocks config/media reads outside fixture. Poisoned synthetic homedir/package/global migration sources must prove no read/copy. Never modify parent HOME/CODEX_HOME or trust absent env as isolation. Fixture docs worker. |
| R1-07 | UI F2 High | ChildProcess.prototype.spawn misses execFileSync/spawnSync/execSync; real quota.ts:153 can launch outside socket guard | Intercept synchronous builtin process exports as well, syncBuiltinESMExports before app imports; negatives for every synchronous/asynchronous API and real startup; no arbitrary nested executable escape. Fixture docs worker. |
| R1-08 | UI F3 Medium | JOB_TRACKING_TIMEOUT SSE message is lost in error resolver/toast and terminal restore (storeHelpers:102, mcpJob:187) | WP07 wires explicit UI error code+localized safe message and CLI restored-terminal mapping, live/reload/restart tests; no auto retry. Keep raw status error and envelope v1. Ops docs worker. |
| R1-09 | UI F4 Medium | WP11 requires Windows execution introduced only by later WP12 schedule->dispatch change | Move minimal Windows dispatch/ref/assertion route into WP11 with own exact-tip CI evidence. WP12 consumes it and adds full integrated matrix, not duplicate source owner. Ops docs worker. |
| R1-10 | security A2 High | main Pages push auto-deploys new installer while npm latest lacks new installation-only doctor; old doctor ignores flag and reads auth | WP11 removes unconditional main-push Pages deployment and adds explicit release-SHA/version compatibility gate BEFORE artifact upload/deploy. WP13 dispatches exact released site only after canonical stable provenance and install smoke pass. Keep old published site if gate fails; no standard-doctor fallback. Main owns005/110/120/130 coordination with ops worker. |
| R1-11 | security A3 Medium | close-event session disposal waits for SSE that disposal itself must end | WP12s explicitly calls idempotent access.dispose BEFORE awaiting HTTP server close, with close-event fallback; open authenticated SSE integration proves shutdown order. Main patches125. |

## Cross-blocker conflict resolution

- Fixture read isolation and synchronous spawn denial are separate boundaries; a
  socket guard cannot prove either. Do not replace these with a 'no secret env'
  assertion. Retain safe clean-runner restrictions until the tests prove isolation.
- Tests requiring a new Node flag must land with their own WP, not await WP12.
  Windows proof similarly precedes WP11 closure. A later cumulative run cannot
  retroactively establish an earlier standalone PR.
- Sparse indices remain wire-compatible. New internal identity metadata is allowed
  only with exact creation -> mapping -> final sweep chain, no content-hash dedupe
  (two legitimate identical images may be separate requested outputs).
- Pages gate needs host source/registry version/digest agreement, not a generated
  marker saying ready. Source promotion alone is not publication authorization.
- Session shutdown belongs to125 access lifecycle; do not expand WP07 into a new
  global shutdown framework.
- No public API envelope rewrite, credential changes, user-data migration or
  product redesign is authorized by these repairs.

## Evidence and review plan

Observed reviewer checks: backend18 focused + canonical seam compile0 + reproduced
TS2345/mock.module gap; UI/ops78+35 focused and all type/drift checks0; security56
focused and benign Node home/stream-close probes. These are baseline/design proof,
not implementation success. All three reviewed the current staged docs and named
their coverage; union covers every plan.

Repair docs only, update exact file maps and acceptance scenarios, stage final
amendments, then re-dispatch SAME three reviewer ids with this synthesis and
specific diff summary. FAIL cannot advance A->B. Replan if repeated repairs do
not change the causal issue. Main independently checks stage remains docs-only.
