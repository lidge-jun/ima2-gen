# 090 — wp6 release evidence (v3.13.0)

## Chain

| Step | Proof |
|---|---|
| Push dev | `93c2cdc0..54da80d8 dev -> dev` (22 commits: wp2-wp5 + evidence) |
| Exact-head CI at 54da80d8 | CI 33580334458 FAILED — `scripts/audit-gate.mjs --prefix ui` flagged transitive browserslist 4.28.5 (GHSA-c83g-rgw3-j3cx, GHSA-73wf-gq98-2v4g, published 2026-08-08 after the last lockfile touch); CodeQL 33580334466 success |
| Repair | a02fcf74 `chore(ui): bump transitive browserslist to 4.28.8` (lockfile only); local gate exit 0; ui build OK |
| Exact-head CI at a02fcf74 | CI 33580899316 success; CodeQL 33580899318 success |
| Promotion | `git merge-base --is-ancestor` main/preview -> dev both true; `9cd60ac1..a02fcf74 dev -> main`, same -> preview (fast-forward) |
| Dry-run cut | release.yml 33581258747 success, `bump=minor dry_run=true expected_sha=a02fcf74...`; tag job skipped |
| Real cut | release.yml 33581536841 success, `dry_run=false`, same expected_sha; release commit d39f9ea2 `[agent] chore: release v3.13.0` |
| Preview publish | publish.yml 33582295768 success -> `3.13.0-preview.260902.33582295768.1` (both Windows consumer lanes green) |
| npm-stable approval 1 (tag job) | approved after verifying pending deployment belonged to run 33581536841 and preview tag was live |
| Tag | `v3.13.0` -> d39f9ea2 |
| Stable publish | publish.yml 33583797341 success after npm-stable approval 2 (headSha == tag SHA verified first); GitHub Release v3.13.0 with 2 assets |
| Ref convergence | HEAD == origin/dev == origin/main == origin/preview == v3.13.0 == d39f9ea2 |
| npm | dist-tags latest 3.13.0, preview 3.13.0-preview.260902.33582295768.1; gitHead d39f9ea2205d47b4aae1df2d98648571f435ef7c; integrity sha512-M5o0Pmh5... |

Incidental: the branch-push publish.yml run 33581249872 on `preview` (event push, not
the release dispatch) failed its Windows Node 24 consumer lane on the tarball-install
deadline. The release path's own preview publish (33582295768) passed the same lane, so
the flake did not gate the release; noted for the maintainer triage backlog.

## Installed-artifact proof (clean prefix, `npm i -g ima2-gen@3.13.0`)

- `ima2 --version` -> 3.13.0
- `routes/assetDerived.js` 5 hits `vector-svg`
- `lib/promptBuilder/client.js`, `requestSchema.js` carry `PROMPT_BUILDER_BAD_BACKEND` / `normalizeRequestModel`
- `ui/dist/assets/*.css|js` carry `composer__prompt-panes--dual` and "Undesired content"
- `skills/ima2/SKILL.md` and `README.md` carry "Trace to SVG"

All four shipped surfaces are in the published bytes.

