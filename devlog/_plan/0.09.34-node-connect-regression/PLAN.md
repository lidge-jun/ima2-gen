---
created: 2026-04-27
tags: [plan, node-mode, react-flow, handles, directional-handles, tests]
status: planning-reopened
owner: Boss
prd: ./README.md
followupPrd: ./PRD-reconnect-handle-anchor.md
---

# PLAN — Node Connect Regression

## Follow-up — Reconnect Handle Anchor Persistence

The 4-direction handle patch exposed a second edge lifecycle issue:

```text
top/top connect -> disconnect -> side/middle reconnect
```

can still render as if the edge is anchored to the old top/top handles. The
likely causes are:

1. User-created edge ids are currently based only on `sourceClientId` and
   `targetClientId`, so different handle pairs for the same two nodes reuse the
   same edge identity.
2. Graph saves are debounced, so disconnect may not be persisted before a fast
   reconnect.

This follow-up keeps the existing graph semantics but makes edge lifecycle and
handle anchoring deterministic.

## 0. Diagnosis

Community symptom:

```text
노드끼리 연결이 안 되고 계속 새로운 노드만 생기는데 어떻게 연결함?
```

Observed code path:

1. `ImageNode.tsx` renders a target handle only when `d.parentServerNodeId`
   exists.
2. `ImageNode.tsx` also exposes only one source handle on the right, so users
   must hit one horizontal connection path.
3. Independent nodes therefore have no target handle.
4. Dragging a source handle onto such a node is not a valid React Flow
   connection.
5. `NodeCanvas.onConnectEnd()` handles every invalid end by calling
   `addChildNodeAt()`.
6. The user sees a new node instead of an existing-node connection.

## 0.1 React Flow Reference Check

Use React Flow / Xyflow v12 documentation, confirmed through Context7 and
official docs:

- Multiple handles are supported on custom nodes.
- Multiple handles of the same type must have unique `id` values.
- Completed `Connection` values carry `sourceHandle` and `targetHandle`.
- `OnConnectEnd` receives a final connection state; `ConnectionState` includes
  `isValid`, `toNode`, and `toHandle`, which can distinguish node/handle drops
  from free-pane drops.

Primary references:

- <https://reactflow.dev/api-reference/types/connection>
- <https://reactflow.dev/api-reference/types/connection-state>
- <https://reactflow.dev/api-reference/types/on-connect-end>
- <https://reactflow.dev/api-reference/react-flow>
- Context7 library: `/websites/reactflow_dev`

## 1. Implementation Slices

### Slice A — Restore Directional Handle Availability

Goal: independent, empty, root, and disconnected nodes must be connectable from
practical directions, not only left/right.

Modify:

- `ui/src/components/ImageNode.tsx`
- `ui/src/index.css`

Before:

```tsx
{d.parentServerNodeId ? (
  <Handle type="target" position={Position.Left} className="image-node__handle" />
) : null}
...
<Handle type="source" position={Position.Right} className="image-node__handle image-node__handle--source" />
```

After:

```tsx
{NODE_HANDLE_POSITIONS.map(({ id, position }) => (
  <Handle
    key={`target-${id}`}
    type="target"
    id={`target-${id}`}
    position={position}
    className={`image-node__handle image-node__handle--target image-node__handle--${id}`}
  />
))}
{NODE_HANDLE_POSITIONS.map(({ id, position }) => (
  <Handle
    key={`source-${id}`}
    type="source"
    id={`source-${id}`}
    position={position}
    className={`image-node__handle image-node__handle--source image-node__handle--${id}`}
  />
))}
```

Notes:

- Do not use `parentServerNodeId` to decide whether the node can receive a
  visual incoming edge.
- Add left/right/top/bottom target handles.
- Add left/right/top/bottom source handles.
- Give every handle a stable unique id because React Flow requires unique ids
  when multiple handles of the same type exist.
- Keep handle IDs presentational only for this hotfix. The graph parent relation
  remains `source` node -> `target` node.
- Keep connection policy in store-level graph logic, not by hiding the DOM
  handle.
- CSS should keep the hit area large enough on all four sides without
  covering the node composer buttons or text input.

### Slice B — Preserve Handle IDs on Edges

