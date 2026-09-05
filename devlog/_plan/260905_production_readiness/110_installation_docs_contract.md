# WP11 — Install the supported runtime without collateral process changes

Status: WP00 diff-level design. No installer/build/source execution in WP00.
Class C4 installation/supply-chain boundary. Archetype repair. Trigger: installers
accept Node 20 while package requires >=22, run auth-sensitive doctor after install,
and may kill unrelated Node processes. Goal: installation succeeds/fails according
to the actual package runtime contract, with reproducible generated documentation
and no implied authentication or upstream-generation proof.
Non-goals: new installer framework, remote bootstrap metadata service, Node manager
replacement, automatic privilege elevation/process killing, release-script rewrite.
Verifier: isolated installer command recordings, package-engine fixtures, projection
negative tests and hosted packed-runtime smoke. Stop on all acceptance rows plus
independent review. Main owns git/release; scope expansion goes upward only.

## Dependencies and authority

Semantic prerequisites: WP10 exports below; WP01 remains registry authority, but
this WP generates runtime/install metadata only and does NOT create a second
provider capability table. Stack base WP10, next WP12. The current package's
`engines.node`, `packageManager`, `bin.ima2`, `files`, build scripts and `.node-version`
are authoritative; do not introduce a runtime-policy.json that duplicates them.

Later WP12s owns cookie/header LAN bootstrap and protected generated media, including
API/DOCKER documentation. This WP does not project future media/auth behavior or
edit those docs. Its installation-only doctor is network/auth-free, so security
bootstrap must not become an installation prerequisite.

WP10→11 frozen seam:

```ts
// bin/lib/doctor-runtime.ts
parseMinimumNodeMajor(engine: unknown): number;
checkNodeEngine(version: string, engine: unknown): DoctorCheckLine;
buildInstallationDoctorLines(root: string): DoctorCheckLine[];
// CLI
// ima2 doctor --installation --json
// stdout: DoctorReport schemaVersion=1, mode="installation"
// exit: summary.exitCode (0 passes/warnings, 1 failed local prerequisite)
```

Report schema is fully specified in [100_runtime_diagnostics.md](100_runtime_diagnostics.md).
WP11 adds no schema fields; a missing provider credential must not make this mode
fail, and no config/auth inspection or fetch is allowed in installation mode.
The Node 20→22 runtime fix lives in WP10 and is re-verified here across installers;
this WP is NOT just a docs refresh.

R1-09: this WP also owns the minimal Windows dispatch/ref/SHA path needed to
verify its own installer. It has no WP12 prerequisite. R1-10 publication ordering
is governed by [009_publication_order_decision.md](009_publication_order_decision.md):
Pages changes are admitted here; canonical release.yml/publish.yml stay unchanged.
The exact executable Pages contract is
[111_pages_publication_gate.md](111_pages_publication_gate.md), part of this same
WP11/PR. Main owns 111 and WP13 dispatch coordination; it is not deferred design.

## File change manifest

