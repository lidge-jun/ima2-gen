import type { McpConnectionState } from "./mcpProviders";
import type { McpMediaKind } from "./mcpSelection";
export type McpReadinessSelection = { provider: string; model: string | null; kind: McpMediaKind };
export type McpReadinessModel = { id: string; label: string; executable?: boolean };
type ObservedProvider = { id: string; enabled: boolean; executable?: boolean; status: { state: McpConnectionState } };
export type McpReadinessObservation = {
  selection: McpReadinessSelection; phase: "loading" | "ready" | "error"; observedAt: number | null;
  providers: readonly ObservedProvider[];
  catalog: { image: McpReadinessModel[]; video: McpReadinessModel[] } | null;
};
export type McpReadinessCode = "loading" | "error" | "missing" | "disabled" | "disconnected"
  | "locked" | "default" | "model-missing" | "model-locked" | "ready";
export type McpReadiness = McpReadinessSelection & { code: McpReadinessCode; modelLabel: string | null; observedAt: number | null };
export type McpReadinessData = Pick<McpReadinessObservation, "providers" | "catalog">;
const STATES = new Set<McpConnectionState>(["disconnected", "connecting", "auth_required", "connected", "offline", "error"]);

function invalid(): never { throw Object.assign(new Error("MCP_READINESS_INVALID"), { code: "MCP_READINESS_INVALID" }); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return invalid();
  return value;
}
function executable(value: unknown): { executable?: boolean } {
  if (value === undefined) return {};
  if (typeof value !== "boolean") return invalid();
  return { executable: value };
}
function provider(value: unknown): ObservedProvider {
  const row = record(value), status = record(row.status);
  if (typeof row.enabled !== "boolean" || !STATES.has(status.state as McpConnectionState)) return invalid();
  return { id: text(row.id), enabled: row.enabled, ...executable(row.executable), status: { state: status.state as McpConnectionState } };
}
function models(value: unknown): McpReadinessModel[] {
  if (!Array.isArray(value)) return invalid();
  return value.map((value) => {
    const row = record(value);
    return { id: text(row.id), label: text(row.label), ...executable(row.executable) };
  });
}
export function parseMcpReadinessData(providers: unknown, catalog: unknown | null): McpReadinessData {
  const envelope = record(providers);
  if (envelope.ok !== true || !Array.isArray(envelope.providers)) return invalid();
  const rows = envelope.providers.map(provider);
  if (catalog === null) return { providers: rows, catalog: null };
  const catalogEnvelope = record(catalog), entries = record(catalogEnvelope.models);
  if (catalogEnvelope.ok !== true) return invalid();
  return { providers: rows, catalog: { image: models(entries.image), video: models(entries.video) } };
}

export function deriveMcpReadiness(observation: McpReadinessObservation, selection: McpReadinessSelection): McpReadiness {
  const sameSelection = observation.selection.provider === selection.provider
    && observation.selection.model === selection.model && observation.selection.kind === selection.kind;
  const result = (code: McpReadinessCode, modelLabel: string | null = selection.model): McpReadiness => ({
    ...selection, code, modelLabel, observedAt: sameSelection ? observation.observedAt : null,
  });
  if (!sameSelection || observation.phase === "loading") return result("loading");
  if (observation.phase === "error") return result("error");
  const provider = observation.providers.find((row) => row.id === selection.provider);
  if (!provider) return result("missing");
  if (!provider.enabled) return result("disabled");
  if (provider.status.state !== "connected") return result("disconnected");
  if (provider.executable === false) return result("locked");
  if (selection.model === null) return result("default", null);
  const model = observation.catalog?.[selection.kind].find((row) => row.id === selection.model);
  if (!model) return result("model-missing");
  return result(model.executable === false ? "model-locked" : "ready", model.label || model.id);
}
