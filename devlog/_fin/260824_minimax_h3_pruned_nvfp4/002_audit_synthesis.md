---
created: 2026-08-24
tags: [ima2-gen, devlog, audit, minimax-h3, nvfp4]
---

# 002 — docs-only roadmap audit synthesis

## Dispatch record

- Socrates (`01a033b1-aec5-70a0-9120-81caaa977b1a`): broad A audit; three
  30-second bounded waits with no artifact; retired while running.
- Ohm (`01a033b4-7006-74f2-adc0-acf3b5a672ef`): narrowed A audit; three
  30-second bounded waits with no artifact; retired while running.

Two distinct reviewer packets failed to return. Main reclaimed the slice under
DISPATCH-RETIRE-01 rather than spawning a third identical packet.

## Findings and disposition

1. **High — CLI field-chain file omitted from exact map.**
   - Trigger: `McpModelEntry.executable/lockReason` was said to deserialize through
     `bin/lib/modelResolver.ts`, but the exact delta listed only `bin/commands/models.ts`.
   - Impact: implementation could access fields absent from the CLI catalog DTO or
     silently omit the model-level lock.
   - Fix: `030_ima2_comfy_video_visibility.md` now explicitly modifies
     `bin/lib/modelResolver.ts` while preserving resolver semantics.
   - Verification: file exists and is consumed by `bin/commands/models.ts`.

2. **Medium — duplicate graph artifact could drift.**
   - Trigger: 020 planned `evidence/020_t2v_api.json`, while 030 planned a copied
     `030_h3_workflow_api.json`.
   - Impact: registration could use a graph different from the one actually proven.
   - Fix: 030 reuses the exact 020 evidence file.
   - Verification: only one graph path remains in the 030 registration command.

3. **Medium — resource total contradicted phase budgets.**
   - Trigger: total 6h versus 90+150+150+90 minutes.
   - Fix: budgets are 60+120+120+60 = 360 minutes.

4. **Medium — Native evidence was assigned to startup instead of model load.**
   - Trigger: current logs emit the relevant Native/Emulated line when H3 loads.
   - Fix: c-1 and 020 require a fresh model-load log segment; 010 explicitly makes
     no Native-load claim.

## Machine checks

```text
goalplan-ok phases=5 criteria=6
scripts-ok
git diff --check: exit 0
all six numbered roadmap docs exist
all planned target/test files checked in current tree
```

## blocking_issues

None remain in the docs-only roadmap. Runtime uncertainty is deliberately carried as
010/020 activation branches: unknown GPU unit ownership is UNSAFE, bad blob metadata is
BLOCKED, and cgroup/CUDA OOM is BLOCKED without weakening host guards.

VERDICT: GO-WITH-FIXES (blockers=2)
