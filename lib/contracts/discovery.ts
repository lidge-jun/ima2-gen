// AI discovery surface (070 WP7): envelope, catalog version, availability
// promotion, and execution bindings. Pure functions shared by the CLI and the
// /api/contracts route. Design evidence: devlog 071 (gh/cargo/MCP/RFC 9457).
import { randomBytes } from "node:crypto";
import { canonicalHash } from "../mcp/sanitizer.js";
import type { Availability, JsonSchema, ToolContract, TypedErrorCode } from "./types.js";

export const DISCOVERY_SCHEMA_VERSION = 1;

export interface EnvelopeMeta {
  catalogVersion: string;
  cliVersion: string;
}

function envelopeBase(meta: EnvelopeMeta) {
  return {
    catalogVersion: meta.catalogVersion,
    schemaVersion: DISCOVERY_SCHEMA_VERSION,
    cliVersion: meta.cliVersion,
    requestId: `disc_${Date.now()}_${randomBytes(3).toString("hex")}`,
    generatedAt: new Date().toISOString(),
  };
}

export function okEnvelope(data: unknown, meta: EnvelopeMeta) {
  return { ok: true as const, data, ...envelopeBase(meta) };
}

export function errorEnvelope(code: TypedErrorCode | "server_error", message: string, meta: EnvelopeMeta, retryable = false) {
  return { ok: false as const, error: { code, message, retryable }, ...envelopeBase(meta) };
}

/** Deterministic catalog version: canonical hash over stable per-tool identity. */
export function catalogVersion(entries: ToolContract[]): string {
  return canonicalHash(entries.map((e) => ({ id: e.id, hash: e.provenance?.sanitizedHash ?? canonicalHash(e.inputSchema) })));
}

/** Live provider state used to promote availability beyond `documented`. */
export interface ProviderLiveState {
  state: string;
  connectedAt?: string;
  /** Local ingested snapshot evidence (fetchedAt must postdate connectedAt). */
  snapshotFetchedAt?: string;
  snapshotToolNames?: string[];
  driftedTools?: string[];
}

/** Callable promotion rule (WP7 audit blocker 2): connected AND post-connect
 *  ingest evidence AND present in that snapshot AND not drifted. */
export function promoteAvailability(entry: ToolContract, live: ProviderLiveState | undefined): Availability {
  if (entry.namespace === "ima2") return entry.availability;
  if (!live || live.state !== "connected") return entry.availability;
  const ingestFresh = Boolean(
    live.snapshotFetchedAt && live.connectedAt && Date.parse(live.snapshotFetchedAt) >= Date.parse(live.connectedAt),
  );
  if (!ingestFresh) return { state: "connected", evidence: "connected; no post-connect ingest evidence" };
  if (live.driftedTools?.includes(entry.name)) return { state: "stale", cause: "schema_drift", evidence: "live schema hash mismatch" };
  if (!live.snapshotToolNames?.includes(entry.name)) return { state: "blocked", cause: "entitlement", evidence: "absent from post-connect tools/list" };
  return { state: "callable", evidence: `live ingest ${live.snapshotFetchedAt}` };
}

export interface ExecutionBinding {
  binding: "mcp-generate" | "mcp-media-action";
  endpoint: string;
  inputContract: JsonSchema;
  note: string;
}

const GENERATE_INPUT: JsonSchema = {
  type: "object",
  properties: {
    provider: { type: "string" },
    kind: { type: "string", enum: ["image", "video"] },
    prompt: { type: "string" },
    model: { type: "string" },
    ratio: { type: "string" },
    startFrameFilename: { type: "string", description: "existing generated-library image used as I2V start frame" },
  },
  required: ["provider", "kind", "prompt"],
  additionalProperties: false,
};

const MEDIA_ACTION_INPUT: JsonSchema = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["stitch", "extend", "upscale-video", "upscale-image", "edit-video", "reframe"] },
    files: { type: "array", items: { type: "string" }, description: "generated-library filenames" },
    prompt: { type: "string" },
    provider: { type: "string" },
  },
  required: ["action", "files"],
  additionalProperties: false,
};

const GENERATE_TOOLS = new Set(["generate_image", "generate_video"]);
const ACTION_TOOLS = new Set(["upscale_image", "upscale_video", "edit_video"]);

/** Raw upstream schemas are reference material; execution flows through these
 *  normalized bindings only (WP7 audit blocker 1). */
export function executionBindingFor(entry: ToolContract): ExecutionBinding | null {
  if (entry.namespace === "ima2" || !entry.namespace.startsWith("mcp.")) return null;
  if (GENERATE_TOOLS.has(entry.name)) {
    return {
      binding: "mcp-generate",
      endpoint: "POST /api/mcp/generate",
      inputContract: GENERATE_INPUT,
      note: "call accepts this normalized contract; the raw inputSchema above is upstream reference only",
    };
  }
  if (ACTION_TOOLS.has(entry.name)) {
    return {
      binding: "mcp-media-action",
      endpoint: "POST /api/mcp/media-action",
      inputContract: MEDIA_ACTION_INPUT,
      note: "call accepts this normalized contract; the raw inputSchema above is upstream reference only",
    };
  }
  return null;
}

export interface ToolSummaryRow {
  id: string;
  namespace: string;
  availability: Availability;
  executable: boolean;
  description: string;
}

/** Progressive disclosure (071): list returns summaries; show returns everything. */
export function buildToolsList(entries: ToolContract[], liveByProvider: Record<string, ProviderLiveState> = {}): ToolSummaryRow[] {
  return entries.map((entry) => {
    const provider = entry.namespace.startsWith("mcp.") ? entry.namespace.slice(4) : null;
    const availability = promoteAvailability(entry, provider ? liveByProvider[provider] : undefined);
    return {
      id: entry.id,
      namespace: entry.namespace,
      availability,
      executable: Boolean(executionBindingFor(entry)) || entry.namespace === "ima2",
      description: ((entry.description || "").split("\n")[0] ?? "").slice(0, 140),
    };
  });
}

export function buildToolShow(entry: ToolContract, liveByProvider: Record<string, ProviderLiveState> = {}) {
  const provider = entry.namespace.startsWith("mcp.") ? entry.namespace.slice(4) : null;
  return {
    ...entry,
    availability: promoteAvailability(entry, provider ? liveByProvider[provider] : undefined),
    execution: executionBindingFor(entry),
  };
}
