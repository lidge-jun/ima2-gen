# Issue #24 — TypeScript Migration (tracking)

**Status:** primary migration MERGED to `main`. Tracking ticket for strict-mode cleanup only.
**GitHub:** https://github.com/lidge-jun/ima2-gen/issues/24
**Primary PRD (closed):** `devlog/_fin/260429_typescript-migration/` (phases 0–7).

## STATUS 2026-04-30 — Partial / tracking

- Shipped: TypeScript migration phases 0-6 are on `main` (`accf797`, `3d8f85d`, `e06dec0`, `631f298`, `e8d58da`) and the primary plan is archived in `_fin/260429_typescript-migration/`.
- Remains: GitHub #24 is OPEN for strict-mode cleanup and leftover JS artifact strategy; keep this folder in `_plan`.

## What already shipped

The phased TypeScript migration described in `_fin/260429_typescript-migration/` is in `main`:

- Phase 0 — `accff97 feat(ts): phase 0+ tsconfig overlays, ts toolchain, express.d.ts`
- Phase 1 — types
- Phase 2 — `3d8f85d feat(ts): phase migrate lib/ to TypeScript`
- Phase 3 — `e06dec0 feat(ts): phase 3 migrate routes/ to TypeScript`
- Phase 4 — `6ff8ee1 feat(ts): phase 4 migrate server.ts and config.ts`
- Phase 5 — `631f298 feat(ts): phase 5 migrate bin/ CLI to TypeScript`
- Phase 6 — `e8d58da feat(ts): phase 6 test infra, package files, gitignore, structure docs`
- Phase 7 — pending: strict-mode cleanup, leftover JS files, sweep `lib/oauthProxy.js`/`routes/edit.js` duplicates.

## What this ticket still tracks

Strict-mode cleanup work that does NOT need a separate PRD; it follows
`_fin/260429_typescript-migration/phase-7-cleanup-strict.md`. No new diff-level
plan is required here. Open a new issue if a strict-mode change requires its
own PRD.
