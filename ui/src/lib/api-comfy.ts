import { jsonFetch } from "./api-core";

export type ComfyMediaKind = "image" | "video";

export interface ComfyHealth {
  ok: boolean;
  version?: string;
  queueRemaining?: number;
  reason?: string;
}

export interface ComfyBinding {
  node: string;
  input: string;
}

export interface ComfyWorkflowBindings {
  prompt: ComfyBinding;
  negativePrompt?: ComfyBinding;
  width?: ComfyBinding;
  height?: ComfyBinding;
  seed?: ComfyBinding;
  refImage?: ComfyBinding;
  output: { node: string };
}

export interface ComfyWorkflowParam {
  name: string;
  node: string;
  input: string;
  type: "number" | "string" | "boolean";
  default?: number | string | boolean;
  min?: number;
  max?: number;
  options?: Array<number | string | boolean>;
}

export interface ComfyWorkflowRecord {
  id: string;
  label: string;
  origin: string;
  mediaKind: ComfyMediaKind;
  bind: ComfyWorkflowBindings;
  params: ComfyWorkflowParam[];
  createdAt: number;
  updatedAt: number;
  health?: ComfyHealth;
}

export type ComfyBindField = keyof ComfyWorkflowBindings;

export interface ComfyBindCandidate {
  field: ComfyBindField;
  node: string;
  input: string;
  classType: string;
  title?: string;
  /** False when several nodes match and a human must choose. */
  unambiguous: boolean;
}

export interface ComfyInspectResult {
  ok: true;
  nodes: Array<{ id: string; classType: string; title: string | null }>;
  candidates: ComfyBindCandidate[];
  needsConfirmation: boolean;
  mediaKind?: ComfyMediaKind;
}

export function listComfyWorkflows(): Promise<{ ok: true; workflows: ComfyWorkflowRecord[] }> {
  return jsonFetch("/api/comfy/workflows");
}

/** Parses a workflow file without saving it, so bindings can be confirmed first. */
export function inspectComfyWorkflow(source: { graph?: unknown; pngBase64?: string }): Promise<ComfyInspectResult> {
  return jsonFetch("/api/comfy/inspect", { method: "POST", body: JSON.stringify(source) });
}

/**
 * Checks an origin through the SERVER, never with a browser fetch.
 *
 * The route runs normalizeComfyOrigin first, so a typed string cannot become an
 * arbitrary outbound request. A malformed origin comes back as a thrown 400
 * while an unreachable one resolves with health.ok false — two different
 * problems that deserve two different messages.
 */
export function probeComfyOrigin(origin: string): Promise<{ ok: true; origin: string; health: ComfyHealth }> {
  return jsonFetch("/api/comfy/probe", { method: "POST", body: JSON.stringify({ origin }) });
}

export function createComfyWorkflow(input: {
  id: string;
  label?: string;
  origin?: string;
  mediaKind: ComfyMediaKind;
  bind: ComfyWorkflowBindings;
  graph?: unknown;
  pngBase64?: string;
  replace?: boolean;
}): Promise<{ ok: true; workflow: ComfyWorkflowRecord }> {
  return jsonFetch("/api/comfy/workflows", { method: "POST", body: JSON.stringify(input) });
}

export function deleteComfyWorkflow(id: string): Promise<{ ok: true; id: string }> {
  return jsonFetch(`/api/comfy/workflows/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export interface ComfyLaneModel {
  id: string;
  label: string;
  /** The origin, or "<origin> (offline)" when that instance did not answer. */
  description?: string;
  executable?: boolean;
  lockReason?: string;
}

export interface ComfyLaneModels {
  image: ComfyLaneModel[];
  video: ComfyLaneModel[];
}

/**
 * Reads the comfy lane out of /api/models.
 *
 * The selector needs the same view the server publishes — including which
 * workflows are on an instance that answered — rather than a second opinion
 * assembled from the workflow list.
 */
export async function getComfyLaneModels(signal?: AbortSignal): Promise<ComfyLaneModels> {
  const catalog = await getLaneCatalog(signal);
  return catalog.comfy?.models ?? { image: [], video: [] };
}

/** The four states the server publishes per lane. */
export type LaneStatus = "ready" | "locked" | "disconnected" | "key-missing";

export interface LaneCatalogEntry {
  status: LaneStatus;
  /** Human-readable detail. Present on some ready lanes too. */
  reason?: string;
  models: ComfyLaneModels;
}

export type LaneCatalog = Record<string, LaneCatalogEntry>;

/**
 * Reads every lane out of /api/models.
 *
 * The selector used to hardcode which lanes exist and which of them do video,
 * while the server was already publishing both — along with a reason for every
 * lane that cannot run. This is the same endpoint getComfyLaneModels reads,
 * widened from one lane to all of them.
 */
export async function getLaneCatalog(signal?: AbortSignal): Promise<LaneCatalog> {
  return parseLaneCatalog(await jsonFetch<unknown>("/api/models", signal ? { signal } : {}));
}

function isLaneStatus(value: unknown): value is LaneStatus {
  return value === "ready" || value === "locked" || value === "disconnected" || value === "key-missing";
}

function invalidCatalog(): never {
  throw Object.assign(new Error("Invalid model catalog response"), { code: "MODEL_CATALOG_INVALID" });
}

function catalogRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function catalogModel(value: unknown): ComfyLaneModel {
  if (!catalogRecord(value) || typeof value.id !== "string" || !value.id.trim()
    || typeof value.label !== "string" || !value.label.trim()) return invalidCatalog();
  const model: ComfyLaneModel = { id: value.id, label: value.label };
  for (const key of ["description", "lockReason"] as const) {
    if (value[key] === undefined) continue;
    if (typeof value[key] !== "string") return invalidCatalog();
    model[key] = value[key];
  }
  if (value.executable !== undefined) {
    if (typeof value.executable !== "boolean") return invalidCatalog();
    model.executable = value.executable;
  }
  return model;
}

/** Project only this client's consumed fields; defaults/surfaces are not selection instructions. */
export function parseLaneCatalog(value: unknown): LaneCatalog {
  if (!catalogRecord(value) || value.ok !== true || !catalogRecord(value.lanes)) return invalidCatalog();
  return Object.fromEntries(Object.entries(value.lanes).map(([id, lane]) => {
    if (!catalogRecord(lane) || !isLaneStatus(lane.status) || !catalogRecord(lane.models)
      || !Array.isArray(lane.models.image) || !Array.isArray(lane.models.video)
      || (lane.reason !== undefined && typeof lane.reason !== "string")) return invalidCatalog();
    const entry: LaneCatalogEntry = { status: lane.status,
      ...(typeof lane.reason === "string" ? { reason: lane.reason } : {}),
      models: { image: lane.models.image.map(catalogModel), video: lane.models.video.map(catalogModel) } };
    // fromEntries defines own properties even for unknown IDs such as __proto__.
    return [id, entry];
  }));
}
