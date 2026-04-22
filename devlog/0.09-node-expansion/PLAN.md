# 0.09 — Node Mode Expansion
Status: draft
Owner: shared FE/BE cycle
Scope: make Node mode a first-class mode comparable to Classic
Reviewed inputs: `NodeCanvas.tsx`, `ImageNode.tsx`, `useAppStore.ts`, `server.js`, `lib/inflight.js`, `devlog/0.04`, `devlog/0.06`, `devlog/0.07`, `_plan/*`

## Context
0.04-0.06 delivered graph skeleton, node generation, and session persistence.
0.07 stabilized Classic mode and largely left Node mode behind.
0.08 is adding `requestId`, `/api/inflight`, cross-tab sync, and async job recovery.
0.09 should finish the jump from "canvas demo" to "daily-usable authored workflow."

## Carryover
- `c04-smoke`: no repeatable Node-mode smoke baseline
- `c06-node-persist`: graph persists, but pending recovery and image/session hydration rules are incomplete
- `c07-history-merge`: history and graph coexist, but import/promote rules are undefined

## End-state goal
By the end of 0.09, Node mode should be a primary workflow, not a secondary experiment.

### Success criteria
1. Users can create, rename, switch, reload, and resume graph sessions without losing topology or pending generation state.
2. Users can start from a blank graph or an existing history image and branch forward from it.
3. Reload during pending generation no longer falls back to TTL-only guesswork; pending nodes reconcile from `/api/inflight`.
4. Node mode can use the same core creation inputs as Classic: references, gallery/history selection, current-image promotion, and global quality/size defaults.
5. Node mode has a short smoke checklist and no refresh/session caveat that Classic does not have.

## Non-goals
- Multi-user collaboration
- Real-time shared graphs
- Content-hash dedup
- Event sourcing / undo rewrite
- Asset garbage collection

## Source of truth
### Decision
Node session graph is the source of truth for topology and per-node UI state.
Classic history remains an asset catalog derived from `generated/` sidecars.
### Practical rule
- SQLite `sessions/nodes/edges` owns graph structure
- `generated/<filename>` owns image files and history listing
- History to graph is explicit promotion/import, not live bidirectional sync
- Node-generated images appearing in history is expected, but history selection must not mutate graph structure implicitly

## Integration: Classic history ↔ Node graph
Recommended model: one-way promotion plus passive visibility.
- Passive visibility: all generated images appear in `/api/history`
- Promotion: a history item becomes a new root or a child of the selected node
- No live two-way binding: graph prompt drafts, position, selection, and edges never write back into history
- History acts as an asset library; graph acts as the authored workspace
Why: bidirectional sync would duplicate truth for prompt text, lineage, deletion semantics, and pending state.

## Data model policy
### Identity
- Session ID owns graph membership
- Graph node ID stays session-local
- Image asset identity stays file-based: `filename` and/or `serverNodeId`
### Sharing across sessions
Multiple sessions may reference the same image asset.
Promoting the same history image into 3 sessions should create 3 graph node records pointing at 1 image asset.
0.09 should not duplicate files to disk for imports.
### Dedup rule
- No automatic node dedup inside a session
- Reuse existing asset references when importing from history
- Deleting a node or session does not delete shared image files in 0.09
Decision needed: asset reference key
- Option A: `filename` only
- Option B: `serverNodeId + format`
- Recommendation: use B internally, expose `filename` in UI

## 0.08 integration requirements
0.08 async job tracking must become Node mode infrastructure, not a Classic-only feature.
- `/api/inflight` is the server authority for pending requests after reload
- `POST /api/node/generate` should accept optional `requestId` and echo it back
- Node data should store `pendingRequestId` while pending
- On session load, pending nodes reconcile against `/api/inflight`
- If a pending node is absent from `/api/inflight` and no result asset exists, transition to `"stale"` or `"error"` with retry guidance

