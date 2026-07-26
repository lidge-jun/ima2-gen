# 260627 — v2.0.4 Release + Structure/Docs Refresh

## Goal
Multi work-phase delivery for ima2-gen@2.0.4 production release and code-grounded documentation refresh.

## Work-Phase Map

| WP | Scope | PABCD | Deliverables |
|----|-------|-------|--------------|
| **WP1** | npm latest v2.0.4 | P→A→B→C→D | version bump, CHANGELOG, main ff to dev, GitHub Release, npm verify |
| **WP2** | structure/ + docs/ | P→A→B→C→D | 00-07 structure, API.md, CLI.md, README (+ko), devlog evidence |

## WP1 — Release v2.0.4 (diff-level)

### MODIFY
- `package.json` — version `2.0.3` → `2.0.4`
- `package-lock.json` — sync version
- `CHANGELOG.md` — add `[2.0.4] - 2026-06-27` section from `v2.0.3..HEAD` (8 commits)

### GIT
- `git checkout main && git merge --ff-only dev` (main 98 commits behind)
- Commit: `chore: release v2.0.4`
- Push `main`
- `gh release create v2.0.4` → triggers `.github/workflows/publish.yml` OIDC

### VERIFY
- `gh run watch` on publish workflow
- `npm view ima2-gen dist-tags` → `latest: 2.0.4`

## WP2 — Docs Refresh (priority from sub-agent audits)

### P0 — `structure/03-server-api.md`
- Add `/api/keys/*`, `/api/quota`, `/api/auth/switch`, `/api/generation-requests`, `/api/agy/status`
- Provider matrix: gemini-api, agy, grok-api
- `POST /api/history/backfill-thumbnails`

### P0 — `structure/06-infra-operations.md`
- Version 2.0.3 → 2.0.4
- OIDC publish workflow, preview dist-tag
- Env vars: XAI_API_KEY, IMA2_AGY_BIN, IMA2_MAX_PARALLEL

### P1 — `structure/02-command-reference.md`
- Provider enum, `backfill-thumbs`, setup flow, inflight video kind

### P1 — `structure/00-structure-hub.md`
- Snapshot note 2026-06-27 @2.0.4

### P2 — `structure/01-file-function-map.md`, `04-frontend-architecture.md`
- generationRequestLog, ResultMetadataModal, QuotaCard, line counts

### P2 — `docs/API.md`, `docs/CLI.md`, `README.md`
- Agent routes, generation-requests, fix billing/quota claim, prompt export typo

### P3 — `structure/05-node-mode.md`, `07-devlog-map.md`, localized READMEs

## Verification
- `npm run typecheck`
- Sub-agent audit re-check on updated files
- Atomic commits per surface group