| Action | Exact path | Change |
|---|---|---|
| NEW | `scripts/generate-runtime-install-contract.mjs` | Deterministic package-derived marker projection/check, root option for fixtures |
| NEW | `scripts/check-built-runtime.mjs` | Compare isolated compiler output against emitted runtime files, no workspace writes |
| MODIFY | `scripts/install-mac.sh` | Generated min-node marker, offline installation doctor, no pkill/sudo retry |
| MODIFY | `scripts/install-linux.sh` | Same contract as macOS |
| MODIFY | `scripts/install-windows.ps1` | Same node floor/doctor contract, remove global stop/cache-clean retries |
| MODIFY | `site/public/install-mac.sh` | Exact generated copy of source script |
| MODIFY | `site/public/install-linux.sh` | Exact generated copy of source script |
| MODIFY | `site/public/install-windows.ps1` | Exact generated copy of source script |
| MODIFY | `package.json` | Add runtime/docs verification scripts; retain current engine/toolchain |
| MODIFY | `.github/workflows/ci.yml` | Windows schedule-or-dispatch activation, explicit candidate ref, unconditional SHA guard and installer behavior step |
| NEW | `scripts/assert-ci-sha.mjs` | Read-only full-SHA/HEAD comparator, first delivered here and reused by WP12 |
| NEW | `tests/ci-windows-candidate.test.ts` | Comparator execution and parsed Windows workflow mutation tests, independently runnable before WP12 |
| MODIFY | `.github/workflows/pages.yml` | Stage publication behind revision-bound compatibility verification before upload/deploy; exact contract in 111 |
| NEW | `scripts/pages-publication-gate.mjs` | Main-owned staged-publication compatibility guard specified in 111 |
| NEW | `tests/pages-publication-contract.test.ts` | Main-owned guard and parsed Pages ordering negatives; registered in WP11, consumed by WP12 |
| MODIFY | `README.md` | Runtime marker block and safe install behavior description |
| MODIFY | `docs/README.ko.md` | Same machine values and localized install behavior |
| MODIFY | `docs/README.ja.md` | Same machine values and localized install behavior |
| MODIFY | `docs/README.zh-CN.md` | Same machine values and localized install behavior |
| MODIFY | `docs/README.zh-TW.md` | Same machine values and localized install behavior |
| MODIFY | `docs/NPX_QUICKSTART.md` | Install-only doctor example and package-vs-source distinction |
| MODIFY | `AGENTS.md` | Current runtime/SDK values and accurate test runner commands; historical counts removed |
| MODIFY | `structure/00-structure-hub.md` | Current TS source/emitted ignored JS policy note |
| MODIFY | `structure/06-infra-operations.md` | Generated runtime table, docs/build checks, safe failure instructions |
| MODIFY | `tests/install-windows-contract.test.js` | Keep source/public parity and PS5.1 compatibility checks |
| NEW | `tests/install-runtime-contract.test.ts` | Real shell fixtures and engine/doctor cross-surface assertions |
| NEW | `tests/runtime-install-projection.test.ts` | Two-source metadata comparison and mutation fixtures |
| NEW | `tests/built-runtime-drift.test.ts` | Isolated compare success/missing/stale fixtures |
| MODIFY | `tests/package-install-smoke.mjs` | Assert installed JSON-mode contract before existing safe health smoke |
| MODIFY | `docs/migration/runtime-test-inventory.md` | Regenerate test inventory |
| MODIFY | `structure/01-file-function-map.md` | New scripts/test owner references and counts |

DELETE files: none. Remove unsafe blocks only inside existing installers. Preserve
user data directories, registry/login state, dependency allowScripts and vendor pins.
Do not include release.yml/publish.yml edits. WP11 wires its Windows and Pages
guards; WP12 extends integrated CI gates; main owns publication/release actions.

## Standalone Windows candidate gate (R1-09)

Move the original WP12 comparator creation into this WP. Complete file contract
for `scripts/assert-ci-sha.mjs`: import only built-in child_process/url/path;
export the following pure function and use an import-safe ESM CLI main guard.

```js
export function assertCiSha(expected, actual) {
  if (!/^[0-9a-f]{40}$/.test(expected)) throw new Error('EXPECTED_SHA must be a full lowercase 40-hex SHA');
  if (!/^[0-9a-f]{40}$/.test(actual)) throw new Error('HEAD must be a full lowercase 40-hex SHA');
  if (expected !== actual) throw new Error('checked-out HEAD differs from EXPECTED_SHA');
  return { expectedSha: expected, actualSha: actual };
}
```

CLI executes `git rev-parse HEAD` with execFileSync, validates EXPECTED_SHA using
this function, prints comparison JSON only, and catches errors to stderr/exit1.
Import executes no git command. No fetch, ref mutation, network, credentials,
release fallback, or shell evaluation. WP12 reuses these bytes without a second
comparator or duplicate source ownership.

In `.github/workflows/ci.yml`, replace Windows' schedule-only condition and comments
that exclude candidate/release dispatch with:

```yaml
if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
```

Add to the existing pinned Windows checkout:

```yaml
with:
  ref: ${{ github.event.inputs.sha || github.sha }}
  fetch-depth: 0
```

Insert immediately after setup-node, BEFORE Pin npm/npm ci or repository scripts:

```yaml
- name: Assert candidate checkout
  env:
    EXPECTED_SHA: ${{ github.event.inputs.sha || github.sha }}
  run: node scripts/assert-ci-sha.mjs
```

