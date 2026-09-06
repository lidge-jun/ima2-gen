# WP11 sub-plan — gate Pages on the compatible published package
A round1 R1-10 repair, same WP11/PR as110, not an extra counted WP.
Decision:009_publication_order_decision.md. Runtime source anchors:pages.yml:4,
install-mac.sh:91,doctor.ts:279,release.yml:187. Current Pages auto-deploys main
and old doctor silently ignores installation flags. No live publication performed.

## Outcome and scope
Old public site remains until stable package/gitHead/tag/provenance and offline
installation smoke agree with exact site source. WP11 introduces gate and tests,
WP13 invokes it after release. Semantic dependency:WP10 installation DoctorReport,
WP11 install/runtime contract. Explicit user release authority includes this
necessary publication-order correction; no repository setting or protection edits.
Class C4; no paid provider calls. This does not modify canonical release/publish.yml.

## Files
MODIFY .github/workflows/pages.yml: dispatch-only, exact revision inputs/checkout,
published compatibility and offline install gates before upload, same deploy job.
NEW scripts/pages-publication-gate.mjs: narrow input/metadata/report validator and
read-only runtime metadata collection CLI, builtin modules only.
NEW tests/pages-publication-contract.test.ts: pure guard negative matrix plus parsed
actual workflow ordering; standard canonical root runner discovers it.
WP12's canonical full test runner executes this independent Pages contract test.
Its two-workflow checker remains limited to ci/pr-fast; do not add a duplicate
Pages validator. WP11/110 owns the Pages guard and first test/script.
MODIFY docs/migration/runtime-test-inventory.md,structure/06-infra-operations.md:
new guard and explicit post-stable Pages dispatch, reference009/130.
No global install/local npm publish, lockfile change or site visual redesign.

## Exact new script contract
Public functions:
```js
export function parsePagesInputs({releaseVersion,releaseSha}) {
  if (typeof releaseVersion !== "string" ||
      !/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(releaseVersion))
    throw new Error("release_version must be a stable semantic version");
  if (typeof releaseSha !== "string" || !/^[0-9a-f]{40}$/.test(releaseSha))
    throw new Error("release_sha must be a full lowercase SHA");
  return {version:releaseVersion,sha:releaseSha};
}
export function assertPagesPublication({
  version,sha,sourceVersion,headSha,tagSha,registry,installationReport
}) { /* complete decisions specified below */ }
```
Validate types before regex (string only); do not coerce arrays/null. Every field
is untrusted boundary data read from input/git/npm/report, not an internal assertion.
assertPagesPublication runs these exact checks:
1. parsePagesInputs succeeds. headSha===tagSha===sha. Source package.json.version
   equals version (CLI validates and passes as registry-independent sourceVersion).
2. registry metadata for BOTH exact version and latest has version===version and
   gitHead===sha. Reject missing/nonstring fields; never treat npm error/timeout
   as unpublished success. Require exact-version registry.dist.integrity string
   and nonempty tarball URL. latest supplies version/gitHead only; no second dist
   contract. Both metadata versions and gitHeads must still match the candidate.
3. installationReport is plain object: schemaVersion===1,mode==="installation",
   version===version,checks nonempty array,summary.exitCode===0,failed===0.
   Each check kind in pass/fail/warn/info, code/message strings; no fail row;
   passed/warned counts match actual rows and passed>0. Require a pass row with
   NODE_RUNTIME_OK; do not accept arbitrary stdout substring mentioning that name.
4. Return only {version,sourceSha:sha,installationMode:"installation",
   installationPassed:true,integrity:exactRegistry.dist.integrity}. No credentials/
   config/host/userdata or raw exception bodies returned.

Use exact function input names consistently:
```ts
{
 version:string; sha:string; sourceVersion:string; headSha:string; tagSha:string;
 registry:{exact:{version:string;gitHead:string;dist:{integrity:string;tarball:string}},
           latest:{version:string;gitHead:string}};
 installationReport:unknown;
}
```
This is the same canonical boundary shape as the JS signature above, not a
parallel third schema.

CLI operations:
- validate-inputs reads RELEASE_VERSION/RELEASE_SHA and source package version,
  validates before any process command with user inputs. Print safe version/sha.
- verify --report <owned-json-path>: collect actual git HEAD and rev-list tag
  using execFileSync argument arrays, metadata via npm view with JSON output and
  timeout. Read whole UTF8 report and JSON.parse; trailing banners or a second
  JSON document fail. Call the validator, print one JSON receipt and exit0;
  fixed safe diagnostic stderr/exit1 on mismatch. No file writes, ref movement,
  arbitrary shell, credential fetch or retry into a different version.
- Exports are import-safe; direct-script URL guard only executes CLI.
Node/npm executable resolution follows scripts/npm-subprocess.mjs if required for
cross-platform invocation; hosted Pages itself runs Ubuntu. Timeout each spawned
metadata command at60s. Late/missing registry metadata fails gate; WP13 can redispatch
after verified publication, never relax the check.

