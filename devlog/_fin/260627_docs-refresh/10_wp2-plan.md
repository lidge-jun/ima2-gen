# WP2 — Structure/Docs Code-Ground Refresh

## MODIFY (P0)
- `structure/00-structure-hub.md` — snapshot 2026-06-27 @2.0.4
- `structure/03-server-api.md` — keys/quota/auth/generation-requests/agy endpoints + API map
- `structure/06-infra-operations.md` — version 2.0.4, OIDC publish, env vars
- `structure/02-command-reference.md` — provider enum, backfill-thumbs, setup flow

## MODIFY (P1)
- `docs/API.md` — generation-requests section, fix billing/quota CLI mapping
- `docs/CLI.md` — prompt export/seed fixes, inflight video kind, billing claim
- `README.md` — grok-api, env vars, soften no-API-key claim

## MODIFY (P2)
- `structure/01-file-function-map.md` — generationRequestLog route, line count bumps
- `structure/04-frontend-architecture.md` — GenerationRequestLogPanel, ResultMetadataModal, QuotaCard

## VERIFY
- Sub-agent spot-check vs routes/* and bin/commands/*
- typecheck (docs only — no code change expected)
