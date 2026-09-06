# WP05 — canonical runner and static/security gates

This companion preserves the original runner/command contracts from050 and adds
source-grounded security scanning. SameWP05, not a separate implementation phase.

## R1-01 — canonical runner activation in WP05

Baseline scripts/run-tests.mjs:19 spawns a fresh Node with only --import tsx and
--test; flags on a focused parent command do not repair canonical npm test.
Required exact script delta (preserve discovery/sort/stdio/exit propagation):
```diff
-const child = spawn(process.execPath, ["--import", "tsx", "--test", ...files], {
+const child = spawn(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "--test", ...files], {
```
No NODE_OPTIONS mutation, optional skip or runtime fallback. package.json already
maps test to this script, so no package or CI script edit is needed. Existing
.github/workflows/ci.yml:33-40 test matrix selects Node22.23.0 and Node24.17.0;
:94 invokes npm test. Both exact-WP05-tip legs must execute the new tests. A local
Node24 capability check alone cannot close Node22 or canonical-runner acceptance.

NEW tests/test-runner-invocation.test.ts uses node:test and a test-owned mkdtemp root. Create only tests/probe.test.mjs plus a local probe-dependency.mjs there; link the repository's node_modules into that root (directory symlink, Windows junction), so --import tsx resolves. Run absolute scripts/run-tests.mjs with process.execPath and cwd=scratch, NOT a mocked spawn or copied runner. Child env is a copy with NODE_OPTIONS and NODE_TEST_CONTEXT removed; no parent execArgv is forwarded. Probe imports {mock} from node:test, asserts the flag occurs exactly once in process.execArgv, registers mock.module(dependencyURL,{namedExports: {value:42}}), dynamically imports it and asserts 42 against the real module's value=7; emits a unique completion marker plus process.version. Restore mock in finally. Outer test asserts marker, current-runtime version and runner exit0. Second isolated fixture deliberately asserts false: runner must return exit1. Do not run repository discovery recursively: scratch contains only the tiny probe. Track/close both children and remove only the owned scratch tree in finally; no provider, auth or network imports. This test is automatically discovered by the existing *.test.ts pattern; inventory registers it in WP05. WP06 inherits runner/test unchanged, adding its own Vertex mock activation to canonical CI.

## Command evidence and future gates

WP00 observed npm run typecheck=0, typecheck:tests=0, test:inventory=0; combined seven-file command in 002=0 (51/51), including grok-planner-adapter and grok-upstream-retry.
New files do not yet exist, so future commands are not reported as already passed:
```sh
node --experimental-test-module-mocks --import tsx --test tests/grok-execution-parity.test.ts tests/grok-image-download-policy.test.ts tests/test-runner-invocation.test.ts tests/grok-planner-adapter.test.ts tests/grok-upstream-retry.test.ts tests/provider-execution-routes.test.ts tests/provider-execution-imports.test.ts
npm run typecheck
npm run typecheck:tests
npm run test:inventory
git diff --check
```
Direct file arguments protect listed targets; compiler includes lib/**/*.ts. Rebuild matching JS via existing build:server before runtime tests with .js imports; not run in docs-only WP00. Exact-head full CI and any live visual proof belong parent.

WP00 A round1 bounded proofs (all exit0, no source/test/script writes): `node --input-type=module` transpiled the actual multimode operation in memory with synthetic transports: baseline persisted indices [1,0], amended [1], identical outputs [1,2], all-failed []/last error, callback-free sweep [1,2]. Documented DNS helper settled on abort before held resolution, handled late fulfillment/rejection with zero unhandledRejection. These are algorithm proofs, not real route tests. `node --experimental-test-module-mocks --experimental-vm-modules --input-type=module` proved baseline/amended runner argv in a VM and actual builtin module mocking on Node24.17.0; NOT canonical child or Node22 proof. Standalone native named-loopback HTTP primitive also passed: custom lookup=1, default DNS=0, server calls=1, exact bytes; server/socket closed. Future downloader, deadline, route, child-invocation and both-runtime CI cases remain mandatory and have not yet run.

## Current baseline and exact-head SAST activation

Gitleaks8.30.1 is installed at/opt/homebrew/bin/gitleaks. Baseline command
`env -i PATH="$PATH" gitleaks git --log-opts='30dc2cb4^..30dc2cb4' --redact --no-banner .`
scanned one priorcommit/~5.22KB, exit0/no leaks. It does NOT observe newWP05 files
yet. At C use `--log-opts='30dc2cb4..HEAD'` after task-owned commits to scan the
actualfullWP05 delta; retain redaction, record output, resolve real findings.
No globalhome/token/content scan; no new scanner dependency.

Existing CodeQL workflow is sourcegrounded and operational: latestPRrun33941317760
atprerequisiteecde2bc7SUCCESS, priorpush33889331088SUCCESS. Its triggers currently
only coverdev/main and schedule, so stackedfeaturebranches are not analyzed.
Exact new MODIFY scope owned by main: .github/workflows/codeql.yml.

Addworkflow_dispatch withoptionalstringinputsha. Existingcheckout gets
`ref: ${{ github.event.inputs.sha || github.sha }}` andfetch-depth0, then an
assert-step fordispatch comparesgitrev-parseHEAD withWANTenvironmentvalue,
requiring40lowercasehex. Preserveall actionpins, build-mode:none, language,
permissionsanduploadcategory. DispatchfromactualfinalWP05branchandpasssameSHA;
verifyrunheadandcheckoutlog. No secretgrant, environmentdeployment, new dependency,
branch-protectionbypass or broaderworkflowrewrite.

CodeQL'sexistingsecurity-eventswrite permission belongs only itsanalysisjob;
manualdispatch uses thesamejob. Exact-headanalysisSUCCESS and no new relevant
High/Criticalalerts/findings are C evidence, not a claimscannersproveSSRFcorrect.
Focused threat-modeltests andindependentsecurityreview remain mandatory.
Existing npm audit-gate runs in mainCI; no Semgrep binary/configisinstalled,
so do notinventaSemgreppass orinstallone for thisphase.

## New invocation gate safety refinement

The tiny canonical-runner fixture uses a minimalplatform/pathenvironment whitelist,
notcopy-allambientenv. It removesNODE_OPTIONS/NODE_TEST_CONTEXT and inheritsno
providercredentials/config. Directorysymlink/junction is insideownedmkdtempand
pointsatlocalnode_modules, never editsit. Fullrepo discovery is not invokedlocally.
No skipping native modulemockcases on eitherNode22 or24.

## Refreshed focused baseline

At30dc2cb4 underenv-i+ownedemptyconfig/DB/generated, these actualexistingtargetsran:
grok-planner-adapter(7),grok-upstream-retry(11),provider-execution-routeschild(22).
Total40substantivecases,0fail/skip; parentreports19includingonechildwrapper.
This precedes the pinnedNodeHTTPtransition and does not certifynewdownloader.

## Historical WP00 groundwork (not current acceptance)

WP00 A round2 no-emit probes reproduced raw-pinned TS2322, verified the generic
helper/adapter against callers, and compared transpiled retryJS byte-identically.
Its intercepted retry/DNS/socket algorithm probes are historical groundwork;
WP05 must still execute the public downloader, canonicalrunner and Node22/24
cases. Search omission, sparseindex identity, signal-bounded DNS, realpinned
socket fixtures and canonical runner activation all remain mandatory in this WP.
