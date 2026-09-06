# WP00 visual research — source-derived, not implementation evidence

Date: 2026-09-05. Source baseline: `ecde2bc79cddc50ff0da38091c1ce0590383090c`.
Scope: WP08 pane geometry and WP09 journeys. This document contains findings;
implementation deltas belong in `080_composer_contract.md` and
`090_user_journeys.md`. No runtime/source/test changes were made in WP00.
The unrelated untracked `scripts/recording/` directory is preserved.

## Evidence and interpretation

The source and callers below were independently read; the older execution-lane
drafts were not used as evidence. This is a bounded C3 documentation task; fixture
isolation receives C4 care because a test can otherwise contact a live account.
Existing React, CSS, node:test and installed Playwright conventions are reused.
No new design system, pane framework, browser installation or paid generation is
needed. No public-web/provider-behavior claim is made by this local-source research.

| Verified anchor | Finding / design consequence |
| --- | --- |
| `ui/src/components/PromptComposer.tsx:21`, `:42`, `:366`, `:475` | `variant?: "sidebar" \| "bottom"`; positive field, mirror and negative field precede the existing toolbar. Keep these DOM classes and callback ownership. |
| `ui/src/components/PromptComposer.tsx:228` | Autosize caches computed max-height by variant. CSS desktop/mobile resets already override inline height; do not introduce a second JS pane-sizing engine. |
| `ui/src/components/NegativePromptField.tsx:4`, `:23`, `:29` | Props are `variant: "classic" \| "home"`, `onSubmit: () => void`. Provider gating is inside the component; switching away must not erase the negative draft. |
| `ui/src/components/home/HomePromptComposer.tsx:37`, `:52`, `:108` | Separate home editing surface; submit uses its existing busy/empty guard then switches to classic. It has no mention engine. Sharing geometry must not imply sharing submission policy. |
| `ui/src/components/Sidebar.tsx:33`, `:48`; `ui/src/components/classic/ClassicWorkspace.tsx:12` | Default desktop owns the sidebar composer; prompt-studio desktop owns the bottom composer. They are alternatives, not two panes to render simultaneously. |
| `ui/src/components/MobileComposeSheet.tsx:108`, `:169` | Mobile classic sheet reuses `PromptComposer` with default sidebar variant; sheet has its own scroll body and actions. Home does not open this classic sheet. |
| `ui/src/hooks/useIsMobile.ts:3`; `ui/src/App.tsx:85` | App's mobile breakpoint is 800px; the 719px pane container breakpoint is a different axis. Preserve both. |
| `ui/src/components/composer/DeadTagMirror.tsx:12`, `:43` | Mirror copies typography/box metrics, measures DOM Ranges, observes textarea resize and scroll. It must remain the textarea's positioned sibling, pointer-transparent and `aria-hidden`. |
| `ui/src/components/PromptComposer.tsx:378`, `:395`, `:402` | IME suppresses mention updates, but Ctrl/Cmd+Enter submission lacks a composing check. Home and negative handlers also lack it. Guard composition without changing ordinary submit shortcuts. |
| `ui/src/store/storeSettingsImpl.ts:598`, `:603`; `ui/src/store/storePersistence.ts:412`; `ui/src/store/useAppStore.ts:269` | Both drafts persist through `saveGenerationDefaultsPatch`, load as strings, then hydrate. Geometry needs no persisted field or schema migration. |

## Current geometry ownership

`main.tsx:3` imports `index.css`; the latter imports progress/provider/responsive
styles. `main.tsx:8`, `:9`, `:25` then import classic, composer-flow and home styles.
`HomeWorkspace.tsx:3` also imports home styles. Moving a declaration without
removing its old owner can therefore preserve or introduce order-dependent wins.

| Owner | Actual responsibility at baseline |
| --- | --- |
| `ui/src/styles/progress-composer.css:202`, `:491`, `:522`, `:562`, `:583` | Composer container/tokens; dual columns/positive panel; mirror; textarea; desktop sidebar growth/reset and 72px dual floor. |
| `ui/src/styles/provider-controls.css:197` | Entire negative prompt skin and geometry, including classic cap and duplicated home metrics; not merely provider settings controls. |
| `ui/src/styles/classic-workspace.css:94`, `:105`, `:143` | Dock cap, bottom 86px/148px textarea tokens, dual dock 52dvh/420px cap and pane-grid scroll. |
| `ui/src/styles/responsive-layout.css:189`, `:204` | Sheet body scroll; prompt composer/stack and both textareas receive 160px sizing. |
| `ui/src/styles/home-workspace.css:270`, `:304`, `:432` | Dual layout; home 168px textarea floor; 144px floor at <=480px. |
| `ui/src/styles/sidebar.css:22` | 7:3 composer/spacer split; dual pane removes the spacer. This is host allocation, not input styling. |
| `ui/src/styles/composer-flow.css:1` | Inserted-prompt chip controls only. Do not turn it into a second pane stylesheet. |

