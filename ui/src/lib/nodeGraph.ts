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

