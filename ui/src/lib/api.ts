import type {
  BillingResponse,
  EmbeddedGenerationMetadata,
  GenerateItem,
  GenerateRequest,
  MultimodeGenerateRequest,
  MultimodeGenerateResponse,
  GenerateResponse,
  OAuthStatus,
} from "../types";
import type { SavedCanvasAnnotations } from "../types/canvas";

export {
  postNodeGenerate,
  postNodeGenerateStream,
  type NodeErrorResponse,
  type NodeGenerateRequest,
  type NodeGenerateResponse,
} from "./nodeApi";

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

function parseSseBlock(block: string): { event: string | null; data: unknown } | null {
  let event: string | null = null;
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return null;
  const raw = dataLines.join("\n");
  if (!raw || raw === "[DONE]") return null;
  return { event, data: JSON.parse(raw) as unknown };
}

export async function postMultimodeGenerateStream(
  payload: MultimodeGenerateRequest,
  handlers: {
    onPartial?: (partial: { image: string; requestId?: string | null; sequenceId?: string | null; index?: number | null }) => void;
    onImage?: (image: GenerateItem) => void;
    onPhase?: (phase: { phase?: string; requestId?: string | null; sequenceId?: string | null; maxImages?: number }) => void;
  } = {},
  options: { signal?: AbortSignal } = {},
): Promise<MultimodeGenerateResponse> {
  const res = await fetch("/api/generate/multimode", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = data as { error?: string; code?: string; status?: number };
      const e = new Error(err.error ?? `Request failed: ${res.status}`) as Error & { code?: string; status?: number };
      e.code = err.code;
      e.status = err.status ?? res.status;
      throw e;
    }
    return data as MultimodeGenerateResponse;
  }

  if (!res.ok || !res.body) {
    throw new Error(`Request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalPayload: MultimodeGenerateResponse | null = null;

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
          handlers.onPartial?.(parsed.data as { image: string; requestId?: string | null; sequenceId?: string | null; index?: number | null });
        } else if (parsed.event === "image") {
          handlers.onImage?.(parsed.data as GenerateItem);
        } else if (parsed.event === "phase") {
          handlers.onPhase?.(parsed.data as { phase?: string; requestId?: string | null; sequenceId?: string | null; maxImages?: number });
        } else if (parsed.event === "done") {
          finalPayload = parsed.data as MultimodeGenerateResponse;
        } else if (parsed.event === "error") {
          const err = parsed.data as { error?: string; code?: string; status?: number };
          const e = new Error(err.error ?? "Multimode generation failed") as Error & { code?: string; status?: number };
          e.code = err.code;
          e.status = err.status;
          throw e;
        }
      }
      boundary = buffer.indexOf("\n\n");
    }
  }

  if (!finalPayload) {
    const e = new Error("No image data returned from the multimode stream") as Error & { code?: string; status?: number };
    e.code = "EMPTY_RESPONSE";
    e.status = 422;
    throw e;
  }
  return finalPayload;
}

export function postEdit(payload: GenerateRequest & { mask?: string }): Promise<GenerateResponse> {
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
  canvasVersion?: boolean;
  canvasSourceFilename?: string | null;
  canvasEditableFilename?: string | null;
  canvasMergedAt?: number | null;
  setId?: string | null;
  cardId?: string | null;
  cardOrder?: number | null;
  headline?: string | null;
  body?: string | null;
  cards?: Array<{
    url?: string;
    headline?: string;
    body?: string;
    cardOrder?: number;
    imageFilename?: string;
    status?: string;
  }>;
  refsCount?: number;
  isFavorite?: boolean;
  sequenceId?: string | null;
  sequenceIndex?: number | null;
  sequenceTotalRequested?: number | null;
  sequenceTotalReturned?: number | null;
  sequenceStatus?: "complete" | "partial" | "empty" | null;
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

export type StorageStatusState = "ok" | "recoverable" | "not_found" | "unknown";

export type StorageStatus = {
  generatedDirLabel: string;
  generatedCount: number;
  legacyCandidatesScanned: number;
  legacySourcesFound: number;
  legacyFilesFound: number;
  state: StorageStatusState;
  messageKind: StorageStatusState | "apology";
  recoveryDocsPath: string;
  doctorCommand: string;
  overrides: {
    generatedDir: boolean;
    configDir: boolean;
  };
};

let _browserId: string | null = null;
export function getBrowserId(): string {
  if (!_browserId) {
    const raw = localStorage.getItem("ima2.browserId");
    if (raw) _browserId = raw;
    else {
      _browserId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem("ima2.browserId", _browserId);
    }
  }
  return _browserId;
}

function jsonFetchWithBrowserId<T>(url: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
    "X-Ima2-Browser-Id": getBrowserId(),
  };
  return jsonFetch<T>(url, { ...init, headers });
}

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
  return jsonFetchWithBrowserId(`/api/history?${qs.toString()}`);
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
  return jsonFetchWithBrowserId(`/api/history?${qs.toString()}`);
}

export function toggleGalleryFavorite(filename: string): Promise<{ isFavorite: boolean }> {
  return jsonFetchWithBrowserId<{ isFavorite: boolean }>("/api/history/favorite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename }),
  });
}

export async function getStorageStatus(): Promise<StorageStatus> {
  const res = await jsonFetch<{ ok: boolean; data: StorageStatus }>("/api/storage/status");
  return res.data;
}

export function openGeneratedDir(): Promise<{ ok: boolean }> {
  return jsonFetch<{ ok: boolean }>("/api/storage/open-generated-dir", {
    method: "POST",
  });
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

export function permanentlyDeleteHistoryItem(filename: string): Promise<{
  ok: boolean;
  filename: string;
  sessionsTouched: number;
  nodesTouched: number;
}> {
  return jsonFetch(`/api/history/${encodeURIComponent(filename)}/permanent`, {
    method: "DELETE",
  });
}

export function restoreHistoryItem(filename: string, trashId: string): Promise<{ ok: boolean }> {
  return jsonFetch(`/api/history/${encodeURIComponent(filename)}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trashId }),
  });
}

