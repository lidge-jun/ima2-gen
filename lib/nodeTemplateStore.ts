import { randomUUID } from "crypto";
import { ulid } from "ulid";
import { getDb } from "./db.js";
import { nodeTemplateSeeds } from "./nodeTemplateSeeds.js";

export type SerializedTemplateNode = { id: string; type?: string | undefined; position?: { x: number; y: number }; width?: number | undefined; height?: number | undefined; data?: Record<string, unknown>; [key: string]: unknown };
export type SerializedTemplateEdge = { id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null; label?: string | undefined; [key: string]: unknown };
export interface NodeTemplateGraph { nodes: SerializedTemplateNode[]; edges: SerializedTemplateEdge[]; viewport?: { x: number; y: number; zoom: number } | undefined; diagnostics?: string[] | undefined; manifest?: { requiredPlaceholders: string[]; expectedTerminalResults: number } | undefined }
export interface NodeTemplateRecord { id: string; name: string; description: string; source: "seed" | "user"; graph: NodeTemplateGraph; thumbnail?: string | undefined; tags: string[]; version: 1; createdAt: number; updatedAt: number }
export interface StripTemplateOptions { preservePrompt: boolean; preserveProvider: boolean }
export type CreateNodeTemplateInput = { name: unknown; description?: unknown | undefined; graph: NodeTemplateGraph; thumbnail?: unknown | undefined; tags?: unknown | undefined; stripOptions?: StripTemplateOptions | undefined };
export type UpdateNodeTemplateInput = Partial<CreateNodeTemplateInput>;
export interface NodeTemplateStore { list(): Promise<NodeTemplateRecord[]>; get(id: string): Promise<NodeTemplateRecord | null>; create(input: CreateNodeTemplateInput): Promise<NodeTemplateRecord>; update(id: string, patch: UpdateNodeTemplateInput): Promise<NodeTemplateRecord>; remove(id: string): Promise<void>; instantiate(id: string): Promise<NodeTemplateGraph> }

const SECRET_KEY = /secret|api[_-]?key|authorization|token|password/i;
const REMOVE_KEY = /^(url|output(path)?|thumbnail|progress|error|requestid|sessionid|parentid|lineage(id)?|result|results)$/i;
const MEDIA_KEY = /^(media|src|file(path)?|upload|reference|image(url)?|video(url)?)$/i;
const PROMPT_KEY = /prompt/i;
const PROVIDER_KEY = /provider|model/i;

function error(status: number, code: string, message: string): Error {
  return Object.assign(new Error(message), { status, code });
}

function tags(value: unknown): string[] { return Array.isArray(value) ? [...new Set(value.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean))].slice(0, 20) : []; }
function text(value: unknown, fallback = ""): string { return typeof value === "string" ? value.trim() || fallback : fallback; }
function clone<T>(value: T): T { return structuredClone(value); }

function cleanValue(value: unknown, key: string, options: StripTemplateOptions): unknown {
  if (SECRET_KEY.test(key) || REMOVE_KEY.test(key)) return undefined;
  if (MEDIA_KEY.test(key) && typeof value === "string") return { placeholder: key, unresolved: true };
  if (PROMPT_KEY.test(key) && !options.preservePrompt) return "";
  if (PROVIDER_KEY.test(key) && !options.preserveProvider) return undefined;
  if (Array.isArray(value)) return value.map((entry) => cleanValue(entry, "", options)).filter((entry) => entry !== undefined);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([childKey, child]) => {
    const clean = cleanValue(child, childKey, options);
    return clean === undefined ? [] : [[childKey, clean]];
  }));
}

function validGraph(graph: NodeTemplateGraph): void {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw error(400, "INVALID_TEMPLATE_GRAPH", "graph must contain nodes and edges arrays");
  if (graph.nodes.some((node) => !node || typeof node.id !== "string" || !node.id)) throw error(400, "INVALID_TEMPLATE_GRAPH", "every node needs an id");
}

