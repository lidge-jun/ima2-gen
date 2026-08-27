# Execution contract

> Status: steps 1-4 reached the v3.12.0 candidate, but preview publication failed before npm/tag mutation. Recovery supersedes the remaining rows; see `011_recovery_plan.md`.

## Planned mutations

| Order | Target | Before | After | Mechanism |
|---|---|---|---|---|
| 1 | `origin/dev` | d14a3094 product head | local bootstrap commit containing release evidence | explicit non-force push |
| 2 | `origin/main` | d18e56ca v3.11.0 | same bootstrap SHA as dev | explicit non-force fast-forward push |
| 3 | release candidate ref | absent or prior owned value | generated v3.12.0 commit, then deleted | `release.yml` lease-protected temporary ref |
| 4 | `origin/main`, `origin/preview` | bootstrap/old release | generated v3.12.0 SHA | `release.yml` non-force pushes |
| 5 | `origin/dev`, `v3.12.0` | bootstrap/absent | generated v3.12.0 SHA | `release.yml` atomic push after preview proof |
| 6 | npm `preview`, npm `latest` | v3.11.0-derived channels | v3.12.0-derived preview and v3.12.0 stable | `publish.yml` OIDC trusted publishing |

## Attempt outcome

- Bootstrap commit: `85ab1a4223352a8511728dff62c8e48411a61d55` on dev/main; CI 33072478945 and CodeQL 33072478779 succeeded.
- Release run: 33072885524 created v3.12.0 candidate `3d111149b470eb1513648b1fe01fc0858ce223f7`; candidate CI 33073171620 succeeded.
- Main/preview moved to the candidate. Preview publish run 33073607259 failed before OIDC publication because Windows Node 22 job 98523042246 hit the step's 15-minute outer timeout.
- Stable job was skipped; dev stayed at the bootstrap SHA; no v3.12.0 tag or npm version exists.

## Before/after contract

- Before: product implementation is complete on dev, while main/preview/npm remain at v3.11.0.
- After: the workflow-created release commit changes only `package.json` and `package-lock.json` for v3.12.0, and all release refs/channels prove that exact commit.
- No manual edits to version files are allowed.

## Approval handling

- The user's deployment request authorizes the GitHub release dispatch and required environment approvals.
- Approve only pending deployments belonging to the exact release run/publish run created by this cycle, with a release-specific comment.
- Never approve an unrelated run or a run whose candidate SHA differs from the frozen release output.

## Failure boundaries

- Bootstrap CI or CodeQL red: stop before release dispatch.
- Candidate CI, package, Windows smoke, registry guard, provenance, or preview proof red: stop; do not approve stable.
- Stable job asks for approval: verify run ID, candidate SHA, environment, and preview proof first.
- Stable publish asks for approval: verify tag and all three remote branches point to the release SHA first.
- Any SHA drift: mark current evidence stale, fetch again, and return to Plan.

## Evidence to capture

- Push output and `git ls-remote` after bootstrap.
- Bootstrap CI/CodeQL run IDs and conclusions.
- Release run ID, candidate SHA/version, job states, and final conclusion.
- Preview/stable publish run IDs, artifact digest/integrity, provenance builder/workflow/source SHA.
- GitHub Release target and tag SHA.
- npm dist-tags, each channel's gitHead/integrity, downloaded tarball digest, and isolated install smoke.
- Final branch ancestry/equality and clean local worktree.
