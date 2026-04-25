import type { GraphEdge, GraphNode } from "../store/useAppStore";
import { initialPos } from "./graph";

const NODE_X_GAP = 360;
const NODE_Y_GAP = 320;

export function getChildNodes(parentId: string, nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] {
  const childIds = new Set(edges.filter((edge) => edge.source === parentId).map((edge) => edge.target));
  return nodes.filter((node) => childIds.has(node.id));
}

export function getNextRootPosition(nodes: GraphNode[]): { x: number; y: number } {
  const roots = nodes.filter((node) => !node.data.parentServerNodeId);
  if (roots.length === 0) return initialPos(0, 0);
  const maxY = Math.max(...roots.map((node) => node.position.y));
  return { x: initialPos(0, 0).x, y: maxY + NODE_Y_GAP };
}

export function getNextChildPosition(
  parent: GraphNode,
  nodes: GraphNode[],
  edges: GraphEdge[],
): { x: number; y: number } {
  const children = getChildNodes(parent.id, nodes, edges);
  const x = parent.position.x + NODE_X_GAP;
  if (children.length === 0) return { x, y: parent.position.y };
  const maxY = Math.max(...children.map((node) => node.position.y));
  return { x, y: maxY + NODE_Y_GAP };
}