export type ComfyExportResponse = {
  ok: true;
  sourceFilename: string;
  uploadedFilename: string;
};

export function exportImageToComfy(input: { filename: string }): Promise<ComfyExportResponse> {
  return jsonFetch<ComfyExportResponse>("/api/comfy/export-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: input.filename }),
  });
}

export type ImageMetadataReadResponse = {
  ok: boolean;
  metadata: EmbeddedGenerationMetadata | null;
  source: "xmp" | "png-comment" | null;
  warnings?: string[];
  code?: string;
  error?: string;
};

export function readImageMetadata(input: {
  filename: string;
  dataUrl: string;
}): Promise<ImageMetadataReadResponse> {
  return jsonFetch("/api/metadata/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function fetchCanvasAnnotations(filename: string): Promise<{
  annotations: SavedCanvasAnnotations | null;
}> {
  return jsonFetchWithBrowserId(`/api/annotations/${encodeURIComponent(filename)}`);
}

export async function saveCanvasAnnotations(
  filename: string,
  payload: SavedCanvasAnnotations,
): Promise<void> {
  await jsonFetchWithBrowserId(`/api/annotations/${encodeURIComponent(filename)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ annotations: payload }),
  });
}

export async function deleteCanvasAnnotations(filename: string): Promise<void> {
  await jsonFetchWithBrowserId(`/api/annotations/${encodeURIComponent(filename)}`, {
    method: "DELETE",
  });
}

export function createCanvasVersion(payload: {
  sourceFilename: string;
  image: Blob;
  prompt?: string | null;
}): Promise<{ item: GenerateItem }> {
  const qs = new URLSearchParams({ sourceFilename: payload.sourceFilename });
  return jsonFetch(`/api/canvas-versions?${qs.toString()}`, {
    method: "POST",
    headers: {
      "Content-Type": "image/png",
    },
    body: payload.image,
  });
}

export function updateCanvasVersion(
  filename: string,
  payload: {
    image: Blob;
    sourceFilename?: string | null;
    prompt?: string | null;
  },
): Promise<{ item: GenerateItem }> {
  const qs = new URLSearchParams();
  if (payload.sourceFilename) qs.set("sourceFilename", payload.sourceFilename);
  const suffix = qs.size > 0 ? `?${qs.toString()}` : "";
  return jsonFetch(`/api/canvas-versions/${encodeURIComponent(filename)}${suffix}`, {
    method: "PUT",
    headers: {
      "Content-Type": "image/png",
    },
    body: payload.image,
  });
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

// ── Prompt Library (0.23) ─────────────────────────────────────────────────

export type PromptFolder = {
  id: string;
  parentId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

export type PromptItem = {
  id: string;
  folderId: string;
  name: string;
  text: string;
  tags: string[];
  mode: "auto" | "direct" | null;
  isFavorite: boolean;
  favoritedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type PromptLibraryPage = {
  prompts: PromptItem[];
  folders: PromptFolder[];
};

export type PromptImportCandidate = {
  id: string;
  name: string;
  text: string;
  tags: string[];
  warnings?: string[];
  source?: {
    kind?: "local" | "github";
    owner?: string;
    repo?: string;
    ref?: string;
    path?: string;
    htmlUrl?: string;
    filename?: string;
    sourceId?: string;
  };
};

export type PromptGitHubFolderSource = {
  kind: "github-folder";
  owner?: string;
  repo?: string;
  ref?: string;
  path?: string;
  htmlUrl?: string;
  apiUrl?: string;
  tags?: string[];
};

export type PromptGitHubFolderFile = {
  name: string;
  path: string;
  extension: string;
  sizeBytes: number;
  htmlUrl: string;
  selected?: boolean;
  warnings?: string[];
};

export type PromptImportFolderFilesResponse = {
  source: PromptGitHubFolderSource;
  files: PromptGitHubFolderFile[];
  warnings: string[];
};

export type PromptImportFolderPreviewResponse = {
  source: PromptGitHubFolderSource;
  files: PromptGitHubFolderFile[];
  candidates: PromptImportCandidate[];
  warnings: string[];
};

export type PromptCuratedSource = {
  id: string;
  repo: string;
  owner?: string;
  name?: string;
  displayName: string;
  defaultRef: string;
  allowedPaths: string[];
  extensions: string[];
  sourceType: string;
  licenseSpdx: string;
  requiresAttribution: boolean;
  trustTier: string;
  lastVerifiedAt: string | null;
  notes: string;
  searchSeeds: string[];
  defaultSearch: boolean;
};

export type PromptIndexedCandidate = PromptImportCandidate & {
  candidateId?: string;
  textPreview?: string;
  headingPath?: string | null;
  ordinal?: number;
  promptHash?: string;
  sourceFileId?: string;
  score?: number;
  scoreHints?: {
    modelHints?: string[];
    generationSurfaceHints?: string[];
    taskHints?: string[];
    sizeHints?: string[];
    qualityHints?: string[];
    warnings?: string[];
  };
};

export type PromptImportPreview = {
  source: {
    kind: "local" | "github";
    owner?: string;
    repo?: string;
    ref?: string;
    path?: string;
    filename?: string;
    htmlUrl?: string;
    tags?: string[];
  };
  candidates: PromptImportCandidate[];
  warnings: string[];
};

export function getPromptLibrary(params?: {
  search?: string;
  folderId?: string;
  favoritesOnly?: boolean;
}): Promise<PromptLibraryPage> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.folderId) qs.set("folderId", params.folderId);
  if (params?.favoritesOnly) qs.set("favoritesOnly", "1");
  return jsonFetch(`/api/prompts?${qs.toString()}`);
}

export function createPrompt(payload: {
  name?: string;
  text: string;
  tags?: string[];
  folderId?: string;
  mode?: "auto" | "direct";
}): Promise<{ prompt: PromptItem }> {
  return jsonFetch("/api/prompts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function updatePrompt(
  id: string,
  payload: Partial<{
    name: string;
    text: string;
    tags: string[];
    folderId: string;
    mode: "auto" | "direct";
  }>,
): Promise<{ prompt: PromptItem }> {
  return jsonFetch(`/api/prompts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function deletePrompt(id: string): Promise<{ ok: boolean }> {
  return jsonFetch(`/api/prompts/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function togglePromptFavorite(id: string): Promise<{ isFavorite: boolean; favoritedAt: number | null }> {
  return jsonFetch(`/api/prompts/${encodeURIComponent(id)}/favorite`, { method: "POST" });
}

export function importPromptLibrary(payload: {
  version?: number;
  folders?: Array<{ id?: string; name: string; parentId?: string }>;
  prompts?: Array<{
    id?: string;
    name: string;
    text: string;
    tags?: string[];
    folderId?: string;
    mode?: "auto" | "direct";
    isFavorite?: boolean;
  }>;
}): Promise<{ foldersCreated: number; promptsImported: number; duplicatesSkipped: number }> {
  return jsonFetch("/api/prompts/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function previewPromptImport(payload: {
  source:
    | { kind: "local"; filename: string; text: string }
    | { kind: "github"; input: string };
}): Promise<PromptImportPreview> {
  return jsonFetch("/api/prompts/import/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function commitPromptImport(payload: {
  candidates: PromptImportCandidate[];
  folderId?: string;
}): Promise<{ foldersCreated: number; promptsImported: number; duplicatesSkipped: number }> {
  return jsonFetch("/api/prompts/import/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function getPromptImportCuratedSources(): Promise<{ sources: PromptCuratedSource[] }> {
  return jsonFetch("/api/prompts/import/curated-sources");
}

export function searchPromptImportCurated(payload: {
  q?: string;
  sourceIds?: string[];
  limit?: number;
}): Promise<{ results: PromptIndexedCandidate[]; sources: PromptCuratedSource[]; warnings: string[] }> {
  return jsonFetch("/api/prompts/import/curated-search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function refreshPromptImportCuratedSource(payload: {
  sourceId: string;
}): Promise<{ source: PromptCuratedSource | null; indexedFiles: number; candidateCount: number; warnings: string[] }> {
  return jsonFetch("/api/prompts/import/curated-refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function listPromptImportFolderFiles(payload: {
  source: { kind: "github-folder"; input: string };
}): Promise<PromptImportFolderFilesResponse> {
  return jsonFetch("/api/prompts/import/folder-files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: { kind: "github-folder", input: payload.source.input },
    }),
  });
}

export function previewPromptImportFolderFiles(payload: {
  source: { kind: "github-folder"; input: string };
  paths: string[];
}): Promise<PromptImportFolderPreviewResponse> {
  return jsonFetch("/api/prompts/import/folder-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: { kind: "github-folder", input: payload.source.input },
      paths: payload.paths,
    }),
  });
}

export function exportPromptLibrary(): Promise<{
  version: number;
  exportedAt: string;
  folders: Array<{ id: string; name: string; parentId: string }>;
  prompts: Array<{
    id: string;
    name: string;
    text: string;
    tags: string[];
    folderId: string;
    mode: string | null;
    isFavorite: boolean;
  }>;
}> {
  return jsonFetch("/api/prompts/export");
}

export function getPromptFolders(): Promise<{ folders: PromptFolder[] }> {
  return jsonFetch("/api/prompts/folders");
}

export function createPromptFolder(payload: { name: string; parentId?: string }): Promise<{ folder: PromptFolder }> {
  return jsonFetch("/api/prompts/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function updatePromptFolder(
  id: string,
  payload: { name?: string; parentId?: string },
): Promise<{ folder: PromptFolder }> {
  return jsonFetch(`/api/prompts/folders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function deletePromptFolder(id: string, strategy?: "moveToRoot" | "deleteItems"): Promise<{ ok: boolean }> {
  const qs = strategy ? `?strategy=${strategy}` : "";
  return jsonFetch(`/api/prompts/folders/${encodeURIComponent(id)}${qs}`, { method: "DELETE" });
}

export async function importLocalImage(file: File): Promise<GenerateItem> {
  const buffer = await file.arrayBuffer();
  const res = await fetch("/api/history/import-local", {
    method: "POST",
    headers: {
      "Content-Type": file.type || "image/png",
      "X-Ima2-Original-Filename": encodeURIComponent(file.name),
    },
    body: buffer,
  });
  if (!res.ok) {
    let detail: { error?: string; code?: string } = {};
    try {
      detail = await res.json();
    } catch {
      /* ignore */
    }
    const err = new Error(detail.error || `Import failed (${res.status})`);
    (err as Error & { code?: string }).code = detail.code || "IMPORT_FAILED";
    throw err;
  }
  const json = (await res.json()) as { item: GenerateItem };
  return json.item;
}
