# Ship plan — commit, push, stable release (010)

## Facts (verified 2026-07-15)

- npm `latest` = 2.0.18 = package.json version → release.sh takes the "fresh release"
  path and requires `main HEAD == origin/dev` before the version commit.
- origin/main d66a75d; origin/dev def2b77 (dev 1 ahead, main is ancestor). Local dev ==
  origin/dev. `gh` authenticated.
- Worktree is DIRTY with parallel-agent work (skills/, ui/src, routes/*.js, other
  tests, untracked tests/video-inflight-kind-contract.test.js). Stable release
  requires a fully clean tracked+untracked worktree → release CANNOT run here.

## Steps

1. Scoped commit on dev (only files owned by this fix):
   lib/responsesFallback.ts, lib/responsesImageAdapter.ts, lib/oauthProxy/generators.ts,
   lib/responsesErrors.ts, lib/generationErrors.ts, lib/routeHelpers.ts,
   lib/generatePipeline.ts, tests/responses-empty-taxonomy.test.ts,
   tests/oauth-proxy-error-safety.test.ts,
   devlog/_plan/260715_oauth_fallback_reference_retention/ (000/001/010),
   structure/01-file-function-map.md PARTIAL — only the 3 lib line-count rows
   (generationErrors 243, oauthProxy/generators 229, generatePipeline 507); the 4 UI
   rows belong to uncommitted parallel work and must stay out so the committed tree's
   line-count contract passes in verify:release.
   Procedure: save refreshed doc → restore committed doc → re-apply 3 rows → stage +
   commit → restore fully refreshed doc in worktree (keeps local runs green for the
   parallel agent).
2. Push origin/dev.
3. Fresh clean release worktree: `git worktree add ../ima2-gen-release main` →
   `git merge --ff-only origin/dev` → `npm ci` + `npm --prefix ui ci`.
4. `./scripts/release.sh patch` in the release worktree (background session, polled):
   bumps to 2.0.19, verify:release (typecheck/tests/builds/audits), preview publish,
   atomic main+dev+tag push, OIDC publish wait, GitHub Release, branch sync
   (dev/preview fast-forwarded to release SHA).
5. Evidence: release.sh final success line, npm view ima2-gen dist-tags, git ls-remote
   tag v2.0.19. Cleanup: remove release worktree.

## Risks / aborts

## Audit fold-back (reviewer round 2, GO-WITH-FIXES blockers=3)

1. HIGH — lib/generatePipeline.ts is contaminated by parallel backgroundPresets work
   (untracked lib/backgroundPresets.ts import + feature hunks). Stage ONLY my two
   hadReferences hunks via exact-blob staging: git show HEAD:file > tmp, apply my
   hunks, git hash-object -w + git update-index --cacheinfo. Derive the structure/01
   generatePipeline row from the STAGED blob (expected 507), not the working file.
   structure/01 staged blob = HEAD doc + 3 rows (243/229/507), leaving UI rows at HEAD.
2. HIGH — routes/generate.js + routes/index.js are stale tracked build artifacts of
   COMMITTED .ts sources (HEAD .ts imports normalizePresetIds / registerAssetsRoutes,
   HEAD .js lacks them); verify:release build:server would regenerate them and abort
   the clean-tree gate. Include the regenerated .js in the scoped commit; pre-verify in
   the release worktree: npm run build:server then git status must stay clean.
3. MEDIUM — devlog/ is gitignored; devlog docs stay LOCAL (dropped from commit list).
   docs/migration/runtime-test-inventory.md is parallel-dirty and stays uncommitted.
   Ownership re-derived at commit time (new parallel-dirty files: bin/commands/gen.ts,
   lib/grokImageAdapter.ts, tests/background-presets.test.ts — all excluded).

- verify:release failing in the clean worktree (e.g. inventory/audit) → fix forward in
  scoped commit on dev and re-run; 3 failures → NEEDS_HUMAN.
- origin branches moving mid-release (parallel pushes) → release.sh fails atomically;
  re-run after refetch.
- npm/gh credential failure → NEEDS_HUMAN (BLOCKED).
