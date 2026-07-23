import type { GraphEdge, GraphNode } from "../store/storeTypes";
import { canConnectPorts } from "./nodeCompatibility";
import { resolveNodePort } from "./nodePortCatalog";

/** Shared shape of React Flow `Connection` and `Edge` for validation. */
export type FlowConnectionLike = {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

/**
 * Pure drag-time connection validator for React Flow's `isValidConnection`
 * (010_phase1 round2 fold-back #2). Resolves both ends through the port
 * catalog and delegates to canConnectPorts (which includes the CYCLE guard).
 * Unresolvable handles are invalid.
 */
export function isValidFlowConnection(
  connection: FlowConnectionLike,
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): boolean {
  const sourceNode = nodes.find((node) => node.id === connection.source);
  const targetNode = nodes.find((node) => node.id === connection.target);
  if (!sourceNode || !targetNode) return false;
  const source = resolveNodePort(sourceNode, connection.sourceHandle, "output");
  const target = resolveNodePort(targetNode, connection.targetHandle, "input");
  if (!source || !target) return false;
  return canConnectPorts(source, target, { nodes, edges }).allowed;
}
