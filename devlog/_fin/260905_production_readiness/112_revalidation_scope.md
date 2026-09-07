# WP11 P — current-tree installation scope and lean delivery

Consumes110/111 and WP10 D105. Basec4fc8ec1, frozen verified WP10source53c4dea3.
Branch codex/prod-wp11-installation. One C4 installation/publication-boundary
repair cycle. User steering098 applies: product delivery before test platforms.
Goal: reject unsupported runtimes, install once without collateral process/file
changes, verify offline before launch, and publish compatible site/package pairs.
Non-goals: Node-manager replacement, global cleanup, credential probes, framework
or dependency upgrades, new generic emitted-code comparison tooling.
Stop:110/111 product acceptance plus this scope amendment, actual Linux/Windows
fixture behavior and same-source fullCI/CodeQL; then PR above212 and D evidence.
Memory:110-115docs and session wp11 evidence. DONE requires fresh proof; external
permission/environment failure is BLOCKED/NEEDS_HUMAN, never an automatic waiver.
Scope: repo/owned fixtures/existing GitHub CI only, zero paid provider calls,
no local installer/server/doctor or real account/keyring/port execution. Local
checks stay pure/static/typecheck. Hosted CI owns actual scripts and packed CLI.
Four-hour WP reassessment and existing72-hour goal bound; no numeric token budget.

## Current evidence and reuse

Main read allthree source installers, existing Windows tests, package/prepack,
packed-install smoke, Pages/Windows CI and release-contract owners. `cxc map
scripts --map-tokens 1800` found the existing release, install-policy and build
owners before targeted searches. Terms:MIN_NODE, Stop-Process, pkill, doctor,
engine, assertFullSha, parseStableVersion and packageManager.

- Both shells still embed20, stop matching processes, retry any npm error with
  sudo and hide standard doctor output; Linux additionally discards npm stderr.
- Windows also deletes the global npm `.package-lock.json` before install. This
  is another collateral user-state mutation in the exact installer scope: remove
  that entire pre-clean block with the process/cache retries. Update the old
  Join-Path assertion to assert absence of that deletion; retain PS5.1-safe npm
  warning/exit handling and source/public byte parity. No permission broadening.
- Windows `Refresh-Path` resets PATH. Hosted behavioral fixtures must intercept
  node/npm/ima2 as child PowerShell functions, not assume a PATH shim survives.
  Use powershell.exe onWindows to exercise PS5.1. POSIX fixtures use owned PATH
  shims. Neither fixture may call real installs, privilege tools or account APIs.
- WP10 exports and installation schema exactly match110; reuse without changes.
- Existing package.json prepack rebuilds UI/server/CLI before packing, and
  tests/package-install-smoke.mjs installs that tarball into an unrelated temp
  project and executes packaged .js. Use that existing release evidence path.
- Existing release-contract finalization verifies registry/tag/provenance. Pages
  must invoke it unchanged; new Pages validation only binds install report and
  site source compatibility, as111 specifies. No live Pages action in this WP.

## Product, necessary verification, auxiliary tooling

Product:three safe installer scripts and synchronized public copies; package-
derived runtime/doc projection; offline launch prerequisite; release-bound Pages
publication order and compatible installed report; current source/install docs.
Necessary verification:existing install-policy/source-public checks, bounded
real-script fixtures, generator drift/error checks, Windows exact-SHA dispatch,
Pages negative/order checks, and existing packed smoke extended with installation
JSON assertions. Existing fullCI remains final candidate gate, not each repair.

Auxiliary tooling NOT built: scripts/check-built-runtime.mjs,
tests/built-runtime-drift.test.ts and verify:built-runtime npm script from110.
That planned local emitted-file comparison feature is explicitly withdrawn under
the owner's no-foundation-expansion direction, not claimed satisfied. Release
freshness still requires the existing clean-checkout build/prepack and actual
installed .js smoke; no build, package or release gate is removed. Source users
are instructed to build before running emitted JS. No new replacement checker,
benchmark, matrix or parallel framework is added to compensate.

Allremaining110/111 manifests/contracts apply. Generator stays necessary because
the three standalone distributed scripts cannot read the repository package.json;
it projects the source floor before publication, including the >=24 mutation.
Keep one small assert-ci-sha command from110: unlike wait-ci-gate's poller, it
checks the current checkout before dependency commands on Windows. Do not widen
the existing poller or canonical release/publish workflows.

## B ownership and minimal proof

After A approval two independent workers may run; both omit model/effort fields.
Worker installers writes only scripts/install-{mac,linux}.sh,
scripts/install-windows.ps1, tests/install-runtime-contract.test.ts and
tests/install-windows-contract.test.js. It inserts the exact generated markers
from110, keeps native fixture execution hosted-only, and owns no public copy.
Worker projection/docs writes only generate-runtime-install-contract.mjs,
runtime-install-projection.test.ts, the five READMEs, NPX_QUICKSTART, AGENTS,
structure/00 and runtime sections ofstructure/06. It may run generation ONLY on
owned scratch fixtures while installers are in flight, never on the live repo.
Main owns package scripts, CI/Pages guards and tests, packed smoke, inventory/map,
and final projection/public-copy generation AFTER both workers stop writing.
Main adds the Pages note tostructure/06 only after the docs worker is finished.
Workers cannot commit, push, launch services, run full local suites or spawn peers.
After two distinct failed actors main reclaims the slice; any new downward
delegation/write domain needs a P amendment, not a mid-B improvisation.

Baseline actually executed: Windows static tests2pass, install-policy exit0,
MCP contract projection --check exit0, release-pipeline tests32pass, shell bash-n
exit0, root/test typechecks0. Static tests read the existing script paths; they do
not prove safe real installation. Typechecks observe their declared TS inputs,
not future MJS/shell semantics. Future new-file verifier commands from110/111
become runnable only after files exist; no preclaimed green. Omit only the
withdrawn built-runtime checker/test commands.

Each script fixture records Node/npm/doctor/serve calls; unsupported Node exits
before npm, npm failure means oneattempt/no doctor/serve, doctor failure means
no serve, success means exact offline command then serve. Forbidden process,
privilege/cache/global-lock operations fail visibly; an owned unrelated sentinel
remains alive. Synthetic engine24 must reject Node22. Clean up only owned fixture
paths/children, with bounded child timeouts. Platform-only omissions must be
reported, never substituted for real same-tip Windows job evidence.

SoT:runtime tables/installer guidance in README variants, AGENTS andstructure/06;
TS-source/ignored-emitted-JS correction instructure/00. Preserve historical
snapshot wording as history while adding current policy. No provider rewrite,
API/DOCKER auth claims or site visual redesign. WP12 owns remaining security,
macOS native watcher, integrated gates and local-platform evidence. WP13 owns
bottom-up merges, canonical release and actual Pages publication.