/** Strict input validation for create/update boundaries (Socrates medium).
 * stripGraphForTemplate itself stays tolerant: it drops dangling edges with
 * diagnostics instead of rejecting (NT-05 contract). */
function assertStrictGraph(graph: NodeTemplateGraph): void {
  validGraph(graph);
  const nodeIds = graph.nodes.map((node) => node.id);
  if (new Set(nodeIds).size !== nodeIds.length) throw error(400, "INVALID_TEMPLATE_GRAPH", "node ids must be unique");
  const idSet = new Set(nodeIds);
  for (const edge of graph.edges) {
    if (!edge || typeof edge.source !== "string" || typeof edge.target !== "string") throw error(400, "INVALID_TEMPLATE_GRAPH", "every edge needs string source and target");
    if (!idSet.has(edge.source) || !idSet.has(edge.target)) throw error(400, "INVALID_TEMPLATE_GRAPH", `dangling edge: ${edge.id ?? `${edge.source}->${edge.target}`}`);
  }
}

export function stripGraphForTemplate(graph: NodeTemplateGraph, options: StripTemplateOptions): NodeTemplateGraph {
  validGraph(graph);
  const input = clone(graph);
  const ids = new Map(input.nodes.map((node, index) => [node.id, `template-node-${index + 1}`]));
  const diagnostics: string[] = [];
  const nodes = input.nodes.map((node) => {
    const data = cleanValue(node.data ?? {}, "data", options) as Record<string, unknown>;
    if (data.status === "inflight" || data.status === "pending") data.status = "idle";
    return { ...node, id: ids.get(node.id)!, data };
  });
  const edges = input.edges.flatMap((edge, index) => {
    const source = ids.get(edge.source); const target = ids.get(edge.target);
    if (!source || !target) { diagnostics.push(`dropped dangling edge: ${edge.id || index}`); return []; }
    return [{ ...cleanValue(edge, "edge", options) as SerializedTemplateEdge, id: `template-edge-${index + 1}`, source, target }];
  });
  const result: NodeTemplateGraph = { nodes, edges, diagnostics, viewport: input.viewport ? clone(input.viewport) : undefined, manifest: input.manifest ? clone(input.manifest) : undefined };
  validGraph(result);
  return result;
}

function rowToTemplate(row: { id: string; name: string; notes: string | null; metadata: string | null; createdAt: number; updatedAt: number }): NodeTemplateRecord | null {
  try {
    const metadata = JSON.parse(row.metadata ?? "{}") as Partial<NodeTemplateRecord>;
    if (!metadata.graph) return null;
    validGraph(metadata.graph);
    return { id: row.id, name: row.name, description: text(row.notes), source: "user", graph: metadata.graph, thumbnail: typeof metadata.thumbnail === "string" ? metadata.thumbnail : undefined, tags: tags(metadata.tags), version: 1, createdAt: row.createdAt, updatedAt: row.updatedAt };
  } catch { return null; }
}

function findUser(id: string): NodeTemplateRecord | null {
  const row = getDb().prepare("SELECT id, name, notes, metadata, created_at AS createdAt, updated_at AS updatedAt FROM assets WHERE id = ? AND kind = 'template'").get(id) as { id: string; name: string; notes: string | null; metadata: string | null; createdAt: number; updatedAt: number } | undefined;
  return row ? rowToTemplate(row) : null;
}

function instantiateGraph(template: NodeTemplateRecord): NodeTemplateGraph {
  const graph = clone(template.graph); const ids = new Map(graph.nodes.map((node) => [node.id, `n_${randomUUID()}`]));
  return { ...graph, viewport: undefined, nodes: graph.nodes.map((node) => ({ ...node, id: ids.get(node.id)!, data: { ...node.data, status: "idle", templateProvenance: template.id } })), edges: graph.edges.map((edge) => ({ ...edge, id: `e_${randomUUID()}`, source: ids.get(edge.source)!, target: ids.get(edge.target)! })) };
}

