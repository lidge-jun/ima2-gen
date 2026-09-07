# WP00 lifecycle and operations research

Status: independently rederived design evidence, not implementation or release proof.
Date: 2026-09-05. Source baseline: `ecde2bc79cddc50ff0da38091c1ce0590383090c`;
branch observed: `codex/prod-wp00-roadmap`. Scope: WP07/10/11/12 only.
The existing execution-lane draft is not an authority for these findings.

## Existing contracts to preserve

- `lib/jobs/envelope.ts:19` already defines eight phases, including `timed_out`.
  `buildEnvelope` gives terminal event names precedence over reported phases,
  retains provider vocabulary, and carries a per-job sequence. Do not recreate it.
- `lib/jobs/idempotency.ts:133` uses SQLite uniqueness to arbitrate claims and
  persists terminal payloads. Its comment explicitly rejects boot-wide unfinished
  key cleanup because multiple servers may share the database. No new job queue,
  idempotency protocol, automatic retry, or provider job resubmission is warranted.
- `lib/inflight.ts:320` stores terminal snapshots; `lib/inflight.ts:416` restores them lazily;
  `routes/health.ts:84` exposes them only with `includeTerminal`. Existing status
  vocabulary includes `completed`, `done`, `error`, and `canceled`.
- `lib/jobStatus.ts:23` normalizes the READ boundary. In particular, adding a raw
  terminal status `timed_out` would currently become `unknown`. WP07 therefore
  retains raw status `error`, with a timeout error code for envelope mapping.
- `ui/src/store/storeInflightImpl.ts:65` presents terminal errors only when raw
  status is `error`; `bin/lib/mcpJob.ts:186` normalizes status and recovers errorCode.
- `lib/eventBus.ts:24` owns the 2,000-entry replay ring; snapshots omit large image
  fields without dropping filenames. `routes/events.ts:17` serializes the envelope.
  CLI replay-gap recovery exists at `bin/lib/mcpJob.ts:240`. Browser reconnection
  resync exists at `ui/src/lib/eventChannel.ts:49`, but replay-gap has no listener.

## Verified gaps and bounded disposition

| Finding | Evidence | Owner and consequence |
|---|---|---|
| TTL cleanup deletes active state without recovery breadcrumb or local abort | `lib/inflight.ts:438-441`; fault probe active=0, terminal=0, aborted=false | WP07: expire into existing terminal table before deleting; no boot-wide cancellation |
| Registering the controller after cancellation does not abort it | `lib/inflight.ts:223-229`; late-register probe cancelled=true, aborted=false | WP07: honor fresh canceled/expired snapshot at registration |
| SSE ignores `write(false)` | `routes/events.ts:7-14`; response stub stayed open | WP07: disconnect that subscriber, bounded cleanup, retain global ring |
| Previous-process cursor is silently ahead of current ring | `lib/eventBus.ts:129-133`; after reset and one event, hasReplayGap(999)=false | WP07: report future cursor as gap; browser resets cursor/resyncs |
| Doctor reports Node 20 compatible while package requires 22 | `bin/commands/doctor.ts:145`; `package.json` engines.node=`>=22` | WP10 reads actual package requirement; WP11 projects it into installers/docs |
| Doctor bundle JSON is mixed with prior console text | `bin/commands/doctor.ts:139-255` | WP10: collect first, format once; process-level JSON parser test |
| Key verification has no deadline and calls all failures AUTH_INVALID | `bin/lib/doctor-providers.ts:163-192` | WP10: bounded requests, classify auth/rate-limit/upstream/network/timeout distinctly |
| Bundle redaction recognizes only a few token prefixes | `bin/lib/doctor-bundle.ts:5`; synthetic userinfo/query sentinel survived | WP10: structured allowlisted report; do not carry raw provider URLs/errors into bundle |
| Installers accept Node 20 and run authentication-sensitive doctor as install gate | scripts/install-{mac,linux}.sh:18, final doctor call; scripts/install-windows.ps1:19,160 | WP11: generate min-node projections and invoke WP10 installation-only check |
| Windows installer EBUSY fallback kills all node processes | `scripts/install-windows.ps1:143-144` | WP11: refuse global termination, return actionable locked-install error; test unrelated process survives |
| Existing docs generator is limited to MCP tool catalog | `scripts/generate-contract-docs.mjs:5-7` | WP11 extends projection coverage via a separate bounded runtime/install generator; retains existing tool generator |
| CI e2e checkout ignores dispatch SHA | `.github/workflows/ci.yml:214`; matrix job has explicit ref at :41 | WP12: assert exact SHA independently in every relevant job |
| Mid-stack PR bases are excluded | `.github/workflows/pr-fast.yml:8` bases=[main,dev] | WP12 removes base filter; PR merge-SHA proof and exact-tip candidate proof remain separate |
| Windows CI is schedule-only | `.github/workflows/ci.yml:165` | R1-09: WP11 owns minimal dispatch/ref/SHA gate for standalone installer proof; WP12 consumes/extends it; neither local macOS nor macmini proves Windows |
| Browser fixture is not isolated yet | `ui/e2e/fixtures/appServer.ts:104` spreads process.env; OAuth URL override only in oauth-expired mode | WP09 owns isolation and teardown; WP12 consumes it, never overwrites it |