After both existing builds and UI build, add an unconditional explicit installer
step `node --import tsx --test tests/install-runtime-contract.test.ts` in each
Windows matrix leg. Retain both Node22.23.0/npm11.18.0 and Node24.17.0/npm12.0.0,
full tests, packed smoke, Action pins, permissions and job names. Do not introduce
WP12's macOS job, all-job checker, PR filter changes or artifact policy here.
Malformed nonempty SHA fails, never silently falls back. Schedule uses github.sha.

`tests/ci-windows-candidate.test.ts` imports the real comparator and already-installed
yaml; reads actual ci.yml and checks Windows condition, exact ref/EXPECTED_SHA,
one checkout, unconditional guard after setup-node/before package commands, both
matrix pairs, and the unconditional installer step after builds. Guard/test steps
cannot be conditional or continue-on-error. Clone parsed fixtures and independently
delete the ref, pin it to main, restore schedule-only, move/skip the guard, remove
a matrix leg or installer step: each fails its specific assertion. Step-label-only
changes pass. Spawn the comparator against current HEAD: correct full SHA exit0;
different valid SHA, short/empty/uppercase values exit1. No whole-YAML regex proof.
The canonical `scripts/run-tests.mjs` discovers this `.test.ts` and the Pages test;
refresh the inventory in this SAME WP. Neither requires a WP12 script.

Main dispatches `ci.yml --ref <WP11-stack-ref> -f sha=<same-full-WP11-tip>` after
publishing that exact candidate, records run id/attempt/ref/input and reads EACH
Windows guard JSON + non-skipped installer/packed-smoke conclusion. Ref moves before
dispatch require refreshed same-tip evidence. Existing e2e still lacks a guard until
WP12, so same-ref/same-tip remains mandatory and no all-job assertion claim is made.
Workflow unavailable on the dispatch surface, denied permission or skipped Windows
means WP11 BLOCKED, not deferred proof from WP12 or a prior nightly.

Bypass record: E7 plan/main review chooses dispatch and reads job evidence; E4
workflow executable guard stops mismatched checkout on this path. Editing workflow
or skipping dispatch bypasses it; host-required settings are not changed. Residual:
no global release enforcement claimed; main must withhold WP11 completion without
same-tip Windows evidence. WP12 later checks the wider matrix.

## Runtime/install generator: complete new-file design

`scripts/generate-runtime-install-contract.mjs` is import-safe ESM with main guard.
Exports:

```js
readRuntimeInstallContract(root) // -> { engine, minimumNodeMajor, packageManager,
                               //      releaseNode, cli, openaiSdk, express }
projectRuntimeInstallContract(root, { check = false } = {}) // -> { changedPaths }
```