## Server/API direction
Keep the current API additive, not disruptive.
- Keep `POST /api/node/generate` backwards-compatible
- Add optional fields rather than replacing `parentNodeId`
- Keep `/api/sessions/:id/graph` as the snapshot save path
- Do not add a second graph persistence route unless 0.08 forces it
Recommended persisted node data:
```ts
type PersistedNodeData = {
  prompt: string;
  imageUrl: string | null;
  serverNodeId: string | null;
  sourceFilename?: string | null;
  sourceOrigin?: "generated" | "history";
  pendingRequestId?: string | null;
  status: "empty" | "pending" | "ready" | "error" | "stale";
  error?: string;
};
```

## Phase plan
### D1 — Node smoke baseline
Summary: formalize `c04-smoke` into one repeatable smoke path for blank root, child branch, refresh, and session reopen.
Files: `devlog/0.09-node-expansion/PLAN.md` plus optional smoke doc under the same folder.
Verify: baseline smoke passes on current HEAD before D2 starts.

### D2 — Pending node recovery
Summary: replace Node-mode TTL-only pending semantics with requestId-backed reconciliation from `/api/inflight`.
Files: `ui/src/store/useAppStore.ts`, `ui/src/lib/api.ts`, `ui/src/types.ts`, `server.js`, `lib/inflight.js`.
Verify: pending node survives reload and reconciles against inflight registry instead of aging out blindly.

### D3 — Session hydration hardening
Summary: make session load restore image state, pending state, and selected-node context without NodeCanvas gaps.
Files: `ui/src/store/useAppStore.ts`, `ui/src/components/NodeCanvas.tsx`, `ui/src/components/ImageNode.tsx`.
Verify: switching sessions does not drop previews, badges, or selected-node context.

### D4 — History promotion
Summary: implement `c07-history-merge` as explicit "Promote to graph" actions from history strip and gallery.
Files: `ui/src/components/HistoryStrip.tsx`, `ui/src/components/GalleryModal.tsx`, `ui/src/store/useAppStore.ts`.
Verify: a history item becomes a new root or child node without duplicating the underlying asset file.

### D5 — Node composer parity
Summary: let Node mode use references, gallery-picked assets, and quick-add root/child flows with the same defaults as Classic.
Files: `ui/src/components/RightPanel.tsx`, `ui/src/components/ReferenceUploader.tsx`, `ui/src/components/PromptComposer.tsx`, `ui/src/store/useAppStore.ts`.
Verify: user can create a root from sidebar input, branch from selected node, and use references in both flows.

### D6 — Node card UX expansion
Summary: upgrade `ImageNode` into a stable authoring card with source provenance, pending state, and clearer error/stale rendering.
Files: `ui/src/components/ImageNode.tsx`, `ui/src/index.css`, optionally `ui/src/components/NodeCanvas.tsx`.
Verify: users can distinguish empty, pending, imported, ready, stale, and errored nodes at a glance.

### D7 — Graph payload hardening
Summary: widen graph save/load rules for imported assets and pending request ids without breaking old sessions.
Files: `ui/src/store/useAppStore.ts`, `ui/src/lib/api.ts`, `server.js`.
Verify: old 0.06 sessions still open, and new 0.09 sessions save richer node data cleanly.

### D8 — QA and parity sweep
Summary: close the cycle only when Node no longer has known refresh/history/session exceptions that Classic does not have.
Files: `devlog/0.09-node-expansion/PLAN.md` and optional smoke notes.
Verify: success criteria 1-5 all pass.

## Must-have for 0.09
- RequestId-backed pending recovery
- Session reload restores graph and pending state consistently
- History/gallery promotion into graph sessions
- Reference/global-setting parity with Classic
- Clear smoke checklist and no hidden refresh caveat

## Nice-to-have for 0.11
- Node duplication / copy-paste
- Subgraph export
- Auto-layout / dagre
- Graph search / minimap filtering
- Asset garbage collection
- Content-hash dedup
- Rich lineage API if passive graph data proves insufficient

