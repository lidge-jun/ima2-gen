# 050 — Cycle outcome

Date: 2026-08-17. Outcome: DONE.

## What was wrong

A Grok image-to-video request failed after 360.3 s with `GROK_PLANNER_TIMEOUT`.
The web-search brief SUCCEEDED (~60 s) and then the planner call stalled through
its entire 300 s budget, while an isolated probe of the identical payload
answered in 32.4 s. Under load the upstream does not just slow down — it stalls.

Four defects turned that stall into a lost video:

1. Search and planner each got a full `plannerTimeoutMs` with no combined
   ceiling, so planning could cost 2x the intended budget.
2. The web-search brief was a hard dependency.
3. The planner rewrite was a hard dependency — the real cause of the report.
4. Every budget was calibrated to idle measurements.

## What changed

| Area | Change |
|------|--------|
| Budgets | planner 300 s -> 900 s, search split out at 300 s, new wired 1500 s planning ceiling, start 150 -> 300 s, poll 900 -> 1800 s, download 120 -> 300 s |
| Search | degrades instead of failing; `webSearchCalls` is now honest |
| Planner | degrades to a locally composed prompt on stall / 5xx / 429 / network fault |
| Fatal cases | user cancel, 4xx, planner refusal (no tool call), and the phase ceiling all stay fatal |
| Client ladder | CLI 600 -> 4200 s, MCP 870 -> 4200 s, UI stream 30 -> 70 min, inflight TTL 10 -> 70 min |

The planner fallback is the change that actually answers the report: a bigger
budget only moves the wall, while the fallback removes it.

## Audit history

Two independent review rounds (grok-4.6) returned FAIL and materially changed
the work:

- Round 1 proved the incident was planner-after-successful-search, so the
  search fix alone was off the failure path. That produced 040.
- Round 2 caught three real bugs, including one introduced during the fix: a
  locally wrapped search deadline was being passed in as the user signal, so a
  slow search would have died as `GENERATION_CANCELED`. It also caught
  `planTotal == search + planner` letting the fatal ceiling preempt the
  fallback, and a fallback that could bill a worse clip than an honest error.

## Evidence

- Fault injection (`IMA2_GROK_PLANNER_TIMEOUT_MS=1`): 200 in 104.3 s with
  `video:planner:degraded reason=timeout` and a saved 3,127,023-byte mp4.
- Three lanes concurrently: t2v 117.4 s, i2v 133.4 s, ref2v 187.6 s, all saved.
- CLI lane: exit 0 with a downloaded file.
- Mixed load (2 videos + 3 images): all five 200, zero timeouts.
- `npm test` 2288 pass / 0 fail; typecheck, typecheck:tests, ui build clean.

## Residual

`startVideoRequest` and the poll loop remain fatal on timeout. They are not
deliberately retried because a video start has no idempotency key and a blind
retry would bill a second render. Budgets were raised instead.
