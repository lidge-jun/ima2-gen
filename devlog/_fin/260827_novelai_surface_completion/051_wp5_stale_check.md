# 051 — wp5 final stale check and delivery plan

Date: 2026-08-27. Prior D direction: every implementation/documentation surface is
complete; only exact-head integration, archive, push, and CI proof remain.

## Current state

- `HEAD`: `5d6d3e15d95adff65b578489e968cd76de1f885c`.
- `origin/dev`: `d18e56caabd03d5019dbfffa8c9686c9be225e4f` after fresh fetch.
- Worktree: clean; local is 15 commits ahead, 0 behind.
- `origin/dev`, remote release `d18e56ca`, and local evidence `755fc1c2` are all
  ancestors of HEAD.
- Repository and installed core skills compare byte-identical.
- Existing remote CI/CodeQL is green only for the old merge base; final HEAD requires
  new post-push runs.

## Final B changes

1. Write `090_outcome.md` with criterion-by-criterion evidence, known unsupported
   NovelAI product surfaces, dead hypotheses/repairs, and terminal outcome candidate.
2. Move the full unit with `git mv` from its former `_plan` location to
   `devlog/_fin/260827_novelai_surface_completion`.
3. Search the entire repository for stale `_plan/260827_novelai_surface_completion`
   paths and repair only real references.
4. Commit the archive; no production source change in wp5.

## Final C verification at archive HEAD

After `090_outcome.md`, `git mv`, and the archive commit, advance the persisted FSM
from B to C with the wp5 implementation/commit attestation. Confirm
`cxc orchestrate status --session 01a04282-54cb-7331-b32b-be0db4c96f89` reports
`phase=C`; `cxc receipt test` is invalid in A/B and must not be attempted earlier.
Then run the exact session-bound receipt command (one quoted shell command,
line-wrapped here only for readability):

```text
cxc receipt test --session 01a04282-54cb-7331-b32b-be0db4c96f89 -- sh -c '
npm run verify:release:source &&
node --import tsx --test tests/nai-cli-options-contract.test.ts tests/nai-cli-built-smoke.test.ts tests/nai-built-runtime-contract.test.ts tests/nai-client-options-contract.test.ts tests/nai-options-contract.test.ts tests/nai-provider-contract.test.ts tests/nai-routing-contract.test.ts tests/nai-ui-registration-contract.test.ts tests/nai-zip-decode.test.ts &&
node --test tests/cli-skill-command-contract.test.js tests/cli-feature-parity-contract.test.js tests/api-docs-contract.test.js &&
node --import tsx --test tests/contract-docs-projection.test.ts &&
uv run --with pyyaml python /Users/jun/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/ima2 &&
cmp skills/ima2/SKILL.md /Users/jun/.codex/skills/ima2/SKILL.md &&
node scripts/check-devlog-citations.mjs devlog/_fin/260827_novelai_surface_completion &&
git diff --check'
```

Read `.codexclaw/evidence/01a04282-54cb-7331-b32b-be0db4c96f89/test-receipt.json`
afterward. Require `exitCode: 0`, `ownerSessionId` equal to this session, `dirty:false`,
and `sourceIdentity.commitSha` equal to `git rev-parse HEAD` (the archive commit).

`verify:release:source` includes native dependency smoke, source/test typechecks,
inventory, UI build, server/CLI builds, provider registry, full test suite, package
metadata/install policy, and both audit gates. It does not publish/tag/release.

Browser render evidence from wp2 remains valid because later phases changed only CLI,
tests, skill, and prose; no UI source changed after `de6069dc`. Recheck evidence hashes
and screenshot existence, not a redundant paid/provider run.

## Fresh final review

Dispatch a new reviewer over `d18e56ca..archive-HEAD`, every changed file, full receipts,
installed-skill cmp, and browser evidence. Critical/High blocks push; Medium is fixed or
explicitly dispositioned before delivery.

## Push and remote proof

1. Fetch `origin/dev` again. If it moved, merge non-force, rerun the full final receipt,
   then review the interdiff.
2. `git push origin dev` (authorized; never force).
3. `git fetch origin dev`; prove `HEAD == origin/dev`, worktree clean, and both original
   divergent commits remain ancestors.
4. Watch CI and CodeQL for the exact pushed SHA. A prior green run is not evidence.
5. If a run fails, inspect the failing job/artifact, repair, rerun local relevant gates,
   commit, push, and watch the new exact SHA. Do not blind rerun.

## Live NovelAI call disposition

No new paid/live generation. The base adapter, V5 models, and alpha were live-probed in
`devlog/_fin/260825_novelai_provider_lane/004_live_api_probe.md`; this unit's new paths
are deterministic booleans/UI/CLI/skill surfaces with fetch-recorder and browser
activation evidence. Another provider call would spend allowance without closing a new
uncertainty.

## Terminal condition

DONE only after archive commit, fresh full local receipt, fresh final review, non-force
push, exact remote SHA, and exact-head CI/CodeQL success. Otherwise report the actual
BLOCKED/UNSAFE/NEEDS_HUMAN/BUDGET_EXHAUSTED state with evidence.