## UX decisions still needed
- `결정 필요`: history promotion default
  - A: always new root
  - B: selected node 있으면 child, 없으면 root
  - Recommendation: B
- `결정 필요`: pending node missing from `/api/inflight`
  - A: mark `error`
  - B: mark `stale`
  - Recommendation: B with retry CTA
- `결정 필요`: session creation policy
  - A: first Node-mode entry auto-creates
  - B: explicit empty-state create
  - Recommendation: A 유지
- `결정 필요`: delete policy for parent nodes
  - A: cascade delete descendants
  - B: block delete when descendants exist
  - Recommendation: A + confirm dialog
- `결정 필요`: imported history node semantics
  - A: treat as normal editable node
  - B: keep read-only until duplicated
  - Recommendation: A

## Breaking change minimization
- `POST /api/node/generate` only gains optional fields
- Existing response fields stay intact
- `/api/sessions/:id/graph` shape stays stable; richer `node.data` is additive
- Old sessions without new fields must hydrate via safe fallbacks
- New status values must map safely from legacy nodes

## Risks
- 0.08 async job model may still churn, delaying D2
- Over-eager pending reconciliation can turn slow nodes into false errors
- History promotion can become accidental two-way sync if boundaries are not explicit
- Shared asset references will raise delete expectations; 0.09 should document non-GC behavior

## Recommendation summary
- 0.09 covers "Node mode usable" only
- Graph is canonical; history is an asset library
- Reuse 0.08 `/api/inflight` instead of inventing Node-specific pending state
- Share image assets by reference, not duplication
- Keep power-user graph features out of scope until 0.11

---

## REVIEW (added 260422)

Status: **READY-with-fixes-required** (5 BLOCKERs must be resolved in D0 before D1).

### Opus 4.7 (rubber-duck) review — BLOCKERs
- **[OP-B1] `/api/inflight` meta lacks `sessionId`/`clientNodeId`.** Current shape is `{ parentNodeId }` only. D2 reconciliation will collide when the same parentNodeId exists in two sessions open in different tabs.
  - **Resolution**: extend `startJob` meta to `{ sessionId, parentNodeId, clientNodeId }`. Update `server.js:548` to pass all three. Update D2 filter: reconcile only jobs matching *current* sessionId.
- **[OP-B2] `ImageNodeData` has no `pendingRequestId` field — D2 depends on D7's field addition, so ordering is wrong.**
  - **Resolution**: move `pendingRequestId` field introduction from D7 into D2. D2 owns the schema add.
- **[OP-B3] `reconcileInflight` doesn't filter by `kind` → Classic jobs leak into Node state.**
  - **Resolution**: D2 filter must apply `job.kind === "node"` before matching. Add filter in both server `/api/inflight` query param and client-side filter.
- **[OP-B4] Classic→graph parent has no loading path** — `loadNodeB64` only resolves `<nodeId>.png`, not `generated/<timestamp>.png` from Classic history.
  - **Resolution**: D4 (history promotion) must copy Classic asset into node asset store with a new `<nodeId>.png` filename, OR extend `loadNodeB64` to accept external paths via `externalSrc` field.
- **[OP-B5] `PUT /api/sessions/:id/graph` has no ETag/version → multi-tab editing = last-write-wins.**
  - **Resolution**: add `graph.version` integer; PUT includes `If-Match: <version>`; server returns 409 on mismatch. Add to D1.

### Opus 4.7 — SHOULD-FIX (summary)
- Regenerate-with-descendants leaves orphan parent assets — spec GC policy or explicit "keep"
- `!parentServerNodeId` guard in useAppStore:~569 means refs only work on root nodes; server editViaOAuth silently drops refs → explicit error, not silent drop
- Pending-node deletion doesn't cancel inflight → D2 must call `finishJob(requestId, { canceled: true })` on delete
- `status:"pending"` saves without pendingRequestId (null reconciliation target) → enforce invariant in D2
- Asset-missing-on-hydration shows broken `<img>` → placeholder state + retry button

