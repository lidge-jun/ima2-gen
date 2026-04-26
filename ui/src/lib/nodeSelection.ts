// Connected-component selection for node mode batch ops.
// Click a node + Cmd/Ctrl-click another to grow the selection by component.

type NodeLike = { id: string; selected?: boolean };
type EdgeLike = { source: string; target: string };

export function getConnectedComponentIds(
  nodes: NodeLike[],
  edges: EdgeLike[],
  nodeId: string,
): string[] {
  const validIds = new Set(nodes.map((n) => n.id));
  if (!validIds.has(nodeId)) return [];
  const neighbors = new Map<string, Set<string>>();
  for (const id of validIds) neighbors.set(id, new Set());
  for (const edge of edges) {
    if (!validIds.has(edge.source) || !validIds.has(edge.target)) continue;
    neighbors.get(edge.source)?.add(edge.target);
    neighbors.get(edge.target)?.add(edge.source);
  }
  const seen = new Set<string>();
  const queue = [nodeId];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (seen.has(id)) continue;
    seen.add(id);
    for (const next of neighbors.get(id) ?? []) {
      if (!seen.has(next)) queue.push(next);
    }
  }
  return nodes.filter((n) => seen.has(n.id)).map((n) => n.id);
}

export function getSelectedNodeIds(nodes: NodeLike[]): string[] {
  return nodes.filter((n) => n.selected).map((n) => n.id);
}

export function applySelectedNodeIds<T extends NodeLike>(
  nodes: T[],
  selectedIds: Iterable<string>,
): T[] {
  const selected = new Set(selectedIds);
  return nodes.map((n) => ({ ...n, selected: selected.has(n.id) }));
}

// Click semantics:
// - additive=false → replace selection with the entire connected component
// - additive=true  → toggle the clicked node when its component already has
//   any selection; otherwise pull in the whole component.
export function applyComponentSelection<T extends NodeLike>(
  nodes: T[],
  edges: EdgeLike[],
  nodeId: string,
  additive: boolean,
): T[] {
  const component = new Set(getConnectedComponentIds(nodes, edges, nodeId));
  if (!component.size) return nodes;
  if (!additive) return applySelectedNodeIds(nodes, component);

  const clicked = nodes.find((n) => n.id === nodeId);
  const componentHasSelection = nodes.some((n) => component.has(n.id) && n.selected);
  const nextSelected = new Set(getSelectedNodeIds(nodes));
  if (componentHasSelection) {
    if (clicked?.selected) nextSelected.delete(nodeId);
    else nextSelected.add(nodeId);
  } else {
    for (const id of component) nextSelected.add(id);
  }
  return applySelectedNodeIds(nodes, nextSelected);
}
