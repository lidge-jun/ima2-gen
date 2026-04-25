---
created: 2026-04-23
tags: [ima2-gen, React, frontend, Zustand]
aliases: [ima2 frontend, ima2 React UI, image_gen frontend]
---

# Frontend Architecture

The current `ima2-gen` web UI is the React app under `ui/src/`. The server serves the built bundle under `ui/dist/`. The old single-file HTML UI remains as `public/index.html.legacy`, but it is not the active entrypoint.

This matters because README and older devlog entries still contain traces of the vanilla HTML UI. Actual UI work should target React components, the Zustand store, `ui/src/lib/api.ts`, and `ui/src/index.css`. Fixing the legacy HTML file will not change the active app.

Start UI work at `App.tsx` to understand how classic canvas and node canvas diverge. Server calls are in `ui/src/lib/api.ts`. State is centralized in `ui/src/store/useAppStore.ts`. For screen-level structure, start with `Sidebar`, `Canvas`, `NodeCanvas`, `RightPanel`, and `GalleryModal`.

---

## Render Flow

```mermaid
graph TD
    MAIN["main.tsx"] --> APP["App.tsx"]
    APP --> STORE["useAppStore"]
    APP --> SIDEBAR["Sidebar"]
    APP --> SETTINGS["SettingsWorkspace"]
    APP --> CLASSIC["Canvas"]
    APP --> NODE["NodeCanvas"]
    APP --> CARD["CardNewsWorkspace"]
    APP --> RIGHT["RightPanel"]
    APP --> MODAL["GalleryModal"]
    STORE --> API["ui/src/lib/api.ts"]
    CARD --> CARDSTORE["cardNewsStore"]
    CARDSTORE --> CARDAPI["cardNewsApi.ts"]
    API --> SERVER["server.js /api"]
    CARDAPI --> SERVER
```

`App.tsx` hydrates history, loads sessions, reconciles inflight jobs, starts polling on mount, and syncs theme preference. If settings are open, it renders `SettingsWorkspace` in the center slot. Otherwise, if UI mode is `classic`, it renders `Canvas`; if node mode is enabled and UI mode is `node`, it renders `NodeCanvas`; if Card News dev mode is enabled and UI mode is `card-news`, it renders `CardNewsWorkspace` and hides the normal right panel. Node mode is enabled in packaged builds by default and can be hidden only by building with `VITE_IMA2_NODE_MODE=0`. Before unload or visibility changes, it flushes the graph save beacon.

Settings are a workspace replacement, not a modal overlay. `SettingsButton` lives next to the `ima2-gen` title in the sidebar. The compact image model selector also lives in this header as a fast switcher, while Settings shows the same choice with full model names. `SettingsWorkspace` keeps the outer shell fixed so the header and `X` close button do not scroll away; only the section index and content pane scroll. Selecting an item jumps the center document to that section instead of replacing the content panel. `SettingsWorkspace` closes with `X` or Escape and returns to the previous canvas path without mutating generation state.

## Major Areas

| Area | Main files | Responsibility |
|---|---|---|
| App shell | `ui/src/App.tsx` | Initialization, storage sync, beforeunload save, canvas/settings switch |
| Left panel | `Sidebar.tsx`, `PromptComposer.tsx`, `SettingsButton.tsx` | Focused generation entry plus settings access |
| Center workspace | `Canvas.tsx`, `NodeCanvas.tsx`, `SettingsWorkspace.tsx`, `ImageNode.tsx` | Classic image display, graph canvas, or settings workspace |
| Right panel | `RightPanel.tsx`, `SizePicker.tsx`, `CostEstimate.tsx` | Quality, size, format, moderation, count |
| History | `HistoryStrip.tsx`, `GalleryModal.tsx`, `ResultActions.tsx` | Saved image browsing and actions |
| Card News | `card-news/*`, `cardNewsStore.ts`, `cardNewsApi.ts` | Dev-gated card set planning, review, batch generation, retry, and set loading |
| Status | `InFlightList.tsx`, `Toast.tsx`, `BillingBar.tsx`, `AccountSettings.tsx` | Pending jobs, notifications, billing/provider status |
| Error UX | `ErrorCard.tsx`, `ui/src/lib/errorCodes.ts`, `errorHandler.ts` | Code-based localized error cards and toast routing |
| Custom size | `SizePicker.tsx`, `CustomSizeConfirmModal.tsx`, `ui/src/lib/size.ts` | Keyboard-safe custom size drafts and generation-time adjustment confirmation |
| i18n | `ui/src/i18n/index.ts`, `ko.json`, `en.json` | Locale load/save and translation lookup |