### Research employee review
- Status: **skipped** (Research employee returned `worker_busy` across 4 retries; dispatched fallback review to Opus 4.7 covering prior-art questions in separate task).
- Prior-art TODO (tracked in session memory): ComfyUI inflight recovery, Flowise multi-tab concurrency, Figma FigJam selection persistence patterns.

### Approval gate
- **Must fix before D1**: OP-B1, OP-B2, OP-B3, OP-B4, OP-B5.
- **Should fix during implementation**: all SHOULD-FIX items above.
- **Can defer to 0.11**: prior-art incorporation, advanced GC.

---

## REVIEW — Research employee (added 260422)

### BLOCKERs (UX prior-art)
- **[RS-B1] Crash-state UX still underspecified.** Running / server-done-but-lost-preview / disappeared-from-inflight states feel too similar under current plan. ComfyUI precedent: server-owned job IDs + queue/history/websocket status, not a single degraded "pending".
  - **Resolution**: add explicit `reconciling`, `stale`, `asset-missing` visual states (badge + CTA). Add to D2 acceptance criteria.
- **[RS-B2] Multi-tab concurrency not first-class in D1-D8.** Appended Opus review caught optimistic concurrency (OP-B5), but selection/graphVersion/last-write-wins not in acceptance criteria.
  - **Resolution**: make `graphVersion` conflict handling + tab-local selection part of D1 acceptance.
- **[RS-B3] Branch/regenerate semantics missing.** Plan defines import + delete but not whether Regenerate replaces in-place vs creates sibling/child. Destructive in-place breaks descendant lineage.
  - **Resolution**: spec Regenerate = sibling node with `parentNodeId` = same parent as source; never in-place destructive. Add to D6.

### SHOULD-FIX
- [RS-S1] Undo/redo, duplicate, copy/paste, queue/cancel shortcuts should be 0.09 must-haves (ComfyUI/nodes.io/FigJam baseline)
- [RS-S2] Selection persistence = tab-local convenience, NOT part of canonical graph payload
- [RS-S3] Orphan cleanup too deferred — need manual orphan review or "delete session keeps assets" messaging
- [RS-S4] Imported/history-root nodes need durable visual badge + source action (provenance affordance)

### NITS
- "graph canonical / history catalog" split matches established patterns — keep
- Add intermediate `reconciling…` label between active and `stale`
- Cascade-delete dialog must preview descendant count

### Prior-art references
- ComfyUI workflow architecture: https://docs.comfy.org/development/core-concepts/workflow
- ComfyUI server comms (best precedent for inflight recovery): https://docs.comfy.org/development/comfyui-server/comms_routes
- ComfyUI shortcuts (undo/redo/queue as baseline): https://docs.comfy.org/interface/shortcuts
- ComfyUI APP mode: https://docs.comfy.org/interface/app-mode
- nodes.io copy/paste + undo/redo: https://nodes.io/story/
- nodes.io template reuse pattern: https://nodes.io/docs/manual/
- Flowise workspaces/migration: https://docs.flowiseai.com/using-flowise/workspaces
- Flowise explicit branching: https://docs.flowiseai.com/integrations/utilities/if-else
- Figma version history + offline conflict: https://help.figma.com/hc/en-us/articles/360038006754
- FigJam connectors / topology: https://help.figma.com/hc/en-us/articles/1500004414542

### Final approval gate for 0.09
**Must fix before D1 coding**: OP-B1, OP-B2, OP-B3, OP-B4, OP-B5, RS-B1, RS-B2, RS-B3 (8 blockers total).
**Scope additions required for "daily-usable"**: undo/redo + duplicate + copy/paste (RS-S1).
