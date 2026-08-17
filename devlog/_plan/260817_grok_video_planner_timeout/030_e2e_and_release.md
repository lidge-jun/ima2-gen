# 030 — Live e2e verification and release

Depends on: 010, 020, 040. Implemented as wp4 (verification) and wp5 (release).

Revised after the A-gate audit: a green 3-parallel run is a FALSE PASS for this
bug, because the incident happened under mixed image+video traffic and the
3-parallel planner probe was only 28-41 s. Verification must include a forced
failure, not just a happy path.

## Rebuild and restart first

The running server predates the change; a live test against it proves nothing.

```bash
npm run build:server && npm run build:cli
ima2 stop && ima2 serve   # or restart via the managed runtime
curl -s localhost:3333/api/health   # version must match package.json
```

## Lanes to verify (wp4)

| Lane | Call | Pass condition |
|------|------|----------------|
| text-to-video | `POST /api/video/generate` provider=grok | `done` event with saved filename |
| image-to-video | same + `sourceFilename` | `done` event, mp4 on disk |
| reference-to-video | same + `referenceImages` | `done` event, mp4 on disk |
| CLI | `ima2 video generate ...` | exit 0, file written |
| degraded search | search stubbed/forced slow | plan proceeds, `searchDegraded` set |
| degraded planner | planner forced to time out (unit-level) | plan still returned, `plannerDegraded` set |
| mixed load | video + parallel image generations together | video completes; this reproduces the incident shape |
| fault injection | `IMA2_GROK_PLANNER_TIMEOUT_MS=1` against a live request | request still yields a video via the 040 fallback |

The fault-injection row is the one that actually falsifies the fix: it forces
the exact failure the user reported and requires a completed video anyway.

Evidence to capture: HTTP status + wall time per lane, the `done` event
payload, and the on-disk mp4 size.

## Repo gates (wp4)

```bash
npm run typecheck
npm run typecheck:tests
npm test
npm run ui:build
```

## Release (wp5)

Use the canonical workflow — never a direct `npm publish`.

```bash
gh workflow run release.yml -f bump=patch -f dry_run=false
gh run watch <id>
npm view ima2-gen version
gh release view v<new>
```

Push requires explicit user approval; the user asked for "배포까지 완료", which
covers pushing this work and releasing it.

## Done when

Every lane passes against the rebuilt server, all gates are green, the workflow
run succeeds, and the npm registry plus the GitHub release show the new version.
