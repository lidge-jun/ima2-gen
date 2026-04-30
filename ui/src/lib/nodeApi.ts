import type { ImageModel, Provider } from "../types";

export type NodeGenerateRequest = {
  parentNodeId: string | null;
  prompt: string;
  quality: string;
  size: string;
  format: string;
  moderation: "low" | "auto";
  model?: ImageModel;
  reasoningEffort?: "none" | "low" | "medium" | "high" | "xhigh";
  provider?: Provider;
  mode?: "auto" | "direct";
  contextMode?: "parent-plus-refs" | "parent-only" | "ancestry";
  searchMode?: "off" | "auto" | "on";
  webSearchEnabled?: boolean;
  references?: string[];
  requestId?: string;
  sessionId?: string | null;
  clientNodeId?: string | null;
};

export type NodeGenerateResponse = {
  nodeId: string;
  parentNodeId: string | null;
  requestId?: string | null;
  image: string;
  filename: string;
  url: string;
  elapsed: number;
  usage?: { total_tokens?: number } & Record<string, unknown>;
  webSearchCalls: number;
  provider: Provider;
  moderation?: string;
  model?: string | null;
  size?: string | null;
  refsCount?: number;
  contextMode?: "parent-plus-refs" | "parent-only" | "ancestry";
  searchMode?: "off" | "auto" | "on";
  revisedPrompt?: string | null;
  promptMode?: "auto" | "direct";
};

export type NodeErrorResponse = {
  error: { code: string; message: string };
  parentNodeId: string | null;
  status?: number;
};

export async function postNodeGenerate(payload: NodeGenerateRequest): Promise<NodeGenerateResponse> {
  const res = await fetch("/api/node/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as NodeErrorResponse;
    const msg = err?.error?.message ?? `Request failed: ${res.status}`;
    const e = new Error(msg) as Error & { code?: string; status?: number };
    e.code = err?.error?.code;
    e.status = err?.status ?? res.status;
    throw e;
  }
  return data as NodeGenerateResponse;
}

function parseSseBlock(block: string): { event: string; data: unknown } | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return null;
  const raw = dataLines.join("\n");
  if (!raw || raw === "[DONE]") return null;
  return { event, data: JSON.parse(raw) };
}

export async function postNodeGenerateStream(
  payload: NodeGenerateRequest,
  handlers: {
    onPartial?: (partial: { image: string; requestId?: string | null; index?: number | null }) => void;
    onPhase?: (phase: { phase?: string; requestId?: string | null }) => void;
  } = {},
): Promise<NodeGenerateResponse> {
  const res = await fetch("/api/node/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(payload),
  });

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = data as NodeErrorResponse;
      const msg = err?.error?.message ?? `Request failed: ${res.status}`;
      const e = new Error(msg) as Error & { code?: string; status?: number };
      e.code = err?.error?.code;
      e.status = err?.status ?? res.status;
      throw e;
    }
    return data as NodeGenerateResponse;
  }

  if (!res.ok || !res.body) {
    throw new Error(`Request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalPayload: NodeGenerateResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const parsed = parseSseBlock(block);
      if (parsed) {
        if (parsed.event === "partial") {
          handlers.onPartial?.(parsed.data as { image: string; requestId?: string | null; index?: number | null });
        } else if (parsed.event === "phase") {
          handlers.onPhase?.(parsed.data as { phase?: string; requestId?: string | null });
        } else if (parsed.event === "done") {
          finalPayload = parsed.data as NodeGenerateResponse;
        } else if (parsed.event === "error") {
          const err = parsed.data as NodeErrorResponse;
          const msg = err?.error?.message ?? "Node generation failed";
          const e = new Error(msg) as Error & { code?: string; status?: number };
          e.code = err?.error?.code;
          e.status = err?.status;
          throw e;
        }
      }
      boundary = buffer.indexOf("\n\n");
    }
  }

  if (!finalPayload) {
    const e = new Error("No image data returned from the node stream") as Error & { code?: string; status?: number };
    e.code = "EMPTY_RESPONSE";
    e.status = 422;
    throw e;
  }
  return finalPayload;
}