The TTL is currently 90 minutes (`./config.ts:302-310`) and is deliberately above
the documented legal Grok video budget. Do not shorten it or infer that a stale
tracker proves upstream failure. The terminal message must say completion is
unknown, with manual inspection before another potentially billed request.

## Startup, package, and documentation source of truth

`./server.ts:484` creates context and runs migration/expiry before listening;
`./server.ts:542` shutdown stops proxy children and agent worker, then races HTTP/MCP closure
against a budget in `lib/mcp/shutdown.ts`. It does not justify a new global shutdown
framework. WP07 concerns tracker/replay recovery; shutdown redesign is not claimed.

`bin/ima2.ts:212` calls `ensureFreshUiDist(ROOT)`; `bin/lib/ui-build.ts:50` distinguishes
source checkout from installed package. Packaged source-missing with dist present is
valid. `package.json` ships `.js`, `ui/dist`, docs, skills and vendor tarballs.
`tsconfig.build.json` emits server/config/lib/routes, and `tsconfig.bin.json` emits CLI.
Existing generated `.js` siblings are ignored, not authored sources; the release test
explicitly guards that policy. `structure/00-structure-hub.md` still calls these
committed artifacts, so WP11 must correct that current statement without rewriting
historical snapshot entries as if they had always been true.

`structure/06-infra-operations.md:41` still says node >=20; AGENTS.md:11 says >=20
and names an old SDK version. README badges already say >=22. The maintained install
contract must use package metadata, not a duplicated hand-written requirements file.
Current-versus-historical text must be distinguished; no global replacement of years,
versions, archived plans, or provider counts.

## Baseline verification ledger (executed here)

All command exits below were observed on the baseline; no full local suite,
credential read, provider generation, shared browser, installation, or git mutation
was performed. Tests create/remove their own temporary SQLite directories.

| Command | Exit / observation | What it observes |
|---|---|---|
| `node --version` | 0, v24.17.0 | actual local runtime only |
| `node --import tsx --test tests/event-bus.test.ts tests/events-channel-contract.test.ts tests/inflight.test.ts tests/inflight-persistence.test.ts tests/terminal-jobs-restart.test.ts` | 0; 28 pass, 0 fail | listed lifecycle modules via direct imports; does not cover the reproduced gaps |
| `npm run typecheck` | 0 | tsconfig.json server/lib/routes source set |
| `npm run typecheck:tests` | 0 | tests/**/*.test.ts and JS overlay; not Markdown |
| `node --test tests/release-pipeline-contract.test.ts` | 0; 32 pass, 0 fail | release scripts and workflow source; existing SHA assertion is not per-job |
| `node --import tsx --test tests/cli-doctor-status-contract.test.js tests/install-windows-contract.test.js` | 0; 3 pass, 0 fail | source contracts, not real doctor JSON or Windows execution |
| `node scripts/generate-contract-docs.mjs --check` | 0, contract docs up to date | skills/ima2/SKILL.md generated MCP block only |
| `npm run test:install-policy` | 0 | root/UI locks, approvals, installed binding.gyp; not installer Node floor |
| `node scripts/classify-tests.mjs --check --fail-js-runtime` | 0 | current test inventory |
| `node scripts/refresh-structure-line-counts.mjs --check` | 0 | structure/01 generated counts only |

Additional executable probes used `node --import tsx --input-type=module -e ...`:

1. In a `mkdtempSync` directory, set IMA2_CONFIG_DIR/IMA2_DB_PATH before dynamic
   imports; `startJob`, register controller, advance `purgeStaleJobs` beyond config
   TTL. Exact output: `{"case":"stale-purge","active":0,"terminal":0,"aborted":false}`.
   Cancel another admitted job, register controller afterwards:
   `{"case":"late-register","cancelled":true,"aborted":false}`. Exit 0 means
   the observation ran, NOT that the future acceptance passed. closeDb then remove
   only the created scratch directory.
