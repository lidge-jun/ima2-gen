import { jsonFetch } from "./api-core";

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
}

/**
 * Reads the comfy lane out of /api/models.
 *
 * The selector needs the same view the server publishes — including which
 * workflows are on an instance that answered — rather than a second opinion
 * assembled from the workflow list.
 */
export async function getComfyLaneModels(signal?: AbortSignal): Promise<ComfyLaneModel[]> {
  const response = await jsonFetch<{ lanes?: Record<string, { models?: { image?: ComfyLaneModel[] } }> }>(
    "/api/models",
    signal ? { signal } : {},
  );
  return response.lanes?.comfy?.models?.image ?? [];
}
