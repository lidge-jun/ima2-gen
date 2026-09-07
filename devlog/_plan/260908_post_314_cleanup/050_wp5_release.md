# 050 wp5 — dev->main promotion, release, Pages, published-artifact visual proof (C4)

Consumes 130_merge_and_release.md (now in _fin/260905_production_readiness) as the
procedure source; this doc lists only the deltas and exact commands.

## Preconditions
- wp1-wp4 PRs merged into dev; wp2 merged into main and synced into dev.
- `git fetch origin; git merge-base --is-ancestor origin/main origin/dev` true.
- `gh pr list --state open` empty.

## Steps
0. Release content BEFORE the cut (release-cut.mjs:169 only bumps package manifests):
   on a branch from dev, convert CHANGELOG `## [Unreleased]` to `## [<V>] - <date>` with
   V = current version minor-bumped (3.15.0 unless main moved), add a fresh empty
   Unreleased, and update structure/06-infra-operations.md only if the procedure
   changed. PR to dev, merge. The cut then packages the versioned changelog.
1. Promotion PR: `gh pr create --base main --head dev --title "Promote dev to main (post-3.14.0 cleanup)"`
   body: list of merged PRs. Wait PR Fast Gate + CodeQL on exact head; dispatch
   `gh workflow run ci.yml --ref dev -f sha=<dev-head>` for the full matrix; merge with
   `--merge --match-head-commit`. Record integrated main SHA = M.
2. Release: `gh workflow run release.yml --ref main -f bump=minor -f dry_run=false -f expected_sha=M`.
   bump=minor because wp3 adds a user-visible lane (NAI quota) and a new error code.
   Poll `gh run list --workflow release.yml`; the `tag` job waits on environment
   `npm-stable`. Approve with `gh api -X POST repos/lidge-jun/ima2-gen/actions/runs/<id>/pending_deployments -f environment_ids[]=<id> -f state=approved -f comment="post-3.14.0 cleanup release, authorized 2026-09-08"`
   (environment id via `gh api repos/lidge-jun/ima2-gen/environments`). publish.yml's
   stable job is gated the same way; approve it too. If the account cannot approve
   (403) -> NEEDS_HUMAN.
3. Verify: `git fetch --tags`; `gh release view v<V>`; `npm view ima2-gen@latest version gitHead`;
   `npm view ima2-gen@preview version gitHead`; all == release SHA R; main/dev/preview == R;
   `node scripts/release-contract.mjs finalize-check <V> R` exit 0.
4. Pages: `gh workflow run pages.yml --ref main -f release_sha=R -f release_version=<V>`; wait;
   fetch https://lidge-jun.github.io/ima2-gen/install-mac.sh (+linux, windows.ps1) with
   `curl -sS -H 'Cache-Control: no-cache'` and `shasum -a 256` vs `git show R:site/public/<file>`.
   Known: the 2026-09-06 tag-ref dispatch failed while main-ref succeeded; use --ref main.
5. Published artifact: `TMP=$(mktemp -d); npm pack ima2-gen@<V> --pack-destination $TMP`;
   verify integrity vs `npm view ima2-gen@<V> dist.integrity`; `npm install -g --prefix $TMP/g $TMP/ima2-gen-<V>.tgz`;
   run with isolated `HOME=$TMP/home IMA2_PORT=<free> IMA2_CONFIG_DIR=...` (use the
   existing tests/package-install-smoke.mjs env contract: IMA2_PACKAGE_TARBALL) ->
   `curl /api/health` version == V.
6. Visual: Computer-use `cua.createBrowserTab("iab", "http://127.0.0.1:<port>", {visible:true})`;
   screenshot home, Settings > Account (NovelAI card present when a dummy token is set
   via /api/keys), Node mode. Save PNGs to .codexclaw/evidence/01a07ce8-b02b-7200-9bfc-300c549d3c70/.
7. Receipts after publication: 051_release_receipt.md in this unit (run ids, SHAs,
   digests, screenshot hashes), then move the unit to _fin at D of wp5. These are
   documentation-only commits delivered by a final PR to dev plus a main sync; their
   ancestry is recorded in the receipt and they do not alter the published artifact.

## Failure handling
Same rollback contract as 130 (never move latest backward; new cut for repairs).

## Accept: c-6, c-7, c-8.
