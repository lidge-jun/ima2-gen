import type { GraphEdge, GraphNode } from "../store/storeTypes";

export type GraphSnapshotEntry = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  label: string;
  at: number;
};

export const GRAPH_HISTORY_LIMIT = 30;

/**
 * Capture an isolated snapshot (030, wp3 audit blocker #2): structuredClone
 * so history entries never share object references with live store state.
 */
export function makeSnapshot(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  label: string,
): GraphSnapshotEntry {
  return { nodes: structuredClone(nodes) as GraphNode[], edges: structuredClone(edges) as GraphEdge[], label, at: Date.now() };
}

export function pushHistory(
  past: readonly GraphSnapshotEntry[],
  entry: GraphSnapshotEntry,
  limit: number = GRAPH_HISTORY_LIMIT,
): GraphSnapshotEntry[] {
  const next = [...past, entry];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

type HistoryShift = {
  past: GraphSnapshotEntry[];
  restored: GraphSnapshotEntry;
  future: GraphSnapshotEntry[];
};

/** Pop the latest undo entry; the current state is pushed onto future. */
export function popUndo(
  past: readonly GraphSnapshotEntry[],
  current: GraphSnapshotEntry,
  future: readonly GraphSnapshotEntry[],
): HistoryShift | null {
  if (past.length === 0) return null;
  const restored = past[past.length - 1];
  return {
    past: past.slice(0, -1),
    restored,
    future: [...future, current],
  };
}

/** Pop the latest redo entry; the current state is pushed back onto past. */
export function popRedo(
  past: readonly GraphSnapshotEntry[],
  current: GraphSnapshotEntry,
  future: readonly GraphSnapshotEntry[],
): HistoryShift | null {
  if (future.length === 0) return null;
  const restored = future[future.length - 1];
  return {
    past: [...past, current],
    restored,
    future: future.slice(0, -1),
  };
}

const PENDING_FIELDS = [
  "status",
  "pendingRequestId",
  "recoveryRequestId",
  "pendingPhase",
  "pendingStartedAt",
  "partialImageUrl",
] as const;

/**
 * Merge a restored snapshot against current state so an undo never demotes a
 * node that is generating right now (030): for nodes currently pending or
 * reconciling, the live pending/recovery fields win over the snapshot.
 * Historical errorInfo on non-pending nodes restores from the snapshot.
 */
export function mergeAfterRestore(
  snapshot: { nodes: GraphNode[]; edges: GraphEdge[] },
  currentNodes: readonly GraphNode[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const liveById = new Map(currentNodes.map((node) => [node.id, node]));
  const nodes = snapshot.nodes.map((node) => {
    const live = liveById.get(node.id);
    if (!live) return node;
    const busy = live.data.status === "pending" || live.data.status === "reconciling";
    if (!busy) return node;
    const data = { ...node.data };
    for (const field of PENDING_FIELDS) {
      (data as Record<string, unknown>)[field] = live.data[field];
    }
    return { ...node, data };
  });
  return { nodes, edges: snapshot.edges };
}