## Workflow before/after
Before:push main with site/install paths OR unconstrained workflow_dispatch;
checkout event/main; npm install site; build/upload/deploy without npm proof.
After:
```yaml
on:
  workflow_dispatch:
    inputs:
      release_sha:
        description: 'Published stable package source commit'
        required: true
        type: string
      release_version:
        description: 'Published stable package version'
        required: true
        type: string
```
Remove push trigger entirely. Do not add release-event auto trigger: CI-created
releases may not emit a follow-up event, and main owns explicit ordered dispatch.
Keep environment github-pages and existing Pages permissions. Build job timeout30m.
Keep existing pinned Actions; checkout with fetch-depth:0 and ref inputs.release_sha.
Use root .node-version for setup-node; pin npm from root packageManager in a safe
Node extraction. Root npm ci supplies release-contract dependencies. No secrets
other than existing repository/Pages builtin workflow token; no provider secrets.

Set env RELEASE_VERSION/RELEASE_SHA from inputs, never interpolate them into
unquoted shell commands. Ordered steps BEFORE upload:
1. node scripts/pages-publication-gate.mjs validate-inputs.
2. git fetch origin --tags, then node scripts/release-contract.mjs finalize-check
   "$RELEASE_VERSION" "$RELEASE_SHA". This proves existing registry provenance,
   tag, artifact integrity contract; stop on error.
3. Install exact approved version into an owned RUNNER_TEMP subdirectory via
   npm install --prefix "$RUNNER_TEMP/ima2-pages-install" "ima2-gen@$RELEASE_VERSION"
   (npm11 pinned; no global mutation). No source prepack masquerading as published.
4. Run installed .js CLI from that directory:
   node "$RUNNER_TEMP/ima2-pages-install/node_modules/ima2-gen/bin/ima2.js"
   doctor --installation --json. Capture complete stdout to owned report path.
   Require exit0. It must execute WP10 no-config/no-auth mode and not fallback.
   A missing flag in old package gives nonJSON/error and blocks.
5. node scripts/pages-publication-gate.mjs verify --report <owned report path>.
   Receipt proves latest/exact metadata and source/installed report match.
6. npm --prefix site ci --no-audit --no-fund; npm --prefix site run build.
7. Upload site/dist only after all above pass. Existing deploy needs build and
   github-pages approval if configured; do not bypass. No continue-on-error,
   conditional skipping of guards, or always-upload of an unverified artifact.

Avoid inherited job defaults.run.working-directory:site for guard/install steps:
remove the default and use npm --prefix site for site work. Paths above are root
relative. Source checkout is exact release SHA; no fallback to main's site files.
No plain checkout of a symbolic ref accepted by validator even if input claims SHA.

## Independent tests and release evidence
No production artifact is published in tests. Pure validator cases:
- matching source/tag/exact/latest/report passes;
- old registry latest or missing installation mode fails, even if package exists;
- wrong gitHead/tag/sourceVersion, prerelease/shortSHA/null/array input fail;
- old-doctor banner, two JSON blobs, empty checks, forged summary counts,
  a failed dependency with exitCode0, or missing runtime pass fail;
- harmless check ordering/additional safe info does not fail.

Parse actual pages.yml with existing yaml and assert no push/release auto trigger,
required input strings, exact checkout ref, root guard invocation order before
npm site build/upload, complete dependencies, failure cannot deploy, and same
pinned source through build. Clone valid fixture and mutate checkout to main,
move upload before guard, skip offline smoke, enable continue-on-error, add a
main-push trigger: each must independently fail. Check runtime command arguments,
not merely a prose comment containing "verified".
Existing release/publish workflows stay byte-identical in WP11.

WP11 C: focused pages contract tests and existing release32 tests on same tip,
Windows own gate from110 independently. This proves gate implementation, not
real site publication. WP13 C: actual workflow success, source SHA receipt,
installed offline JSON and HTTP installer-byte comparisons against release source.
If package releases but Pages fails, report partial delivery and keep goal active.

## Compatibility and rollback
Until stable proof the old site remains. Direct main-push site deployment is replaced
with documented explicit release-bound dispatch; intentional workflow behavior change.
Old clients/packages are not auto-upgraded. Do not require old packages to understand
new doctor flags, and never downgrade guard to standard doctor.
A revert that restores auto-push before package compatibility is re-proven reopens
R1-10 and must be rejected. Pages recovery under this gate is forward-repair-only:
publish a corrected new immutable package/site revision through the canonical
release path, then dispatch its matching Pages revision. An older site release
cannot pass this gate while a newer package is npm latest; do not promise such
a rollback, move latest backwards, or add a bypass. Before a new Pages deployment
passes all gates the previously live site remains unchanged. Keep its receipt
for diagnosis, not as a claim that arbitrary old-version redispatch is allowed.
Installed CLI rollback to a previous immutable package is a separate operator
action and does not roll back the hosted site's publication contract.
