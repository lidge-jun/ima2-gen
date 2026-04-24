import type {
  BillingResponse,
  GenerateRequest,
  GenerateResponse,
  ImageModel,
  OAuthStatus,
} from "../types";

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & {
    error?: string | { code?: string; message?: string };
    currentVersion?: number;
  };
  if (!res.ok) {
    const raw = (data as { error?: string | { code?: string; message?: string }; code?: string })
      .error;
    const topCode = (data as { code?: string }).code;
    const message =
      typeof raw === "string"
        ? raw
        : raw?.message ?? `Request failed: ${res.status}`;
    const err = new Error(message) as Error & {
      status?: number;
      code?: string;
      currentVersion?: number;
    };
    err.status = res.status;
    if (typeof raw !== "string" && raw?.code) err.code = raw.code;
    else if (topCode) err.code = topCode;
    if (typeof data.currentVersion === "number") {
      err.currentVersion = data.currentVersion;
    }
    throw err;
  }
  return data;
}

export function getInflight(params?: {
  kind?: "classic" | "node";
  sessionId?: string;
  includeTerminal?: boolean;
}): Promise<{
  jobs: Array<{
    requestId: string;
    kind: string;
    prompt: string;
    startedAt: number;
    phase?: string;
    phaseAt?: number;
    meta?: Record<string, unknown>;
  }>;
  terminalJobs?: Array<{
    requestId: string;
    kind: string;
    status: "completed" | "error" | "canceled";
    startedAt: number;
    finishedAt: number;
    durationMs: number;
    phase?: string;
    phaseAt?: number;
    httpStatus?: number;
    errorCode?: string;
    meta?: Record<string, unknown>;
  }>;
}> {
  const qs = new URLSearchParams();
  if (params?.kind) qs.set("kind", params.kind);
  if (params?.sessionId) qs.set("sessionId", params.sessionId);
  if (params?.includeTerminal) qs.set("includeTerminal", "1");
  const suffix = qs.size > 0 ? `?${qs.toString()}` : "";
  return jsonFetch(`/api/inflight${suffix}`);
}

export async function cancelInflight(requestId: string): Promise<void> {
  await fetch(`/api/inflight/${encodeURIComponent(requestId)}`, {
    method: "DELETE",
  }).catch(() => {});
}

export function getOAuthStatus(): Promise<OAuthStatus> {
  return jsonFetch<OAuthStatus>("/api/oauth/status");
}

export function getBilling(): Promise<BillingResponse> {
  return jsonFetch<BillingResponse>("/api/billing");
}

