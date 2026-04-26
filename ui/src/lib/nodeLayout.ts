import type { GraphEdge, GraphNode } from "../store/useAppStore";
import { initialPos } from "./graph";

const NODE_X_GAP = 360;
const NODE_Y_GAP = 320;

export function getChildNodes(
  parentId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): GraphNode[] {
  const childIds = new Set(
    edges.filter((e) => e.source === parentId).map((e) => e.target),
  );
  return nodes.filter((n) => childIds.has(n.id));
}

// Pick the next position for a new root node based on the bottom-most
// existing root, so dragged-around nodes don't get stomped by a fresh `+`.
export function getNextRootPosition(nodes: GraphNode[]): { x: number; y: number } {
  const roots = nodes.filter((n) => !n.data.parentServerNodeId);
  if (roots.length === 0) return initialPos(0, 0);
  const maxY = Math.max(...roots.map((n) => n.position.y));
  return { x: initialPos(0, 0).x, y: maxY + NODE_Y_GAP };
}

// Place a child relative to the parent's actual position rather than depth
// indices — prevents overlap when the parent has been moved.
export function getNextChildPosition(
  parent: GraphNode,
  nodes: GraphNode[],
  edges: GraphEdge[],
): { x: number; y: number } {
  const children = getChildNodes(parent.id, nodes, edges);
  const x = parent.position.x + NODE_X_GAP;
  if (children.length === 0) return { x, y: parent.position.y };
  const maxY = Math.max(...children.map((n) => n.position.y));
  return { x, y: maxY + NODE_Y_GAP };
}