export class SqliteNodeTemplateStore implements NodeTemplateStore {
  async list(): Promise<NodeTemplateRecord[]> {
    const rows = getDb().prepare("SELECT id, name, notes, metadata, created_at AS createdAt, updated_at AS updatedAt FROM assets WHERE kind = 'template' ORDER BY updated_at DESC").all() as Array<{ id: string; name: string; notes: string | null; metadata: string | null; createdAt: number; updatedAt: number }>;
    return [...nodeTemplateSeeds, ...rows.map(rowToTemplate).filter((record): record is NodeTemplateRecord => record !== null)];
  }
  async get(id: string): Promise<NodeTemplateRecord | null> { return nodeTemplateSeeds.find((seed) => seed.id === id) ?? findUser(id); }
  async create(input: CreateNodeTemplateInput): Promise<NodeTemplateRecord> {
    const name = text(input.name); if (name.length < 1 || name.length > 80) throw error(400, "INVALID_TEMPLATE_NAME", "template name must be 1-80 characters");
    assertStrictGraph(input.graph);
    const record: NodeTemplateRecord = { id: `template_${ulid()}`, name, description: text(input.description), source: "user", graph: stripGraphForTemplate(input.graph, input.stripOptions ?? { preservePrompt: true, preserveProvider: true }), thumbnail: typeof input.thumbnail === "string" ? input.thumbnail : undefined, tags: tags(input.tags), version: 1, createdAt: Date.now(), updatedAt: Date.now() };
    getDb().prepare("INSERT INTO assets (id, kind, name, file_path, folder_id, notes, metadata, created_at, updated_at) VALUES (?, 'template', ?, NULL, NULL, ?, ?, ?, ?)").run(record.id, record.name, record.description || null, JSON.stringify({ graph: record.graph, thumbnail: record.thumbnail, tags: record.tags }), record.createdAt, record.updatedAt);
    return record;
  }
  async update(id: string, patch: UpdateNodeTemplateInput): Promise<NodeTemplateRecord> {
    if (nodeTemplateSeeds.some((seed) => seed.id === id)) throw error(403, "SEED_TEMPLATE_READ_ONLY", "seed templates cannot be changed");
    const current = findUser(id); if (!current) throw error(404, "TEMPLATE_NOT_FOUND", "template not found");
    const name = patch.name === undefined ? current.name : text(patch.name); if (name.length < 1 || name.length > 80) throw error(400, "INVALID_TEMPLATE_NAME", "template name must be 1-80 characters");
    if (patch.graph !== undefined) assertStrictGraph(patch.graph);
    const next = { ...current, name, description: patch.description === undefined ? current.description : text(patch.description), graph: patch.graph === undefined ? current.graph : stripGraphForTemplate(patch.graph, patch.stripOptions ?? { preservePrompt: true, preserveProvider: true }), thumbnail: patch.thumbnail === undefined ? current.thumbnail : typeof patch.thumbnail === "string" ? patch.thumbnail : undefined, tags: patch.tags === undefined ? current.tags : tags(patch.tags), updatedAt: Date.now() };
    getDb().prepare("UPDATE assets SET name = ?, notes = ?, metadata = ?, updated_at = ? WHERE id = ? AND kind = 'template'").run(next.name, next.description || null, JSON.stringify({ graph: next.graph, thumbnail: next.thumbnail, tags: next.tags }), next.updatedAt, id);
    return next;
  }
  async remove(id: string): Promise<void> { if (nodeTemplateSeeds.some((seed) => seed.id === id)) throw error(403, "SEED_TEMPLATE_READ_ONLY", "seed templates cannot be deleted"); if (getDb().prepare("DELETE FROM assets WHERE id = ? AND kind = 'template'").run(id).changes === 0) throw error(404, "TEMPLATE_NOT_FOUND", "template not found"); }
  async instantiate(id: string): Promise<NodeTemplateGraph> { const template = await this.get(id); if (!template) throw error(404, "TEMPLATE_NOT_FOUND", "template not found"); return instantiateGraph(template); }
}

export const nodeTemplateStore: NodeTemplateStore = new SqliteNodeTemplateStore();