`git show ecde2bc7 -- ui/src/styles` confirms the protected correction:
sidebar dual rows keep their content minimum, both textarea minima become 72px,
the sidebar spacer yields, bottom grid scrolls under its toolbar, and mobile resets
cover both fields. This is a behavioral baseline, not a reason to preserve scattered
file placement. Single-pane wrappers use `display: contents`; changing them to
unconditional flex/grid would change non-NAI geometry.

## Existing visual artifacts actually inspected

These are existing files, viewed during WP00, not screenshots captured this turn.
Their filenames do not prove their build SHA. Do not reuse as current-head release
proof; WP12 must capture, inspect and bind new evidence to its build.

| Existing artifact under `devlog/_artifacts/260905_nai_negative_geometry/` | Observed |
| --- | --- |
| `j7-s1-sidebar.png` (1157×826) | Vertically stacked positive/negative cards, labels and hints visible, toolbar and Generate below. NovelAI missing-token state is visible; no upstream success evidence. |
| `j7-s2-bottom.png` (1440×1000) | Dock is scrolled to the negative pane while toolbar stays visible. Positive pane is out of the scrollport: requiring both full pane boxes inside the grid at once would reject intended scrolling. |
| `j7-s3-mobile.png` (390×844) | Sheet shows positive pane and upper negative pane; sticky Generate remains visible. Screenshot alone cannot prove lower hint reachability or focus visibility after scrolling. |

## Journey gaps grounded in the existing harness

Read all seven `ui/e2e/j1-*.spec.ts` through `j7-*.spec.ts`.
J1 checks fake MiniMax key entry and gallery output; J2 checks auth error → Settings
→ return; J3 checks classified billing error; J4 opens an empty node graph; J5
restarts with one isolated home; J6's three cases cover stale/removed Comfy selection;
J7's three cases measure sidebar/bottom/mobile negative geometry.

- J7 sidebar measures both floors, but bottom/mobile do not independently assert
  both fields; home, long input, locale expansion, narrow/short windows, theme,
  real provider toggles and IME activation are absent.
- J7's toolbar test measures direct child centers, including a wrapper. WP09 must
  test actual buttons (including the nested save button) and use trial click for
  enabled controls. Visibility alone does not prove a control receives input.
- `appServer.ts:20-59` installs a seed on every document navigation. Reload can
  overwrite the result of user edits and hide persistence regressions. J6-S2
  genuinely calls the UI setter but does not reload afterward.
- J5 restarts on a different ephemeral origin; it proves server-side gallery
  recovery, not same-origin browser localStorage persistence. Keep these separate.
- `appServer.ts:97` spreads ambient env, sets OAuth port only for `oauth-expired`,
  and never pins the Grok port. Autostart disabled is not network disabled.
  `config.ts:221`, `:345` otherwise select 10531/18645 on real loopback services.
- `server.ts:1` loads `dotenv/config`. Sanitizing child env alone still permits a
  repository `.env` read. `config.ts:49-65` also has a repo fallback config file;
  a valid explicit config protects this loader only. The key loaders at
  `server.ts:52-203` continue to package `.ima2/config.json` when the key is absent,
  even if primary config parsed. WP09 must use an owned allowlisted projection,
  exclude package fallback/data, and install file-read guards before app imports.
- `lib/storageMigration.ts:99-166,300-309` reads OS home and executable/global
  locations during startup (`server.ts:487`). Missing HOME does not prevent
  `os.homedir()` from resolving the account. Existing `IMA2_TEST_HOME`,
  `IMA2_TEST_EXEC_PATH`, `IMA2_TEST_ARGV1` redirect many paths, but the two fixed
  prefixes `/opt/homebrew` and `/usr/local` remain. App-facing homedir override and
  pre-import filesystem interception are independent obligations; no parent
  HOME/CODEX_HOME mutation, no claim of native/OS sandboxing.
- `lib/agyCli.ts:21-33` falls back from an absent override to user-local binaries.
  A nonexistent `IMA2_AGY_BIN` is not isolation. `routes/models.ts:340-363` probes
  the installed CLI with `--version`; the fixture must prevent provider subprocesses.
