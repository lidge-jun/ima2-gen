# 040 — The planner must degrade too (the actual incident fix)

Depends on: 010, 020. Added after the A-gate audit. Implemented as wp3b.

## Why this exists

The reviewer's decisive finding: the reported failure was
`GROK_PLANNER_TIMEOUT`, which means the search stage SUCCEEDED and the planner
call stalled. 020 (degradable search) is off that failure path, and a bigger
planner budget alone only moves the wall further away — an upstream that stalls
at 300 s can stall at 900 s.

A budget cannot promise "it always works". A fallback can.

## Design

When the planner call times out (and ONLY on timeout / upstream failure — never
on user cancellation and never on the phase ceiling), compose the generation
prompt locally and proceed instead of failing the request.

```ts
// lib/grokVideoAdapter.ts — planGrokVideo catch branch
catch (e: any) {
  clearTimeout(timer);
  if (options.signal?.aborted || e?.code === "GENERATION_CANCELED") throw e;   // real cancel
  if (phaseSignal.aborted) throw grokError("Grok video planning timed out", 504,
                                           "GROK_VIDEO_PLAN_TIMEOUT");          // phase ceiling
  if (!isDegradablePlannerFailure(e)) throw e;                                  // 4xx etc stay fatal
  const fallback = composeFallbackVideoPrompt(prompt, { mode, duration, resolution, searchSummary });
  logWarn("grok", "video:planner:degraded", { requestId, reason, promptChars: fallback.length });
  return { prompt: fallback, mode, duration, resolution, aspectRatio,
           webSearchCalls: searchDegraded ? 0 : 1,
           plannerDegraded: { reason, message } , ...(searchDegraded ? { searchDegraded } : {}) };
}
```

### What counts as degradable

| Failure | Behavior |
|---------|----------|
| Planner timeout (`AbortError`, phase not aborted) | degrade to fallback prompt |
| Planner 5xx / network failure | degrade to fallback prompt |
| Planner returned no/invalid tool call | degrade to fallback prompt |
| Planner 4xx (bad request, auth) | FATAL — a retry would fail identically |
| User cancel | FATAL — honor the cancel |
| Phase ceiling (`planTotalTimeoutMs`) | FATAL as `GROK_VIDEO_PLAN_TIMEOUT` |

### composeFallbackVideoPrompt

New helper in lib/grokVideoPlannerPrompt.ts (it already owns the pacing
vocabulary). It is deterministic and local — no network:

- starts from the user's own prompt, which is already a legitimate video prompt;
- appends `formatDurationPacingGuidance(duration, mode, resolution)`, the same
  beat-structure guidance the planner system prompt uses;
- appends the mode line (I2V preserve-identity / Ref2V keep-subjects / T2V
  describe-motion);
- appends a condensed search brief when one is available;
- caps total length so the generation payload stays sane.

Precedent in this repo: `cardNewsPlanner.deterministicFallback` already treats a
planner as optional (config.ts).

## Surfacing

`GrokVideoPlan` and `GrokVideoGenerateResult` gain
`plannerDegraded?: { reason: "timeout" | "failed" | "empty" }`, recorded in the
generated metadata alongside `searchDegraded`. The user gets their video, and
the record honestly says it was generated from an unplanned prompt.

## Tests

- planner timeout -> plan returned, `plannerDegraded.reason === "timeout"`,
  prompt contains the user's text.
- planner 4xx -> still throws.
- user cancel during planner -> still throws `GENERATION_CANCELED`.
- phase ceiling aborted -> throws `GROK_VIDEO_PLAN_TIMEOUT`, never degrades.
- `composeFallbackVideoPrompt` includes pacing guidance and mode guidance.

## Done when

A forced planner timeout still produces a saved mp4, and the fatal cases above
remain fatal.