2. Invoke registered `/api/events` handler using EventEmitter request/response,
   response.write returns false, publish one phase. Output
   `{"case":"backpressure","closed":false}`. Emit close for teardown. Reset ring,
   publish one new event: `{"case":"future-cursor","gap":false}`. Exit 0.
3. `buildDoctorBundle` with a synthetic Comfy error containing URL userinfo and
   query token (opaque non-provider-prefixed sentinel); output only boolean
   `{"case":"opaque-url-secret","leaked":true}`. Exit 0. No actual secret used.
4. Parse both YAML workflows using installed `yaml`: test checkout ref is
   `${{ github.event.inputs.sha || github.sha }}`, windows/e2e ref absent, Windows
   condition is schedule-only, PR bases are main/dev. Exit 0.

Not run: standard doctor (auth/config inspection), provider verification, paid
image-probe, server bootstrap, browser suite, builds that emit files, package install,
workflow dispatch, or any future verifier whose source has not yet been implemented.
Future commands in decade docs are explicitly implementation-C gates, not baseline
greens. Markdown design quality remains independent review, not tsc coverage.

Final documentation-only check: Node filesystem checker over the five assigned
documents verified balanced code fences, every MODIFY target exists, local Markdown
links resolve, and no abbreviated file citations: exit0. HEAD remained baseline and
`git status --short` still showed only pre-existing scripts/recording. The assigned
plan directory is ignored (`git check-ignore .../070_job_lifecycle.md` returned it);
main must explicitly stage the approved documents. No source or git ref changed here.
The repository citation checker across the whole shared unit returned exit1 for
85 abbreviated citations in concurrently authored documents, including seven in
this lane; this lane's seven were corrected and its focused checker now passes.
Other lanes were not edited, and unit-wide citation health is not claimed.

## Cross-lane agreement required before roadmap lock

- WP03 retains `startJob`/`finishJob`/`publishJobEvent` and envelope v1 signatures;
  WP07 does not seize adapter execution, job IDs, or idempotency ownership.
- WP09 fixture must provide isolated config/auth directories, allowlisted child env,
  explicit loopback endpoints for each supported stub lane, refusal of all real
  outbound calls, and awaited child-exit teardown. WP12 adds no parallel fixture.
- WP10 exports report/installation mode consumed by WP11, not vice versa. Node
  requirement comes from package.json at WP10; WP11 does not change report schema.
  Import-time trap: `bin/ima2.ts:16`, `bin/commands/doctor.ts:11`, and
  `bin/lib/star-prompt.ts:5` import config, whose initialization reads user config.
  An offline/no-credential installation branch must run before those dynamic imports;
  omitting only loadConfig inside standardDoctor is insufficient.
- WP01 remains provider-capability SoT; WP11 projects live registry values only after
  WP01's contract settles. No second capability table.
- WP11 owns the initial Windows ci.yml dispatch/ref/SHA delta; WP12 extends ci.yml,
  owns pr-fast.yml and cumulative exact-candidate evidence. Main owns release.yml,
  publish.yml, merge policy and provenance; any guard extension there requires main
  integration. Before WP11, main's `--ref <tip> -f sha=<same full tip>` workaround
  aligns e2e by ref but cannot create Windows proof. WP11 adds Windows proof;
  WP12 adds all-job assertions and the mid-stack PR gate. Pages ordering is 009/111,
  separate from canonical release/publish machinery.

## A round1 consumer/ordering repair evidence (2026-09-05)

R1-08 source readback: `ui/src/lib/errorCodes.ts:245-272` does not recognize the
new code; priority class can override its spec. `ui/src/store/storeHelpers.ts:102`
uses generic restored failure text; :143 filters old IDs before reconciliation.
`ui/src/store/storeInflightImpl.ts:177` prefers current IDs and never reads older
persisted IDs when any current ID exists. `ui/src/store/storeVideoImpl.ts:248,346`
and `ui/src/store/storeSettingsImpl.ts:45` bypass the shared error handler.
`bin/lib/mcpJob.ts:187` restores meta.message rather than tracking-expiry meaning.
`tests/node-error-info-contract.test.ts:14` is an exhaustive typed registry consumer
and must include the new code even though its default runtime branch stays unchanged.
The complete bounded correction belongs in 070, not a new terminal status/schema.

Executed read-only design probe: `node --input-type=module` stdin program imported
installed TypeScript, loaded four source files, applied proposed text replacements
in a Map, and used a CompilerHost readFile override with noEmit and a writeFile
trap. Parsed actual ui/tsconfig.app.json (`include:["src"]`); diagnostics=0 for
virtual errorCodes.ts/sseStreamError.ts/storeHelpers.ts/storeInflightImpl.ts changes.
No source file, build output or compiler cache was written.

