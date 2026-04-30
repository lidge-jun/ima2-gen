---
created: 2026-04-23
tags: [ima2-gen, structure-docs, architecture, GPT-Image-2]
aliases: [ima2 structure hub, ima2 architecture, image_gen structure]
---

# ima2-gen Structure Hub

`ima2-gen` is a combined image-generation CLI and web UI. Users start the local server with `ima2 serve`, then generate or edit images through either the browser UI or CLI commands. This folder documents that runtime path as a small architecture reference set.

This hub matters because the codebase has several active centers of gravity. `server.ts` (with paired runtime `server.js`) bootstraps the app and delegates most API surfaces to `routes/*`, including `generate`, `edit`, `multimode`, `nodes`, `sessions`, `history`, `imageImport`, `health`, `storage`, `metadata`, `annotations`, `canvasVersions`, `comfy`, `prompts`, `promptImport`, and the dev-gated `cardNews`. `lib/*` owns storage, OAuth, logging, sessions, inflight state, migration helpers, image metadata embed/restore, prompt library SQLite, reference compression, ComfyUI bridge helpers, canvas version store, system-trash soft-delete, PNG-info parsing, and card-news planner/template stores. `bin/` owns the CLI automation surface, now near-complete parity with the server API (#45). `ui/src/` owns the React UI, the React Flow node mode, Canvas Mode (split under `ui/src/components/canvas-mode/`), mobile shell, the prompt library panel, and the dev-only card-news workspace. Without a structure guide, even a small API change can make it unclear whether CLI, UI, tests, or devlog docs also need to move.

Snapshot note, 2026-04-30: TypeScript migration is functionally complete and merged to `main` (archived under `devlog/_fin/260429_typescript-migration`). Route, lib, server, config, and bin source files are now `*.ts`; paired `*.js` files coexist as committed build/runtime artifacts (see `tsconfig.build.json`, `tsconfig.bin.json`, and `prepack`). Treat the `.ts` files as source of truth and only edit the `.js` paths through the build, never by hand.

Start here when onboarding. Read the system overview, then open `[[01-file-function-map]]` for concrete file locations. Use `[[02-command-reference]]` for CLI work, `[[03-server-api]]` for server changes, `[[04-frontend-architecture]]` and `[[05-node-mode]]` for UI work, `[[06-infra-operations]]` for build/auth/runtime operations, and `[[07-devlog-map]]` for roadmap and archive interpretation.

This documentation is based on local code and local devlog files, not external web research. Version numbers, endpoints, and line counts are snapshots of the current working tree. Update the relevant docs whenever the code changes.

---

## System Overview

```mermaid
graph LR
    CLI["bin/ima2.ts<br/>CLI dispatcher"] --> API["server.ts<br/>Express bootstrap"]
    CMDS["bin/commands/*<br/>client commands"] --> API
    WEB["ui/dist<br/>served app"] --> API
    SRC["ui/src<br/>React source"] --> WEB
    API --> ROUTES["routes/*<br/>API modules"]
    API --> OAUTH["openai-oauth<br/>local proxy"]
    API --> GEN["~/.ima2/generated<br/>images and sidecars"]
    API --> DB["better-sqlite3<br/>sessions and graph"]
    API --> LIB["lib/*<br/>asset node inflight db"]
```

The runtime path is intentionally direct. CLI commands and the browser call `/api/*` endpoints registered by `server.js` and implemented in `routes/*`. The server sends image requests through the local OAuth proxy, saves image files under the configured generated directory, usually `~/.ima2/generated`, and persists graph sessions through SQLite. Node mode wraps the same image-generation capability in a graph workflow.

## Reading Order

| Order | Document | Why to read it |
|---:|---|---|
| 1 | `[[00-structure-hub]]` | Understand the system flow and document map. |
| 2 | `[[01-file-function-map]]` | Locate files, line counts, and module responsibilities. |
| 3 | `[[02-command-reference]]` | Understand `ima2` commands and server discovery. |
| 4 | `[[03-server-api]]` | Understand REST contracts, response shapes, and errors. |
| 5 | `[[04-frontend-architecture]]` | Understand React UI, Zustand state, and component layout. |
| 6 | `[[05-node-mode]]` | Understand graph canvas, node generation, and session persistence. |
| 7 | `[[06-infra-operations]]` | Understand auth, config, build, test, and runtime data. |
| 8 | `[[07-devlog-map]]` | Understand roadmap, completed work, and planning docs. |

## Document Map

| Document | Scope | Update when |
|---|---|---|
| `00-structure-hub.md` | Entry point, doc relationships, QA flow | A doc is added, removed, renamed, or re-scoped. |
| `01-file-function-map.md` | File tree, line counts, responsibilities, tests | Files move, large modules split, or line counts change. |
| `02-command-reference.md` | CLI commands, options, server discovery, exit codes | `bin/ima2.ts`, `bin/commands/*`, or `bin/lib/*` changes. |
| `03-server-api.md` | `/api/*` endpoints and request/response contracts | `server.ts`, route modules, store helpers, or API tests change. |
| `04-frontend-architecture.md` | React UI, components, store, i18n | `ui/src/*`, `ui/package.json`, or CSS changes. |
| `05-node-mode.md` | Graph UI, node API, sessions, pending states | `NodeCanvas`, `ImageNode`, `/api/node/*`, or session logic changes. |
| `06-infra-operations.md` | Auth, OAuth proxy, config, build/test/release | `package.json`, scripts, env, CI, or runtime storage changes. |
| `07-devlog-map.md` | `_plan`, `_fin`, `_spikes`, roadmap interpretation | Devlog folders move or the active roadmap changes. |

## Cross References

| Document | Should also check |
|---|---|
| `01-file-function-map` | `03-server-api`, `04-frontend-architecture`, `06-infra-operations` |
| `02-command-reference` | `03-server-api`, `06-infra-operations` |
| `03-server-api` | `02-command-reference`, `05-node-mode`, `06-infra-operations` |
| `04-frontend-architecture` | `03-server-api`, `05-node-mode` |
| `05-node-mode` | `03-server-api`, `04-frontend-architecture`, `07-devlog-map` |
| `06-infra-operations` | `01-file-function-map`, `02-command-reference` |
| `07-devlog-map` | `00-structure-hub`, `05-node-mode`, `06-infra-operations` |

## Sync Checklist

- [x] Create the structure docs folder and record its purpose in `AGENTS.md`.
- [x] Mirror the `cli-jaw/devlog/structure` hub pattern as a smaller set.
- [x] Document the current CLI, API, UI, node-mode, infra, and devlog surfaces.
- [x] `server.js` is split into route modules; keep `01`, `03`, and `06` synchronized with route ownership.
- [ ] If a CLI command is added, update `02`, `03`, and `06` together.
- [ ] If React component or store shape changes, update `04` and `05` together.

## Change Log

- 2026-04-23: Created the initial `image_gen/structure` hub and eight-document reference set.
- 2026-04-23: Translated the structure docs from Korean to English.
- 2026-04-25: Updated the hub after route decomposition, home-directory storage migration, and 0.09 closeout audit.
- 2026-04-26: Refreshed the docs around CLI parity, runtime port fallback, and public classic/node product scope.
- 2026-04-28: Updated hub for image metadata embed/restore, prompt library, dev-only card-news workspace, expanded route surface (`metadata`, `prompts`, `cardNews`), and `ima2-gen@1.1.5`.
- 2026-04-30: Refreshed all eight docs after the TypeScript migration closeout, CLI feature-parity #45 (`feat(cli): full feature parity with server API`), Canvas Mode workspace split (`refactor(ui): split canvas mode workspace`), Canvas dual-mask cleanup, OS-trash soft-delete, blank-canvas/escape close hardening, and `ima2-gen@1.1.8`. Re-aligned line counts, route inventory, and CLI command list to the working tree.

Previous document: none

Next document: `[[01-file-function-map]]`
