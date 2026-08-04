// Provider-aware composer reference-image limits. Mirrors the server's hard
// caps so users hit the boundary at attach time, not as a 400 at generate:
// - lib/generatePipeline.ts: grok/grok-api/agy/gemini-api image editing <= 3
// - routes/video.ts: grok ref2v <= MAX_REF2V_REFERENCES (7)
// - routes/mcpMedia.ts: MCP lane takes up to 3 references [{filename, tag}];
//   direct attachments ride POST /api/mcp/temp-references (batch upload into
//   generated storage), so the tray cap is 3 (composer-tray 010 A5).
// - lib/minimaxImageAdapter.ts: MiniMax takes a single subject_reference
// - gpt oauth/api: server capabilities.limits.maxRefCount (referenceLimit)
import type { Provider } from "../types";

export const GROK_FAMILY_IMAGE_REF_LIMIT = 3;
export const MINIMAX_IMAGE_REF_LIMIT = 1;
export const GROK_VIDEO_REF_LIMIT = 7;
export const MCP_REFERENCE_LIMIT = 3;

const LIMITED_IMAGE_PROVIDERS: ReadonlySet<Provider> = new Set(["grok", "grok-api", "agy", "gemini-api"]);

export function effectiveReferenceLimit(input: {
  provider: Provider;
  serverLimit: number;
  videoModelSelected: boolean;
  mcpProvider: string | null;
}): number {
  if (input.mcpProvider) return MCP_REFERENCE_LIMIT;
  if (input.videoModelSelected) return Math.min(input.serverLimit, GROK_VIDEO_REF_LIMIT);
  if (input.provider === "minimax") {
    return Math.min(input.serverLimit, MINIMAX_IMAGE_REF_LIMIT);
  }
  if (LIMITED_IMAGE_PROVIDERS.has(input.provider)) {
    return Math.min(input.serverLimit, GROK_FAMILY_IMAGE_REF_LIMIT);
  }
  return input.serverLimit;
}
