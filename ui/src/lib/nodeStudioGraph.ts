import type { AssetItem, GraphEdge, GraphNode, ImageNodeData } from "../store/storeTypes";
import { useAppStore } from "../store/useAppStore";
import { newClientNodeId } from "./graph";
import { deriveParentServerNodeIds, graphHasCycle } from "./nodeGraph";
import type { BranchGraphOutput } from "./nodeBranching";
import type { NodeTemplateGraphDto } from "./api-node-templates";
import type { PortDescriptor } from "./nodeCompatibility";

export type GraphCommitReason = "template" | "palette" | "branch" | "element-drop";
export const NODE_ELEMENT_MIME = "application/ima2-node-element";

export type ElementDropPayload = {
  version: 1;
  assetKind: "element";
  elementId: string;
};

function emptyImageData(id: string): ImageNodeData {
  return {
    clientId: id,
    serverNodeId: null,
    parentServerNodeId: null,
    prompt: "",
    imageUrl: null,
    status: "empty",
    pendingRequestId: null,
    pendingPhase: null,
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeTemplateNode(node: NodeTemplateGraphDto["nodes"][number]): GraphNode {
  const data = record(node.data);
  const element = data.nodeType === "element-reference";
  return {
    ...node,
    id: node.id,
    type: element ? "elementReferenceNode" : "imageNode",
    position: node.position ?? { x: 0, y: 0 },
    data: {
      ...emptyImageData(node.id),
      ...data,
      clientId: node.id,
      status: data.status === "ready" ? "ready" : "empty",
      pendingRequestId: null,
      pendingPhase: null,
    },
  } as GraphNode;
}

function normalizeTemplateEdge(edge: NodeTemplateGraphDto["edges"][number]): GraphEdge {
  return {
    ...edge,
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle === "output" ? "source-right" : edge.sourceHandle,
    targetHandle: edge.targetHandle === "input" ? "target-left" : edge.targetHandle,
  } as GraphEdge;
}

export function normalizeTemplateGraph(graph: NodeTemplateGraphDto): {
  nodes: GraphNode[];
  edges: GraphEdge[];
} {
  return {
    nodes: graph.nodes.map(normalizeTemplateNode),
    edges: graph.edges.map(normalizeTemplateEdge),
  };
}

function validSnapshot(nodes: readonly GraphNode[], edges: readonly GraphEdge[]): boolean {
  const nodeIds = new Set(nodes.map((node) => node.id));
  if (nodeIds.size !== nodes.length) return false;
  if (new Set(edges.map((edge) => edge.id)).size !== edges.length) return false;
  if (edges.some((edge) => !nodeIds.has(edge.source) || !nodeIds.has(edge.target))) return false;
  if (graphHasCycle(nodes, edges)) return false;
  return nodes.every((node) =>
    node.type !== "elementReferenceNode" || record(node.data).nodeType === "element-reference",
  );
}

export function commitGraphSnapshot(input: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  reason: GraphCommitReason;
}): boolean {
  if (!validSnapshot(input.nodes, input.edges)) return false;
  const graphNodes = deriveParentServerNodeIds(input.nodes, input.edges);
  useAppStore.setState({ graphNodes, graphEdges: input.edges });
  useAppStore.getState().scheduleGraphSave();
  return true;
}

export function appendBranchOutput(
  graph: { nodes: GraphNode[]; edges: GraphEdge[] },
  output: BranchGraphOutput,
): { ok: true; graph: { nodes: GraphNode[]; edges: GraphEdge[] } } | { ok: false } {
  if (output.createdNodeIds.length === 0 || output.createdEdgeIds.length === 0) return { ok: false };
  const candidate = {
    nodes: [...graph.nodes, ...output.nodes],
    edges: [...graph.edges, ...output.edges],
  };
  return validSnapshot(candidate.nodes, candidate.edges)
    ? { ok: true, graph: candidate }
    : { ok: false };
}

export function buildPaletteInsertion(input: {
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  position: { x: number; y: number };
  sourcePort?: PortDescriptor;
}): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const id = newClientNodeId();
  const node: GraphNode = {
    id,
    type: "imageNode",
    position: input.position,
    data: emptyImageData(id),
  };
  if (!input.sourcePort) return { nodes: [...input.graph.nodes, node], edges: input.graph.edges };
  const edge: GraphEdge = {
    id: `${input.sourcePort.nodeId}:${input.sourcePort.handleId}->${id}:target-left`,
    source: input.sourcePort.nodeId,
    target: id,
    sourceHandle: input.sourcePort.handleId,
    targetHandle: "target-left",
  };
  return { nodes: [...input.graph.nodes, node], edges: [...input.graph.edges, edge] };
}

export function parseElementDropPayload(value: string): ElementDropPayload | null {
  try {
    const payload = JSON.parse(value) as Partial<ElementDropPayload>;
    return payload.version === 1
      && payload.assetKind === "element"
      && typeof payload.elementId === "string"
      && payload.elementId.length > 0
      ? payload as ElementDropPayload
      : null;
  } catch {
    return null;
  }
}

function previewUrl(asset: AssetItem): string | null {
  const refs = asset.metadata?.refs;
  const path = Array.isArray(refs)
    ? refs.find((value): value is string => typeof value === "string" && value.length > 0)
    : null;
  return path ? `/generated/${path.split("/").map(encodeURIComponent).join("/")}` : null;
}

export function buildElementReferenceNode(
  asset: AssetItem,
  position: { x: number; y: number },
): GraphNode | null {
  if (asset.kind !== "element") return null;
  const refs = Array.isArray(asset.metadata?.refs) ? asset.metadata.refs : [];
  const id = newClientNodeId();
  return {
    id,
    type: "elementReferenceNode",
    position,
    data: {
      ...emptyImageData(id),
      nodeType: "element-reference",
      elementId: asset.id,
      elementName: asset.name,
      thumbnailUrl: previewUrl(asset),
      refCount: refs.length,
      notesPreview: asset.notes ?? "",
      revision: asset.updatedAt,
      missing: false,
    },
  } as GraphNode;
}
