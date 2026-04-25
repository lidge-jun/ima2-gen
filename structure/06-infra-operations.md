---
created: 2026-04-23
tags: [ima2-gen, operations, build, testing]
aliases: [ima2 operations, ima2 infra, image_gen operations]
---

# Infrastructure And Operations

`ima2-gen` operates as an npm package, local Node server, OAuth proxy, SQLite-backed graph store, image file store, and React build artifact. Users see one CLI, but internally the server, UI bundle, local config, and runtime data move together.

This document matters because development mode and packaged mode take different paths. Developers run `npm run dev`, which builds the UI and launches the watched server. Users run `ima2 serve`, which checks for `ui/dist` and starts the server. Node mode is enabled in both paths by default. CLI clients read `~/.ima2/server.json` to find the running server. Config and generated data are split between the repo and the user's home directory.

For operations work, choose the layer first. Auth and provider changes touch config and the OAuth proxy. Release work touches `package.json`, `files`, and `prepublishOnly`. Test work touches `scripts/run-tests.mjs` and `tests/*.test.js`. UI build work touches `ui/package.json` and `ui/dist`.

---

## Runtime Layout

```mermaid
graph TD
    CLI["ima2 CLI"] --> CFG["~/.ima2/config.json"]
    CLI --> ADV["~/.ima2/server.json"]
    CLI --> SRV["server.js"]
    SRV --> DIST["ui/dist"]
    SRV --> GEN["generated"]
    SRV --> DB["SQLite via better-sqlite3"]
    SRV --> OAUTH["openai-oauth<br/>default port 10531"]
    SRV --> ENV["env vars"]
```

## Package Contract

| Item | Current value |
|---|---|
| package name | `ima2-gen` |
| version | `1.1.0` |
| type | `module` |
| bin | `ima2` -> `./bin/ima2.js` |
| package engine | `node >=20` |
| publish files | `bin/`, `lib/`, `routes/`, `ui/dist/`, `docs/`, `assets/`, `server.js`, `config.js`, `.env.example`, `README.md` |
| major dependencies | `express`, `openai`, `openai-oauth`, `better-sqlite3`, `dotenv`, `ulid` |

README may still mention a different Node baseline. The operational baseline is the current `engines.node` field in `package.json`.

## Script Surface

| Script | Runs | Purpose |
|---|---|---|
| `npm start` | `node bin/ima2.js serve` | Start the server like a user would |
| `npm run dev` | `node scripts/dev.mjs` | Build UI, then run watched server |
| `npm run dev:server` | `node --watch server.js` | Watch only the server |
| `npm run ui:install` | `cd ui && npm install` | Install UI dependencies |
| `npm run ui:dev` | `cd ui && npm run dev` | Vite dev server |
| `npm run ui:build` | `cd ui && npm run build` | TypeScript build and Vite build |
| `npm run build` | `npm run ui:build` | Build UI bundle before publish |
| `npm test` | `node scripts/run-tests.mjs` | Run `tests/*.test.js` with `node:test` |
| `npm run setup` | `node bin/ima2.js setup` | Configure provider |
| `npm run lint:pkg` | package metadata check | Validate package fields and publish file list |
| `npm run test:package-install` | temp tarball install smoke | Installs packed package and checks `ima2 doctor`, `/api/health`, and `/api/storage/status` |

`release:*` scripts include npm publish and git push. Agents must not run them unless the user explicitly asks.

## Config And Data Locations

| Location | Role | Caution |
|---|---|---|
| `~/.ima2/config.json` | Provider config and possible API key location | May contain secrets; never paste values into docs |
| `~/.ima2/server.json` | Running server port advertisement | Used by CLI discovery |
| `image_gen/.ima2/config.json` | Legacy config location | New CLI prefers the home config |
| `~/.ima2/generated/` | Image files and sidecar metadata | Runtime output; survives npm global updates. Startup migration scans legacy package `generated/` folders across npm, npx, pnpm, Yarn, Bun, nvm/fnm, asdf/mise, Volta, and common macOS/Linux/Windows global layouts |
| `~/.ima2/generated/.trash/` | Soft-deleted assets | Restore and purge policy target |
| SQLite DB | Session graph storage | Managed through `lib/db.js` and `lib/sessionStore.js` |
| `ui/dist/` | Active UI bundle served by server | Build output, not source |

`ima2 doctor` includes a Storage section with the current gallery path, legacy-source counts, and recovery-guide pointer. The browser gallery also calls `/api/storage/status` and can open the current generated folder through `/api/storage/open-generated-dir`; that endpoint accepts no arbitrary path.