## State Model

| State group | Location | Description |
|---|---|---|
| Generation options | `useAppStore.ts` | Provider, quality, size, format, moderation, image model, count |
| Prompt/reference | `useAppStore.ts` | Prompt, reference images, add/remove/clear helpers |
| Classic history | `useAppStore.ts` plus `/api/history` | Current image, history, gallery |
| Inflight | `useAppStore.ts` plus `/api/inflight` | localStorage-backed pending jobs and polling |
| Node graph | `useAppStore.ts` plus sessions API | Nodes, edges, graphVersion, session actions |
| Card News set | `cardNewsStore.ts` plus `/api/cardnews/*` | Image template, role template, brief, planner metadata, active card plan, card statuses |
| Settings workspace | `useAppStore.ts` | `settingsOpen` and active settings section |
| UI preferences | `localStorage` | Right panel state, UI mode, selected filename, locale, theme |
| Error surface | `useAppStore.ts` plus `ErrorCard.tsx` | `errorCard` state for actionable errors; toast remains for small errors |

The image model preference is stored in `localStorage` as `ima2.imageModel`. Sidebar compact labels (`5.4m`, `5.4`, `5.5`) and Settings full labels (`GPT-5.4 Mini`, `GPT-5.4`, `GPT-5.5`) both read/write the same store field, so the next classic or node request sends the selected `model` instead of falling back to the default. The sidebar selector is intentionally tiny: the closed state shows only the compact label, opens a custom menu on click, and closes on outside click or Escape.

Visible metadata should carry the selected model too. Current result metadata, hydrated history items, and ready node status labels use the server-returned or sidecar-restored `model` so UI debugging matches backend logs. The visible metadata uses compact aliases to preserve elapsed time: model aliases are `5.4m`/`5.4`/`5.5`, and quality aliases are `l`/`m`/`h`.

## API Client

| Function | Endpoint | Used by |
|---|---|---|
| `postGenerate` | `POST /api/generate` | Classic generation |
| `postEdit` | `POST /api/edit` | Edit flow |
| `getHistory` | `GET /api/history` | History strip and gallery |
| `getHistoryGrouped` | `GET /api/history?groupBy=session` | Session-grouped history |
| `deleteHistoryItem` | `DELETE /api/history/:filename` | Asset delete |
| `restoreHistoryItem` | `POST /api/history/:filename/restore` | Undo/restore |
| `getStorageStatus` | `GET /api/storage/status` | Gallery storage recovery notice |
| `openGeneratedDir` | `POST /api/storage/open-generated-dir` | Gallery "Open folder" action |
| `getInflight` | `GET /api/inflight` | Pending reconciliation |
| `postNodeGenerate` | `POST /api/node/generate` | Node-mode generation |
| `postNodeGenerateStream` | `POST /api/node/generate` with `Accept: text/event-stream` | Node-mode partial preview streaming |
| Session helpers | `/api/sessions/*` | Graph session list/load/save |
| `getOAuthStatus` | `GET /api/oauth/status` | Provider readiness |
| `getBilling` | `GET /api/billing` | Billing bar and API status |

Card News intentionally uses a separate API client, `ui/src/lib/cardNewsApi.ts`, instead of mixing its set-shaped payloads into the classic image helpers. The important functions are:

| Function | Endpoint | Used by |
|---|---|---|
| `listCardNewsImageTemplates` | `GET /api/cardnews/image-templates` | Card News composer |
| `listCardNewsRoleTemplates` | `GET /api/cardnews/role-templates` | Card News composer |
| `draftCardNews` | `POST /api/cardnews/draft` | JSON-first planner outline |
| `generateCardNews` | `POST /api/cardnews/generate` | Parallel template-guided batch generation |
| `regenerateCardNewsCard` | `POST /api/cardnews/cards/:cardId/regenerate` | Selected-card retry/regeneration |
| `listCardNewsSets` | `GET /api/cardnews/sets` | Gallery set discovery |
| `getCardNewsSet` | `GET /api/cardnews/sets/:setId` | Gallery set open/load |

