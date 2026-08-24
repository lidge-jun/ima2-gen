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
import { PROVIDER_REFERENCE_LIMITS } from "../generated/providers";

export const GROK_FAMILY_IMAGE_REF_LIMIT = PROVIDER_REFERENCE_LIMITS.grok.image;
export const MINIMAX_IMAGE_REF_LIMIT = PROVIDER_REFERENCE_LIMITS.minimax.image;
export const GROK_VIDEO_REF_LIMIT = PROVIDER_REFERENCE_LIMITS.grok.video;
export const MCP_REFERENCE_LIMIT = 3;

type LaneLimits = { readonly image?: number; readonly edit?: number; readonly video?: number };

// Every lane cap comes from the manifest by lookup, not by matching Grok's
// number. Value-matching silently dropped Atlas (10), so the tray allowed more
// references than lib/generatePipeline.ts accepts whenever serverLimit > 10.
function laneLimit(provider: Provider, mode: "image" | "video"): number | undefined {
  const limits = (PROVIDER_REFERENCE_LIMITS as Record<string, LaneLimits | undefined>)[provider];
  return limits?.[mode];
}

/**
 * Lanes that accept no reference input at all.
 *
 * NOT derivable from an empty `referenceLimits`: oauth and api are also empty
 * there, but they legitimately defer to the server's `maxRefCount`. An empty
 * manifest entry means "no lane-specific cap", which is a different statement
 * from "no references accepted". Deriving the set would silently drop
 * references for the two biggest lanes.
 *
 * nai is here because lib/generatePipeline.ts answers NAI_REF_UNSUPPORTED and
 * routes/edit.ts answers NAI_EDIT_UNSUPPORTED for any attachment.
 */
const LANES_WITHOUT_REFERENCE_SUPPORT: ReadonlySet<string> = new Set(["nai"]);

export function effectiveReferenceLimit(input: {
  provider: Provider;
  serverLimit: number;
  videoModelSelected: boolean;
  mcpProvider: string | null;
}): number {
  if (input.mcpProvider) return MCP_REFERENCE_LIMIT;
  if (input.videoModelSelected) return Math.min(input.serverLimit, GROK_VIDEO_REF_LIMIT);
  // A lane that declares no image capacity accepts none. Without this, an
  // empty referenceLimits entry falls through to the server limit and the tray
  // would invite attachments the route answers with NAI_REF_UNSUPPORTED.
  if (LANES_WITHOUT_REFERENCE_SUPPORT.has(input.provider)) return 0;
  const lane = laneLimit(input.provider, "image");
  return lane === undefined ? input.serverLimit : Math.min(input.serverLimit, lane);
}
