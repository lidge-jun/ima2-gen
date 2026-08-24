---
created: 2026-08-24
tags: [ima2-gen, devlog, stale-check, verification, closeout, phase4]
---

# 042 — wp4 P stale-check

Current implementation commits:

```text
49a8c6d3 feat(comfy): classify locked video workflows
16f373ca feat(comfy-ui): show H3 locked video catalog
e67c7e6d fix(comfy-ui): keep full H3 name visible
841ab488 test(comfy): bind H3 catalog visibility proof
```

Criteria c-1..c-4 are met. Remaining c-5/c-6 require:

- source/test typechecks
- build:server + build:cli
- targeted Comfy suite
- provider registry + inventory
- full `npm test`
- UI production build
- actual-store/API/CLI lock receipt
- desktop/mobile screenshot evidence
- SoT docs and final outcome/commit ledger
- patched 3334 service teardown; existing 3333 service and user dirty files untouched
- fresh lidge receipt: Comfy inactive, llama inactive, 600W, GPU apps 0, pruned blob unchanged
- explicit force-add plus `git ls-files` proof for ignored 041/042/043/090/evidence

Current worktree contains only this unit's final docs/render-fix delta plus pre-existing
user changes `docs/grok-video-i2v-research.md` and the old untracked 260823 H3 doc. The
final commit stages explicit paths only.
