# 000 — Grok video planner timeout: measured diagnosis

Date: 2026-08-17
Session: 01a00ed8-578b-74b3-a93f-cf6b21a48056
Reported symptom: "그록비디오 플래너가 계속 타임아웃 나고 있어."

## 1. Reproduction

A real image-to-video request against the running server failed exactly as the
user described:

```
POST /api/video/generate  (provider=grok, mode=image-to-video, 5s, 480p)
-> 200 with an SSE error frame after 360.3 s

event: error
data: {"error":"Grok video planner timed out","code":"GROK_PLANNER_TIMEOUT",
       "status":504,"errorClass":"PROVIDER_TIMEOUT"}
```

The same request body, re-sent when nothing else was talking to the proxy,
succeeded in 147.7 s and produced a saved mp4. The request is therefore not
structurally broken; it is losing a race against its own time budget.

## 2. Where the time actually goes

`planGrokVideo()` (lib/grokVideoAdapter.ts) runs two upstream calls in
sequence, and BOTH are charged against the same `plannerTimeoutMs` value:

| Stage | Call | Budget source | Measured (idle) |
|-------|------|---------------|-----------------|
| Web-search brief | `POST /v1/responses` with forced `web_search` | `planner.timeoutMs` (300 s) | 70.2 s, 73.1 s |
| Planner tool call | `POST /v1/chat/completions` with `generate_video` | `cfg.plannerTimeoutMs` (300 s) | 8.7 s (text), 14.5-32.4 s (with image) |
| Both, in-process via `planGrokVideo` | — | — | 113.9 s |

Measured against the local progrok proxy (`127.0.0.1:18646`, grok-4.6).

So an idle-system plan costs roughly 114 s of the 300 s budget. That is only
2.6x headroom, and the headroom is not evenly distributed: the search stage
alone consumes 60-70% of the wall clock.

## 3. Root cause

### 3.0 What the failing request actually did (audit correction)

An independent review (grok-4.6, A-gate) corrected the first draft of this
section, and the correction matters:

The failing request reported `GROK_PLANNER_TIMEOUT`, not `GROK_SEARCH_TIMEOUT`.
`searchGrokVisualContext` maps its own abort to `GROK_SEARCH_TIMEOUT`
(lib/grokImageAdapter.ts) and `planGrokVideo` rethrows coded errors unchanged.
So in the 360.3 s failure the search stage **succeeded** (~60 s) and then the
PLANNER fetch rode its own fresh 300 s timer to the end.

Two consequences:

- The stages do not share one countdown; each gets a full `plannerTimeoutMs`.
  The planning phase's real worst case was `2 x plannerTimeoutMs` = 600 s, and
  neither stage knew what the other had already spent.
- Making the search degradable (020) does NOT fix this incident. It hardens a
  different failure. The incident fix is the planner budget, the combined
  ceiling, and a planner fallback (040).

The planner hung for the FULL 300 s while an isolated probe of the identical
payload answered in 32.4 s. That is a ~10x divergence: under load the upstream
does not merely slow down, it can stall. A budget calibrated to the 40.9 s
concurrent probe would be calibrated to the wrong number.

### 3.1 Structural defects

Concurrency evidence:

- Four parallel web-search calls measured 44.5 s / 52.1 s / 56.1 s / 78.7 s.
- Three parallel real planner payloads measured 28.5 s / 39.2 s / 40.9 s.
- The failing request ran under mixed generation traffic and stalled at 300 s.

Four structural defects turn that into a hard user-visible failure:

1. **Unbounded sequential stages.** Search and planner each receive the FULL
   `plannerTimeoutMs` and run one after the other inside one user request, so
   the planning phase can cost `2 x plannerTimeoutMs` with no combined ceiling.
2. **A research nicety is a hard dependency.** `searchGrokVisualContext()` is
   awaited unconditionally for video, and any failure or timeout propagates out
   of `planGrokVideo` and kills the request. The web-search brief is an
   enhancement — the planner has a complete system prompt, the user prompt, the
   source image, and continuity context without it — yet a slow search day
   takes the whole video down.
3. **The planner rewrite is also treated as mandatory.** If the planner call
   times out, the whole video dies — even though the user's own prompt is a
   perfectly usable generation prompt. The repo already accepts this pattern
   elsewhere (`cardNewsPlanner.deterministicFallback`), but the video lane has
   no fallback at all. This is the defect that actually produced the report.
4. **Budgets are tuned to idle measurements.** The 300 s planner budget came
   from an idle-system ~72 s search. Real usage is concurrent and can stall an
   order of magnitude past the idle profile.

### 3.2 Ruled out as a timeout multiplier

`grokFetchWithRetry` cannot stretch a stage past its budget: aborts and
timeouts are never retried, all attempts share one `combinedSignal`, and an
attempt slower than 15 s is not retried at all (lib/grokUpstreamRetry.ts).

## 4. Non-causes ruled out

- **Not a stale server process.** The running server was v3.5.1 while HEAD had
  already raised the budgets, but `config.js` on disk (loaded by that process)
  already carried `plannerTimeoutMs: 300_000`, and the in-process probe
  confirmed `plannerTimeoutMs= 300000`.
- **Not malformed tool calling.** Every planner response carried
  `finish_reason: "tool_calls"` with a valid `generate_video` call.
  (`message.content` also contains a markdown-fenced copy of the same call,
  which is harmless because `parseGrokVideoPlanPrompt` reads `tool_calls`.)
- **Not the video generation or poll stage.** Successful runs cleared submit,
  progress, and download well inside their budgets.
- **Not text-to-video only.** T2V succeeded in 140.5 s; the image-carrying
  lanes are slower because a high-detail image costs ~1026 prompt image tokens
  and pushes planner latency from ~9 s to 15-40 s.

## 5. Consequences to fix

- Give every stage a genuinely generous budget, sized against a STALL, not the
  idle or lightly-concurrent case, and add a combined planning ceiling so the
  stages cannot sum unbounded.
- Make the search stage degradable (020) so a slow brief costs a less-researched
  prompt instead of a dead request.
- Make the PLANNER degradable too (040): a planner timeout falls back to a
  locally composed prompt so the user still gets their video. This is what
  turns "generous budget" into "it always works".
- Align every client ceiling — CLI, MCP, the web UI stream timeout, and the
  server-side inflight TTL — above the server's worst case, so no layer
  abandons a request another layer would have completed.