## Environment Variables

| Variable | Default or meaning |
|---|---|
| `OPENAI_API_KEY` | May be used for billing probes and legacy provider config |
| `PORT` | Server port, default `3333` |
| `OAUTH_PORT` | OAuth proxy port, default `10531` |
| `IMA2_SERVER` | CLI target server URL override |
| `IMA2_CONFIG_DIR` | Used by tests to isolate config directory |
| `IMA2_INFLIGHT_TTL_MS` | Active in-flight stale-job TTL, default `600000` |
| `IMA2_INFLIGHT_TERMINAL_TTL_MS` | Recent completed/error/canceled job debug retention, default `30000` |
| `VITE_IMA2_NODE_MODE` | UI build-time gate; set `0` only for a classic-only bundle |
| `IMA2_LOG_LEVEL` | Reserved log-level setting; current app emits safe structured logs |

Generation and edit endpoints currently hard-block `provider: "api"`. Even with an API key, image generation is OAuth-centered.

## Observability

The server emits safe structured log lines for route lifecycle, OAuth responses, stream image receipt, inflight phase changes, session graph saves, and gallery history grouping. `IMA2_LOG_LEVEL` supports `debug`, `info`, `warn`, `error`, and `silent`; invalid values fall back to `info`.

Every `/api/*` request gets a sanitized `X-Request-Id` header. Static UI files and `/generated/*` images are deliberately outside the request logger so gallery image serving does not create log noise or surprise headers. Correlate a UI request with `requestId` first, then follow the same id through `[http.request]`, `[generate.request]`, `[oauth.response]`, `[inflight.phase]`, `[oauth.image]`, `[generate.saved]`, `[http.response]`, and `[inflight.finish]`.

Logs intentionally use counts rather than sensitive values: `promptChars`, `refs`, `imageChars`, `durationMs`, and `errorCode`. Do not add raw prompts, style-sheet bodies, data URLs, generated base64, tokens, cookies, or raw upstream response bodies to logs.

## Development And Verification

| Task | Command | Expected result |
|---|---|---|
| Full test suite | `npm test` | `scripts/run-tests.mjs` runs `tests/*.test.js` |
| UI build | `npm run build` | `ui/dist` is updated |
| Dev server | `npm run dev` | UI is built, then `node --watch server.js` starts |
| Package sanity | `npm run lint:pkg` | Required `files[]`, `bin`, and version fields are checked |
| Package smoke | `npm pack --dry-run --json` | Verifies the publish manifest includes release-critical files |
| Package install smoke | `npm run test:package-install` | Installs the tarball in a temp project and checks `doctor`, `/api/health`, and `/api/storage/status` |
| CLI health | `ima2 ping` | Checks `/api/health` on the running server |

## Pre-Release Checklist

- [ ] Run `npm test`.
- [ ] Run `npm run build` to refresh `ui/dist`.
- [ ] Run `npm run lint:pkg` to verify the publish file list.
- [ ] Run `npm pack --dry-run --json` or rely on `tests/package-smoke.test.js` to confirm README, recovery docs, storage routes, doctor files, and `ui/dist/index.html` are included in the publish manifest.
- [ ] Run `npm run test:package-install` before publish when you want a full tarball install smoke. This is opt-in because it performs a real temp `npm install`.
- [ ] Check README and `structure/` docs for Node baseline, provider wording, and CLI table drift.
- [ ] Do not run release scripts automatically; they include push/publish behavior.

## Change Checklist

- [ ] If `package.json` scripts or engines change, update this doc.
- [ ] If config file locations change, update discovery flow in `[[02-command-reference]]`.
- [ ] If OAuth proxy startup changes, update `[[03-server-api]]` and provider docs.
- [ ] If `ui/dist` publish policy changes, update `[[04-frontend-architecture]]`.
- [ ] If tests are added, update the test map in `[[01-file-function-map]]`.

## Change Log

- 2026-04-23: Documented package, scripts, config, runtime data, and test/build operations.
- 2026-04-23: Translated this document from Korean to English.
- 2026-04-24: Added inflight terminal TTL and safe logging operations notes.
- 2026-04-25: Added npm package smoke guidance for release-critical file inclusion.
- 2026-04-25: Updated package metadata for version 1.1.0, `routes/`/`docs/` publish contract, and install-smoke script.
- 2026-04-25: Updated logging operations for dependency-free levels, request IDs, and API-only middleware.

Previous document: `[[05-node-mode]]`

Next document: `[[07-devlog-map]]`
