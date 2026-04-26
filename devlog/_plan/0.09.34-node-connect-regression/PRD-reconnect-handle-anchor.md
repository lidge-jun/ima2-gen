---
created: 2026-04-27
tags: [prd, node-mode, react-flow, reconnect, handles, session-save]
status: planning
owner: Boss
source: community report 2026-04-27 01:21
---

# PRD — Reconnect Handle Anchor Persistence

## User Report

```text
최초 상단 상단 연결
disconnect
-> 백엔드 반영안됨(i assume?)
다음에 다시 중간 중간 연결시 자동으로 상단으로 연결이 되는 이슈
```

## Problem

After a top-to-top connection is disconnected, reconnecting the same two nodes
through the middle/side handles can visually snap back to the previous top
anchor.

The user suspects the disconnect may not be reflected in the backend before the
next reconnect.

## Product Goal

Disconnect and reconnect must be deterministic:

1. Disconnect removes the edge visually and persists that removal promptly.
2. Reconnecting the same two nodes with different handles must create a fresh
   edge identity and preserve the new `sourceHandle` / `targetHandle`.
3. Reloading the session must keep the latest anchor choice, not an older
   top/top anchor.
4. Empty-canvas child creation and graph parent semantics must remain unchanged.
5. Programmatic child/sibling edges use the same edge id helper with `auto`
   handle anchors, so user-created and button-created edges do not diverge into
   mixed id schemes.

## Current Root-Cause Candidates

### Candidate A — Stable edge id hides handle changes

Current user-created edge ids are based only on the two node ids:

```text
sourceClientId->targetClientId
```

That means these two different visual edges share the same id:

```text
A source-top    -> B target-top
A source-right  -> B target-left
```

React Flow and session persistence can then treat a reconnected edge as the same
edge object, making stale handle anchors more likely to survive.

### Candidate B — Debounced graph save delays disconnect persistence

Graph saves are debounced. Disconnect currently updates client state and queues a
save, but does not immediately flush the removal before the next user action.
If the user reconnects quickly, the backend may only see the final edge state or
may briefly retain the previous handle metadata.

## Non-Goals

- Do not add multi-parent support.
- Do not auto-replace an existing parent edge.
- Do not change the node generation API.
- Do not add DB columns for handles unless the existing edge `data` JSON cannot
  safely preserve them.
- Do not remove the source-handle-to-empty-canvas child-node gesture.

## Acceptance Criteria

- Connecting top/top creates an edge with top/top handle ids.
- Disconnecting that edge removes it from the client graph and promptly flushes
  the graph save.
- Reconnecting the same nodes through side/middle handles creates an edge whose
  id or stored metadata is distinct from the old top/top edge.
- `addChildNode()`, `addSiblingNode()`, and `addChildNodeAt()` use the same edge
  id helper as `connectNodes()`.
- Session save payload contains the latest side/middle `sourceHandle` and
  `targetHandle`.
- Session load restores the latest side/middle handles.
- Regression tests cover disconnect -> reconnect same pair with different
  handles.
