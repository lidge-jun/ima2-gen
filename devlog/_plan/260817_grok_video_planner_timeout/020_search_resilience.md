# 020 — The web-search brief must never kill a video request

Depends on: 010. Implemented as its own PABCD cycle (wp3).

## Problem

`planGrokVideo()` awaits `searchGrokVisualContext()` unconditionally. When the
search is slow or fails, the rejection propagates and the user loses the whole
video generation — for a stage whose only product is an optional research
paragraph injected as "Mandatory web-search brief".

The planner already handles a missing brief: `buildGrokVideoPlannerPayload`
emits `"Mandatory web-search brief: unavailable."` when `searchSummary` is
falsy. The capability exists; nothing uses it.

## Design

Wrap the search stage in a bounded, non-fatal attempt inside `planGrokVideo`:

```ts
let searchSummary: string | undefined;
let searchDegraded: GrokVideoSearchDegradation | undefined;
try {
  const search = await searchGrokVisualContext(prompt, ctx, { ...opts, plannerModel });
  searchSummary = search.summary;
} catch (e: any) {
  // A user cancel — or the phase ceiling from 010 — is a real abort, never a degrade.
  if (options.signal?.aborted || phaseSignal.aborted || e?.code === "GENERATION_CANCELED") throw e;
  searchDegraded = {
    reason: e?.code === "GROK_SEARCH_TIMEOUT" ? "timeout" : "failed",
    message: typeof e?.message === "string" ? e.message : "web search unavailable",
  };
  logWarn("grok", "video:search:degraded", { requestId, reason: searchDegraded.reason });
}
```

The `phaseSignal.aborted` check is required (A-gate finding): once 010 runs both
stages under one phase deadline, `searchGrokVisualContext` reports a
phase-ceiling abort as its own cancellation, and a naive catch would degrade and
then start the planner AFTER the planning ceiling already fired.

Rules:

- Only the SEARCH stage degrades. A planner failure remains fatal, because
  without a planned prompt there is nothing to generate — until 040 supplies a
  local fallback prompt, after which the planner degrades too.
- User cancellation (`options.signal.aborted`) is never swallowed.
- The planner stage's own budget starts AFTER the search returns, so a slow
  search cannot eat the planner's time; the combined phase is capped by the
  wired `planTotalTimeoutMs` from 010.

## Surfacing

`GrokVideoPlan` gains `searchDegraded?: { reason: "timeout" | "failed" }` and
`webSearchCalls` becomes honest (`0` when the search did not produce a brief,
instead of the current hardcoded `1`).

routes/video.ts records `searchDegraded` in the generated metadata. It is NOT
added to the `planning` SSE event: that event is emitted BEFORE `planGrokVideo`
runs (`generateVideoViaGrok`), so the degradation is not known yet. Metadata is
the only honest carrier (A-gate finding).

## Tests

- tests/videoRoute.test.ts (or a new tests/grokVideoSearchDegrade.test.ts):
  a stubbed search that rejects with `GROK_SEARCH_TIMEOUT` still yields a plan,
  and the resulting plan reports `searchDegraded.reason === "timeout"` and
  `webSearchCalls === 0`.
- A stubbed search that rejects with `GENERATION_CANCELED` while
  `options.signal.aborted` still rejects.

## Done when

A failing/slow search yields a completed video with a degradation marker, tests
cover both the degrade and the cancel path, and the suite is green.
