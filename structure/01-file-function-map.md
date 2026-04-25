---
created: 2026-04-23
tags: [ima2-gen, file-map, function-map, code-structure]
aliases: [ima2 file map, ima2 str_func, image_gen file map]
---

# File And Function Map

This document is a fast map of the current `ima2-gen` file layout. Use it to understand which files own which responsibilities before making changes.

The map matters because the repository looks small, but runtime responsibility is split across several areas. `server.js` is now a small bootstrap file, API ownership lives in `routes/*`, and runtime helpers live in `lib/*`. The CLI is split into `bin/commands/*`, and the UI is split across `ui/src/components/*`, `ui/src/lib/*`, and `ui/src/store/useAppStore.ts`. Reading responsibilities and line counts together helps reveal both impact radius and refactor targets.

Before adding a feature, choose the surface first. For CLI work, read `bin/` and `[[02-command-reference]]`. For API work, read `server.js`, `lib/*`, and `[[03-server-api]]`. For UI work, read `ui/src/` and `[[04-frontend-architecture]]`. For graph workflow work, also read `[[05-node-mode]]`.

---

## Top-Level Tree

```mermaid
graph TD
    ROOT["image_gen"] --> BIN["bin<br/>CLI entry and commands"]
    ROOT --> SERVER["server.js<br/>Express bootstrap"]
    ROOT --> ROUTES["routes<br/>API modules"]
    ROOT --> LIB["lib<br/>storage and lifecycle helpers"]
    ROOT --> UI["ui<br/>React source and build"]
    ROOT --> TESTS["tests<br/>node:test suite"]
    ROOT --> DEVLOG["devlog<br/>plans spikes archive"]
    ROOT --> DOCS["docs<br/>localized README files"]
    ROOT --> STRUCT["structure<br/>architecture reference"]
    SERVER --> GEN["~/.ima2/generated<br/>runtime image outputs"]
```

## Core File Line Counts

| File | Lines | Responsibility |
|---|---:|---|
| `server.js` | 168 | Express bootstrap, middleware wiring, OAuth startup, route registration, static serving |
| `routes/generate.js` | 269 | Classic generation API, model validation, reference validation, sidecar save |
| `routes/edit.js` | 186 | Edit API, parent image path, OAuth edit response save |
| `routes/nodes.js` | 363 | Node generation API, SSE partial streaming, node sidecar save, node fetch |
| `routes/sessions.js` | 292 | SQLite-backed session list/load/save/rename/delete and graph save |
| `routes/history.js` | 102 | History list, grouped gallery, soft delete and restore |
| `routes/health.js` | 89 | Health, providers, billing, OAuth status |
| `routes/storage.js` | 39 | Gallery storage status and generated-folder open action |
| `routes/index.js` | 19 | Route registration hub |
| `bin/ima2.js` | 378 | CLI setup, serve, status, doctor, open, reset, command dispatch |
| `bin/commands/gen.js` | 136 | CLI image-generation client |
| `bin/commands/edit.js` | 70 | CLI image-edit client |
| `bin/commands/ls.js` | 49 | History list client |
| `bin/commands/ps.js` | 46 | Inflight job list client |
| `bin/commands/show.js` | 48 | Single history item display/reveal client |
| `bin/commands/ping.js` | 28 | Server health probe client |
| `bin/lib/client.js` | 97 | Server discovery, HTTP request wrapper, response normalization |
| `bin/lib/platform.js` | 97 | Browser-open and binary-resolution helpers |
| `bin/lib/args.js` | 73 | Dependency-free argv parser |
| `bin/lib/files.js` | 39 | Data URI file conversion and output naming |
| `bin/lib/output.js` | 48 | Terminal output, JSON, exit-code mapping |
| `bin/lib/star-prompt.js` | 97 | CLI prompt decoration helper |
| `bin/lib/storage-doctor.js` | 38 | CLI storage doctor formatting |
| `lib/sessionStore.js` | 231 | SQLite session and graph persistence; lightweight session-title lookup |
| `lib/assetLifecycle.js` | 123 | Soft delete, restore, node asset-missing marking |
| `lib/db.js` | 114 | SQLite bootstrap and migrations, including inflight table |
| `lib/nodeStore.js` | 69 | Node image and metadata load/save |
| `lib/inflight.js` | 204 | SQLite-backed active job registry and short-lived terminal job snapshots |
| `lib/logger.js` | 150 | Safe structured logging, redaction, level filtering, and test sink helpers |
| `lib/requestLogger.js` | 48 | API-only request lifecycle logging and sanitized request ID middleware |
| `lib/codexDetect.js` | 69 | Codex OAuth session detection helper |
| `lib/errorClassify.js` | 62 | Upstream/OAuth error classifier for stable error codes |
| `lib/historyList.js` | 68 | History reconstruction from generated assets and sidecars |
| `lib/storageMigration.js` | 284 | Legacy generated-folder scan and migration support |

## UI File Map