- `routes/quota.ts:153` uses `execFileSync` for `grok version`;
  `lib/codexDetect.ts:14,73,90-123` caches homedir then uses synchronous bundled
  Node/PATH/Windows probes for CLI login/keyring status. An asynchronous spawn
  prototype guard misses them. WP09 intercepts all sync and async process exports,
  synchronizes named ESM exports, and tests real quota/Codex discovery separately
  from generic rejection tests. Expected refusals never report authenticated.
- A guard installed before `--import tsx` can block its own compiler service or
  worker. The amended fixture instead launches verified emitted `server.js` after
  server/CLI builds. It has NO esbuild/worker/process exception. The git-tracked TS
  source projection and its separately enumerated emitted-JS runtime manifest are
  different inputs/evidence; generated JS is not described as git-tracked source.
- R2-S2 source check: `ui/package.json` build currently ends with `vite build`;
  `ui/vite.config.ts:30` enables Vite's manifest but no revision/input/output receipt
  producer exists. That manifest is not a complete dist inventory: index.html and
  copied `ui/public/fonts/*.woff2` need independent coverage. WP09 must introduce
  its producer before its projection consumer requires this evidence.
- UI input hashing cannot stop at `ui/src`: `ui/src/lib/presets.ts:1-4` imports
  root preset JSON and presetCompiler; `ui/src/lib/videoMotionSelection.ts:4`
  imports videoMotionPresets; the two generation stores import presetCompiler.js.
  `ui/vite.config.ts:4` imports `ui/dev/resolveDevApiTarget.mjs`. The complete
  explicit inventory in `090` includes these TS/emitted-JS/JSON inputs, UI configs,
  public assets and lockfiles. Git HEAD alone misses dirty input or output drift.
- `stubUpstream.ts:40-46` records Host headers only on requests that reached that
  stub. `assertStubOnlyCalls()` cannot see a request sent elsewhere and is not an
  egress barrier. A separate denied-connection test is mandatory.
- `ui/playwright.config.ts:11` disables traces. Existing CI uploads
  `ui/test-results/` on failure (`.github/workflows/ci.yml:232`); new fixture tests
  should attach safe geometry/state evidence there, not merely save unused PNGs.

## Observed baseline commands

All run against the source baseline before these documents were created.

| Command | Observed outcome / what it observes |
| --- | --- |
| `git rev-parse HEAD` | exit 0, `ecde2bc79cddc50ff0da38091c1ce0590383090c`. |
| `node --import tsx --test tests/nai-dual-prompt-contract.test.ts tests/composer-mention-parity-contract.test.js tests/mobile-compose-sheet-accessibility-contract.test.js tests/model-select-lane-gating.test.ts` | exit 0, 35 passed / 0 failed. Source-contract tests and model resolver logic, not browser geometry. Direct file arguments observe this slice. |
| `(cd ui && npm run typecheck:e2e)` | exit 0; `tsconfig.e2e.json` includes `e2e` and `playwright.config.ts`. |
| `(cd ui && ./node_modules/.bin/tsc -p tsconfig.app.json --noEmit)` | exit 0; config includes `src`, observes TS/TSX but not computed CSS. |
| `(cd ui && npm run test:e2e -- --list)` | exit 0, 11 tests / 7 files. Discovers tests only; no browser/server execution or visual pass implied. |

Runtime E2E, full suites, builds which overwrite `ui/dist`, paid generations,
live browser interaction and credential-file reads were deliberately NOT run.
Initial guessed paths `storeProviderImpl.ts`, `storeSubscriptions.ts`,
`hooks/useAppInit.ts`, and `docs/runtime-test-inventory.md` returned absent-path
errors; corrected owners are `storeSettingsImpl.ts`, `App.tsx` and
`docs/migration/runtime-test-inventory.md`. They are not verifier commands.

## Cross-lane agreements required before implementation

1. WP02 owns provider/model selection semantics. WP09 consumes real setters and
   the retained persistence keys, not a second resolver. Pin exact model/label and
   request expectations in test data after WP02 audit; never derive expected output
   by calling the production resolver under test.
2. WP08 owns geometry and minimal IME guards; WP09 owns new journey/fixture tests.
   Existing J7 protection accompanies WP08 and remains independently meaningful.