The same probe transpiled the actual error resolver/class spec/parser and extracted
the actual terminalJobError declaration into isolated VM contexts. Assertions:
two explicit/wrapped-code resolver cases, two envelope/flat SSE cases and restored
code/status/message passed; hostile synthetic text and AUTH_EXPIRED class did not
escape the fixed timeout branch. Baseline resolver independently produced UNKNOWN;
proposed resolver produced JOB_TRACKING_TIMEOUT. Process exit0. This is partial
in-memory design/type proof, NOT a live toast/browser, CLI, SQLite, full planned
delta typecheck or implementation-test pass. Those future gates remain unrun.

R1-09 readback: existing Windows schedule-only condition and absent checkout ref
confirmed in actual ci.yml; 110 now creates comparator/test and explicit installer
step in WP11. 120 consumes those definitions. A second read-only stdin Node probe
extracted the proposed comparator's JS block from 110 and evaluated it in a VM:
actual HEAD/full SHA accepted; different/empty/short/uppercase/null SHA rejected
(one positive, five negatives), exit0. Parsed actual ci.yml independently confirmed
Windows schedule-only/ref absent. No workflow dispatch or candidate job was run.
R1-10 source was read, not published:
009 decision and main-owned 111 exact Pages contract are linked by 110/120.
Final lane-only structural probe: four assigned Markdown documents, six resolvable
relative links, 61 existing MODIFY targets, balanced code fences; exit0.
`git diff --check --` those four paths also exited0. These checks validate file
structure/whitespace, not plan correctness; independent A re-audit is still required.

## A round2 R2-U1 async reconciliation repair evidence (2026-09-05)

008_1 synthesis accepted the lost-update regression introduced by the R1 design:
baseline `ui/src/store/storeInflightImpl.ts:170-178` awaits before reading local
state; the earlier 070 amendment froze that state before await. 070 now uses a
prefetch ID/revision snapshot only for scopes/comparison, then rereads both raw
storage and current memory (memory wins). Current additions/replacements survive;
IDs removed from both sources cannot re-enter through the stale active response.
Changed mode/session discards that response without writes or toasts. Local revision
strings and memory references are invocation-local; no global epoch/schema added.

An intermediate proposal incorrectly compared server/local startedAt. Main identified
this before acceptance: `ui/src/store/storeGenImpl.ts:71,295` and `lib/inflight.ts:170`
independently assign Date.now. Those cross-clock guards were removed. Correlation
remains requestId-based; revision timestamps compare LOCAL before/after state only.
No claim of solving pre-existing indistinguishable stored-only same-ID ABA reuse.

Read-only `node --input-type=module` stdin proof extracts the exact helper/function
TS blocks from 070, not a second handwritten merger. Replaces the current function
only in a CompilerHost readFile Map plus the planned loadInFlight optional argument;
actual ui/tsconfig.app.json, noEmit, incremental=false, writeFile trap: diagnostics=0.
The replacement reconcile function is 48 lines; its two private helpers are small.

For execution, transpile those same blocks and the actual loadInFlight/scope/restore
helpers in a VM. Deferred fetch, memory storage/store, prompt-normalization and toast
sinks are boundary doubles. Sixteen held-response scenarios pass: addition with
conflicting disk copy; removal with stale active response; same-ID replacement with
absent/active/terminal response; same-timestamp new object; in-place cancel phase;
expired raw terminal plus new job; node A->B and node->classic scope switches;
client1000/server1010 active and terminal; negative server-clock skew active and
terminal; already recovered terminal; stored-only replacement. Every case asserts
memory/persisted IDs, activeGenerations, warning count and zero automatic POSTs.
Scope-switch cases also assert zero set/save calls. Process exit0, zero disk writes.

Five independent mutations were rejected: freeze fresh local to prefetch; remove
removed-ID suppression; remove concurrent revision protection; remove scope discard;
reintroduce invalid terminal timestamp equality. Initial probe exit1 was a harness
cross-realm deepStrictEqual array-prototype mismatch (both displayed ['new']); host
Array.from normalization fixed the oracle, not the proposed state behavior. Final
16-scenario/5-mutation probe exited0. R1 localized warning code/dictionaries unchanged.

Limits: partial in-memory design/type proof, not future production tests, rendered
toast, real HTTP/SQLite/server/CLI or browser proof. No source/test/FSM/git action.