## Classic UI And Node UI

| Mode | Condition | Main component | State flow |
|---|---|---|---|
| Classic | Default UI | `Canvas.tsx` | Sends prompt to `/api/generate`, then updates current image/history |
| Node | Product feature enabled | `NodeCanvas.tsx` | Calls `/api/node/generate` per node, renders partial previews when streamed, and saves the graph to the session |
| Card News | Dev feature enabled | `CardNewsWorkspace.tsx` | Builds a `CardNewsPlan`, shows planner/progress metadata, writes generated sets under `/generated/cardnews/<setId>/`, and opens set history from Gallery |

Node mode uses `@xyflow/react`. Empty canvas creates a root node. Dragging an edge from an existing node can create a child node. Session loading displays a canvas overlay.

Node generation uses SSE first through `postNodeGenerateStream()`. Partial images are stored only in transient `ImageNodeData.partialImageUrl`; they are deleted from the graph save payload. The final `done` payload replaces the preview with the canonical saved file URL. If the server returns JSON instead of SSE, the client falls back to the final-only behavior.

Node selection batch actions live on the canvas, not in Settings. `NodeCanvas` exposes a compact selection bar inside the React Flow area. Selection mode treats a normal node click as selecting the whole undirected connected component. Cmd/Ctrl modifies that selection: another component is added/removed, while a node inside the selected component can be toggled as an exception. Batch regeneration is sequential and in-place for selected nodes only; it does not use the single-node ready-state sibling branch.

Node edge removal is routed explicitly instead of relying on raw React Flow edge changes. When an edge is removed, `useAppStore.disconnectEdges()` removes the visual edge and clears or recomputes the target node's `parentServerNodeId`. Selection mode disables Delete/Backspace deletion so graph selection cannot accidentally remove edges or nodes.

Error handling is centralized. API helpers preserve `err.code` where the server sends `{ error: { code, message } }`; `handleError()` maps stable codes to either a toast or persistent `ErrorCard`. The card is reserved for actionable failures such as OAuth expiry, moderation refusal, upstream 5xx, network/proxy failure, and API-key-disabled policy.

Card News keeps delivery local to its workspace. Generated cards are not assigned to classic `currentImage`. `CardDeckRail`, `CardStage`, `CardInspector`, `CardStatusBadge`, `CardNewsBatchBar`, and `PlannerMetaBadge` show card status, selected-card actions, planner mode, locked-card hints, and failed-card retry. `GalleryModal` preserves `setId`, card metadata, and set card lists when it groups history rows; opening a Card News set calls `cardNewsStore.loadSet(setId)` and switches UI mode to `card-news`.

## Style And Layout

| File | Current signal | Caution |
|---|---|---|
| `ui/src/index.css` | 2789 lines | Large structural changes can easily create CSS drift |
| `ui/src/components/*.tsx` | 2773 lines | Component class names and CSS are tightly coupled |
| `ui/dist/` | Build output | Do not edit directly |
| `public/index.html.legacy` | Legacy artifact | Do not use it as the source for new active UI behavior |

## Change Checklist

- [ ] If a new API call is added, update `ui/src/lib/api.ts` and `[[03-server-api]]`.
- [ ] If store shape changes, check classic, node, and localStorage migration paths.
- [ ] If node-mode UI changes, update `[[05-node-mode]]`.
- [ ] Record major CSS changes alongside component ownership.
- [ ] If a change references legacy HTML, re-check it against the active UI.

## Change Log

- 2026-04-23: Documented the active React UI architecture.
- 2026-04-23: Translated this document from Korean to English.
- 2026-04-24: Documented node SSE partial preview rendering and JSON fallback.
- 2026-04-24: Documented shared sidebar/settings image model selection.
- 2026-04-25: Documented error-card UX, custom-size confirmation, storage gallery helpers, and card-news WIP caveat.
- 2026-04-25: Documented node selection batch generation and canvas-level batch actions.
- 2026-04-25: Documented explicit node edge disconnect routing and parent metadata cleanup.
- 2026-04-25: Added Card News workspace/API/store details for planner JSON, progress, retry, and Gallery set loading.

Previous document: `[[03-server-api]]`

Next document: `[[05-node-mode]]`
