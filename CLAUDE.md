# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev (server --watch + Vite UI + Node-mode gate on)
npm run dev

# Server-only watch (no UI dev server)
npm run dev:server

# UI build (required before `ima2 serve` works from a packaged install)
npm run build

# Tests (runs tests/*.test.js via scripts/run-tests.mjs, cross-platform)
npm test

# Run one test file
node --test tests/health.test.js

# Skip the OAuth proxy subprocess (useful for offline tests / CI on Windows)
IMA2_NO_OAUTH_PROXY=1 node server.js

# CLI after global install
ima2 serve | setup | status | doctor | gen <prompt> | edit <file> | ls | show | ps | ping

# Release (bumps version, publishes to npm, pushes tag)
npm run release:patch    # :minor, :major
```

`npm run build` runs `tsc -b && vite build` inside `ui/`. The server statically serves `ui/dist/`, and `bin/ima2.js serve` auto-runs the UI build if `ui/dist/index.html` is missing and `ui/package.json` exists (dev checkout). On a packaged install with `ui/dist/` missing, it errors out.

## Architecture

Two long-lived processes and a file-based handshake:

```
ima2 serve
 ├── Express (:3333, server.js) ── serves ui/dist + /generated/* + /api/*
 ├── openai-oauth child proc (:10531) ── spawned via spawnBin("npx", ["openai-oauth", ...])
 │                                        auto-restart 5s on exit; gated by IMA2_NO_OAUTH_PROXY
 └── ~/.ima2/server.json ── port/pid/version advertisement for CLI auto-discovery
```

- **OAuth-only in practice.** `/api/providers` returns `apiKeyDisabled: true`; `POST /api/generate` and `/api/edit` reject `provider: "api"` with `403 APIKEY_DISABLED`. The API-key code path still loads `OPENAI_API_KEY` (for `/api/billing`) but is not a generation route.
- **Generation path = Responses API streaming.** `generateViaOAuth` / `editViaOAuth` hit `http://127.0.0.1:10531/v1/responses` with `model: "gpt-5.4"` and `tools: [{ type: "image_generation", ... }, { type: "web_search" }]`, parse SSE events, and extract `image_generation_call.result` base64. The model is **not** `gpt-image-2` — `gpt-image-2` is not a valid Responses API `model` value; the image tool decides the actual image model. Do not rename back to `gpt-image-2` without re-testing end-to-end.
- **SSE parser is duplicated** in `generateViaOAuth` (~line 160) and `editViaOAuth` (~line 620). If you change one, change both.
- **History is disk-first, sidecar JSON for metadata.** `generated/<timestamp>_<rand>_<idx>.<ext>` + `generated/<same>.json` sidecar is the authoritative source for `GET /api/history`. No DB involvement for history. `listImages` walks 2 directory levels (for 0.04 session/node subdirs) and filters `.trash/`.
- **SQLite (`lib/db.js`, `lib/sessionStore.js`) is only for Node-mode sessions** (graph snapshots with optimistic locking via `If-Match` header / `graphVersion` integer). History and inflight state do not touch SQLite.
- **Inflight registry is in-memory** (`lib/inflight.js`). The client echoes a `requestId` on every generate call, server registers it via `startJob` / `setJobPhase` / `finishJob`, and `GET /api/inflight?kind=&sessionId=` reports active jobs. UI persists its own copy in `localStorage["ima2.inFlight"]` with a 180s TTL and cross-tab `storage` event sync, so a refresh mid-generation reconciles.
- **Two UI modes.** `classic` (default, shipped) and `node` (dev-only, gated by `VITE_IMA2_DEV` → `IS_DEV_UI` in `ui/src/lib/devMode.ts`). `App.tsx` forces `uiMode = "classic"` in packaged builds regardless of localStorage. `NodeCanvas` / `ImageNode` / graph save code must survive being dead code in prod bundles.
- **State is one big Zustand store** (`ui/src/store/useAppStore.ts`, ~1300 lines) covering history hydration, inflight polling, session graph ops, classic and node generation, draft, refs, and right-panel state. There is no slice split yet; be explicit which domain you're touching and keep actions colocated with their selectors.

## Config and discovery

- `IMA2_CONFIG_DIR` (defaults to `~/.ima2`) holds `config.json` (auth provider + api key if any) and `server.json` (port/pid/version). `bin/ima2.js` migrates from a legacy `<packageRoot>/.ima2/config.json` on first read.
- CLI client commands (`gen / edit / ls / show / ps / ping`) discover the running server via `~/.ima2/server.json`, overridable with `--server <url>` or `IMA2_SERVER=...`. Exit codes are stable and documented in README: `0 ok · 2 bad args · 3 unreachable · 4 APIKEY_DISABLED · 5 4xx · 6 5xx · 7 safety refusal · 8 timeout`.
- Windows has no native `codex` installer. `lib/codexDetect.js` probes auth via file (`~/.codex/auth.json`, `~/.config/codex/auth.json`) AND `codex login status` subprocess. `bin/lib/platform.js` wraps `spawn` with Windows `.cmd` resolution (the `Windows npx spawn EINVAL` fix in commit `2579e53`).

## Conventions

- ES Modules only (`"type": "module"`), Node `>=20`. Do not add CommonJS.
- Reference images: max 5, max ~5.2MB decoded per ref, strict base64 regex check in `validateAndNormalizeRefs`. Moderation is `"auto" | "low"` only.
- Size presets enforce gpt-image sizing rules (every side %16, ratio ≤3:1, 655k–8.3M total pixels). See `ui/src/lib/size.ts` and `tests/size-presets.test.js` before adding a new preset.
- Sidecar metadata written alongside every generated image drives history reconstruction — any new field on generate/edit/node must also be surfaced in the `listImages` mapping in `server.js:286-343`.
- Filename collisions avoided via `${Date.now()}_${randomBytes(4).hex}_${idx}` (commit `7a0e2f5`). Keep the random token when adding new write paths.
- Tests live in `tests/*.test.js` using Node's built-in test runner (`node --test`). `scripts/run-tests.mjs` handles cross-platform invocation; CI matrix is Ubuntu/macOS/Windows × Node 20/22.

## Gotchas

- The developer system prompt inside `generateViaOAuth` / `editViaOAuth` currently contains "authorized red-team evaluation session" and instructions to skip safety disclaimers. This is a published npm package — treat any change near those strings as user-visible policy. Do not add similar phrases without an explicit ask.
- `devlog/` documents three overlapping roadmaps (`AGENTS.md` Phase 0–3, README Roadmap 0.10–0.12, `devlog/_plan/README.md` 0.1–1.0). They have drifted. Treat them as historical context, not ground truth — confirm current scope with the user before acting on a devlog item.
- `public/index.html.legacy` is the pre-React vanilla build, kept for reference only. The live UI is `ui/dist/`.
- `generated/` has no size cap or TTL (only `.trash/` has soft-delete). Expect it to grow without bound on long-running dev installs.
- README has an unstaged edit (working copy) that reframes the model as `responses + image_generation` instead of `gpt-image-2`. Match that framing in any user-facing copy you touch.