export function postGenerate(payload: GenerateRequest): Promise<GenerateResponse> {
  return jsonFetch<GenerateResponse>("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function postEdit(payload: GenerateRequest): Promise<GenerateResponse> {
  return jsonFetch<GenerateResponse>("/api/edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export type HistoryItem = {
  filename: string;
  url: string;
  createdAt: number;
  prompt: string | null;
  userPrompt?: string | null;
  revisedPrompt?: string | null;
  promptMode?: "auto" | "direct" | null;
  quality: string | null;
  size: string | null;
  moderation?: string | null;
  model?: string | null;
  format: string;
  provider: string;
  usage: Record<string, unknown> | null;
  webSearchCalls: number;
  sessionId?: string | null;
  nodeId?: string | null;
  parentNodeId?: string | null;
  clientNodeId?: string | null;
  requestId?: string | null;
  kind?: string | null;
  refsCount?: number;
};

export type HistoryCursor = { before: number; beforeFilename: string };

export type HistoryPage = {
  items: HistoryItem[];
  total: number;
  nextCursor: HistoryCursor | null;
};

export type HistorySessionGroup = {
  sessionId: string;
  title?: string | null;
  label?: string | null;
  items: HistoryItem[];
  lastUsedAt: number;
};

export type HistoryGroupedPage = {
  sessions: HistorySessionGroup[];
  loose: HistoryItem[];
  total: number;
  nextCursor: HistoryCursor | null;
};

export function getHistory(
  params: { limit?: number; since?: number; cursor?: HistoryCursor; sessionId?: string } = {},
): Promise<HistoryPage> {
  const qs = new URLSearchParams();
  qs.set("limit", String(params.limit ?? 50));
  if (params.since != null) qs.set("since", String(params.since));
  if (params.cursor) {
    qs.set("before", String(params.cursor.before));
    qs.set("beforeFilename", params.cursor.beforeFilename);
  }
  if (params.sessionId) qs.set("sessionId", params.sessionId);
  return jsonFetch(`/api/history?${qs.toString()}`);
}

export function getHistoryGrouped(
  params: { limit?: number; cursor?: HistoryCursor } = {},
): Promise<HistoryGroupedPage> {
  const qs = new URLSearchParams();
  qs.set("groupBy", "session");
  qs.set("limit", String(params.limit ?? 200));
  if (params.cursor) {
    qs.set("before", String(params.cursor.before));
    qs.set("beforeFilename", params.cursor.beforeFilename);
  }
  return jsonFetch(`/api/history?${qs.toString()}`);
}

export function deleteHistoryItem(filename: string): Promise<{
  ok: boolean;
  trashId: string;
  filename: string;
  unlinkAt: number;
  sessionsTouched: number;
  nodesTouched: number;
}> {
  return jsonFetch(`/api/history/${encodeURIComponent(filename)}`, { method: "DELETE" });
}

export function restoreHistoryItem(filename: string, trashId: string): Promise<{ ok: boolean }> {
  return jsonFetch(`/api/history/${encodeURIComponent(filename)}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trashId }),
  });
}

export type NodeGenerateRequest = {
  parentNodeId: string | null;
  prompt: string;
  quality: string;
  size: string;
  format: string;
  moderation: "low" | "auto";
  model?: ImageModel;
  provider?: "oauth";
  mode?: "auto" | "direct";
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
  provider: "oauth";
  moderation?: string;
  model?: string | null;
  refsCount?: number;
  revisedPrompt?: string | null;
  promptMode?: "auto" | "direct";
};

export type NodeErrorResponse = {
  error: { code: string; message: string };
  parentNodeId: string | null;
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
    const e = new Error(msg) as Error & { code?: string };
    e.code = err?.error?.code;
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
      const e = new Error(msg) as Error & { code?: string };
      e.code = err?.error?.code;
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
          const e = new Error(msg) as Error & { code?: string };
          e.code = err?.error?.code;
          throw e;
        }
      }
      boundary = buffer.indexOf("\n\n");
    }
  }

  if (!finalPayload) {
    throw new Error("Node stream ended without a final image");
  }
  return finalPayload;
}

// ── Sessions (0.06) ──
export type SessionSummary = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  graphVersion: number;
  nodeCount: number;
};

export type SessionGraphNode = {
  id: string;
  x: number;
  y: number;
  data: Record<string, unknown>;
};
export type SessionGraphEdge = {
  id: string;
  source: string;
  target: string;
  data: Record<string, unknown>;
};
export type SessionFull = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  graphVersion: number;
  nodes: SessionGraphNode[];
  edges: SessionGraphEdge[];
};

export type GraphSaveMeta = {
  saveId?: string;
  saveReason?: string;
  tabId?: string;
};

export function listSessions(): Promise<{ sessions: SessionSummary[] }> {
  return jsonFetch("/api/sessions");
}
export function createSession(title: string): Promise<{ session: SessionSummary }> {
  return jsonFetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}
export function getSession(id: string): Promise<{ session: SessionFull }> {
  return jsonFetch(`/api/sessions/${encodeURIComponent(id)}`);
}
export function renameSession(id: string, title: string): Promise<{ ok: boolean }> {
  return jsonFetch(`/api/sessions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}
export function deleteSession(id: string): Promise<{ ok: boolean }> {
  return jsonFetch(`/api/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
}
export function saveSessionGraph(
  id: string,
  graphVersion: number,
  nodes: SessionGraphNode[],
  edges: SessionGraphEdge[],
  meta: GraphSaveMeta = {},
): Promise<{ ok: boolean; nodes: number; edges: number; graphVersion: number }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "If-Match": String(graphVersion),
  };
  if (meta.saveId) headers["X-Ima2-Graph-Save-Id"] = meta.saveId;
  if (meta.saveReason) headers["X-Ima2-Graph-Save-Reason"] = meta.saveReason;
  if (meta.tabId) headers["X-Ima2-Tab-Id"] = meta.tabId;
  return jsonFetch(`/api/sessions/${encodeURIComponent(id)}/graph`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ nodes, edges }),
  });
}

// ── Style sheet (0.10) ────────────────────────────────────────────────────
export type StyleSheet = {
  palette: string[];
  composition: string;
  mood: string;
  medium: string;
  subject_details: string;
  negative: string[];
};
export type StyleSheetResponse = {
  styleSheet: StyleSheet | null;
  enabled: boolean;
};
export function getSessionStyleSheet(id: string): Promise<StyleSheetResponse> {
  return jsonFetch(`/api/sessions/${encodeURIComponent(id)}/style-sheet`);
}
export function saveSessionStyleSheet(
  id: string,
  styleSheet: StyleSheet | null,
  enabled?: boolean,
): Promise<{ ok: boolean }> {
  return jsonFetch(`/api/sessions/${encodeURIComponent(id)}/style-sheet`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ styleSheet, enabled }),
  });
}
export function setSessionStyleSheetEnabled(
  id: string,
  enabled: boolean,
): Promise<{ ok: boolean; enabled: boolean }> {
  return jsonFetch(`/api/sessions/${encodeURIComponent(id)}/style-sheet/enabled`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
}
export function extractSessionStyleSheet(
  id: string,
  prompt: string,
  referenceDataUrl?: string,
): Promise<{ styleSheet: StyleSheet }> {
  return jsonFetch(`/api/sessions/${encodeURIComponent(id)}/style-sheet/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, referenceDataUrl }),
  });
}
