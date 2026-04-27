---
created: 2026-04-27
tags: [ima2-gen, node-mode, react-flow, edges, handles, regression]
aliases: [ima2 node connect regression, node edge connection broken, new node instead of connect, four directional handles]
status: planning-reopened
owner: Boss
source: community report 2026-04-27 01:01
---

# 0.09.34 — Node Connect Regression

This lane fixes a node-mode regression reported after the explicit edge
disconnect work:

```text
노드끼리 연결이 안 되고 계속 새로운 노드만 생기는데 어떻게 연결함?
```

## Problem

Dragging from one node to another should connect the existing nodes from any
practical direction. Instead, the UI can treat the gesture as an invalid
connection and create a new child node at the drop point.

## Current Root-Cause Candidate

`ImageNode` currently renders the left target handle only when
`data.parentServerNodeId` exists, and it exposes only one source handle on the
right. Root, empty, newly disconnected, and otherwise independent nodes have
`parentServerNodeId: null`, so they do not expose a target handle for React Flow
to hit.

When the target handle is missing, React Flow marks the drop invalid.
`NodeCanvas.onConnectEnd()` then treats the invalid end as a free-canvas drop
and calls `addChildNodeAt()`, which creates a new node instead of connecting the
existing target.

## Documentation / API References

- React Flow multiple handles: when a custom node has multiple handles of the
  same type, each handle needs a unique `id`.
- React Flow `Connection`: completed connections carry `sourceHandle` and
  `targetHandle`.
- React Flow `OnConnectEnd` / `ConnectionState`: unsuccessful connection end
  events can be inspected with fields such as `isValid`, `toNode`, and
  `toHandle`.

Primary references:

- <https://reactflow.dev/api-reference/types/connection>
- <https://reactflow.dev/api-reference/types/connection-state>
- <https://reactflow.dev/api-reference/types/on-connect-end>
- <https://reactflow.dev/api-reference/react-flow>
- Context7 query: `/websites/reactflow_dev`, topic "multiple handles / OnConnectEnd connectionState"

## Done Means

- Existing independent nodes can receive incoming connections.
- Nodes expose directional connection points on left, right, top, and bottom.
- Dragging A source handle onto any B target handle connects A -> B.
- Edges preserve `sourceHandle` and `targetHandle` ids where React Flow provides them.
- The same gesture does not create an extra child node.
- Dropping a source handle onto empty canvas still creates a new child node.
- Edge disconnect remains explicit and still clears the target's derived parent.
- Targets that already have a different incoming parent are rejected with the
  existing parent-conflict UX unless product direction changes.
- Regression tests cover handle availability and the invalid-drop/new-child
  distinction.

## Implementation Notes

- Build completed in PABCD B on 2026-04-27.
- Four-direction handles use unique React Flow ids such as `source-top` and
  `target-bottom`.
- User-created edges preserve `sourceHandle` and `targetHandle` through session
  save/load using the existing edge `data` JSON, avoiding a DB migration.
- `onConnectEnd()` now ignores invalid drops that still have a target node or
  target handle candidate, so dragging onto an existing node does not create a
  new child node.

## Follow-up PRD

- [PRD-reconnect-handle-anchor.md](./PRD-reconnect-handle-anchor.md)
- [PRD-refresh-handle-persistence-and-live-sync.md](./PRD-refresh-handle-persistence-and-live-sync.md)

Reopened after a user report that this sequence can still reuse the old visual
anchor:

```text
top/top connect -> disconnect -> side/middle reconnect
```

The follow-up focuses on handle-aware edge identity and immediate disconnect
save flushing.

## Revised Follow-up — Refresh / Live Sync

Reopened again after a user report that:

```text
cmd shift r 하면 다시 상단 노드로 복귀되고
중간 커넥터 끼리 연결한것도 상단 노드로 바뀌어

노드 생성때 바로 반영이 안되고 새로고침해야지 노드에 반영
```

The latest PRD focuses on:

- preserving `sourceHandle` / `targetHandle` in the `beforeunload` beacon save path;
- preventing refresh from overwriting good handle metadata with `{}`;
- hardening node generation completion so a successful result appears on the current node without refresh.
