// edit_video stage-1 (keyframe preview) executor (wp5b2 shape research).
// Ground truth (live capture 2026-07-20): stage-1 is SYNCHRONOUS — the
// tools/call response carries structuredContent.kind === "keyframe_preview"
// with keyframeUrl and nextArguments; no async task is created. The shared
// executeMediaPlan polling loop therefore 404s on get_task. Stage-1 also
// frequently exceeds CloudFront's 30s gateway limit (504), so we retry.
import type { McpConnectionManager } from "./connectionManager.js";
import type { MediaProviderAdapter, ToolCallPlan } from "./providerAdapter.js";

export interface EditVideoPreviewResult {
  keyframeUrl: string;
  prompt?: string | undefined;
  keyframeTimestampSeconds?: number | undefined;
  nextArguments?: Record<string, unknown> | undefined;
}

const PREVIEW_ATTEMPTS = 3;
const RETRY_BASE_MS = 4_000;

function isStreamableError(error: unknown): boolean {
  return String((error as Error)?.message ?? error).includes("Streamable HTTP error");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parse the stage-1 response: structuredContent first, text fallback. */
export function parseKeyframePreview(result: Record<string, unknown>): EditVideoPreviewResult | null {
  const structured = result.structuredContent as Record<string, unknown> | undefined;
  if (structured?.kind === "keyframe_preview" && typeof structured.keyframeUrl === "string" && structured.keyframeUrl) {
    return {
      keyframeUrl: structured.keyframeUrl,
      ...(typeof structured.prompt === "string" ? { prompt: structured.prompt } : {}),
      ...(typeof structured.keyframeTimestampSeconds === "number" ? { keyframeTimestampSeconds: structured.keyframeTimestampSeconds } : {}),
      ...(structured.nextArguments && typeof structured.nextArguments === "object"
        ? { nextArguments: structured.nextArguments as Record<string, unknown> } : {}),
    };
  }
  const content = result.content;
  if (Array.isArray(content)) {
    const text = content.map((entry) => (entry as { text?: string | undefined }).text ?? "").join("\n");
    const match = text.match(/Keyframe URL:\s*(https:\/\/\S+)/i);
    if (match?.[1]) return { keyframeUrl: match[1] };
  }
  return null;
}

export async function executeEditVideoPreview(
  manager: McpConnectionManager,
  adapter: MediaProviderAdapter,
  plan: ToolCallPlan,
  options: { signal?: AbortSignal | undefined; attempts?: number | undefined } = {},
): Promise<EditVideoPreviewResult> {
  if (!adapter.executable) throw new Error(`MCP_EXECUTION_LOCKED:${adapter.provider}`);
  const attempts = options.attempts ?? PREVIEW_ATTEMPTS;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (options.signal?.aborted) throw new Error("MCP_JOB_ABORTED");
    try {
      const raw = await manager.callTool(adapter.provider, plan.toolName, plan.args, { ...(options.signal ? { signal: options.signal } : {}), timeoutMs: 300_000 });
      const preview = parseKeyframePreview(raw);
      if (!preview) throw new Error(`MCP_PREVIEW_SHAPE_UNEXPECTED:${adapter.provider}`);
      return preview;
    } catch (error) {
      lastError = error;
      if (!isStreamableError(error) || attempt === attempts) throw error;
      await sleep(RETRY_BASE_MS * attempt);
    }
  }
  throw lastError;
}
