# 000 — runway-mcp-loss-hardening: Plan

## Observed failure (reproduced live 2026-07-18)

Runway MCP video generation succeeds remotely (asset visible in Runway library,
24-48h signed CloudFront URL) but never lands locally. Live probe via
`POST /api/mcp/generate` (seedance-2, 4s, 480p): SSE shows
`submitted -> provider-queued -> provider-running -> downloading -> error
{"code":"fetch failed"}`. Manual `downloadMediaResult` with the same URL 4 min
later succeeds (533429 bytes, video/mp4). The single-shot download at the
completion moment is the drop point; the failure leaves no taskId, no file log,
no retry, no recovery path. User lost 3x 15s generations this way
(tasks f3e1f78d, abbf9ac3, 2aa8045f — still recoverable via `get_task`).

Official-doc constraints (Sol subagent, Tier-2 proven): API output URLs expire in
24-48h (not instantly); MCP `get_task` has `outputSchema: null`; API asks for
>=5s poll interval with jitter/backoff; moderation failures surface as FAILED,
not as disappearing SUCCEEDED results.

## Objective

Make Runway MCP generation results survive transient completion-moment failures:
retry the download, persist taskId+outputUrls, prefer structured fields when
parsing, and add a recovery endpoint that re-downloads a finished task by id —
then use it to recover the user's 3 lost 15s videos.

## Loop-spec

- Loop archetype: verifier-defined (spec-satisfaction repair; tests + live recovery).
- Write scope: `lib/mcp/downloadMediaResult.ts`, `lib/mcp/adapters/runway.ts`,
  `lib/mcp/executeMediaJob.ts`, `routes/mcpMedia.ts` (or new
  `routes/mcpRecover.ts` if the 500-line cap bites), new `lib/mcp/jobLog.ts`,
  focused tests under `tests/`.
- Out-of-scope: UI changes, other providers, higgsfield, server restart-resume
  of in-flight polling (documented as follow-up only), push/publish.
- Budget / bounds: single work-phase; live Runway probes limited to one 4s 480p
  clip (already spent 2) + zero-credit get_task/list_recent recovery calls.

## Work-phase map

| WP | Doc | Slice |
|----|-----|-------|
| 1 | 010_phase1.md | download retry + parse/persist + recover endpoint + logging + tests + live recovery |

## Accept criteria

- C1: download retries transient failures (network error / 403 / 5xx) with
  backoff; unit tests prove retry-then-success and retry-exhaustion paths.
- C2: parsePoll prefers `structuredContent.url` / `task.artifacts[].url` over
  text-regex; unit test with the real captured get_task payload shape.
- C3: providerTaskId + outputUrls are persisted to job meta before download;
  MCP job lifecycle events append to a file log including error `cause`.
- C4: `POST /api/mcp/tasks/:id/recover` re-downloads a SUCCEEDED task and
  commits it through the same path as a normal generation.
- C5: the 3 lost user videos (task ids above) are recovered into
  `~/.ima2/generated/` and appear in `/api/history`.
- C6: `npm run typecheck` + focused node:test files pass; poll cadence >=5s
  with jitter per official guidance.
