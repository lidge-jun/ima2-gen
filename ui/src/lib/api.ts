import type {
  BillingResponse,
  GenerateRequest,
  GenerateResponse,
  GenerationLogItem,
  OAuthStatus,
} from "../types";

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & {
    error?: string | { code?: string; message?: string };
    currentVersion?: number;
    attempts?: unknown;
  };
  if (!res.ok) {
    const raw = (data as { error?: string | { code?: string; message?: string } })
      .error;
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
    // Some routes return { error: "...", code: "USAGE_LIMIT" } as flat fields
    // alongside a string error. Pick that up too so callers can branch on
    // err.code without parsing the message.
    if (!err.code) {
      const flatCode = (data as { code?: unknown }).code;
      if (typeof flatCode === "string") err.code = flatCode;
    }
    if (typeof data.currentVersion === "number") {
      err.currentVersion = data.currentVersion;
    }
    console.warn(
      `[ima2][api] ${init?.method ?? "GET"} ${url} failed: status=${res.status} ` +
      `code=${err.code ?? "?"} msg=${message}`,
      Array.isArray(data.attempts) ? { attempts: data.attempts } : undefined,
    );
    throw err;
  }
  return data;
}

export type InflightJob = {
  requestId: string;
  kind: string;
  prompt: string;
  startedAt: number;
  phase?: string;
  phaseAt?: number;
  attempt?: number;
  maxAttempts?: number;
  meta?: Record<string, unknown>;
};

export function getInflight(params?: {
  kind?: "classic" | "node";
  sessionId?: string;
}): Promise<{ jobs: InflightJob[] }> {
  const qs = new URLSearchParams();
  if (params?.kind) qs.set("kind", params.kind);
  if (params?.sessionId) qs.set("sessionId", params.sessionId);
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
  originalPrompt?: string | null;
  quality: string | null;
  size: string | null;
  moderation?: string | null;
  format: string;
  provider: string;
  usage: Record<string, unknown> | null;
  webSearchCalls: number;
  sessionId?: string | null;
  nodeId?: string | null;
  parentNodeId?: string | null;
  clientNodeId?: string | null;
  kind?: string | null;
  favorite?: boolean;
  /** echoes the requestId that produced this image, when known. Lets the
   *  client reconcile a pending in-flight entry after a refresh by matching
   *  history rows against `inFlight[].id`. */
  requestId?: string | null;
};

export type HistoryCursor = { before: number; beforeFilename: string };

export type HistoryPage = {
  items: HistoryItem[];
  total: number;
  nextCursor: HistoryCursor | null;
};

export type HistorySessionGroup = {
  sessionId: string;
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

export async function setFavorite(filename: string, value: boolean): Promise<{ filename: string; favorite: boolean }> {
  const res = await fetch(
    `/api/history/${encodeURIComponent(filename)}/favorite`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `setFavorite failed: ${res.status}`);
  }
  return res.json();
}

export type NodeGenerateRequest = {
  parentNodeId: string | null;
  prompt: string;
  quality: string;
  size: string;
  format: string;
  moderation: "low" | "auto";
  provider?: "oauth";
  references?: string[];
  requestId?: string;
  sessionId?: string | null;
  clientNodeId?: string | null;
  maxAttempts?: number;
  originalPrompt?: string;
};

export type NodeGenerateResponse = {
  nodeId: string;
  parentNodeId: string | null;
  image: string;
  filename: string;
  url: string;
  elapsed: number;
  usage?: { total_tokens?: number } & Record<string, unknown>;
  webSearchCalls: number;
  provider: "oauth";
  moderation?: string;
  // Echoed by /api/node/generate so the UI can preserve the preview aspect
  // ratio without re-deriving from the node sidecar.
  size?: string | null;
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
export type GraphSaveMeta = {
  saveId?: string;
  saveReason?: string;
  tabId?: string;
};

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

export function getGenerationLog(
  params: { limit?: number; status?: "success" | "failed" } = {},
): Promise<{ items: GenerationLogItem[]; total: number }> {
  const qs = new URLSearchParams();
  qs.set("limit", String(params.limit ?? 100));
  if (params.status) qs.set("status", params.status);
  return jsonFetch(`/api/generation-log?${qs.toString()}`);
}

export function deleteFailedLogItem(id: string): Promise<{ ok: boolean; id: string }> {
  const clean = id.replace(/^failed\//, "");
  return jsonFetch(`/api/generation-log/failed/${encodeURIComponent(clean)}`, {
    method: "DELETE",
  });
}

export async function enhancePrompt(
  prompt: string,
  language: "ko" | "en" = "ko",
  references: string[] = [],
): Promise<{ prompt: string }> {
  const payload: Record<string, unknown> = { prompt, language };
  if (references.length > 0) payload.references = references;
  const res = await fetch("/api/enhance-prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `enhancePrompt failed: ${res.status}`);
  }
  return res.json();
}
