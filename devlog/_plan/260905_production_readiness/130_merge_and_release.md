# WP13 — Bottom-up stack merge and provenance-verified release
Class C4. Archetype: spec satisfaction. Consumes WP00 locked map and WP01-WP12
plus WP06m and WP12s verified layer tips; semantic dependency is all layers integrated.
The explicit security-gate/media-gate tasks and c-15/c-16 block entry to merge/release
until WP12s/WP06m close; the coarse WP12 dependency is not a sufficient release gate.
Stop: >=10 implementation PRs actually merged, exact release artifact and smoke
proof agree, all preceding WPs closed, all high/critical findings resolved.
Memory: this unit's 000 continuity log, layer-specific check docs, goalplan/ledger.

## Authority and ownership
Main owns all remote operations. User explicitly approved task push, stack merge
and release. No shared-branch forced updates or protection bypass. Preserve user
media/config and scripts/recording. No third-party dependency PR merging.
Tool/credential scope: existing gh origin account, hosted workflow publishing,
isolated test homes, existing browser tools. Zero paid image generation.
Reassess at 4 hours WP elapsed / 72 hours whole run; no claimed token budget.
If same packet fails through two agents main reclaims it; release identity decisions
are never delegated. Permission/credential blockers require a user-facing report.

## Exact file/action map
- MODIFY CHANGELOG.md: add only delivered user-visible changes, fixes, compatibility
  notes and known limits for the chosen next minor version (if no breaking changes).
  Use actual final version from release workflow, not a pre-invented registry tag.
- MODIFY structure/06-infra-operations.md: only if delivered procedure differs;
  preserve canonical release workflow commands and distinguish stub vs live proof.
- MODIFY this unit's 000_plan.md: append WP13 check/terminal record and stack table
  with every actual PR number, parent/base, head, merge SHA and CI run URL.
- NEW 131_release_readiness.md: frozen source SHA, all PR proof and zero-unresolved
  high/critical review ledger, head-specific CI jobs, visual/install evidence and
  fallback/rollback target. Complete content is the structured sections below.
- NEW 132_release_receipt.md: actual workflow run IDs, release version, digest,
  registry source SHA, tag/branch ancestry, published install and screenshot hashes.
- MODIFY .github/workflows/pages.yml and its compatibility guard are owned by WP11
  (see009 and110), not an ad-hoc WP13 edit. This phase consumes the explicitly
  dispatch-only, release-SHA/version-bound Pages workflow after stable proof.
- MOVE unit to devlog/_fin/260905_production_readiness ONLY once the whole unit
  is complete; update references in tracked files/tests/goalplan pointers and verify.
  Do not archive incomplete work for the sake of a release checklist.
- No hand edits to package version/tags/generated JS required: release.yml owns cut.
- No database or API field changes. Field-chain: N/A; receipts are documentation,
  parsed downstream only by humans unless WP12 adds a named verifier.

## Stack construction and integration order
Preserve ecde2bc7 as prerequisite branch codex/prod-prereq-nai (base dev).
WP00 branch codex/prod-wp00-roadmap bases on prerequisite. Implementation branch
names are codex/prod-wp01-capabilities through codex/prod-wp12-acceptance
(including codex/prod-wp06m-video-bounds between WP06 and WP07),
followed by codex/prod-wp12s-lan-security, each
created at verified prior layer head. Exact suffixes are recorded in 000 before
publishing. Every PR explicitly names base; never rely on gh defaults.

Each PR body contains:
- one layer thesis and IN/OUT;
- stack table with predecessor/successor links;
- source HEAD and exact-head local/CI outputs;
- activation/visual evidence, backward compatibility and revert scope;
- review focus: only this layer's diff.

Do not falsely call independent work a semantic dependency. The accumulated
integration baseline is deliberate per the user's deep-stack request. If A finds
a layer not independently valid, re-slice before implementation rather than pad
the count. WP00/prerequisite/release promotion do not count toward the ten
implementation PR minimum.

## Per-layer remote proof (run at each publication and again before merge)
1. Refresh remote refs, PR head/base, all checks and reviews.
2. Compare actual branch head with recorded full SHA; refuse stale proof.
3. Prove lower tip ancestor of upper tip using git merge-base --is-ancestor.
4. Until WP12 broadens triggers, dispatch ci.yml using the layer's own branch:
   gh workflow run ci.yml --ref <layer-branch> -f sha=<full-layer-sha>
   The ref and sha MUST resolve to identical commits. Discover run by workflow,
   branch, dispatch event, full headSha and created time after dispatch.
5. Read gh run view <run-id> --json headSha,status,conclusion,jobs,url.
   Every applicable job succeeds; empty gh pr checks --required is not green proof.
6. A rebase or lower-layer fix invalidates upper proof. Rebase only task-owned
   refs with --onto/--update-refs after mapping ownership; use explicit leases;
   verify ancestry and rerun exact-head checks for changed layers.

## Bottom-up merge procedure
- Mandatory predecessor:013's CI-history prerequisite must already be merged by
  WP12, and its merge-up cascade/current-head checks must be complete. A red
  PR199 Fast Gate is still a merge blocker even if manual full-head CI is green.
- Prefer merge commits to preserve stack ancestry; repository currently allows them.
- Merge prerequisite, then documentation, then implementation layers in order.
- For each now-bottom layer explicitly retarget base to dev once predecessor is
  merged; verify diff contains only that layer. Do not merge a child into an old
  feature branch and call it trunk integration.
- Re-read head/checks/review threads after retarget; require fresh merge-base
  validation and rerun gates when the tested tree changed.