| Area | File | Lines | Responsibility |
|---|---|---:|---|
| App shell | `ui/src/App.tsx` | 100 | Initial hydration, polling, classic/node/card-news canvas switch |
| Entry | `ui/src/main.tsx` | 10 | React mount |
| Types | `ui/src/types.ts` | 121 | Provider, quality, size, image model, response types |
| Store | `ui/src/store/useAppStore.ts` | 2378 | Zustand state, history, in-flight jobs, graph, sessions, errors, storage, custom size, node batch selection, edge disconnect |
| API client | `ui/src/lib/api.ts` | 501 | Browser-side REST client |
| Style | `ui/src/index.css` | 2979 | App layout, canvas, components, node-mode, settings, error, node batch, and card-news styling |
| Components | `ui/src/components/*.tsx` | 3089 | Sidebar, canvas, modal, node cards, batch bar, panels, controls, settings, error surfaces |
| Hooks | `ui/src/hooks/*.ts` | 57 | Billing and OAuth status polling |
| i18n | `ui/src/i18n/*` | 1026 | English/Korean translations and locale runtime |

## Major Components

| Component | Lines | Role |
|---|---:|---|
| `GalleryModal.tsx` | 457 | History gallery modal, storage recovery banner, open-folder action |
| `PromptComposer.tsx` | 219 | Prompt input, reference handling, style-sheet entry |
| `NodeCanvas.tsx` | 166 | React Flow graph canvas, edge disconnect routing |
| `RightPanel.tsx` | 129 | Quality, size, format, moderation, count controls |
| `ImageNode.tsx` | 252 | Node-mode image card, partial preview, reference draft state |
| `ProviderSelect.tsx` | 103 | OAuth/API provider display and disabled-state handling |
| `SessionPicker.tsx` | 89 | Node-mode session picker |
| `SettingsWorkspace.tsx` | 218 | Workspace-style settings page |
| `StyleSheetDialog.tsx` | 249 | Session style-sheet summary, extract, edit dialog |
| `SizePicker.tsx` | 106 | Preset/custom size picker with keyboard draft state |
| `ImageModelSelect.tsx` | 101 | Shared Settings/sidebar image model selector |
| `ErrorCard.tsx` | 70 | Persistent CTA error surface |
| `CustomSizeConfirmModal.tsx` | 85 | Blocking confirmation for adjusted custom sizes |

## Test Map

| Test | Lines | Contract covered |
|---|---:|---|
| `tests/health.test.js` | 206 | `/api/health`, advertisement, generate provider payload, terminal inflight |
| `tests/history-tombstone.test.js` | 161 | History soft delete, restore, pagination, session-title grouping |
| `tests/inflight.test.js` | 54 | Active/terminal inflight registry behavior |
| `tests/logging.test.js` | 51 | Safe log redaction and structured format |
| `tests/oauth-proxy-error-safety.test.js` | 36 | OAuth upstream error body log-safety regression |
| `tests/cli-commands.test.js` | 130 | Live CLI command behavior |
| `tests/bin.test.js` | 117 | CLI entry behavior |
| `tests/cli-lib.test.js` | 111 | Client, args, files, output helpers |
| `tests/server.test.js` | 94 | Basic server API contracts |
| `tests/size-presets.test.js` | 57 | Size preset validation |
| `tests/image-model.test.js` | 89 | Image model allowlist and route rejection contract |
| `tests/error-classify.test.js` | 49 | Error string classifier contract |
| `tests/size-custom-input-contract.test.js` | 214 | Custom size keyboard and confirmation contract |
| `tests/node-batch-contract.test.js` | 62 | Node graph selection and batch generation contracts |
| `tests/node-edge-disconnect-contract.test.js` | 52 | Edge-only disconnect and parent metadata cleanup contracts |
| `tests/package-smoke.test.js` | 72 | Publish manifest dry-run contract |
| `tests/package-install-smoke.mjs` | 157 | Optional tarball install smoke |

## Refactor Signals

| Signal | Current state | Recommended docs to update |
|---|---|---|
| `server.js` is split | Route files own API surfaces; keep route map current | `03-server-api`, `06-infra-operations` |
| `ui/src/index.css` is 2789 lines | Layout and component styles are concentrated | `04-frontend-architecture` |
| `useAppStore.ts` is the central store | Classic, node, session, history, and toast state are together | `04-frontend-architecture`, `05-node-mode` |
| `public/index.html.legacy` remains | Active UI is `ui/dist`; legacy HTML is only an artifact | `04-frontend-architecture`, `07-devlog-map` |

## Change Checklist

- [ ] Add new files to the relevant table with their responsibilities.
- [ ] If server routes are split, update line counts and API docs together.
- [ ] If UI components are split, update the component table and frontend doc.
- [ ] If tests are added, update the test map and `06-infra-operations`.

## Change Log

- 2026-04-23: Created the first working-tree file and responsibility map.
- 2026-04-23: Translated this document from Korean to English.
- 2026-04-24: Added safe logger, terminal inflight, gallery title grouping, and related tests.
- 2026-04-25: Updated line counts and ownership after route decomposition, model/error/custom-size/storage work, and package smoke tests.

Previous document: `[[00-structure-hub]]`

Next document: `[[02-command-reference]]`
