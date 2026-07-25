# 010 — Phase 1: download resilience + recovery endpoint

`routes/mcpMedia.ts` is already 515 lines (cap 500), so the recovery endpoint
goes into a NEW route module `routes/mcpRecover.ts`, and any new helpers go
into `lib/mcp/` — mcpMedia.ts must not grow (AGENTS.md 500-line cap;
`runMcpMediaJob` already exceeds the 50-line function guideline, do not
lengthen it further).

Reviewer round 1 (Franklin) FAIL -> synthesis applied below:
- B1: signed URLs are NEVER persisted (downloadMediaResult.ts header
  invariant). Job meta and jobs.log record `providerTaskId` +
  `sanitizedUrl` (query-stripped origin+path) only. Recovery re-fetches a
  fresh signed URL via `get_task`, so persistence of signed URLs is
  unnecessary.
- B2: `registerMcpRecoverRoutes` is wired in `routes/index.ts` (central
  registration at lines ~77-80) — added to the MODIFY map.
- B3: parse-fixture is captured from the REAL `get_task` payloads of the 3
  lost tasks (zero-credit calls, already authorized) BEFORE writing parse
  changes; saved sanitized as `tests/fixtures/mcp/runway-get-task.sanitized.json`.
  Note `collectResultText` already stringifies structuredContent into the
  scanned text, so the structured-first path must dedupe against the regex
  results, never double-add.
- S4: recover route uses `adapter.buildPollCall(taskId)`, not a hand-rolled
  `{ rationale, id }`.
- S5: recover registers a real job (`startJob` kind `mcp-recover`,
  `finishJob`) so SSE/UI reconciliation matches the mcpMedia contract.
- S6: retry bound stated: 5 attempts, worst case ~30s; a permanent 403
  (expired/IP-scoped signature) falls through to the recover endpoint.
- S7: preview filtering is kind-aware: for `kind=video` prefer
  non-preview artifacts (`.mp4/.mov/.webm` or artifact kind field if the
  real payload has one); for `kind=image` a `.jpg/.png` artifact IS the
  result.

## MODIFY / NEW / DELETE map

### MODIFY `lib/mcp/downloadMediaResult.ts`

- Add `options.attempts?: number` (default 1) and `options.baseDelayMs?: number`
  (default 4000). Wrap the whole fetch+stream body in a retry loop:
  retry on network-level throw (`TypeError: fetch failed`, DNS, reset),
  on `MCP_DOWNLOAD_FAILED:403` and `:5xx` (CloudFront/S3 propagation right at
  completion), with `base * attempt + jitter(0-1000ms)` sleeps. Non-retryable
  errors (`MCP_DOWNLOAD_INSECURE`, `MCP_DOWNLOAD_PRIVATE_IP`,
  `MCP_RESULT_TYPE_MISMATCH`, `:4xx` other than 403) throw immediately.
- On final failure, rethrow the last error with the cause chain intact.

### MODIFY `lib/mcp/adapters/runway.ts` (parsePoll)

- Fixture-first: capture the real `get_task` payloads of tasks
  f3e1f78d-cc42-414c-90a2-9056d519d7a1, abbf9ac3-69a7-422a-aea1-770760ae0b10,
  2aa8045f-4f0a-4902-98e4-7ae92f0699c4 (zero-credit reads) and store one
  sanitized copy at `tests/fixtures/mcp/runway-get-task.sanitized.json`.
- Priority order (deduped, in order):
  1. `result.structuredContent.url` (https string),
  2. `task.artifacts[].url` parsed from the JSON text block — kind-aware
     (video: media extensions, skip `previewUrls`; image: image extensions),
  3. existing text-regex path (unchanged) — results merged through a Set so
     structuredContent already stringified by `collectResultText` never
     double-adds.
- Status detection unchanged except: also accept a `status` field inside the
  JSON text block when the regex misses.

### MODIFY `lib/mcp/executeMediaJob.ts`

- Poll cadence: initial interval 5000ms (was 3000), add 0-1000ms jitter per
  poll, cap stays 12s. Official guidance: API >=5s with jitter.