- gh pr merge <number> --merge --match-head-commit <full-sha>
  Do not pass --admin, do not bypass rules, and do not delete a parent branch
  while any open child still targets it.
- Fetch origin/dev and prove each merge SHA is its ancestor.
- After all layers, create dev -> main promotion PR. Review its complete diff,
  require exact-head CI and merge normally. Do not force-sync main or dev.
- Fetch refs and verify main contains dev and preview before release preflight.
  Record final integrated main SHA as the release expected_sha.

## Freeze and canonical cut
131_release_readiness.md must contain:
Frozen source SHA; >=10 implementation PR receipts; per-WP verifier and visual
matrix; unresolved findings count; previous stable tag/digest and reinstall
rollback path; no paid canary claim; explicit GO/NO-GO.
NO-GO on failed named gates, unknown head, red checks, unresolved high/critical,
unapproved spend, missing cross-layer regression or artifact-install proof.

After GO dispatch:
gh workflow run release.yml --ref main -f bump=minor -f dry_run=false -f expected_sha=<integrated-main-sha>
Select patch/minor/major by actual compatibility; minor is planned for additive
diagnostics/contracts, a breaking change must be explicitly accepted beforehand.
Capture the run ID and candidate SHA. Poll with bounded intervals; distinguish
candidate verification, preview publish, npm-stable tag approval, stable publish
approval and final GitHub Release creation. Use existing account's allowed approval
API only for THIS authorized run, with explicit comment and verified environment.
No bypass and no direct npm publish.

If workflow is blocked/failed: inspect exact failed job/log and repair with a new
WP/PR if source changes are needed. Never relabel failure as successful publication.
Do not republish an immutable version or move an existing stable tag.

## Release verification and natural-runtime smoke
- Fetch origin main/dev/preview and tags.
- gh release view v<version> --json tagName,targetCommitish,isDraft,isPrerelease,url
- npm view ima2-gen@latest version gitHead dist --json
- npm view ima2-gen@preview version gitHead --json
- Require stable version, expected release-cut SHA, tag SHA and package gitHead
  agree; require main/dev/preview actual release refs agree unless later
  authorized changes occurred, in which case document ancestry and exact delta.
- node scripts/release-contract.mjs finalize-check <version> <release-sha>
  This existing verifier checks tag, registry version/tag/integrity/provenance.
  It has NOT yet been executed against the future release.
- Download release-artifact manifest via gh run download for the verified publisher,
  and verify artifact SHA-512 against npm metadata via existing release contract.
- Published package smoke: existing tests/package-install-smoke.mjs supports
  IMA2_PACKAGE_TARBALL; run it against the downloaded published tarball in hosted CI
  or isolated macmini-cf with correctly discovered runtime. GITHUB_SHA must be
  release SHA for its source assertion. It uses isolated config/generated/DB paths.
- Only after stable registry/provenance and installed offline doctor smoke pass,
  run the WP11-gated Pages workflow:
  gh workflow run pages.yml --ref main -f release_sha=<release-sha> -f release_version=<version>
  The workflow checks out the exact release SHA, proves tag/npm gitHead/version and
  offline installation-mode compatibility BEFORE building/uploading/deploying.
  Normal main pushes no longer publish site/public installers. Capture Pages run ID,
  checked-out SHA, compatibility output, artifact/deploy environment and completion.
  Fetch deployed install-mac.sh, install-linux.sh and install-windows.ps1 with
  bounded cache-bypass HTTP requests and compare bytes/digests with this release's
  site/public source; do not download remote media. A delayed CDN or failed gate
  keeps old Pages live and this goal incomplete. No standard-doctor fallback,
  guard skip, environment bypass or stale-site claim is allowed.
- Serve that installed artifact on an isolated port, not by claiming dev ui/dist
  equals the package; run fixture-backed critical UI scenario and observe screenshot.
  Verify actual /api/health version and browser loaded asset identity.
  This published-artifact QA runs on a clean synthetic-data runner and is bound by
  the verified tarball digest/provenance; it does not invoke source appProjection
  with an invented strict UI receipt. Source-fixture certification and published
  artifact origin proof are separate consumers, neither a permissive fallback.
- Expected output: install exit 0, release health version exact, no credential
  migration, positive/negative pane usable and toolbar hit-testable in supported
  layouts, restored state and errors retain semantics.
  Also require deployed installer bytes match the release-backed Pages artifact.

## Failure/rollback contract
Before release: revert task-owned layer commits only through an explicit new
revert PR; never git reset or discard user work. After release: previous immutable
package version is the reinstall target. Do not silently move latest backwards
or rewrite a stable tag. Revert releases are a new workflow cut with their own
proof; user data remains untouched and DB compatibility must be demonstrated.
Hosted Pages has a stricter forward-repair-only contract: older site versions
cannot pass the latest-bound compatibility gate. Keep the old live site until
new verification/deploy succeeds; after deployment, repair through a corrected
new release and exact-SHA Pages dispatch. Do not claim an installed-package
rollback also restores the hosted site or silently move npm latest backward.
An approval/login obstacle is NEEDS_HUMAN, not a fake DONE.

## Verifier preflight and limits
Observed: tests/release-pipeline-contract.test.ts 32 pass exit 0 (source control
and provenance algorithms). This is not a release proof.
Current workflows and script paths verified in 005. Proposed future commands
are operational steps, not pre-existing success evidence.
E8 goalplan gate runs only after WP13 D; every criterion carries captured evidence.
No production-ready claim extends beyond the exercised local-first scenarios.
