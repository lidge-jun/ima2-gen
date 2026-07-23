import type { GraphEdge, GraphNode } from "../store/useAppStore";

export function getIncomingEdge(edges: GraphEdge[], targetId: string): GraphEdge | null {
  return edges.find((edge) => edge.target === targetId) ?? null;
}

export function hasMultipleIncomingEdges(edges: GraphEdge[], targetId: string): boolean {
  let count = 0;
  for (const edge of edges) {
    if (edge.target !== targetId) continue;
    count += 1;
    if (count > 1) return true;
  }
  return false;
}

export function wouldCreateMultipleIncomingEdge(
  edges: GraphEdge[],
  sourceId: string,
  targetId: string,
): boolean {
  return edges.some((edge) => edge.target === targetId && edge.source !== sourceId);
}

/**
 * True when adding source→target would close a directed cycle, i.e. the
 * source is already reachable from the target (010_phase1, W1).
 */
export function wouldCreateCycle(
  edges: readonly { source: string; target: string }[],
  sourceId: string,
  targetId: string,
): boolean {
  if (sourceId === targetId) return true;
  const children = new Map<string, string[]>();
  for (const edge of edges) {
    const list = children.get(edge.source) ?? [];
    list.push(edge.target);
    children.set(edge.source, list);
  }
  const seen = new Set<string>([targetId]);
  const queue = [targetId];
  for (let i = 0; i < queue.length; i++) {
    for (const next of children.get(queue[i]) ?? []) {
      if (next === sourceId) return true;
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

/** Kahn topological visit — true when some nodes are unreachable (cycle). */
export function graphHasCycle(
  nodes: readonly { id: string }[],
  edges: readonly { source: string; target: string }[],
): boolean {
  const indegree = new Map<string, number>();
  const children = new Map<string, string[]>();
  for (const node of nodes) indegree.set(node.id, 0);
  for (const edge of edges) {
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    const list = children.get(edge.source) ?? [];
    list.push(edge.target);
    children.set(edge.source, list);
  }
  const queue = nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id);
  let visited = 0;
  for (let i = 0; i < queue.length; i++) {
    visited += 1;
    for (const next of children.get(queue[i]) ?? []) {
      const left = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, left);
      if (left === 0) queue.push(next);
    }
  }
  return visited < nodes.length;
}

export function deriveParentServerNodeIds(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return nodes.map((node) => {
    const incoming = getIncomingEdge(edges, node.id);
    const parent = incoming ? byId.get(incoming.source) : null;
    const nextParentServerNodeId = parent?.data.serverNodeId ?? null;
    if (node.data.parentServerNodeId === nextParentServerNodeId) return node;
    return {
      ...node,
      data: {
        ...node.data,
        parentServerNodeId: nextParentServerNodeId,
      },
    };
  });
}
