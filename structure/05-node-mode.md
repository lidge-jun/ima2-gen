---
created: 2026-04-23
tags: [ima2-gen, node-mode, React-Flow, graph]
aliases: [ima2 Node Mode, image graph mode, node canvas]
---

# Node Mode

Node mode extends `ima2-gen` from a single-image generator into a graph-based image workspace. Users can create a root image, branch from it, and generate or edit child images. The UI is based on `@xyflow/react`, while the server provides node-level generation and session graph persistence.

This mode matters because it is the likely center of future workflows. Classic UI revolves around one prompt and a list of image results. Node mode can represent lineage, retries, comparisons, research mode, and card-news flows as a graph. That connects API contracts, store state, session DB, and asset lifecycle.

To understand node mode, start with three files. `NodeCanvas.tsx` owns graph interaction. `ImageNode.tsx` renders the prompt, image, pending, stale, error, and node-local reference input state of each node. `routes/nodes.js` owns `/api/node/generate`, while `routes/sessions.js` and `lib/sessionStore.js` persist graph state.

---

## Node Generation Flow

```mermaid
sequenceDiagram
    participant UI as NodeCanvas
    participant Store as useAppStore
    participant API as routes/nodes.js
    participant OAuth as openai-oauth
    participant Files as generated
    participant DB as SQLite session

    UI->>Store: add root or child node
    Store->>API: POST /api/node/generate with requestId
    API->>Files: load parent image if needed
    API->>OAuth: generate or edit image
    OAuth-->>API: partial image events for root generation
    API-->>Store: SSE partial preview events
    OAuth-->>API: image result
    API->>Files: save node image and metadata
    API-->>Store: SSE done or JSON nodeId filename url
    Store->>API: PUT /api/sessions/:id/graph
    API->>DB: save graph version
```

## Key Files

| File | Role |
|---|---|
| `ui/src/components/NodeCanvas.tsx` | React Flow wrapper, node/edge changes, child-node gesture |
| `ui/src/components/ImageNode.tsx` | Node card UI, status display, image rendering |
| `ui/src/components/SessionPicker.tsx` | Session selection and creation UX |
| `ui/src/store/useAppStore.ts` | `graphNodes`, `graphEdges`, `graphVersion`, session actions |
| `ui/src/lib/graph.ts` | Client node IDs and initial-position helpers |
| `ui/src/lib/api.ts` | Node generation and session API client |
| `routes/nodes.js` | `/api/node/generate`, `/api/node/:nodeId` |
| `routes/sessions.js` | `/api/sessions/*` |
| `lib/nodeStore.js` | Node image and metadata storage |
| `lib/sessionStore.js` | SQLite sessions, nodes, edges, graphVersion |
| `lib/assetLifecycle.js` | Keeps node state coherent when assets are deleted |

## Node State Model

| State | Meaning | Expected UI behavior |
|---|---|---|
| `empty` | Node has no image yet | Prompt input or generation can start |
| `pending` | Generation request is running | Spinner and pending phase are shown |
| `reconciling` | UI is syncing with server inflight state after refresh | Temporary sync state is shown |
| `ready` | Image and metadata exist | Preview and child generation are available |
| `stale` | Saved graph and server asset state differ | Show warning or retry guidance |
| `asset-missing` | Graph exists but image file is gone | Offer recovery or cleanup guidance |
| `error` | Generation failed | Show error and retry entry |

## API Contract

| Endpoint | Role | Key fields |
|---|---|---|
| `POST /api/node/generate` | Generate/edit one node | `parentNodeId`, `prompt`, `quality`, `size`, `format`, `moderation`, `references`, `sessionId`, `clientNodeId`, `requestId`; response includes `refsCount` |
| `GET /api/node/:nodeId` | Fetch node metadata | `nodeId`, `meta`, `url` |
| `GET /api/sessions` | List sessions | `sessions` |
| `POST /api/sessions` | Create a session | `title` |
| `GET /api/sessions/:id` | Load a session and graph | `session` |
| `PUT /api/sessions/:id/graph` | Save graph snapshot | `If-Match`, `nodes`, `edges` |

`PUT /api/sessions/:id/graph` uses version-based saving. The client sends the current `graphVersion` in the `If-Match` header. The server returns the new `graphVersion` on success.

## Streaming And Recovery

Root node generation requests use `postNodeGenerateStream()` and ask the server for `Accept: text/event-stream`. The server relays upstream partial images as `partial` events before the canonical `done` event. Child/edit nodes currently use the same route but remain final-only, because combining parent-edit semantics with extra progressive previews needs separate provider validation.