Goal: React Flow should know which directional handles were used, even though
the app still treats all handles as the same parent relation.

Modify:

- `ui/src/store/useAppStore.ts`
- `ui/src/types.ts` if `GraphEdge` needs explicit fields
- session save/load mapping only if the current edge type drops handle fields

Required behavior:

- `connectNodes()` should accept optional `sourceHandle` and `targetHandle`.
- New edges should preserve those values:

```ts
{
  id: `${sourceClientId}->${targetClientId}`,
  source: sourceClientId,
  target: targetClientId,
  sourceHandle,
  targetHandle,
}
```

- `onConnect()` should pass `params.sourceHandle` and `params.targetHandle` to
  `connectNodes()`.
- Session graph save/load must not drop handle ids if React Flow needs them to
  render directional edges correctly after reload.
- Parent derivation must continue to use only `edge.source` and `edge.target`.

### Slice C — Prevent Invalid Node Drops From Creating New Nodes

Goal: a failed drop on/near an existing node or handle must not be treated the
same as a free-canvas drop.

Modify:

- `ui/src/components/NodeCanvas.tsx`

Required behavior:

- Keep the existing convenience gesture: source handle -> empty canvas creates a
  new child node.
- If React Flow reports a target node/handle candidate on connection end, do not
  call `addChildNodeAt()` from the invalid path.
- Use the documented `connectionState.toNode` / `connectionState.toHandle`
  fields, and verify installed typings before coding.

Expected shape after type verification:

```tsx
const onConnectEnd: OnConnectEnd = useCallback(
  (event, connectionState) => {
    if (connectionState.isValid) return;
    const fromNodeId = connectionState.fromNode?.id;
    if (!fromNodeId) return;
    if (connectionState.toNode || connectionState.toHandle) return;

    const clientX =
      "touches" in event ? event.changedTouches[0].clientX : (event as MouseEvent).clientX;
    const clientY =
      "touches" in event ? event.changedTouches[0].clientY : (event as MouseEvent).clientY;
    const pos = screenToFlowPosition({ x: clientX, y: clientY });
    addChildNodeAt(fromNodeId, pos);
  },
  [addChildNodeAt, screenToFlowPosition],
);
```

### Slice D — Keep Store Policy Stable

Goal: do not rewrite graph rules unless audit finds a real integration gap.

Review only, modify only if needed:

- `ui/src/store/useAppStore.ts`
- `ui/src/lib/nodeGraph.ts`

Current policy to preserve:

- Self-connections are ignored.
- Duplicate edges are ignored.
- A target with a different incoming parent is rejected with
  `edge.parentConflict`.
- `deriveParentServerNodeIds()` keeps `parentServerNodeId` derived from visual
  edges.

Business decision left to user:

- For an already-parented target, keep current reject behavior, or replace the
  old parent edge automatically. Recommendation: keep reject behavior for this
  hotfix.

### Slice E — Regression Tests

Goal: lock the reported bug so edge-disconnect changes cannot break connection
creation again.

Modify:

- `tests/node-edge-disconnect-contract.test.js`
- `tests/node-ui-contract.test.js` or new `tests/node-connect-contract.test.js`

Required cases:

- `ImageNode` renders top/right/bottom/left source handles.
- `ImageNode` renders top/right/bottom/left target handles.
- Source and target handles have unique ids.
- Target handles are not gated by `d.parentServerNodeId`.
- `NodeCanvas.onConnect` still routes valid connections to `connectNodes()`.
- `NodeCanvas.onConnectEnd` creates a child node only for free-canvas invalid
  drops, not invalid drops with a target node/handle candidate.
- `connectNodes()` preserves `sourceHandle` and `targetHandle` on new edges if
  the store type and save/load flow require it.
- Existing disconnect tests still pass.

### Slice F — Reconnect Uses Handle-Aware Edge Identity

Goal: reconnecting the same two nodes with different handles must not reuse a
stale top/top edge identity.

Modify:

- `ui/src/store/useAppStore.ts`
- `tests/node-ui-contract.test.js` or `tests/node-edge-disconnect-contract.test.js`

Required behavior:

- Add a helper for user-created edge ids, for example:

