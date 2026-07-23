import type { GraphEdge, GraphNode } from "../store/storeTypes";
import { wouldCreateCycle } from "./nodeGraph";

export type NodePortType =
  | "prompt"
  | "image"
  | "images"
  | "video"
  | "mask"
  | "element-refs"
  | "element-notes"
  | "settings"
  | "any-media";

export interface PortDescriptor {
  nodeId: string;
  handleId: string;
  logicalPortId?: string;
  equivalentHandleIds?: readonly string[];
  direction: "input" | "output";
  type: NodePortType;
  acceptsMany?: boolean;
}

export interface CompatibilityResult {
  allowed: boolean;
  reason?: "SAME_DIRECTION" | "TYPE_MISMATCH" | "CARDINALITY" | "SELF_EDGE" | "DUPLICATE_EDGE" | "CYCLE";
}

export interface GraphSnapshot {
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
}

const COMPATIBLE_INPUTS: Readonly<Record<NodePortType, readonly NodePortType[]>> = {
  prompt: ["prompt", "element-notes"],
  image: ["image", "images", "mask", "element-refs", "any-media"],
  images: ["images", "element-refs", "any-media"],
  video: ["video", "any-media"],
  mask: ["mask", "any-media"],
  "element-refs": ["image", "images", "element-refs", "any-media"],
  "element-notes": ["prompt", "element-notes"],
  settings: ["settings"],
  "any-media": ["image", "images", "video", "mask", "any-media"],
};

function edgeUsesPort(
  edgeHandle: string | null | undefined,
  port: PortDescriptor,
): boolean {
  const handles = port.equivalentHandleIds ?? [port.handleId];
  return typeof edgeHandle === "string" && handles.includes(edgeHandle);
}

function hasDuplicateEdge(source: PortDescriptor, target: PortDescriptor, edges: readonly GraphEdge[]): boolean {
  return edges.some((edge) =>
    edge.source === source.nodeId
    && edge.target === target.nodeId
    && edgeUsesPort(edge.sourceHandle, source)
    && edgeUsesPort(edge.targetHandle, target),
  );
}

function hasExistingInput(edgeTarget: PortDescriptor, edges: readonly GraphEdge[]): boolean {
  return edges.some((edge) =>
    edge.target === edgeTarget.nodeId && edgeUsesPort(edge.targetHandle, edgeTarget),
  );
}

export function canConnectPortTypes(
  outputType: NodePortType,
  inputType: NodePortType,
): boolean {
  return COMPATIBLE_INPUTS[outputType].includes(inputType);
}

export function canConnectPorts(
  source: PortDescriptor,
  target: PortDescriptor,
  graph: GraphSnapshot,
): CompatibilityResult {
  if (source.direction !== "output" || target.direction !== "input") {
    return { allowed: false, reason: "SAME_DIRECTION" };
  }
  if (source.nodeId === target.nodeId) return { allowed: false, reason: "SELF_EDGE" };
  if (hasDuplicateEdge(source, target, graph.edges)) return { allowed: false, reason: "DUPLICATE_EDGE" };
  if (!canConnectPortTypes(source.type, target.type)) {
    return { allowed: false, reason: "TYPE_MISMATCH" };
  }
  if (wouldCreateCycle(graph.edges, source.nodeId, target.nodeId)) {
    return { allowed: false, reason: "CYCLE" };
  }
  if (!target.acceptsMany && hasExistingInput(target, graph.edges)) {
    return { allowed: false, reason: "CARDINALITY" };
  }
  return { allowed: true };
}