`ImageNode` renders `data.partialImageUrl` while a node is `pending` or `reconciling`. This value is transient UI state only. `sanitizeForSave()` strips it before session graph persistence so base64 previews never inflate SQLite payloads.

Each node request writes `requestId` into the node sidecar and `/api/history`. Recovery uses `pendingRequestId ?? recoveryRequestId` first, then falls back to `(sessionId, clientNodeId, createdAt)`. This avoids accidentally attaching an older retry result after reload or HMR.

Pending and reconciling cards use a transform-only rotating border glow. Reduced-motion users keep the static glow without rotation.

## Conflict Reload Recovery

Session graph saves use `If-Match` graph versions. When the server returns `GRAPH_VERSION_CONFLICT`, the client reloads the latest graph and shows neutral copy: the graph version changed. The response does not prove another tab caused the change.

After the reload, node mode immediately runs history recovery. The matcher uses `pendingRequestId ?? recoveryRequestId` first, then falls back to `(sessionId, clientNodeId, createdAt)` so a completed node asset can be reattached even if the graph snapshot stored only the sanitized pending state.

Recovered nodes become `ready` with `imageUrl` from history. Draft-only fields such as node-local `referenceImages` and transient `partialImageUrl` stay stripped from session graph saves; `refsCount` remains numeric metadata in sidecars/history.

## Parent And External Source Inputs

| Input | Server behavior | Used when |
|---|---|---|
| `parentNodeId` present | Load stored parent node image and use the edit path | Generating a child node |
| `parentNodeId` absent | Generate a new image from prompt and references | Generating a root node |
| `externalSrc` present | Read an existing asset from `generated/` | Promoting a history image into the graph |

## Reference Image Scope

Node mode separates visible node-local references from classic composer references.

| Reference state | Scope | Persistence | Behavior |
|---|---|---|---|
| Node-local `data.referenceImages` | One root node composer | Draft only, stripped from session save | Sent to `/api/node/generate` only for root nodes |
| Classic `referenceImages` | Classic composer | In-memory classic draft | Parked/inactive in node mode and never sent by `generateNode()` |
| Session style sheet | Active session | Stored through style sheet APIs | May influence prompts as a style prefix, but is not a reference chip |

Child/edit nodes already have a parent image source. Extra references are blocked in the UI and rejected by `/api/node/generate` with `NODE_REFS_UNSUPPORTED_FOR_EDIT` so user attachments are not silently ignored.

`duplicateBranchRoot()` seeds the source image into the duplicated root node's local draft references. It must not push into the classic global reference list.

`sanitizeForSave()` removes node-local draft references before `PUT /api/sessions/:id/graph` to avoid base64 bloat and oversized node data replacement.

Node sidecar metadata and `/api/history` rows expose `refsCount`, a numeric count only. They never store the reference image base64 after generation succeeds.

## Difference From Classic Mode

| Topic | Classic | Node mode |
|---|---|---|
| Primary unit | Current image and history | Nodes and edges |
| Generation endpoint | `/api/generate` | `/api/node/generate` |
| Storage | Sidecar JSON and flat history | Node metadata and session graph |
| Restore path | `/api/history`, localStorage selected item | `/api/sessions/:id`, graphVersion |
| Pending display | In-flight list | Per-node status, streamed partial preview, animated border glow |

## Change Checklist

- [ ] If `ImageNodeData` shape changes, check session save, restore, and API types.
- [ ] If `/api/node/generate` response changes, update `ui/src/lib/api.ts` and this doc.
- [ ] If graph save policy changes, check `If-Match` version behavior and tests.
- [ ] If asset delete/restore changes, review `asset-missing` state and history docs.
- [x] Node mode is part of the npm-published UI by default; update build/package rules in `[[06-infra-operations]]` if this gate changes.

## Change Log

- 2026-04-24: Documented node-local reference inputs, parked classic references, and the child/edit reference guard.
- 2026-04-24: Documented partial-image SSE streaming, requestId recovery, and pending-node glow.
- 2026-04-24: Added conflict reload recovery notes for neutral graph-version copy and requestId-first node repair.
- 2026-04-23: Documented the implemented node canvas, node API, and session persistence structure.
- 2026-04-23: Translated this document from Korean to English.

Previous document: `[[04-frontend-architecture]]`

Next document: `[[06-infra-operations]]`
