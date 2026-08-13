// Contract catalog SoT types (WP2 / 020). Pure type module — no runtime imports.
// The catalog is the single source of truth for AI-facing tool contracts:
// built-in ima2 tools and provider MCP snapshot mirrors share this shape.

export type ContractNamespace = "ima2" | `mcp.${string}`;

export type JsonSchema = Record<string, unknown>;

export type TypedErrorCode =
  | "auth_required"
  | "unavailable"
  | "schema_changed"
  | "unknown_tool"
  | "invalid_input"
  | "execution_unbound"
  | "upstream_error";

export type AvailabilityState =
  | "documented" // known from a bundled/cached snapshot only — never executable
  | "installed"  // local package/transport present, no live session
  | "connected"  // live authenticated session exists
  | "callable"   // connected + tool present live + schema hash match
  | "stale"      // live schema hash mismatch — execution locked
  | "blocked";   // execution denied for a typed cause

export type AvailabilityCause =
  | "auth_required"
  | "entitlement"
  | "schema_drift"
  | "revoked"
  | "offline";

export interface Availability {
  state: AvailabilityState;
  cause?: AvailabilityCause | undefined;
  /** Human/machine-readable judgment basis (hash, timestamp, "builtin", ...). */
  evidence?: string | undefined;
}

export interface SnapshotProvenance {
  provider: string;
  endpoint: string;
  fetchedAt: string;
  serverInfo?: Record<string, unknown> | null | undefined;
  /** Negotiated MCP protocol version from the live session, when known. */
  protocolVersion?: string | undefined;
  entitlementTag: string;
  originalHash: string;
  sanitizedHash: string;
}

/** Lossless sanitized snapshot artifact shape (written by the 010 spike, owned by 040). */
export interface SnapshotSource {
  provenance: SnapshotProvenance;
  serverInstructions?: string | null | undefined;
  tools: SnapshotTool[];
}

export interface SnapshotTool {
  name: string;
  title?: string | undefined;
  description?: string | undefined;
  inputSchema?: JsonSchema | undefined;
  outputSchema?: JsonSchema | undefined;
  annotations?: Record<string, unknown> | undefined;
  /** sha256 of canonical({inputSchema, outputSchema}); recomputed when absent. */
  schemaHash?: string | undefined;
}

export interface ToolContract {
  /** Fully-qualified id: `ima2.<name>` or `mcp.<provider>.<tool>`. */
  id: string;
  namespace: ContractNamespace;
  /** Upstream original name (mcp.*) or canonical ima2 name. */
  name: string;
  title?: string | undefined;
  description: string;
  /** Upstream descriptions are data, never instructions. */
  trust: "builtin" | "upstream-untrusted";
  inputSchema: JsonSchema;
  outputSchema?: JsonSchema | undefined;
  annotations?: Record<string, unknown> | undefined;
  errorContract: TypedErrorCode[];
  /** Interview Round 2: ima2 runtime owns all execution. */
  executionOwner: "ima2-server";
  availability: Availability;
  provenance?: SnapshotProvenance | undefined;
}