3. WP09 owns `ui/e2e/fixtures/appServer.ts`, `stubUpstream.ts` and test-only isolation
   support. WP12 consumes their signatures unchanged and owns integrated evidence
   orchestration/build-SHA binding. WP09 also owns the minimal existing e2e-job
   server/CLI prebuild steps needed for its emitted-JS child; WP12 extends these
   later with its stronger artifact checks rather than first adding the builds.
   R2-S2 also assigns WP09 the single-parent build/receipt wrapper
   `scripts/write-ui-build-receipt.mjs`, shared schema/validator, and `ui/package.json`
   integration. Receipt is `ui/dist/.ima2-ui-build-receipt.json`, with source digest,
   optional Git HEAD, safe normalized build flags and the entire regular-file dist
   inventory excluding only itself. `createAppProjection` verifies current inputs,
   HEAD and every output before copying, then rechecks copied files/inventory.
   No missing/stale-receipt bypass. Source archives may bind by input digest;
   exact-head CI requires Git. Main's `120` consumes this WP09 producer/validator.
   `startApp`, retained `home`, `seedBrowser`, transport/process counters and
   `holdNextGeneration(): {submitted:Promise<void>;release():void}` remain stable.
   No competing fixture implementation in WP12. Main must align `120`'s ownership
   paragraph with this A-repair; this worker cannot write that document.
4. WP07's lifecycle behavior is consumed by J5 and WP12, not reimplemented in WP09.
   A reload/reset fixture must not quietly stand in for restart recovery.
5. Main's WP12s (after WP12, before release; `125` design) owns LAN bootstrap,
   session cookies and generated-media security. WP09 remains normal loopback
   mode and adds no token/header/cookie bypass. WP12s may extend this fixture only
   for its explicitly isolated LAN scenarios; no current authentication failure
   may be converted into successful unauthenticated behavior by fixture changes.

## R1-06/R1-07 repair evidence limits

The accepted causal repairs and exact fixture contracts are in `090`, not new
implementation here. Required independent activation: synthetic poisoned package/
home/global migration inputs (no original content read/copied), named ESM homedir,
all sync/async process APIs plus Worker, actual guarded emitted startup, real
quota/Codex unavailable states, and owned cleanup after failure/restart. File and
socket boundaries must each fire under their own negative, not share one assertion.

All browser/server execution remains on a clean disposable credential/media-free
runner until real relevant-path poisoned-file tests are executed and reviewed by
main. In-memory code tests are narrower evidence only. Native-addon syscalls,
internal loader reads and filesystem races remain outside the JS guard claim;
no synthetic fixture test proves an OS security sandbox. No app runtime proof,
browser or credential read was performed during this documentation amendment.

## R2-S1/R2-S2 amendment interpretation

The R2 synthesis is `008_1_audit_round2_synthesis.md` and was read in full.
I6's real-loader `existsSync` fallback refusal is EXPECTED: increment the safe
metadata counter, zero poison reads/copies, empty unexpected denials and successful
ordinary assertClean. Only the separate I6-content case forces an actual forbidden
content read/copy, producing an unexpected denial and asserted assertClean failure.
The same path does not imply the same operation or expected outcome.

The receipt is a trusted-build integrity record, not a cryptographic proof against
a malicious builder. WP09 begins with an input/head snapshot, finishes only after
successful Vite plus unchanged source checks, and records every regular output
(HTML, public fonts, hidden manifest, maps and other public files). No environment
secrets or absolute operator paths are serialized. UIR-1–10 cover valid, absent,
stale HEAD, changed input, same-size HTML/font tampering, extra/missing output,
archive binding, build races and privacy/cleanup. These are planned future tests;
no receipt producer, Vite build or filesystem fixture was executed in this repair.

Build prelude amendment: one wrapper owns the original two tsc stages and Vite,
plus a nonce-bound exclusive `ui/node_modules/.cache/ima2-ui-build/active` directory.
This is already ignored (`.gitignore:4`), outside Vite's wiped dist. Missing/foreign
transactions, concurrent builds and invalidated source snapshots cannot finish;
normal failures clean owned state, crashes leave an ignored BUSY lock rather than
certifying old output. No build state in `.codexclaw`, `.ima2` or unignored root
files, and no release assert-clean exception. Source ZIPs install dependencies,
build server/CLI prerequisites then use digest-only receipt binding; exact-head
CI still requires real Git HEAD. Lock/watcher and release-cleanliness tests remain
planned, not executed evidence.

Documentation handoff: main already staged the roadmap snapshot; this worker
changes only `003` and `090` via apply_patch, not the index or other lanes' files.

## R3 integration correction

008_2 records the root-cause analysis: strict fixture receipt policy must not
replace ordinary product builds. WP09 adds build:fixture and changes only E2E/
PR-fast browser build steps after server/CLI emit. Normal build/ui:build/prepack/
release/serve auto-rebuild retain their original commands and .env behavior.
appProjection still requires strict certification; ordinary artifacts cannot
fall back into it. Clean-checkout prepack and synthetic .env compatibility tests
plus strict refusal/success cases are required at implementation C. No build or
publication was executed for this documentation correction.
