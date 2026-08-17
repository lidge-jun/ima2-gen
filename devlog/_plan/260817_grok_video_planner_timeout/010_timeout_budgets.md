# 010 — Generous, stage-scoped timeout budgets

Depends on: 000. Implemented as its own PABCD cycle (wp2).

Revised after the A-gate audit found the first budget table internally
inconsistent (240 + 420 > 600) and calibrated to the wrong number.

## Goal

Every Grok video stage gets a budget sized against a STALL (the observed
failure), not the idle or lightly-concurrent probe, and the planning phase gets
an explicit combined ceiling that is genuinely larger than its parts.

## Calibration rule

The incident was a planner call that stalled for the entire 300 s budget while
an isolated probe of the same payload answered in 32 s. Budgets are therefore
calibrated against the STALL (300 s+), not the 40.9 s concurrent probe, and the
parts must fit inside the whole:

`search + planner <= planTotal`

| Stage | Idle | Concurrent | Observed stall | New budget | vs stall |
|-------|------|-----------|----------------|------------|----------|
| Web-search brief | 70-73 s | 78.7 s | — | 300 s | ~3.8x concurrent |
| Planner tool call | 9-32 s | 28-41 s | >=300 s | 900 s | 3x the stall |
| Planning phase total | 114 s | — | 360 s (failed) | 1200 s | 3.3x the failure |
| Video start | — | — | — | 300 s (was 150 s) | 2x |
| Video poll total | — | ~90 s typical | — | 1800 s (was 900 s) | large |
| Video download | — | — | — | 300 s (was 120 s) | 2.5x |

`300 + 900 = 1200 = planTotal`. The parts now fit exactly inside the whole, and
`planTotalTimeoutMs` is WIRED (not a decorative knob): `planGrokVideo` builds a
phase deadline and both stages run under it.

## Server worst case and the client ladder

Server worst case for one video request:

`1200 (plan) + 300 (start) + 1800 (poll) + 300 (download) = 3600 s`

Every client must sit ABOVE that, with slack — an equal ceiling is a race:

| Layer | Before | After | Note |
|-------|--------|-------|------|
| Server total | ~2670 s | 3600 s | sum of stage budgets |
| CLI `--timeout` | 600 s | 4200 s | +600 s slack |
| MCP video ceiling | 870 s | 4200 s | same ladder |
| UI `JOB_STREAM_TIMEOUT_MS` | 1800 s | 4200 s | UI is the likeliest client |
| Server inflight TTL | 600 s | 4200 s | a 10-min TTL purged live jobs |

The inflight TTL is the sleeper: `purgeStaleJobs()` dropped the job row after
10 minutes even while the worker was still running, so a long video lost its
reconcile state mid-flight.

## Diff-level changes

### config.ts

Add a dedicated search knob and raise the video budgets:

```ts
// NEW — own bound for the degradable web_search brief (020).
searchTimeoutMs:          300_000    IMA2_GROK_SEARCH_TIMEOUT_MS
// NEW — wired ceiling on search + planner combined.
videoPlanTotalTimeoutMs: 1_200_000   IMA2_GROK_VIDEO_PLAN_TOTAL_TIMEOUT_MS

// RAISED
plannerTimeoutMs:       300_000 ->   900_000  IMA2_GROK_PLANNER_TIMEOUT_MS
videoStartTimeoutMs:    150_000 ->   300_000  IMA2_GROK_VIDEO_START_TIMEOUT_MS
videoTimeoutMs:         900_000 -> 1_800_000  IMA2_GROK_VIDEO_TIMEOUT_MS
videoDownloadTimeoutMs: 120_000 ->   300_000  IMA2_GROK_VIDEO_DOWNLOAD_TIMEOUT_MS
inflight.ttlMs:         600_000 -> 4_200_000  IMA2_INFLIGHT_TTL_MS
```

`getPlannerConfig()` in lib/grokImageCore.ts gains `searchTimeoutMs` with the
same 300 s default so the image lane inherits the split too.

### lib/grokVideoShared.ts

`videoConfig()` surfaces the new fields:

```ts
searchTimeoutMs: g.searchTimeoutMs || 300_000,
planTotalTimeoutMs: g.videoPlanTotalTimeoutMs || 1_200_000,
startTimeoutMs: g.videoStartTimeoutMs || 300_000,
```

### Wiring planTotalTimeoutMs (required, not optional)

`planGrokVideo` creates ONE phase deadline and passes it to both stages:

```ts
const phase = withTimeoutSignal(options.signal, cfg.planTotalTimeoutMs);
// search runs under phase.combinedSignal (bounded again by searchTimeoutMs)
// planner runs under phase.combinedSignal (bounded again by plannerTimeoutMs)
```

Cancellation stays distinguishable: the degrade path in 020 must check the
PHASE deadline as well as the user signal, so a phase-ceiling abort is never
mistaken for a degradable search failure.

### Client ceilings

- bin/commands/video.ts: `--timeout` default `600` -> `4200` s.
- bin/lib/videoMcp.ts: `MCP_VIDEO_TIMEOUT_MS` -> `4200` s. (Note: this constant
  also guards the runway/higgsfield MCP lanes; a longer ceiling is harmless
  there because those lanes end on their own terminal events.)
- ui/src/lib/eventChannel.ts: `JOB_STREAM_TIMEOUT_MS` 30 min -> 70 min.
- config.ts: `inflight.ttlMs` 10 min -> 70 min.

### Docs

README, docs/API.md, docs/CLI.md, structure/06-infra-operations.md and the site
config reference list the new env knobs and defaults.

## Tests

- tests/config.test.js: new defaults and env-override parsing for
  `IMA2_GROK_SEARCH_TIMEOUT_MS` and `IMA2_GROK_VIDEO_PLAN_TOTAL_TIMEOUT_MS`.
- tests/videoRoute.test.ts: `videoConfig()` exposes the new fields.
- A budget-coherence test asserting `searchTimeoutMs + plannerTimeoutMs <=
  planTotalTimeoutMs` and that every client ceiling exceeds the server worst
  case, so the ladder cannot silently regress.

## Done when

Config defaults changed, `planTotalTimeoutMs` actually wired, every client in
the ladder raised, docs updated, typecheck and suite green.