Read package.json and .node-version only; dynamically import the WP10 engine parser
from the repository tool module (not the `--root` fixture's code), using Node's
existing TS support or `--import tsx` in the npm script. Inputs must be strings of
the expected metadata shape; fail 2 for unsupported engine or absent source values.
No network, package install, shell execution, or config/credential read.

Known targets are the manifest above, not arbitrary directory traversal. For shell
sources, replace exactly one `# runtime-contract:generated:start/end` region with
`MIN_NODE=<parsed floor>` (PowerShell `$MIN_NODE = <floor>`). Reject duplicate/missing
markers; initial marker insertion is part of this PR. After projecting source scripts,
copy their complete bytes to matching site/public target (normal generator operation,
not a second hand-edited installer). `--check` computes these bytes without writing.

For README variants and structure/06, use one
`<!-- runtime-install:generated:start -->` / end region. Fixed generated table:

```md
| Contract | Value |
|---|---|
| Node engine | `>=22` |
| npm toolchain | `npm@11.18.0` |
| Release Node | `24.17.0` |
| CLI entry | `bin/ima2.js` |
```

Values above illustrate baseline OUTPUT, not hardcoded generator defaults. The
surrounding prose is localized manually; machine table labels may stay consistent
across translations. AGENTS generated tech block includes package-resolved Express
and OpenAI SDK ranges; replace stale >=20/v5 claims rather than adding a contradictory
second block. Its test guidance references `scripts/run-tests.mjs`, not fixed test
counts. No automatic translation or rewrite of archived version snapshots.
Escape Markdown pipe/newline from metadata or reject malformed value; deterministic
LF output, stable ordering, second run byte-identical. Check exit 0 clean, 1 drift,
2 invalid input/markers. List mismatched relative paths only, not environment data.

### Package scripts (before → after)

Existing scripts have no runtime docs or emitted-runtime equivalence check. Add:

```json
{
  "docs:runtime": "node --import tsx scripts/generate-runtime-install-contract.mjs",
  "docs:runtime:check": "node --import tsx scripts/generate-runtime-install-contract.mjs --check",
  "verify:built-runtime": "node scripts/check-built-runtime.mjs"
}
```

Keep `generate-contract-docs.mjs --check` separate: its MCP catalog behavior is
already correct and must not be reimplemented. No package-lock dependency change
expected from adding scripts; do not churn lockfile or install any package.

## Installer diff-level changes

Before shell scripts: `MIN_NODE=20`, broad pgrep/pkill block, sudo retry after ANY
npm failure, `ima2 doctor >/dev/null` then exec serve.
After: generated MIN_NODE floor, remove broad process-stop block, single existing
array-based npm install. On failure, show safe instruction to inspect npm permissions
or stop the specific ima2 service manually, return nonzero; never infer every error
is a permission issue. No silent stderr discard. Keep existing node discovery and
explicit launch behavior, but unsupported existing Node returns before npm install.

```sh
if ! npm "${INSTALL_ARGS[@]}"; then
  fail "Install failed. Inspect npm output; stop the intended ima2 service or fix npm permissions, then rerun."
fi
ima2 doctor --installation --json || fail "Installed runtime is incomplete. Run ima2 doctor --installation --json."
```

Before PowerShell: initial Get-Process/Stop-Process block and EBUSY fallback that
kills every node process, waits, cleans cache and retries.
After: remove both termination blocks and cache-clean; retain PS5.1-safe Invoke-Npm.
One failure branch prints npm output and returns actionable nonzero result:

```powershell
if ($installResult.ExitCode -ne 0) {
    Write-Host ($installResult.Output -join "`n")
    Fail 'Install failed. Close the intended ima2 service if files are locked, inspect npm permissions, then rerun.'
}
& ima2 doctor --installation --json
if ($LASTEXITCODE -ne 0) {
    Fail 'Installed runtime is incomplete. Run ima2 doctor --installation --json.'
}
```

Do not switch to global kill with a narrower regex; process ownership is not proven
by a substring. No automatic elevation. README sentence promising automatic stale
cleanup becomes: installer does not stop running applications; stop the intended
ima2 service yourself if an update is locked. Update all five current READMEs with
the same meaning. Initial Node discovery comments say minimum from generated block.

## Built runtime checker: complete new-file design

`scripts/check-built-runtime.mjs` uses local TypeScript compiler, spawnSync via
process.execPath (not npx), fs/path/os. Exports `compareEmittedFiles(expectedDir,
runtimeRoot): { missing: string[], different: string[] }`; CLI main creates a unique
temp directory, runs local tsc with `-p tsconfig.build.json --outDir <temp>` then
`-p tsconfig.bin.json --outDir <temp>`. For expected bin/ima2.js only, prepend
`#!/usr/bin/env node\n` iff the emitted bytes do not start with `#!`, matching
`scripts/fix-shebangs.mjs:27-30`; do not alter other JS. Check the real entry executable
bit on POSIX separately (the existing script chmods 0755), not as a byte comparison.
Never run a root-writing step implicitly. Reject compare before builds
when files are missing; exit 1 lists relative files, exit 2 compiler/setup failure.
Read emitted expected `.js` files recursively and byte-compare against root files;
do not compare arbitrary extra files, UI output, timestamps or `.ts`. Cleanup only
the created temp path in finally. No build output is copied into workspace by checker.

This detects stale generated output in source verification. It is not independent
compiler correctness proof: package-install smoke separately executes packed `.js`
from an unrelated directory with source absent. Existing `nai-built-runtime-contract`
tests import .js under a TS loader, so imports alone are insufficient packed proof.

## Acceptance activation and negative tests

