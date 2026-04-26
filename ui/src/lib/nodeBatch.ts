// Topological + dependency helpers for selected-node batch generation.

type BatchNodeData = {
  serverNodeId?: string | null;
  imageUrl?: string | null;
  status?: string;
};

type BatchNode = { id: string; data: BatchNodeData; selected?: boolean };
type BatchEdge = { source: string; target: string };

export type NodeBatchMode = "missing-only" | "regenerate-all";

export function nodeHasImage(node: BatchNode): boolean {
  return node.data.status === "ready" && Boolean(node.data.imageUrl);
}

// Kahn's algorithm restricted to the selected set. Out-of-order nodes
// (cycles inside the selection — currently impossible since edges form a
// tree, but cheap to defend against) get appended at the end.
export function topologicalSortSelected(
  nodes: BatchNode[],
  edges: BatchEdge[],
  selectedIds: Iterable<string>,
): string[] {
  const selected = new Set(selectedIds);
  const existing = new Set(nodes.map((n) => n.id));
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const id of selected) {
    if (!existing.has(id)) continue;
    indegree.set(id, 0);
    outgoing.set(id, []);
  }
  for (const edge of edges) {
    if (!selected.has(edge.source) || !selected.has(edge.target)) continue;
    outgoing.get(edge.source)?.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }
  const orderedIds = nodes.map((n) => n.id);
  const queue = orderedIds.filter((id) => selected.has(id) && (indegree.get(id) ?? 0) === 0);
  const out: string[] = [];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    out.push(id);
    for (const next of outgoing.get(id) ?? []) {
      indegree.set(next, (indegree.get(next) ?? 0) - 1);
      if ((indegree.get(next) ?? 0) === 0) queue.push(next);
    }
  }
  const emitted = new Set(out);
  return out.concat(orderedIds.filter((id) => selected.has(id) && !emitted.has(id)));
}

// Children outside the selection — used to surface "X downstream nodes will
// be marked stale" in the batch bar summary.
export function getUnselectedDownstreamIds(
  edges: BatchEdge[],
  selectedIds: Iterable<string>,
): string[] {
  const selected = new Set(selectedIds);
  const out = new Set<string>();
  const children = new Map<string, string[]>();
  for (const edge of edges) {
    const list = children.get(edge.source) ?? [];
    list.push(edge.target);
    children.set(edge.source, list);
  }
  const queue = [...selected];
  for (let i = 0; i < queue.length; i++) {
    for (const child of children.get(queue[i]) ?? []) {
      if (selected.has(child) || out.has(child)) continue;
      out.add(child);
      queue.push(child);
    }
  }
  return [...out];
}

// Selected nodes whose parent isn't selected but lacks a serverNodeId — those
// would call /api/node/generate without a parent payload, yielding a fresh
// root regen instead of a continuation. Block the run rather than silently
// rerooting the user's tree.
export function validateBatchDependencies(
  nodes: BatchNode[],
  edges: BatchEdge[],
  selectedIds: Iterable<string>,
): string[] {
  const selected = new Set(selectedIds);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const blocked: string[] = [];
  for (const edge of edges) {
    if (!selected.has(edge.target) || selected.has(edge.source)) continue;
    const parent = byId.get(edge.source);
    if (!parent?.data.serverNodeId) blocked.push(edge.target);
  }
  return blocked;
}