```ts
function newGraphEdgeId(
  sourceClientId: ClientNodeId,
  targetClientId: ClientNodeId,
  sourceHandle?: string | null,
  targetHandle?: string | null,
): string
```

- The id must include the handle pair or a reconnect-safe nonce, not only
  `sourceClientId->targetClientId`.
- Keep duplicate/multiple-parent policy based on `source` and `target`, not on
  edge id.
- Use the helper at every edge creation site so edge ids are consistent:
  - `connectNodes()`
  - `addChildNode()`
  - `addSiblingNode()`
  - `addChildNodeAt()`
- Programmatic child/sibling edges pass no handle ids, so their id uses the
  `auto` anchor fallback.

Suggested deterministic shape:

```text
<sourceClientId>:<sourceHandle || auto>-><targetClientId>:<targetHandle || auto>
```

If React Flow still reuses stale anchors for same-handle reconnects, upgrade to
a reconnect nonce while preserving `source`/`target` as the graph meaning.

### Slice G — Flush Disconnect Before Fast Reconnect

Goal: edge deletion should reach session persistence promptly instead of waiting
for the normal debounce when the user immediately reconnects.

Modify:

- `ui/src/store/useAppStore.ts`

Required behavior:

- Extend `GraphSaveReason` with a reason such as `"edge-disconnect"` if needed.
- After `disconnectEdges()` updates state, trigger an immediate graph flush:

```ts
void get().flushGraphSave("edge-disconnect");
```

- Preserve the existing debounced save for ordinary node movement/text edits.
- Do not block UI interaction on the flush.
- If a reconnect happens while the disconnect save is in flight, the existing
  graph save queue should schedule/persist the new edge as the next state.

### Slice H — Persistence Contract for Reconnect Handles

Goal: prove the backend/session graph observes the latest reconnect handles.

Modify:

- `tests/node-ui-contract.test.js`
- `tests/node-edge-disconnect-contract.test.js`
- `tests/node-parent-source-contract.test.js` or a new targeted session graph
  test if needed

Required cases:

- Connecting the same source/target with `source-top`/`target-top` and later
  `source-right`/`target-left` produces distinguishable edge identity or stored
  handle data.
- `addChildNode()`, `addSiblingNode()`, and `addChildNodeAt()` all use the same
  edge id helper with `auto` handle fallbacks.
- Saved session edge `data` contains the latest `sourceHandle` and
  `targetHandle`.
- Loaded graph edge restores the latest handle ids.
- Disconnect path calls immediate flush with the edge-disconnect reason.

## 2. Integration Risks

- React Flow type names must be checked against the installed UI dependency
  before writing the `onConnectEnd` guard, but official docs expose `toNode` and
  `toHandle`.
- If all target handles become visible on all nodes, duplicate-parent attempts
  become easier to perform; keep the existing store-level conflict toast.
- Multiple same-type handles need unique ids; missing ids can make edge creation
  or reload rendering ambiguous.
- Top/bottom hit areas can overlap the preview/composer if CSS is careless.
- Do not remove the source-handle-to-empty-canvas child-node gesture, because it
  is a useful existing workflow.
- Do not change node persistence or session graph save shape for this hotfix.
- Stable edge ids can cause React Flow to reuse old visual anchors. New edge ids
  must account for handle changes or reconnect events.
- Immediate disconnect flush must not introduce graph-version conflicts during
  fast reconnect; rely on the existing queued save mechanism if a save is
  already in flight.

## 3. Verification

Targeted:

```bash
node --test tests/node-edge-disconnect-contract.test.js
node --test tests/node-ui-contract.test.js
```

Full:

```bash
npm test
cd ui && npx tsc --noEmit
npm run ui:build
```

Optional rendered smoke:

```text
1. Create two independent nodes.
2. Drag A source handle onto B target handle.
3. Confirm A -> B edge appears and no third node is created.
4. Disconnect the edge.
5. Reconnect A -> B.
6. Drag A source handle to empty canvas and confirm a new child node is still created.
```

## 4. Done Criteria

- Reported symptom is explained by code and fixed by restoring target handle
  availability.
- Existing-node connection and empty-canvas child creation are distinct paths.
- Edge disconnect behavior remains intact.
- Targeted node connection/disconnect tests pass.
- Full test/build checks pass before completion.