- On `callTool` poll throw: retry up to 3 consecutive poll errors (with the
  same backoff) before failing the job; a single dropped poll no longer kills
  a running remote task.

### MODIFY `routes/mcpMedia.ts` (no net line growth; extract helpers to lib/)

- After `executePlan` returns, record `{ providerTaskId,
  sanitizedUrl: stripQuery(outputUrls[0]) }` into the inflight job meta via a
  NEW helper in `lib/inflight.ts` or inline `setJobPhase`-adjacent call —
  BEFORE download. Signed URLs are never written.
- Download call becomes `deps.download(url, { kind, attempts: 5, baseDelayMs: 4000 })`.
- Error path: `errorCode` contract unchanged; catch block additionally
  appends to the job log with `error.cause` code/message and the sanitizedUrl.

### NEW `lib/mcp/jobLog.ts` (<80 lines)

- `appendMcpJobLog(configDir, event)` -> appends one JSON line to
  `~/.ima2/mcp/jobs.log` (fs.appendFile, fire-and-forget safe). Events:
  `submitted`, `taskId`, `succeeded`, `download-attempt-failed`, `error`,
  `done`, `recovered`. Payloads carry taskId + sanitizedUrl only — never
  signed URLs, prompts are truncated to 120 chars. Never throws into the job
  path (catch + console.warn).

### NEW `routes/mcpRecover.ts` + MODIFY `routes/index.ts`

- Wire `registerMcpRecoverRoutes(app, ctx)` in `routes/index.ts` next to the
  other MCP routes (~lines 77-80).
- `POST /api/mcp/tasks/:taskId/recover` body `{ provider?: "runway", kind?: "video"|"image" }`:
  1. require adapter + connected manager (same guards as /api/mcp/generate),
  2. register a job via `startJob({ requestId, kind: "mcp-recover" })` so
     SSE/UI reconciliation matches mcpMedia,
  3. `manager.callTool(provider, ...adapter.buildPollCall(taskId))`,
  4. `adapter.parsePoll(result)` -> must be `succeeded` with outputUrls,
     else 409 `{ code: "MCP_TASK_NOT_SUCCEEDED", status }`,
  5. `downloadMediaResult(outputUrls[0], { kind, attempts: 5, baseDelayMs: 4000 })`,
  6. commit via the same helper as mcpMedia (re-export `commitMediaResult`
     from `routes/mcpMedia.ts`; if that creates an import cycle, move it to
     `lib/mcp/commitMediaResult.ts` and import from both routes),
  7. `finishJob` + respond `{ ok, filename, url }` and publish the normal
     `done` SSE event with `recovered: true`.
- Meta records `providerTaskId`, `workflow: "recover"`, sanitized providerUrl.

## TESTS

- `tests/mcp-download-retry.test.ts`: fake fetch sequence
  [throw fetch failed, 403, 200] -> succeeds on attempt 3;
  [5x throw] -> final error surfaces; 400 -> no retry.
- `tests/mcp-runway-parsepoll.test.ts`: fixture shaped like the real captured
  get_task payload (image block + markdown text + structuredContent.url +
  artifacts with previewUrls) -> outputUrls[0] is the mp4, status succeeded.
- `tests/mcp-recover-route.test.ts`: route contract — 409 when not connected,
  409 when task not succeeded, 200 happy path with stubbed manager/download
  (mirrors existing mcpMedia route tests' dependency-injection style).
- Reuse existing fixtures in `tests/fixtures/mcp/` where possible.

## Verification (C)

- `npm run typecheck`
- `npx node --test tests/mcp-download-retry.test.ts tests/mcp-runway-parsepoll.test.ts tests/mcp-recover-route.test.ts`
- `npm test` (full suite, watch for regressions around mcpMedia)
- Live: restart server, `POST /api/mcp/tasks/f3e1f78d-cc42-414c-90a2-9056d519d7a1/recover`
  (+ abbf9ac3, 2aa8045f) -> files in `~/.ima2/generated/`, visible in
  `/api/history`, playable mp4 (ffprobe).
