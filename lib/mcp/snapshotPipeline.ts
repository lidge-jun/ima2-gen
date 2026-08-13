// Snapshot pipeline (040 WP4): raw live tools -> sanitized, canonically hashed,
// provenance-tagged SnapshotSource; plus drift/entitlement diffing.
import type { SnapshotSource, SnapshotTool } from "../contracts/types.js";
import { canonicalHash, scrubValue, toolSchemaHash } from "./sanitizer.js";

export interface BuildSnapshotInput {
  provider: string;
  endpoint: string;
  entitlementTag: string;
  tools: Array<Record<string, unknown>>;
  serverInfo?: Record<string, unknown> | null | undefined;
  protocolVersion?: string | undefined;
  serverInstructions?: string | null | undefined;
  fetchedAt?: string | undefined;
}

function toSnapshotTool(raw: Record<string, unknown>): SnapshotTool {
  const picked: SnapshotTool = scrubValue({
    name: String(raw.name),
    ...(raw.title !== undefined ? { title: raw.title as string } : {}),
    ...(raw.description !== undefined ? { description: raw.description as string } : {}),
    ...(raw.inputSchema !== undefined ? { inputSchema: raw.inputSchema as Record<string, unknown> } : {}),
    ...(raw.outputSchema !== undefined ? { outputSchema: raw.outputSchema as Record<string, unknown> } : {}),
    ...(raw.annotations !== undefined ? { annotations: raw.annotations as Record<string, unknown> } : {}),
  });
  return { ...picked, schemaHash: toolSchemaHash(picked) };
}

export function buildSnapshotArtifact(input: BuildSnapshotInput): SnapshotSource {
  const tools = input.tools.map((raw) => toSnapshotTool(raw));
  return {
    provenance: {
      provider: input.provider,
      endpoint: input.endpoint,
      fetchedAt: input.fetchedAt ?? new Date().toISOString(),
      serverInfo: scrubValue(input.serverInfo ?? null),
      ...(input.protocolVersion ? { protocolVersion: input.protocolVersion } : {}),
      entitlementTag: input.entitlementTag,
      originalHash: canonicalHash(input.tools),
      sanitizedHash: canonicalHash(tools),
    },
    ...(input.serverInstructions !== undefined && input.serverInstructions !== null
      ? { serverInstructions: scrubValue(input.serverInstructions) }
      : {}),
    tools,
  };
}

export interface SnapshotDiff {
  drifted: string[];
  missing: string[];
  added: string[];
}

const hashOf = (tool: SnapshotTool): string => tool.schemaHash ?? toolSchemaHash(tool);

/** drift = tool present in both but schemaHash mismatch; missing = entitlement gap. */
export function diffSnapshot(stored: SnapshotSource, live: SnapshotSource): SnapshotDiff {
  const storedByName = new Map(stored.tools.map((t) => [t.name, t]));
  const liveByName = new Map(live.tools.map((t) => [t.name, t]));
  const drifted: string[] = [];
  const missing: string[] = [];
  const added: string[] = [];
  for (const [name, storedTool] of storedByName) {
    const liveTool = liveByName.get(name);
    if (!liveTool) missing.push(name);
    else if (hashOf(storedTool) !== hashOf(liveTool)) drifted.push(name);
  }
  for (const name of liveByName.keys()) {
    if (!storedByName.has(name)) added.push(name);
  }
  return { drifted, missing, added };
}

export interface IngestLiveToolsInput {
  listing: {
    provider: string;
    fetchedAt: string;
    tools: Array<Record<string, unknown>>;
    serverInfo?: Record<string, unknown> | null | undefined;
    protocolVersion?: string | undefined;
  };
  endpoint: string;
  entitlementTag: string;
  snapshotDir: string;
  packageRoot: string;
  isCurrent?: () => boolean | undefined;
}

/** Connect/refresh success path (040 audit round 1): sanitize live tools, diff
 *  against the effective previous snapshot (local > bundled), persist locally. */
export async function ingestLiveTools(input: IngestLiveToolsInput): Promise<{ snapshot: SnapshotSource; diff: SnapshotDiff }> {
  const { loadEffectiveSnapshot, saveLocalSnapshot } = await import("./snapshotStore.js");
  const snapshot = buildSnapshotArtifact({
    provider: input.listing.provider,
    endpoint: input.endpoint,
    entitlementTag: input.entitlementTag,
    tools: input.listing.tools,
    serverInfo: input.listing.serverInfo,
    ...(input.listing.protocolVersion ? { protocolVersion: input.listing.protocolVersion } : {}),
    fetchedAt: input.listing.fetchedAt,
  });
  const previous = loadEffectiveSnapshot({
    snapshotDir: input.snapshotDir,
    packageRoot: input.packageRoot,
    provider: input.listing.provider,
  });
  const diff = previous ? diffSnapshot(previous, snapshot) : { drifted: [], missing: [], added: snapshot.tools.map((t) => t.name) };
  if (input.isCurrent && !input.isCurrent()) throw new Error("MCP_SNAPSHOT_IDENTITY_STALE");
  saveLocalSnapshot(input.snapshotDir, snapshot);
  return { snapshot, diff };
}