| Scenario | Required independent observation |
|---|---|
| fixture package engine >=22, Node shim v20.19.0 | doctor check fails NODE_RUNTIME_UNSUPPORTED; generated POSIX/PS min=22; installer exits before recording any npm install/serve call |
| same fixture Node v22.0.0 | installer reaches npm once, then exact `doctor --installation --json`, then serve only if exit 0 |
| fixture engine >=24 with Node22 | all three reject; proves package-derived floor, not replacement hardcoded 22 |
| first install with no credentials | installed runtime report exit0 when files/deps are healthy, no auth probe/fetch |
| missing packaged dist/native binding | doctor exits1; installer does not launch serve |
| npm returns EBUSY/EPERM or ordinary failure | no sudo/Stop-Process/pkill/cache clean; one npm call only; unrelated Node sentinel child still alive |
| independent source/public mutation | generator --check exit1 names affected copy; generated files byte-identical after generation |
| mutate one document engine or packageManager | parser compares extracted table value to package source; check fails; prose rewording outside marker does not fail |
| absent/duplicate marker or invalid engine | exit2, zero writes even in generation mode (validate all targets before writing any) |
| mutate emitted JS or delete one generated module in temp fixture | built-runtime checker reports stale/missing independently; does not modify fixture runtime |
| actual packed package from unrelated cwd, no source TS/dev deps | --version and --installation --json execute emitted CLI; report version equals tarball package.json, correct mode/schema/exit; existing local health smoke remains |
| WP11 dispatch at same explicit ref/full tip | BOTH Windows legs run real installer fixtures and packed smoke; actualSha==expectedSha in each log; no nightly/WP12 substitution |
| missing/wrong Windows ref, skipped/late guard, schedule-only or omitted behavioral step | parsed mutation fails independently; comparator actual HEAD mismatch exits1 before package commands |
| staged Pages candidate before compatible stable artifact exists | WP11 Pages guard/ordering tests from 009/111 fail before upload/deploy; old public site remains unchanged |

Installer tests run the real script file with PATH shims that record commands and
return predetermined versions/status. Never download Node/npm or install globally
in these tests. Windows behavioral tests execute PowerShell on hosted Windows;
do not mark them passed on macOS because a source regex matched. Shim node/npm/ima2,
and make forbidden commands fail loudly; use an unrelated sentinel process plus
command log to independently detect termination attempts. Generated floor extraction
tests run cross-platform; actual shell behavior remains platform-specific.

## Verification and rollback

Observed baseline: install-policy 0; current Windows contract 2 tests pass within
3-test command; runtime docs generator for MCP 0; typechecks 0. These do not cover
new installer safety or Node floor. No installer was run at WP00. Future focused C:

```sh
node --import tsx --test tests/doctor-runtime.test.ts tests/install-runtime-contract.test.ts tests/runtime-install-projection.test.ts tests/built-runtime-drift.test.ts
node --import tsx --test tests/ci-windows-candidate.test.ts tests/pages-publication-contract.test.ts
npm run docs:runtime:check
node scripts/generate-contract-docs.mjs --check
npm run test:install-policy
```

New commands are NOT baseline greens; execute after sources exist. CI runs existing
server/CLI/UI builds before verify:built-runtime and packed smoke. This WP supplies
hosted Windows candidate coverage; WP12 consumes it and expands cumulative gates.
Local full suites and paid probes remain forbidden.
Refresh test inventory/counts after files are final. Human review covers translated
behavior and source-vs-installed explanation, not regex phrase enforcement.

Rollback: revert source layer/rebuild and keep data/config/auth unchanged. Existing
installed versions retain their prior CLI; source installer and public copy must
roll back together. Do not recommend an old installer that globally kills Node as
an operational workaround. Missing installation-mode support in an older package is
a visible compatibility error, not permission to fall back to credential-sensitive
doctor or bypass verification. Main decides any historical package support policy.
Reverting WP11's Windows delta withdraws its same-tip Windows claim and requires
revalidation before installer delivery. After WP12 consumes assert-ci-sha.mjs, do
not remove that shared file in isolation: rollback the dependent layer first or
retain the guard under a reviewed compatibility revert. Pages rollback follows
009/111; no unconditional main-push restoration.
