 ---
 created: 2026-08-31
 tags: [ima2-gen, devlog, release]
 ---
 
 # 080 — wp10: Stable Release v3.12.2
 
 ## Summary
 
 Final release phase. All 9 preceding work-phases (wp1-wp9) merged to `dev`,
 provenance guard green, `assertBaseline` clean. This phase performed the
 actual version bump, tag creation, npm publication, and branch alignment.
 
 ## Release evidence
 
 | Check | Result |
 |---|---|
 | `npm view ima2-gen version` | **3.12.2** |
 | `origin/main` SHA | `7f7a581901cc4e91b6387e1dbc4e757d4b0f700f` |
 | `origin/dev` SHA | `7f7a581901cc4e91b6387e1dbc4e757d4b0f700f` |
 | `v3.12.2` tag SHA | `7f7a581901cc4e91b6387e1dbc4e757d4b0f700f` |
 | wp9 merge (`86bf4590`) is ancestor of tag | **yes** |
 | Release workflow (cut) | `33385943673` job `99468471054` ✓ |
 | Release workflow (mint) | `33385943673` job `99473915869` in-progress (publish verified) |
 | Publish workflow (stable) | `33388289198` — tarball published, registry verified |
 | `aria-modal` in bundle chunks | 10 files (matches wp9 migration count) |
 | Escape key handling in bundle | 7 chunks |
 | Open PRs | **0** |
 
 ## Environment approvals
 
 Two `npm-stable` environment deployment approvals were required and granted
 via API during this phase:
 
 1. Release run `33385943673` — approved for mint job
 2. Publish run `33388289198` — approved for stable publish job
 
 ## Branch history
 
 Three earlier release attempts failed and were fixed in-flight:
 
 1. Run `33385017376`: stale `test:inventory` → fixed by `node scripts/classify-tests.mjs`
 2. Run `33385138230`: TS build errors → restored `useEffect` import, removed unused `CloseReason`
 3. Run `33385321206`: provenance guard shallow clone → added `fetch-depth: 0` to CI test job
 
 All fixes committed to `dev` and merged before the successful release attempt.
 
 ## Not verified
 
 - Windows consumer install: CI jobs passed but local Windows verification not performed
 - GitHub Release page: `create-github-release` job status pending at time of writing
 
