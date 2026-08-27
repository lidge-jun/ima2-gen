# 012 — wp1 audit synthesis

Reviewer verdict: GO-WITH-FIXES, blockers=1.

## Blocker — generated server runtime was unverified

- Trigger: focused tests import TypeScript directly while committed `config.js` and
  `lib/naiImageAdapter.js` are the runtime artifacts.
- Impact: source could pass while installed/server behavior remains hardcoded false.
- Accepted. `010` now requires `npm run build:server` and a new JS runtime contract that
  imports generated artifacts and proves config defaults plus true/false wire behavior.

## Merge precondition

The reviewer correctly noted the worktree is not clean because P amended 010 and added
011. These docs are committed before merging `origin/dev`; the merge is not attempted
with hidden local modifications.
