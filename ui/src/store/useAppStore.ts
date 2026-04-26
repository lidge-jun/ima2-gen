import { create } from "zustand";
import type {
  Count,
  Format,
  GenerateItem,
  GenerateResponse,
  Moderation,
  Provider,
  Quality,
  SizePreset,
  UIMode,
} from "../types";
import { isMultiResponse } from "../types";
import {
  postGenerate,
  getHistory,
  getInflight,
  cancelInflight,
  postNodeGenerate,
  setFavorite,
  listSessions as apiListSessions,
  createSession as apiCreateSession,
  getSession as apiGetSession,
  renameSession as apiRenameSession,
  deleteSession as apiDeleteSession,
  saveSessionGraph,
  type SessionSummary,
  type SessionFull,
  type HistoryItem,
  type InflightJob,
} from "../lib/api";
import { compressImage } from "../lib/image";
import { snap16 } from "../lib/size";
import { newClientNodeId, type ClientNodeId } from "../lib/graph";
import { getNextRootPosition, getNextChildPosition } from "../lib/nodeLayout";
import type { PresetPayload } from "../lib/presets";
import type { Node as FlowNode, Edge as FlowEdge } from "@xyflow/react";

function loadRightPanelOpen(): boolean {
  try {
    const raw = localStorage.getItem("ima2.rightPanelOpen");
    if (raw === null) return true;
    return JSON.parse(raw) === true;
  } catch {
    return true;
  }
}

function loadUIMode(): UIMode {
  try {
    const raw = localStorage.getItem("ima2.uiMode");
    if (raw === "node" || raw === "classic") return raw;
  } catch {}
  return "classic";
}

function clampMaxAttempts(n: number): number {
  if (!Number.isFinite(n)) return 3;
  const i = Math.floor(n);
  if (i < 1) return 1;
  if (i > 10) return 10;
  return i;
}

function loadMaxAttempts(): number {
  try {
    const raw = localStorage.getItem("ima2.maxAttempts");
    if (raw == null) return 3;
    const n = Number(JSON.parse(raw));
    return clampMaxAttempts(n);
  } catch {
    return 3;
  }
}

function saveMaxAttempts(n: number): void {
  try {
    localStorage.setItem("ima2.maxAttempts", JSON.stringify(clampMaxAttempts(n)));
  } catch {}
}


// Activity log entry: in-flight items used to be ephemeral, but the user wants
// them to persist after success/failure with color cues + retry. We keep the
// localStorage key `ima2.inFlight` for backwards compatibility with older
// browser tabs, but the shape now carries terminal state too.
export type ActivityStatus = "running" | "success" | "error";

export type ActivityRetryPayload = {
  kind: "classic" | "node";
  prompt: string;
  // classic-only:
  count?: number;
  // node-only:
  clientNodeId?: ClientNodeId;
};

export type PersistedInFlight = {
  id: string;
  prompt: string;
  startedAt: number;
  phase?: string;
  status?: ActivityStatus;
  attempt?: number;
  maxAttempts?: number;
  endedAt?: number;
  elapsedMs?: number;
  errorMessage?: string;
  retry?: ActivityRetryPayload;
  // For success entries: history filename so clicking the activity item
  // can switch the main view (classic) or focus the node (node mode).
  filename?: string;
  // Recovery metadata — used after refresh to re-scope polling and rebuild
  // node parent links. Server stores these in `meta` (see lib/inflight.js)
  // and the SQLite-backed registry preserves them across restart.
  kind?: "classic" | "node";
  sessionId?: string | null;
  parentNodeId?: string | null;
  clientNodeId?: ClientNodeId;
};

const INFLIGHT_TTL_MS = 180_000;            // running TTL (legacy guard against stuck items)
const ACTIVITY_SUCCESS_TTL_MS = 10 * 60_000; // 10 min
const ACTIVITY_ERROR_TTL_MS = 24 * 60 * 60_000; // 24 h
const ACTIVITY_MAX_ENTRIES = 50;

function activityTtlMs(item: PersistedInFlight): number {
  switch (item.status) {
    case "success": return ACTIVITY_SUCCESS_TTL_MS;
    case "error": return ACTIVITY_ERROR_TTL_MS;
    default: return INFLIGHT_TTL_MS;
  }
}

function isExpired(item: PersistedInFlight, now: number): boolean {
  const stamp = item.endedAt ?? item.startedAt;
  return now - stamp > activityTtlMs(item);
}

function loadInFlight(): PersistedInFlight[] {
  try {
    const raw = localStorage.getItem("ima2.inFlight");
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const now = Date.now();
    const items: PersistedInFlight[] = [];
    for (const x of arr) {
      if (!x || typeof x.id !== "string" || typeof x.prompt !== "string") continue;
      if (typeof x.startedAt !== "number") continue;
      const item: PersistedInFlight = {
        id: x.id,
        prompt: x.prompt,
        startedAt: x.startedAt,
        phase: typeof x.phase === "string" ? x.phase : undefined,
        status: x.status === "success" || x.status === "error" ? x.status : "running",
        attempt: typeof x.attempt === "number" ? x.attempt : undefined,
        maxAttempts: typeof x.maxAttempts === "number" ? x.maxAttempts : undefined,
        endedAt: typeof x.endedAt === "number" ? x.endedAt : undefined,
        elapsedMs: typeof x.elapsedMs === "number" ? x.elapsedMs : undefined,
        errorMessage: typeof x.errorMessage === "string" ? x.errorMessage : undefined,
        filename: typeof x.filename === "string" ? x.filename : undefined,
        kind: x.kind === "classic" || x.kind === "node" ? x.kind : undefined,
        sessionId: typeof x.sessionId === "string" ? x.sessionId : null,
        parentNodeId: typeof x.parentNodeId === "string" ? x.parentNodeId : null,
        clientNodeId:
          typeof x.clientNodeId === "string" ? (x.clientNodeId as ClientNodeId) : undefined,
        retry:
          x.retry && typeof x.retry === "object" && typeof x.retry.prompt === "string"
            ? {
                kind: x.retry.kind === "node" ? "node" : "classic",
                prompt: x.retry.prompt,
                count: typeof x.retry.count === "number" ? x.retry.count : undefined,
                clientNodeId:
                  typeof x.retry.clientNodeId === "string"
                    ? (x.retry.clientNodeId as ClientNodeId)
                    : undefined,
              }
            : undefined,
      };
      if (!isExpired(item, now)) items.push(item);
    }
    // Newest first, then cap.
    items.sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt));
    return items.slice(0, ACTIVITY_MAX_ENTRIES);
  } catch {
    return [];
  }
}

function saveInFlight(list: PersistedInFlight[]): void {
  try {
    localStorage.setItem("ima2.inFlight", JSON.stringify(list));
  } catch (err) {
    // Quota exceeded or storage disabled. Notify the user once per tab.
    const w = window as unknown as { __ima2QuotaWarned?: boolean };
    if (!w.__ima2QuotaWarned) {
      w.__ima2QuotaWarned = true;
      console.warn("[ima2] localStorage write failed:", err);
      try {
        useAppStore.getState().showToast("로컬 저장소가 가득 차서 최근 상태가 저장되지 않을 수 있습니다.", true);
      } catch {}
    }
  }
}

// Extract recovery metadata from a server inflight job. Server stores
// kind/sessionId/parentNodeId/clientNodeId either at the top level (kind)
// or inside `meta`. Returns undefined-where-absent so callers can spread
// the result and only override known fields.
function extractInflightMeta(job: InflightJob): {
  kind?: "classic" | "node";
  sessionId: string | null;
  parentNodeId: string | null;
  clientNodeId?: ClientNodeId;
} {
  const meta = job.meta && typeof job.meta === "object" ? job.meta : {};
  const metaKind = (meta as { kind?: unknown }).kind;
  const kind =
    job.kind === "classic" || job.kind === "node"
      ? job.kind
      : metaKind === "classic" || metaKind === "node"
        ? (metaKind as "classic" | "node")
        : undefined;
  const metaSessionId = (meta as { sessionId?: unknown }).sessionId;
  const metaParentNodeId = (meta as { parentNodeId?: unknown }).parentNodeId;
  const metaClientNodeId = (meta as { clientNodeId?: unknown }).clientNodeId;
  return {
    kind,
    sessionId: typeof metaSessionId === "string" ? metaSessionId : null,
    parentNodeId: typeof metaParentNodeId === "string" ? metaParentNodeId : null,
    clientNodeId:
      typeof metaClientNodeId === "string"
        ? (metaClientNodeId as ClientNodeId)
        : undefined,
  };
}

// Centralized debug logger. Toggle via `localStorage["ima2.debug"] = "1"` or
// `?ima2_debug=1` on the URL — defaults to on for our self-hosted deploy
// because the in-flight reconcile logic is the source of most "ghost
// generation" bug reports. Output flows to the browser DevTools console with
// a stable [ima2:topic] prefix so it can be filtered.
const IMA2_DEBUG = (() => {
  if (typeof window === "undefined") return false;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("ima2_debug") === "1") return true;
    if (url.searchParams.get("ima2_debug") === "0") return false;
    const stored = localStorage.getItem("ima2.debug");
    if (stored === "0") return false;
    if (stored === "1") return true;
  } catch {}
  return true;
})();
function dlog(topic: string, ...args: unknown[]): void {
  if (!IMA2_DEBUG) return;
  // eslint-disable-next-line no-console
  console.log(`[ima2:${topic}]`, ...args);
}
function dwarn(topic: string, ...args: unknown[]): void {
  if (!IMA2_DEBUG) return;
  // eslint-disable-next-line no-console
  console.warn(`[ima2:${topic}]`, ...args);
}

// Match running in-flight entries against history rows that carry the same
// requestId. Promotes any matched entry from "running" → "success" and links
// the resulting filename. Used by both reconcileInflight (one-shot on load)
// and the polling tick (continuous). Lives at module scope so the helper can
// be reused without going through the zustand `set` indirection twice.
function reconcileWithHistoryItems(
  items: HistoryItem[],
  get: () => InflightAccess,
  set: (partial: Partial<InflightAccess>) => void,
): number {
  const byReq = new Map<string, HistoryItem>();
  for (const it of items) {
    if (typeof it.requestId === "string" && it.requestId) {
      byReq.set(it.requestId, it);
    }
  }
  if (byReq.size === 0) return 0;
  const local = get().inFlight;
  let matched = 0;
  const next = local.map((f) => {
    // Promote both running AND error rows: a refresh-during-fetch can land
    // the entry in "error" before the unloading guard sees beforeunload, but
    // the server still finishes and writes the sidecar. We must recover that
    // row when its requestId shows up in history. Already-success rows are
    // left alone so a stale history slice can't downgrade newer state.
    if (f.status === "success") return f;
    const hit = byReq.get(f.id);
    if (!hit) return f;
    matched++;
    const endedAt = hit.createdAt || Date.now();
    return {
      ...f,
      status: "success" as const,
      endedAt,
      elapsedMs: endedAt - f.startedAt,
      filename: hit.filename,
      phase: undefined,
    };
  });
  if (matched > 0) {
    dlog("inflight", "rescued via history match:", matched);
    saveInFlight(next);
    set({
      inFlight: next,
      activeGenerations: next.filter((f) => (f.status ?? "running") === "running").length,
    });
  }
  return matched;
}

// Slim view of the store fields the helper above needs. Avoids importing the
// full Store type (which would create a forward reference).
type InflightAccess = {
  inFlight: PersistedInFlight[];
  activeGenerations: number;
};

// Page-unload guard: when the user navigates away or refreshes, in-flight
// fetches abort and would otherwise hit the generate/generateNode catch
// blocks, marking the activity entry as "error". The server still owns
// the request (the upstream OAuth call keeps running), so on the next
// page load `reconcileInflight` should restore it as running. We set this
// flag from beforeunload/visibilitychange and skip the local error-mark
// when it's set.
let unloading = false;
if (typeof window !== "undefined") {
  const markUnloading = () => { unloading = true; };
  const clearUnloading = () => { unloading = false; };
  window.addEventListener("beforeunload", markUnloading);
  window.addEventListener("pagehide", markUnloading);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") markUnloading();
    else clearUnloading();
  });
}

function loadSelectedFilename(): string | null {
  try {
    const raw = localStorage.getItem("ima2.selectedFilename");
    return typeof raw === "string" && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

function saveSelectedFilename(filename: string | null): void {
  try {
    if (filename) localStorage.setItem("ima2.selectedFilename", filename);
    else localStorage.removeItem("ima2.selectedFilename");
  } catch {}
}

const HISTORY_LIMIT = 500;

export type ImageNodeStatus =
  | "empty"
  | "pending"
  | "reconciling"
  | "ready"
  | "stale"
  | "asset-missing"
  | "error";

export type ImageNodeData = {
  clientId: ClientNodeId;
  serverNodeId: string | null;
  parentServerNodeId: string | null;
  prompt: string;
  imageUrl: string | null;
  status: ImageNodeStatus;
  pendingRequestId: string | null;
  pendingPhase?: string | null;
  error?: string;
  elapsed?: number;
  webSearchCalls?: number;
  // Resolved generation size ("1024x1024", "1536x1024", ...). Drives the
  // node card aspect ratio so non-square outputs aren't letterboxed.
  size?: string | null;
};

export type GraphNode = FlowNode<ImageNodeData>;
export type GraphEdge = FlowEdge;

function mapSessionToGraph(session: SessionFull): {
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  graphVersion: number;
} {
  const graphNodes: GraphNode[] = session.nodes.map((n) => {
    const d = (n.data ?? {}) as Partial<ImageNodeData>;
    const explicitImageUrl =
      typeof d.imageUrl === "string" && d.imageUrl.length > 0 ? d.imageUrl : null;
    const fallbackImageUrl =
      typeof d.serverNodeId === "string" && d.serverNodeId.length > 0
        ? `/generated/${d.serverNodeId}.png`
        : null;
    const imageUrl = explicitImageUrl ?? fallbackImageUrl;
    const data: ImageNodeData = {
      clientId: n.id as ClientNodeId,
      serverNodeId: (d.serverNodeId ?? null) as string | null,
      parentServerNodeId: (d.parentServerNodeId ?? null) as string | null,
      prompt: typeof d.prompt === "string" ? d.prompt : "",
      imageUrl,
      status: (d.status ?? (imageUrl ? "ready" : "empty")) as ImageNodeStatus,
      pendingRequestId: (d.pendingRequestId ?? null) as string | null,
      pendingPhase: (d.pendingPhase ?? null) as string | null,
      error: d.error as string | undefined,
      elapsed: d.elapsed as number | undefined,
      webSearchCalls: d.webSearchCalls as number | undefined,
      size: typeof d.size === "string" ? d.size : null,
    };
    return {
      id: n.id,
      type: "imageNode",
      position: { x: n.x, y: n.y },
      data,
    };
  });
  const graphEdges: GraphEdge[] = session.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
  }));
  return {
    graphNodes,
    graphEdges,
    graphVersion: session.graphVersion,
  };
}

type ToastState = { message: string; error: boolean; id: number } | null;

type AppState = {
  provider: Provider;
  quality: Quality;
  sizePreset: SizePreset;
  customW: number;
  customH: number;
  format: Format;
  moderation: Moderation;
  count: Count;
  prompt: string;
  referenceImages: string[];
  addReferences: (files: File[]) => Promise<void>;
  addReferenceDataUrl: (dataUrl: string) => void;
  removeReference: (index: number) => void;
  clearReferences: () => void;
  useCurrentAsReference: () => Promise<void>;
  activeGenerations: number;
  inFlight: PersistedInFlight[];
  startInFlightPolling: () => void;
  reconcileInflight: () => Promise<void>;
  reconcileGraphPending: () => Promise<void>;
  syncFromStorage: () => void;
  dismissActivity: (id: string) => void;
  clearActivityHistory: () => void;
  retryActivity: (id: string) => Promise<void>;
  cancelActivity: (id: string) => void;
  selectActivity: (id: string) => void;
  currentImage: GenerateItem | null;
  history: GenerateItem[];
  toast: ToastState;
  rightPanelOpen: boolean;
  toggleRightPanel: () => void;
  galleryOpen: boolean;
  galleryFavOnly: boolean;
  openGallery: (opts?: { favOnly?: boolean }) => void;
  closeGallery: () => void;
  setGalleryFavOnly: (v: boolean) => void;
  lightboxOpen: boolean;
  openLightbox: (filename?: string | null) => void;
  closeLightbox: () => void;
  lightboxNext: () => void;
  lightboxPrev: () => void;
  jumpToImageSession: (item?: GenerateItem | null) => Promise<void>;

  uiMode: UIMode;
  setUIMode: (m: UIMode) => void;

  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  setGraphNodes: (n: GraphNode[]) => void;
  setGraphEdges: (e: GraphEdge[]) => void;
  addRootNode: () => ClientNodeId;
  addChildNode: (parentClientId: ClientNodeId) => ClientNodeId;
  addSiblingNode: (sourceClientId: ClientNodeId) => ClientNodeId;
  duplicateBranchRoot: (sourceClientId: ClientNodeId) => ClientNodeId;
  addChildNodeAt: (parentClientId: ClientNodeId, position: { x: number; y: number }) => ClientNodeId;
  connectNodes: (sourceClientId: ClientNodeId, targetClientId: ClientNodeId) => void;
  updateNodePrompt: (clientId: ClientNodeId, prompt: string) => void;
  generateNode: (clientId: ClientNodeId) => Promise<void>;
  deleteNode: (clientId: ClientNodeId) => void;
  deleteNodes: (clientIds: ClientNodeId[]) => void;

  // Sessions (0.06)
  sessions: SessionSummary[];
  activeSessionId: string | null;
  activeSessionGraphVersion: number | null;
  sessionLoading: boolean;
  loadSessions: () => Promise<void>;
  switchSession: (id: string) => Promise<void>;
  createAndSwitchSession: (title?: string) => Promise<void>;
  renameCurrentSession: (title: string) => Promise<void>;
  deleteSessionById: (id: string) => Promise<void>;
  scheduleGraphSave: () => void;
  flushGraphSave: (reason?: "debounced" | "manual" | "switch-session" | "recovery" | "beforeunload" | "queued") => Promise<void>;

  setProvider: (p: Provider) => void;
  setQuality: (q: Quality) => void;
  setSizePreset: (s: SizePreset) => void;
  setCustomSize: (w: number, h: number) => void;
  setFormat: (f: Format) => void;
  setModeration: (m: Moderation) => void;
  setCount: (c: Count) => void;
  setPrompt: (p: string) => void;
  // Original (pre-enhance) prompt — set by EnhanceModal.onApply, cleared on
  // direct edits or external prompt changes. Used so generate / sidecar can
  // record what the user originally typed before the enhance rewrite.
  originalPrompt: string | null;
  applyEnhancedPrompt: (original: string, enhanced: string) => void;
  clearOriginalPrompt: () => void;
  revertToOriginalPrompt: () => void;
  maxAttempts: number;
  setMaxAttempts: (n: number) => void;
  /** Unix ms until which generate() refuses to call /api/generate. Set when
   *  the upstream returns USAGE_LIMIT (429). null = no cool-down active. */
  usageLimitedUntil: number | null;
  setUsageLimitedUntil: (ts: number | null) => void;
  logModalOpen: boolean;
  openLogModal: () => void;
  closeLogModal: () => void;
  retryFromLog: (item: import("../types").GenerationLogItem) => Promise<void>;
  applyPreset: (payload: PresetPayload) => void;
  selectHistory: (item: GenerateItem) => void;
  removeFromHistory: (filename: string) => void;
  addHistoryItem: (item: GenerateItem) => void;
  toggleFavorite: (filename?: string) => Promise<void>;
  generate: (overrides?: { overridePrompt?: string; overrideCount?: Count }) => Promise<void>;
  varyCurrentResult: () => Promise<void>;
  hydrateHistory: () => void;
  showToast: (message: string, error?: boolean) => void;
  getResolvedSize: () => string;
};

export const useAppStore = create<AppState>((set, get) => ({
  provider: "oauth",
  quality: "high",
  sizePreset: "auto",
  customW: 1920,
  customH: 1088,
  format: "png",
  moderation: "low",
  count: 1,
  prompt: "",
  maxAttempts: loadMaxAttempts(),
  usageLimitedUntil: (() => {
    try {
      const raw = localStorage.getItem("ima2.usageLimitedUntil");
      if (!raw) return null;
      const n = Number(raw);
      if (!Number.isFinite(n)) return null;
      return n > Date.now() ? n : null;
    } catch {
      return null;
    }
  })(),
  setUsageLimitedUntil: (ts) => {
    try {
      if (ts && ts > Date.now()) {
        localStorage.setItem("ima2.usageLimitedUntil", String(ts));
      } else {
        localStorage.removeItem("ima2.usageLimitedUntil");
      }
    } catch {}
    set({ usageLimitedUntil: ts && ts > Date.now() ? ts : null });
  },
  setMaxAttempts: (n) => {
    const v = clampMaxAttempts(n);
    saveMaxAttempts(v);
    set({ maxAttempts: v });
  },
  logModalOpen: false,
  openLogModal: () => set({ logModalOpen: true }),
  closeLogModal: () => set({ logModalOpen: false }),
  retryFromLog: async (item) => {
    if (!item?.prompt) {
      get().showToast("재시도할 프롬프트가 없습니다.", true);
      return;
    }
    const s = get();
    set({
      prompt: item.prompt,
      quality: (item.quality as Quality) || s.quality,
      sizePreset: (item.size as SizePreset) || s.sizePreset,
      format: (item.format as Format) || s.format,
      moderation: (item.moderation as Moderation) || s.moderation,
      logModalOpen: false,
    });
    if (item.referenceCount > 0) {
      get().showToast("참조 이미지는 재시도에 포함되지 않습니다. 필요하면 다시 첨부하세요.", true);
    }
    await get().generate({ overridePrompt: item.prompt, overrideCount: 1 });
  },
  referenceImages: [],
  addReferences: async (files) => {
    const allowed = 5 - get().referenceImages.length;
    const toAdd = files.slice(0, Math.max(0, allowed));
    const dataUrls = await Promise.all(
      toAdd.map(
        (f) =>
          new Promise<string | null>((resolve) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve(typeof reader.result === "string" ? reader.result : null);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(f);
          }),
      ),
    );
    const valid = dataUrls.filter((x): x is string => !!x);
    set((s) => ({ referenceImages: [...s.referenceImages, ...valid].slice(0, 5) }));
    if (files.length > allowed) {
      get().showToast("참조 이미지는 최대 5장까지 추가할 수 있습니다. 초과한 이미지는 제외되었습니다.", true);
    }
  },
  addReferenceDataUrl: (dataUrl) => {
    set((s) =>
      s.referenceImages.length >= 5
        ? s
        : { referenceImages: [...s.referenceImages, dataUrl] },
    );
  },
  removeReference: (index) => {
    set((s) => ({
      referenceImages: s.referenceImages.filter((_, i) => i !== index),
    }));
  },
  clearReferences: () => set({ referenceImages: [] }),
  useCurrentAsReference: async () => {
    const cur = get().currentImage;
    if (!cur) {
      get().showToast("참조로 사용할 현재 이미지가 없습니다.", true);
      return;
    }
    if (get().referenceImages.length >= 5) {
      get().showToast("참조 이미지 슬롯이 가득 찼습니다. 최대 5장까지 가능합니다.", true);
      return;
    }
    let dataUrl = cur.image;
    if (!dataUrl.startsWith("data:")) {
      try {
        const resp = await fetch(dataUrl);
        const blob = await resp.blob();
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            typeof reader.result === "string"
              ? resolve(reader.result)
              : reject(new Error("read failed"));
          reader.onerror = () => reject(reader.error ?? new Error("read failed"));
          reader.readAsDataURL(blob);
        });
      } catch {
        get().showToast("현재 이미지를 불러오지 못했습니다.", true);
        return;
      }
    }
    set((s) => ({ referenceImages: [...s.referenceImages, dataUrl] }));
    get().showToast("현재 이미지를 참조에 추가했습니다.");
  },
  activeGenerations: loadInFlight().filter((f) => (f.status ?? "running") === "running").length,
  inFlight: loadInFlight(),
  dismissActivity: (id) => {
    const next = get().inFlight.filter((f) => f.id !== id);
    saveInFlight(next);
    set({
      inFlight: next,
      activeGenerations: next.filter((f) => (f.status ?? "running") === "running").length,
    });
  },
  clearActivityHistory: () => {
    // Keeps in-progress entries; only clears terminal ones.
    const next = get().inFlight.filter((f) => (f.status ?? "running") === "running");
    saveInFlight(next);
    set({
      inFlight: next,
      activeGenerations: next.length,
    });
  },
  selectActivity: (id) => {
    const item = get().inFlight.find((f) => f.id === id);
    if (!item) return;
    if (item.status === "success" && item.filename) {
      const target = get().history.find((h) => h.filename === item.filename);
      if (target) {
        get().selectHistory(target);
        return;
      }
      // History not yet hydrated for this filename — fall back to constructing
      // a minimal item so the canvas can render the URL directly.
      get().selectHistory({
        image: `/generated/${item.filename}`,
        url: `/generated/${item.filename}`,
        filename: item.filename,
        prompt: item.prompt,
      });
      return;
    }
    if (item.clientNodeId && get().uiMode === "node") {
      // Node-mode click: leave focus to the existing node selection logic.
      // (Could pan/zoom to the node here in a future pass.)
    }
  },
  cancelActivity: (id) => {
    const item = get().inFlight.find((f) => f.id === id);
    if (!item || (item.status ?? "running") !== "running") return;
    void cancelInflight(id);
    const next = get().inFlight.map((f) =>
      f.id === id
        ? {
            ...f,
            status: "error" as const,
            endedAt: Date.now(),
            elapsedMs: Date.now() - f.startedAt,
            errorMessage: "취소됨",
            phase: undefined,
          }
        : f,
    );
    saveInFlight(next);
    set({
      inFlight: next,
      activeGenerations: next.filter((f) => (f.status ?? "running") === "running").length,
    });
  },
  retryActivity: async (id) => {
    const item = get().inFlight.find((f) => f.id === id);
    if (!item || !item.retry) {
      get().showToast("재시도 정보가 없습니다", true);
      return;
    }
    // Drop the failed entry first so a new one (with fresh id) replaces it.
    get().dismissActivity(id);
    if (item.retry.kind === "node" && item.retry.clientNodeId) {
      await get().generateNode(item.retry.clientNodeId);
    } else {
      const c = (item.retry.count === 2 || item.retry.count === 4 ? item.retry.count : 1) as Count;
      await get().generate({
        overridePrompt: item.retry.prompt,
        overrideCount: c,
      });
    }
  },
  startInFlightPolling: () => {
    if (typeof window === "undefined") return;
    const w = window as unknown as { __ima2InflightTimer?: number };
    if (w.__ima2InflightTimer) return;
    dlog("inflight", "startInFlightPolling");
    const tick = async () => {
      const cur = get().inFlight;
      const running = cur.filter((f) => (f.status ?? "running") === "running");
      if (running.length === 0) {
        if (w.__ima2InflightTimer) {
          clearInterval(w.__ima2InflightTimer);
          w.__ima2InflightTimer = undefined;
          dlog("inflight", "polling stopped (no running)");
        }
        return;
      }
      // Merge server-side phase + attempt info onto running entries.
      try {
        const inflightKind = get().uiMode === "node" ? "node" : "classic";
        const inflightSessionId =
          inflightKind === "node" ? get().activeSessionId ?? undefined : undefined;
        const { jobs } = await getInflight({
          kind: inflightKind,
          sessionId: inflightSessionId,
        });
        const byId = new Map(jobs.map((j) => [j.requestId, j] as const));
        let changed = false;
        const nextInflight = get().inFlight.map((f) => {
          // Only update entries still running locally.
          if ((f.status ?? "running") !== "running") return f;
          const j = byId.get(f.id);
          if (!j) return f;
          const newPhase = typeof j.phase === "string" ? j.phase : f.phase;
          const newAttempt = typeof j.attempt === "number" ? j.attempt : f.attempt;
          const newMax = typeof j.maxAttempts === "number" ? j.maxAttempts : f.maxAttempts;
          // Restore recovery metadata from server in case localStorage was
          // wiped or this entry came in via cross-tab `storage` sync without
          // its meta block.
          const meta = extractInflightMeta(j);
          const newKind = meta.kind ?? f.kind;
          const newSessionId = meta.sessionId ?? f.sessionId ?? null;
          const newParentNodeId = meta.parentNodeId ?? f.parentNodeId ?? null;
          const newClientNodeId = meta.clientNodeId ?? f.clientNodeId;
          if (
            newPhase === f.phase &&
            newAttempt === f.attempt &&
            newMax === f.maxAttempts &&
            newKind === f.kind &&
            newSessionId === (f.sessionId ?? null) &&
            newParentNodeId === (f.parentNodeId ?? null) &&
            newClientNodeId === f.clientNodeId
          ) {
            return f;
          }
          changed = true;
          return {
            ...f,
            phase: newPhase,
            attempt: newAttempt,
            maxAttempts: newMax,
            kind: newKind,
            sessionId: newSessionId,
            parentNodeId: newParentNodeId,
            clientNodeId: newClientNodeId,
          };
        });
        if (changed) {
          saveInFlight(nextInflight);
          set({
            inFlight: nextInflight,
            activeGenerations: nextInflight.filter((f) => (f.status ?? "running") === "running").length,
          });
        }
      } catch {}
      try {
        const lastKnown = get().history.reduce(
          (max, it) => (it.createdAt && it.createdAt > max ? it.createdAt : max),
          0,
        );
        const { items } = await getHistory({ limit: HISTORY_LIMIT, since: lastKnown });
        const arr: GenerateItem[] = items.map((it) => ({
          image: it.url,
          url: it.url,
          filename: it.filename,
          thumb: it.url,
          prompt: it.prompt ?? undefined,
          originalPrompt: it.originalPrompt ?? undefined,
          size: it.size ?? undefined,
          quality: it.quality ?? undefined,
          format: it.format as Format | undefined,
          createdAt: it.createdAt,
          sessionId: it.sessionId ?? null,
          favorite: it.favorite === true,
        }));
        const existing = get().history;
        const fresh = arr.filter(
          (a) => !existing.some((e) => e.filename === a.filename),
        );
        if (fresh.length > 0) {
          dlog("inflight", "polling history fresh:", fresh.length);
          set((s) => {
            const nextCurrent = s.currentImage ?? fresh[0];
            if (!s.currentImage && fresh[0]?.filename) {
              saveSelectedFilename(fresh[0].filename);
            }
            return {
              history: [...fresh, ...s.history].slice(0, HISTORY_LIMIT),
              currentImage: nextCurrent,
            };
          });
        }
        // Reconcile running inflight against fresh history rows by requestId.
        // A running entry whose requestId matches a new history row is the
        // success case after a refresh-during-fetch: server finished and
        // wrote the sidecar, but the client never got the response back.
        if (items.length > 0) {
          reconcileWithHistoryItems(items, get, set);
        }
        // TTL prune: drop expired terminal entries + reap stuck running entries.
        const now = Date.now();
        const remaining = get().inFlight.filter((f) => !isExpired(f, now));
        if (remaining.length !== get().inFlight.length) {
          dlog("inflight", "TTL prune:", get().inFlight.length - remaining.length);
          saveInFlight(remaining);
          set({
            inFlight: remaining,
            activeGenerations: remaining.filter((f) => (f.status ?? "running") === "running").length,
          });
        }
      } catch (err) {
        dwarn("inflight", "polling tick failed:", err);
      }
    };
    w.__ima2InflightTimer = window.setInterval(tick, 1500) as unknown as number;
  },
  reconcileInflight: async () => {
    try {
      const inflightKind = get().uiMode === "node" ? "node" : "classic";
      const inflightSessionId =
        inflightKind === "node" ? get().activeSessionId ?? undefined : undefined;
      // Fetch server inflight AND a recent history slice in parallel so we
      // can rescue running entries that completed while the client was gone.
      const [{ jobs }, historyPage] = await Promise.all([
        getInflight({ kind: inflightKind, sessionId: inflightSessionId }),
        getHistory({ limit: 100 }).catch(() => ({ items: [] as HistoryItem[], total: 0, nextCursor: null })),
      ]);
      const historyItems = historyPage.items || [];
      const serverById = new Map(jobs.map((j) => [j.requestId, j] as const));
      const historyByRequestId = new Map<string, HistoryItem>();
      for (const it of historyItems) {
        if (typeof it.requestId === "string" && it.requestId) {
          historyByRequestId.set(it.requestId, it);
        }
      }
      const now = Date.now();
      const local = get().inFlight;
      let rescued = 0;
      let dropped = 0;
      let kept = 0;
      const merged: PersistedInFlight[] = [];
      for (const f of local) {
        const status = f.status ?? "running";
        if (status === "success") {
          if (!isExpired(f, now)) merged.push(f);
          continue;
        }
        // 1) Server still owns it → keep (running only; an "error" row
        //    appearing in serverIds is a stale local mistake). Restore
        //    recovery meta (kind/sessionId/parentNodeId/clientNodeId) from
        //    the server so a refreshed tab can rebuild node parent links.
        const serverJob = serverById.get(f.id);
        if (status === "running" && serverJob) {
          const meta = extractInflightMeta(serverJob);
          merged.push({
            ...f,
            kind: meta.kind ?? f.kind,
            sessionId: meta.sessionId ?? f.sessionId ?? null,
            parentNodeId: meta.parentNodeId ?? f.parentNodeId ?? null,
            clientNodeId: meta.clientNodeId ?? f.clientNodeId,
          });
          kept++;
          continue;
        }
        // 2) History has a row with our requestId → server finished and
        //    wrote the sidecar. Promote regardless of current local status,
        //    because the local "error" mark may come from a fetch torn down
        //    by refresh before the unloading guard fired.
        const histMatch = historyByRequestId.get(f.id);
        if (histMatch) {
          const successItem: PersistedInFlight = {
            ...f,
            status: "success",
            endedAt: histMatch.createdAt || now,
            elapsedMs: (histMatch.createdAt || now) - f.startedAt,
            filename: histMatch.filename,
            errorMessage: undefined,
            phase: undefined,
          };
          merged.push(successItem);
          rescued++;
          continue;
        }
        // Error rows that did NOT match history stay as-is until TTL.
        if (status === "error") {
          if (!isExpired(f, now)) merged.push(f);
          continue;
        }
        // 3) Neither in server nor history. The legacy rule dropped after
        //    10 s, but a slow generate (high quality / 4-up) routinely
        //    takes longer. Hold the entry for the full TTL (180 s) so the
        //    next polling tick still has a chance to find the sidecar.
        if (now - f.startedAt < INFLIGHT_TTL_MS) {
          merged.push(f);
          kept++;
          continue;
        }
        // 4) Truly stuck — convert to error so the user sees a retry button
        //    instead of the entry silently vanishing.
        merged.push({
          ...f,
          status: "error",
          endedAt: now,
          elapsedMs: now - f.startedAt,
          errorMessage: f.errorMessage || "결과를 확인할 수 없습니다 (타임아웃)",
          phase: undefined,
        });
        dropped++;
      }
      const localIds = new Set(merged.map((f) => f.id));
      for (const j of jobs) {
        if (!localIds.has(j.requestId)) {
          // Server-only entry — started in another tab/process or after our
          // localStorage was cleared. Populate full recovery meta so node
          // parent links survive the next refresh.
          const meta = extractInflightMeta(j);
          merged.push({
            id: j.requestId,
            prompt: j.prompt || "",
            startedAt: j.startedAt,
            status: "running",
            attempt: j.attempt,
            maxAttempts: j.maxAttempts,
            kind: meta.kind,
            sessionId: meta.sessionId,
            parentNodeId: meta.parentNodeId,
            clientNodeId: meta.clientNodeId,
          });
        }
      }
      // Hydrate history with the slice we just read so subsequent polling
      // ticks have a recent baseline (avoids first-tick refetch race).
      if (historyItems.length > 0) {
        const fresh: GenerateItem[] = historyItems.map((it) => ({
          image: it.url,
          url: it.url,
          filename: it.filename,
          thumb: it.url,
          prompt: it.prompt ?? undefined,
          originalPrompt: it.originalPrompt ?? undefined,
          size: it.size ?? undefined,
          quality: it.quality ?? undefined,
          format: it.format as Format | undefined,
          createdAt: it.createdAt,
          sessionId: it.sessionId ?? null,
          favorite: it.favorite === true,
        }));
        const existing = get().history;
        const newOnes = fresh.filter((a) => !existing.some((e) => e.filename === a.filename));
        if (newOnes.length > 0) {
          set((s) => ({
            history: [...newOnes, ...s.history].slice(0, HISTORY_LIMIT),
          }));
        }
      }
      dlog("inflight", "reconcile:", {
        serverJobs: jobs.length,
        localBefore: local.length,
        rescued,
        dropped,
        kept,
        historyMatched: historyByRequestId.size,
      });
      saveInFlight(merged);
      set({
        inFlight: merged,
        activeGenerations: merged.filter((f) => (f.status ?? "running") === "running").length,
      });
      if (merged.some((f) => (f.status ?? "running") === "running")) {
        get().startInFlightPolling();
      }
    } catch (err) {
      dwarn("inflight", "reconcile failed:", err);
    }
  },
  syncFromStorage: () => {
    // Triggered by `storage` events (another tab changed localStorage).
    const nextInflight = loadInFlight();
    const nextSelected = loadSelectedFilename();
    set((s) => ({
      inFlight: nextInflight,
      activeGenerations: nextInflight.filter((f) => (f.status ?? "running") === "running").length,
      currentImage:
        nextSelected && s.currentImage?.filename !== nextSelected
          ? s.history.find((h) => h.filename === nextSelected) ?? s.currentImage
          : s.currentImage,
    }));
    if (nextInflight.some((f) => (f.status ?? "running") === "running")) {
      get().startInFlightPolling();
    }
  },
  currentImage: null,
  history: [],
  toast: null,
  rightPanelOpen: loadRightPanelOpen(),
  toggleRightPanel: () =>
    set((s) => {
      const next = !s.rightPanelOpen;
      try {
        localStorage.setItem("ima2.rightPanelOpen", JSON.stringify(next));
      } catch {}
      return { rightPanelOpen: next };
    }),
  galleryOpen: false,
  galleryFavOnly: false,
  openGallery: (opts) => set({ galleryOpen: true, galleryFavOnly: opts?.favOnly === true }),
  closeGallery: () => set({ galleryOpen: false }),
  setGalleryFavOnly: (v) => set({ galleryFavOnly: v }),
  lightboxOpen: false,
  openLightbox: (filename) => {
    if (filename) {
      const target = get().history.find((h) => h.filename === filename);
      if (target) get().selectHistory(target);
    }
    if (!get().currentImage) return;
    set({ lightboxOpen: true });
  },
  closeLightbox: () => set({ lightboxOpen: false }),
  lightboxNext: () => {
    const cur = get().currentImage;
    const hist = get().history;
    if (!cur || hist.length === 0) return;
    const idx = hist.findIndex(
      (h) => (cur.filename && h.filename === cur.filename) || h.image === cur.image,
    );
    const nextIdx = idx < 0 ? 0 : Math.min(idx + 1, hist.length - 1);
    if (nextIdx === idx) return;
    get().selectHistory(hist[nextIdx]);
  },
  lightboxPrev: () => {
    const cur = get().currentImage;
    const hist = get().history;
    if (!cur || hist.length === 0) return;
    const idx = hist.findIndex(
      (h) => (cur.filename && h.filename === cur.filename) || h.image === cur.image,
    );
    const prevIdx = idx < 0 ? 0 : Math.max(idx - 1, 0);
    if (prevIdx === idx) return;
    get().selectHistory(hist[prevIdx]);
  },
  jumpToImageSession: async (item) => {
    const target = item ?? get().currentImage;
    if (!target) return;
    // Close the overlay immediately so the click feels responsive even when
    // we have to fall back to /api/history to resolve the sessionId.
    if (get().lightboxOpen) set({ lightboxOpen: false });
    let sid = target.sessionId ?? null;
    if (!sid && target.filename) {
      try {
        const { items } = await getHistory({ limit: 500 });
        const hit = items.find((h) => h.filename === target.filename);
        sid = hit?.sessionId ?? null;
      } catch {}
    }
    if (!sid) {
      // Classic-mode image — no graph session to jump to. Prefill the
      // composer with this image's prompt + options so the click feels
      // like "open this for re-work" instead of a dead end.
      const prompt = (target.prompt ?? "").trim();
      if (!prompt) {
        get().showToast("이 이미지의 프롬프트 정보를 찾지 못했습니다.", true);
        return;
      }
      const s = get();
      set({
        prompt,
        originalPrompt:
          typeof target.originalPrompt === "string" && target.originalPrompt.length > 0
            ? target.originalPrompt
            : null,
        quality: (target.quality as Quality) || s.quality,
        sizePreset: (target.size as SizePreset) || s.sizePreset,
        moderation: (target.moderation as Moderation) || s.moderation,
      });
      get().showToast("프롬프트와 옵션을 가져왔습니다.");
      // Focus the composer textarea after the lightbox unmounts.
      setTimeout(() => {
        const el = document.querySelector<HTMLTextAreaElement>(
          ".composer__textarea, .prompt-area",
        );
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      }, 50);
      return;
    }
    if (get().uiMode !== "node") get().setUIMode("node");
    if (get().activeSessionId !== sid) {
      try {
        await get().switchSession(sid);
      } catch (err) {
        console.warn("[ima2:lightbox] switchSession failed", err);
        get().showToast("세션으로 이동하지 못했습니다.", true);
      }
    }
  },

  uiMode: loadUIMode(),
  setUIMode: (m) => {
    try { localStorage.setItem("ima2.uiMode", m); } catch {}
    set({ uiMode: m });
  },

  graphNodes: [],
  graphEdges: [],
  setGraphNodes: (graphNodes) => {
    set({ graphNodes });
    get().scheduleGraphSave();
  },
  setGraphEdges: (graphEdges) => {
    set({ graphEdges });
    get().scheduleGraphSave();
  },

  sessions: [],
  activeSessionId: null,
  activeSessionGraphVersion: null,
  sessionLoading: false,

  async loadSessions() {
    try {
      const { sessions } = await apiListSessions();
      set({ sessions });
      const current = get().activeSessionId;
      if (!current && sessions.length > 0) {
        await get().switchSession(sessions[0].id);
      } else if (!current && sessions.length === 0) {
        await get().createAndSwitchSession("첫 번째 그래프");
      }
    } catch (err) {
      console.warn("[sessions] load failed:", err);
    }
  },

  async switchSession(id) {
    set({ sessionLoading: true });
    await get().flushGraphSave("switch-session");
    try {
      const { session } = await apiGetSession(id);
      const { graphNodes, graphEdges, graphVersion } = mapSessionToGraph(session);
      set({
        activeSessionId: id,
        activeSessionGraphVersion: graphVersion,
        graphNodes,
        graphEdges,
        sessionLoading: false,
      });
      void get().reconcileGraphPending();
    } catch (err) {
      console.warn("[sessions] switch failed:", err);
      set({ sessionLoading: false });
      get().showToast("세션을 불러오지 못했습니다.", true);
    }
  },

  async reconcileGraphPending() {
    const sid = get().activeSessionId;
    if (!sid) return;
    const pendingNodes = get().graphNodes.filter(
      (n) => n.data?.pendingRequestId && (n.data.status === "pending" || n.data.status === "reconciling"),
    );
    if (pendingNodes.length === 0) return;
    let jobs: Array<{ requestId: string; phase?: string }> = [];
    try {
      const res = await getInflight({ kind: "node", sessionId: sid });
      jobs = res.jobs;
    } catch {
      return;
    }
    const byId = new Map(jobs.map((j) => [j.requestId, j.phase] as const));
    const next = get().graphNodes.map((n) => {
      const reqId = n.data?.pendingRequestId;
      if (!reqId) return n;
      if (n.data.status !== "pending" && n.data.status !== "reconciling") return n;
      if (byId.has(reqId)) {
        const phase = byId.get(reqId) ?? null;
        return {
          ...n,
          data: { ...n.data, status: "reconciling" as const, pendingPhase: phase },
        };
      }
      // Not in-flight anymore — image may have landed, or job was lost
      const hasAsset = !!n.data.imageUrl || !!n.data.serverNodeId;
      return {
        ...n,
        data: {
          ...n.data,
          pendingRequestId: null,
          pendingPhase: null,
          status: hasAsset ? ("ready" as const) : ("stale" as const),
          error: hasAsset ? undefined : "생성이 정상적으로 끝나지 않았습니다. 이 노드에서 다시 시도하세요.",
        },
      };
    });
    set({ graphNodes: next });
  },

  async createAndSwitchSession(title = "제목 없는 세션") {
    try {
      const { session } = await apiCreateSession(title);
      set({
        sessions: [session as SessionSummary, ...get().sessions],
        activeSessionId: session.id,
        activeSessionGraphVersion: session.graphVersion,
        graphNodes: [],
        graphEdges: [],
      });
    } catch (err) {
      console.warn("[sessions] create failed:", err);
      get().showToast("세션을 만들지 못했습니다.", true);
    }
  },

  async renameCurrentSession(title) {
    const id = get().activeSessionId;
    if (!id) return;
    try {
      await apiRenameSession(id, title);
      set({
        sessions: get().sessions.map((s) =>
          s.id === id ? { ...s, title, updatedAt: Date.now() } : s,
        ),
      });
    } catch (err) {
      get().showToast("세션 이름을 바꾸지 못했습니다.", true);
    }
  },

  async deleteSessionById(id) {
    try {
      await apiDeleteSession(id);
      const remaining = get().sessions.filter((s) => s.id !== id);
      set({ sessions: remaining });
      if (get().activeSessionId === id) {
        set({
          activeSessionId: null,
          activeSessionGraphVersion: null,
          graphNodes: [],
          graphEdges: [],
        });
        if (remaining.length > 0) {
          await get().switchSession(remaining[0].id);
        } else {
          await get().createAndSwitchSession("첫 번째 그래프");
        }
      }
    } catch (err) {
      get().showToast("세션을 삭제하지 못했습니다.", true);
    }
  },

  scheduleGraphSave() {
    scheduleGraphSaveImpl(get, set);
  },

  async flushGraphSave(reason = "manual") {
    await flushGraphSaveImpl(get, set, reason);
  },

  addRootNode: () => {
    const clientId = newClientNodeId();
    const node: GraphNode = {
      id: clientId,
      type: "imageNode",
      position: getNextRootPosition(get().graphNodes),
      data: {
        clientId,
        serverNodeId: null,
        parentServerNodeId: null,
        prompt: "",
        imageUrl: null,
        status: "empty",
        pendingRequestId: null,
        pendingPhase: null,
      },
    };
    set({ graphNodes: [...get().graphNodes, node] });
    get().scheduleGraphSave();
    return clientId;
  },

  addChildNode: (parentClientId) => {
    const parent = get().graphNodes.find((n) => n.id === parentClientId);
    if (!parent) return parentClientId;
    const clientId = newClientNodeId();
    const node: GraphNode = {
      id: clientId,
      type: "imageNode",
      position: getNextChildPosition(parent, get().graphNodes, get().graphEdges),
      data: {
        clientId,
        serverNodeId: null,
        parentServerNodeId: parent.data.serverNodeId,
        prompt: "",
        imageUrl: null,
        status: "empty",
        pendingRequestId: null,
        pendingPhase: null,
      },
    };
    const edge: GraphEdge = {
      id: `${parentClientId}->${clientId}`,
      source: parentClientId,
      target: clientId,
    };
    set({
      graphNodes: [...get().graphNodes, node],
      graphEdges: [...get().graphEdges, edge],
    });
    get().scheduleGraphSave();
    return clientId;
  },

  addSiblingNode: (sourceClientId) => {
    const source = get().graphNodes.find((n) => n.id === sourceClientId);
    if (!source) return sourceClientId;

    const incomingEdge = get().graphEdges.find((e) => e.target === sourceClientId);
    if (!incomingEdge) {
      const clientId = newClientNodeId();
      const node: GraphNode = {
        id: clientId,
        type: "imageNode",
        position: getNextRootPosition(get().graphNodes),
        data: {
          clientId,
          serverNodeId: null,
          parentServerNodeId: null,
          prompt: source.data.prompt,
          imageUrl: null,
          status: "empty",
          pendingRequestId: null,
          pendingPhase: null,
        },
      };
      set({ graphNodes: [...get().graphNodes, node] });
      get().scheduleGraphSave();
      return clientId;
    }

    const parentClientId = incomingEdge.source;
    const parent = get().graphNodes.find((n) => n.id === parentClientId);
    if (!parent) return sourceClientId;

    const clientId = newClientNodeId();
    const node: GraphNode = {
      id: clientId,
      type: "imageNode",
      position: getNextChildPosition(parent, get().graphNodes, get().graphEdges),
      data: {
        clientId,
        serverNodeId: null,
        parentServerNodeId: source.data.parentServerNodeId,
        prompt: source.data.prompt,
        imageUrl: null,
        status: "empty",
        pendingRequestId: null,
        pendingPhase: null,
      },
    };
    const edge: GraphEdge = {
      id: `${parentClientId}->${clientId}`,
      source: parentClientId,
      target: clientId,
    };
    set({
      graphNodes: [...get().graphNodes, node],
      graphEdges: [...get().graphEdges, edge],
    });
    get().scheduleGraphSave();
    return clientId;
  },

  updateNodePrompt: (clientId, prompt) => {
    set({
      graphNodes: get().graphNodes.map((n) =>
        n.id === clientId ? { ...n, data: { ...n.data, prompt } } : n,
      ),
    });
    get().scheduleGraphSave();
  },

  duplicateBranchRoot: (sourceClientId) => {
    const source = get().graphNodes.find((n) => n.id === sourceClientId);
    if (!source) return sourceClientId;
    const clientId = newClientNodeId();
    const rootSiblings = get().graphNodes.filter((n) => !n.data.parentServerNodeId).length;
    const node: GraphNode = {
      id: clientId,
      type: "imageNode",
      position: { x: source.position.x + 420, y: source.position.y + 40 },
      data: {
        clientId,
        serverNodeId: null,
        parentServerNodeId: null,
        prompt: source.data.prompt,
        imageUrl: null,
        status: "empty",
        pendingRequestId: null,
        pendingPhase: null,
      },
    };
    // no parent edge — becomes a new branch root at root layer
    void rootSiblings;
    set({ graphNodes: [...get().graphNodes, node] });
    get().scheduleGraphSave();
    return clientId;
  },

  async generateNode(clientId) {
    const requestedNode = get().graphNodes.find((n) => n.id === clientId);
    const targetClientId =
      requestedNode?.data.status === "ready" ? get().addSiblingNode(clientId) : clientId;
    const node = get().graphNodes.find((n) => n.id === targetClientId);
    if (!node) return;
    const { prompt, parentServerNodeId } = node.data;
    if (!prompt.trim()) {
      get().showToast("프롬프트를 입력하세요.", true);
      return;
    }
    const s = get();
    const size = s.getResolvedSize();

    // mark pending
    const flightId = `fn_${targetClientId}`;
    const startedAt = Date.now();
    const nextInFlight: PersistedInFlight[] = [
      ...s.inFlight,
      {
        id: flightId,
        prompt,
        startedAt,
        status: "running",
        attempt: 1,
        maxAttempts: s.maxAttempts,
        retry: { kind: "node", prompt, clientNodeId: targetClientId },
        kind: "node",
        sessionId: s.activeSessionId,
        parentNodeId: parentServerNodeId ?? null,
        clientNodeId: targetClientId,
      },
    ];
    saveInFlight(nextInFlight);
    set({
      graphNodes: get().graphNodes.map((n) =>
        n.id === targetClientId
          ? {
              ...n,
              data: {
                ...n.data,
                status: "pending",
                pendingRequestId: flightId,
                pendingPhase: "queued",
                error: undefined,
                size,
              },
            }
          : n,
      ),
      activeGenerations: s.activeGenerations + 1,
      inFlight: nextInFlight,
    });
    get().startInFlightPolling();

    try {
      const res = await postNodeGenerate({
        parentNodeId: parentServerNodeId,
        prompt,
        quality: s.quality,
        size,
        format: s.format,
        moderation: s.moderation,
        requestId: flightId,
        sessionId: s.activeSessionId,
        clientNodeId: targetClientId,
        maxAttempts: s.maxAttempts,
        ...(s.originalPrompt && s.originalPrompt !== prompt
          ? { originalPrompt: s.originalPrompt }
          : {}),
        ...(s.referenceImages.length && !parentServerNodeId
          ? { references: s.referenceImages.map((d) => d.replace(/^data:[^;]+;base64,/, "")) }
          : {}),
      });
      set({
        graphNodes: get().graphNodes.map((n) =>
          n.id === targetClientId
            ? {
                ...n,
                data: {
                  ...n.data,
                  serverNodeId: res.nodeId,
                  imageUrl: res.url,
                  status: "ready",
                  pendingRequestId: null,
                  pendingPhase: null,
                  elapsed: res.elapsed,
                  webSearchCalls: res.webSearchCalls,
                  size: res.size ?? n.data.size ?? size,
                },
              }
            : n,
        ),
      });
      get().showToast(`노드 ${res.nodeId.slice(0, 8)} 생성 완료 (${res.elapsed}초)`);
      // Mark activity success.
      const elapsedMs = Math.round(Number(res.elapsed) * 1000) || (Date.now() - startedAt);
      const next = get().inFlight.map((f) =>
        f.id === flightId
          ? {
              ...f,
              status: "success" as const,
              endedAt: Date.now(),
              elapsedMs,
              phase: undefined,
              clientNodeId: targetClientId,
            }
          : f,
      );
      saveInFlight(next);
      set({
        inFlight: next,
        activeGenerations: Math.max(0, get().activeGenerations - 1),
      });
    } catch (err) {
      // Same page-unload guard as classic generate: server keeps the request,
      // local state should not flip to "error" just because the tab tore down.
      if (unloading) return;
      const msg = err instanceof Error ? err.message : "노드 생성에 실패했습니다.";
      set({
        graphNodes: get().graphNodes.map((n) =>
          n.id === targetClientId
            ? {
                ...n,
                data: {
                  ...n.data,
                  status: "error",
                  pendingRequestId: null,
                  pendingPhase: null,
                  error: msg,
                },
              }
            : n,
        ),
      });
      get().showToast(msg, true);
      const next = get().inFlight.map((f) =>
        f.id === flightId
          ? {
              ...f,
              status: "error" as const,
              endedAt: Date.now(),
              elapsedMs: Date.now() - startedAt,
              errorMessage: msg,
              phase: undefined,
            }
          : f,
      );
      saveInFlight(next);
      set({
        inFlight: next,
        activeGenerations: Math.max(0, get().activeGenerations - 1),
      });
    } finally {
      if (!unloading) get().scheduleGraphSave();
    }
  },

  deleteNode: (clientId) => {
    const doomed = get().graphNodes.find((n) => n.id === clientId);
    const reqId = doomed?.data?.pendingRequestId;
    if (reqId) void cancelInflight(reqId);
    set({
      graphNodes: get().graphNodes.filter((n) => n.id !== clientId),
      graphEdges: get().graphEdges.filter((e) => e.source !== clientId && e.target !== clientId),
    });
    get().scheduleGraphSave();
  },

  deleteNodes: (clientIds) => {
    const set_ = new Set(clientIds);
    for (const n of get().graphNodes) {
      if (set_.has(n.id) && n.data?.pendingRequestId) {
        void cancelInflight(n.data.pendingRequestId);
      }
    }
    set({
      graphNodes: get().graphNodes.filter((n) => !set_.has(n.id)),
      graphEdges: get().graphEdges.filter((e) => !set_.has(e.source) && !set_.has(e.target)),
    });
    get().scheduleGraphSave();
  },

  addChildNodeAt: (parentClientId, position) => {
    const parent = get().graphNodes.find((n) => n.id === parentClientId);
    if (!parent) return parentClientId;
    const clientId = newClientNodeId();
    const node: GraphNode = {
      id: clientId,
      type: "imageNode",
      position,
      data: {
        clientId,
        serverNodeId: null,
        parentServerNodeId: parent.data.serverNodeId,
        prompt: "",
        imageUrl: null,
        status: "empty",
        pendingRequestId: null,
        pendingPhase: null,
      },
    };
    const edge: GraphEdge = {
      id: `${parentClientId}->${clientId}`,
      source: parentClientId,
      target: clientId,
    };
    set({
      graphNodes: [...get().graphNodes, node],
      graphEdges: [...get().graphEdges, edge],
    });
    get().scheduleGraphSave();
    return clientId;
  },

  connectNodes: (sourceClientId, targetClientId) => {
    if (sourceClientId === targetClientId) return;
    const existing = get().graphEdges.find(
      (e) => e.source === sourceClientId && e.target === targetClientId,
    );
    if (existing) return;
    const source = get().graphNodes.find((n) => n.id === sourceClientId);
    if (!source) return;
    set({
      graphNodes: get().graphNodes.map((n) =>
        n.id === targetClientId
          ? { ...n, data: { ...n.data, parentServerNodeId: source.data.serverNodeId } }
          : n,
      ),
      graphEdges: [
        ...get().graphEdges,
        { id: `${sourceClientId}->${targetClientId}`, source: sourceClientId, target: targetClientId },
      ],
    });
    get().scheduleGraphSave();
  },

  setProvider: (provider) => set({ provider }),
  setQuality: (quality) => set({ quality }),
  setSizePreset: (sizePreset) => set({ sizePreset }),
  setCustomSize: (w, h) => set({ customW: snap16(w), customH: snap16(h) }),
  setFormat: (format) => set({ format }),
  setModeration: (moderation) => set({ moderation }),
  setCount: (count) => set({ count }),
  setPrompt: (prompt) => {
    // Direct edits invalidate the saved enhance source, unless the user is
    // restoring the exact enhanced text again (no-op).
    const cur = get();
    const next: Partial<AppState> = { prompt };
    if (cur.originalPrompt && prompt !== cur.prompt) next.originalPrompt = null;
    set(next);
  },
  originalPrompt: null,
  applyEnhancedPrompt: (original, enhanced) => {
    const trimmed = enhanced.trim();
    if (!trimmed) return;
    set({
      prompt: trimmed,
      originalPrompt: original.trim() || null,
    });
  },
  clearOriginalPrompt: () => set({ originalPrompt: null }),
  revertToOriginalPrompt: () => {
    const orig = get().originalPrompt;
    if (!orig) return;
    set({ prompt: orig, originalPrompt: null });
  },
  applyPreset: (payload: PresetPayload) => {
    set({
      quality: payload.quality,
      sizePreset: payload.sizePreset,
      format: payload.format,
      moderation: payload.moderation,
      count: payload.count,
      ...(payload.sizePreset === "custom" && payload.customW && payload.customH
        ? { customW: payload.customW, customH: payload.customH }
        : {}),
    });
  },

  selectHistory: (item) => {
    saveSelectedFilename(item.filename ?? null);
    set({ currentImage: item });
  },

  removeFromHistory: (filename) => {
    const s = get();
    const history = s.history.filter((h) => h.filename !== filename);
    const stillCurrent =
      s.currentImage && s.currentImage.filename === filename ? null : s.currentImage;
    set({ history, currentImage: stillCurrent });
    if (stillCurrent === null) saveSelectedFilename(null);
  },

  addHistoryItem: (item) => {
    const s = get();
    const exists = s.history.some(
      (h) => item.filename && h.filename === item.filename,
    );
    if (exists) return;
    const withDefaults: GenerateItem = {
      ...item,
      createdAt: item.createdAt || Date.now(),
    };
    set({ history: [withDefaults, ...s.history].slice(0, HISTORY_LIMIT) });
  },

  toggleFavorite: async (filename?: string) => {
    const s = get();
    const target = filename ?? s.currentImage?.filename;
    if (!target) return;
    const currentItem =
      s.history.find((h) => h.filename === target) ??
      (s.currentImage?.filename === target ? s.currentImage : null);
    const next = !currentItem?.favorite;

    const patchItem = <T extends { filename?: string; favorite?: boolean }>(it: T): T =>
      it.filename === target ? { ...it, favorite: next } : it;
    set({
      history: s.history.map(patchItem),
      currentImage: s.currentImage ? patchItem(s.currentImage) : s.currentImage,
    });

    try {
      await setFavorite(target, next);
    } catch (err) {
      const revert = <T extends { filename?: string; favorite?: boolean }>(it: T): T =>
        it.filename === target ? { ...it, favorite: !next } : it;
      set({
        history: get().history.map(revert),
        currentImage: get().currentImage ? revert(get().currentImage!) : get().currentImage,
      });
      s.showToast("즐겨찾기 저장 실패", true);
      console.error(err);
    }
  },

  getResolvedSize: () => {
    const { sizePreset, customW, customH } = get();
    return sizePreset === "custom" ? `${customW}x${customH}` : sizePreset;
  },

  async generate(overrides) {
    const s = get();
    const prompt = (overrides?.overridePrompt ?? s.prompt).trim();
    if (!prompt) return;
    // Refuse early when we already know we're rate-limited; otherwise every
    // click burns more upstream budget for the same 429.
    const cool = get().usageLimitedUntil;
    if (cool && cool > Date.now()) {
      const sec = Math.max(1, Math.ceil((cool - Date.now()) / 1000));
      get().showToast(
        `OpenAI 사용 한도에 도달했습니다. 약 ${sec}초 뒤 자동 해제됩니다.`,
        true,
      );
      return;
    }
    const count = overrides?.overrideCount ?? s.count;

    const size = s.getResolvedSize();
    const references = s.referenceImages.length
      ? s.referenceImages.map((d) => d.replace(/^data:[^;]+;base64,/, ""))
      : null;

    const startedAt = Date.now();
    const flightIds = Array.from(
      { length: count },
      (_, i) => `f_${startedAt}_${i}_${Math.random().toString(36).slice(2, 7)}`,
    );
    const newEntries: PersistedInFlight[] = flightIds.map((id) => ({
      id,
      prompt,
      startedAt,
      status: "running" as const,
      attempt: 1,
      maxAttempts: s.maxAttempts,
      retry: { kind: "classic" as const, prompt, count: 1 },
      kind: "classic" as const,
      sessionId: s.activeSessionId,
      parentNodeId: null,
    }));
    set((state) => ({
      activeGenerations: state.activeGenerations + count,
      inFlight: [...state.inFlight, ...newEntries],
    }));
    saveInFlight(get().inFlight);
    get().startInFlightPolling();

    let succeeded = 0;
    let failed = 0;
    let maxElapsed = 0;
    let firstErrMsg: string | null = null;

    console.log(
      `[ima2][generate] start: flights=${flightIds.length} quality=${s.quality} ` +
      `size=${size} moderation=${s.moderation} maxAttempts=${s.maxAttempts} ` +
      `refs=${references?.length ?? 0} promptLen=${prompt.length} ` +
      `hasOriginal=${Boolean(s.originalPrompt && s.originalPrompt !== prompt)}`,
    );

    await Promise.all(
      flightIds.map(async (flightId) => {
        const slotStartedAt = Date.now();
        console.log(`[ima2][generate][${flightId}] posting /api/generate`);
        try {
          const res: GenerateResponse = await postGenerate({
            prompt,
            quality: s.quality,
            size,
            format: s.format,
            moderation: s.moderation,
            provider: s.provider,
            n: 1,
            requestId: flightId,
            maxAttempts: s.maxAttempts,
            ...(s.originalPrompt && s.originalPrompt !== prompt
              ? { originalPrompt: s.originalPrompt }
              : {}),
            ...(references ? { references } : {}),
          });
          console.log(
            `[ima2][generate][${flightId}] response ok in ` +
            `${Date.now() - slotStartedAt}ms elapsed=${(res as { elapsed?: number }).elapsed}`,
          );

          // Server returns single-shape for n=1, but handle multi defensively.
          const picked = isMultiResponse(res)
            ? { image: res.images[0]?.image ?? "", filename: res.images[0]?.filename }
            : { image: res.image, filename: res.filename };
          if (!picked.image) throw new Error("빈 응답");

          const item: GenerateItem = {
            image: picked.image,
            filename: picked.filename,
            prompt,
            ...(s.originalPrompt && s.originalPrompt !== prompt
              ? { originalPrompt: s.originalPrompt }
              : {}),
            elapsed: res.elapsed,
            provider: res.provider,
            usage: res.usage,
            quality: res.quality ?? s.quality,
            size: res.size ?? size,
          };
          await addHistory(item, set, get);
          succeeded += 1;
          const elapsedNum = Number(res.elapsed);
          if (Number.isFinite(elapsedNum) && elapsedNum > maxElapsed) {
            maxElapsed = elapsedNum;
          }
          const elapsedMs = Math.round(elapsedNum * 1000) || (Date.now() - slotStartedAt);
          set((state) => ({
            inFlight: state.inFlight.map((f) =>
              f.id === flightId
                ? {
                    ...f,
                    status: "success",
                    endedAt: Date.now(),
                    elapsedMs,
                    phase: undefined,
                    filename: picked.filename,
                  }
                : f,
            ),
          }));
        } catch (err) {
          // Page is being torn down — server still owns the request and
          // reconcileInflight will restore it on the next load. Don't write
          // a misleading "error" mark.
          if (unloading) return;
          failed += 1;
          const msg = err instanceof Error ? err.message : "생성에 실패했습니다.";
          const errCode = (err as { code?: string } | null)?.code;
          const errStatus = (err as { status?: number } | null)?.status;
          console.warn(
            `[ima2][generate][${flightId}] FAILED in ` +
            `${Date.now() - slotStartedAt}ms code=${errCode ?? "?"} status=${errStatus ?? "?"}:`,
            err,
          );
          // 429 / USAGE_LIMIT → start a 5-min cool-down so subsequent clicks
          // don't replay the same upstream rejection. Persist via
          // setUsageLimitedUntil so other tabs see it via storage event.
          if (errCode === "USAGE_LIMIT" || errStatus === 429) {
            get().setUsageLimitedUntil(Date.now() + 5 * 60 * 1000);
          }
          if (firstErrMsg === null) {
            firstErrMsg = msg;
          }
          set((state) => ({
            inFlight: state.inFlight.map((f) =>
              f.id === flightId
                ? {
                    ...f,
                    status: "error",
                    endedAt: Date.now(),
                    elapsedMs: Date.now() - slotStartedAt,
                    errorMessage: msg,
                    phase: undefined,
                  }
                : f,
            ),
          }));
        } finally {
          set((state) => ({
            activeGenerations: Math.max(0, state.activeGenerations - 1),
          }));
          saveInFlight(get().inFlight);
        }
      }),
    );

    if (succeeded > 0 && failed === 0) {
      const label = count === 1
        ? `${maxElapsed}초 만에 생성했습니다.`
        : `${succeeded}장을 ${maxElapsed}초 만에 생성했습니다.`;
      get().showToast(label);
    } else if (succeeded > 0 && failed > 0) {
      get().showToast(`${succeeded}/${count}장 생성 성공 (${failed}장 실패)`, true);
    } else {
      const cool = get().usageLimitedUntil;
      if (cool && cool > Date.now()) {
        get().showToast(
          "OpenAI 사용 한도에 도달했습니다. 5분간 새 생성을 중지합니다.",
          true,
        );
      } else {
        get().showToast(firstErrMsg ?? "생성에 실패했습니다.", true);
      }
    }
  },

  varyCurrentResult: async () => {
    const s = get();
    const promptFromResult = s.currentImage?.prompt;
    if (!promptFromResult) {
      s.showToast("복제할 결과가 없습니다", true);
      return;
    }
    await s.generate({ overridePrompt: promptFromResult, overrideCount: 1 });
  },

  hydrateHistory() {
    void (async () => {
      try {
        const res = await getHistory({ limit: HISTORY_LIMIT });
        const history: GenerateItem[] = res.items.map((it) => ({
          image: it.url,
          url: it.url,
          filename: it.filename,
          prompt: it.prompt || undefined,
          originalPrompt: it.originalPrompt || undefined,
          provider: it.provider,
          quality: it.quality || undefined,
          size: it.size || undefined,
          usage: (it.usage as GenerateItem["usage"]) ?? undefined,
          thumb: it.url,
          createdAt: it.createdAt,
          favorite: it.favorite === true,
          sessionId: it.sessionId ?? null,
        }));
        if (history.length > 0) {
          const selected = loadSelectedFilename();
          const matched = selected
            ? history.find((it) => it.filename === selected)
            : null;
          set({ history, currentImage: matched ?? history[0] });
          if (!matched) saveSelectedFilename(history[0]?.filename ?? null);
        }
      } catch (err) {
        console.warn("[history] load failed:", err);
      }
    })();
  },

  showToast(message, error = false) {
    set({ toast: { message, error, id: Date.now() + Math.random() } });
  },
}));

// ── Graph autosave (module-level debounce) ──
type GraphSaveReason =
  | "debounced"
  | "manual"
  | "switch-session"
  | "recovery"
  | "beforeunload"
  | "queued";
type GraphSaveResult = "saved" | "skipped" | "conflict" | "failed";

const SAVE_DEBOUNCE_MS = 800;
const GRAPH_TAB_ID_KEY = "ima2.graphTabId";
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let isSavingGraph = false;
let needsGraphSave = false;
let activeGraphSavePromise: Promise<void> | null = null;
let graphSaveSeq = 0;

function getGraphTabId(): string {
  try {
    const existing = sessionStorage.getItem(GRAPH_TAB_ID_KEY);
    if (existing) return existing;
    const next = `tab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(GRAPH_TAB_ID_KEY, next);
    return next;
  } catch {
    return "tab_unavailable";
  }
}

function nextGraphSaveId(): string {
  return `gs_${Date.now().toString(36)}_${++graphSaveSeq}`;
}

async function reloadSessionAfterConflict(
  get: () => AppState,
  set: (patch: Partial<AppState>) => void,
): Promise<void> {
  const id = get().activeSessionId;
  if (!id) return;
  const { session } = await apiGetSession(id);
  const { graphNodes, graphEdges, graphVersion } = mapSessionToGraph(session);
  set({
    graphNodes,
    graphEdges,
    activeSessionGraphVersion: graphVersion,
  });
  get().showToast("그래프 버전이 달라져 최신 그래프를 다시 불러왔습니다.", true);
}

async function doSave(
  get: () => AppState,
  set: (patch: Partial<AppState>) => void,
  reason: GraphSaveReason,
): Promise<GraphSaveResult> {
  const id = get().activeSessionId;
  const graphVersion = get().activeSessionGraphVersion;
  if (!id) return "skipped";
  if (graphVersion == null) return "skipped";
  const { graphNodes, graphEdges } = get();
  const nodes = graphNodes.map((n) => ({
    id: n.id,
    x: n.position.x,
    y: n.position.y,
    data: n.data as unknown as Record<string, unknown>,
  }));
  const edges = graphEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    data: {},
  }));
  try {
    const res = await saveSessionGraph(id, graphVersion, nodes, edges, {
      saveId: nextGraphSaveId(),
      saveReason: reason,
      tabId: getGraphTabId(),
    });
    if (get().activeSessionId !== id) return "skipped";
    set({ activeSessionGraphVersion: res.graphVersion });
    return "saved";
  } catch (err) {
    if ((err as { status?: number }).status === 409) {
      await reloadSessionAfterConflict(get, set);
      return "conflict";
    }
    console.warn("[sessions] save failed:", err);
    return "failed";
  }
}

async function runGraphSaveQueue(
  get: () => AppState,
  set: (patch: Partial<AppState>) => void,
  reason: GraphSaveReason,
): Promise<void> {
  if (isSavingGraph) {
    needsGraphSave = true;
    if (activeGraphSavePromise) await activeGraphSavePromise;
    return;
  }
  isSavingGraph = true;
  activeGraphSavePromise = (async () => {
    let nextReason = reason;
    do {
      needsGraphSave = false;
      const result = await doSave(get, set, nextReason);
      if (result === "conflict" || result === "failed") break;
      nextReason = "queued";
    } while (needsGraphSave);
  })().finally(() => {
    isSavingGraph = false;
    activeGraphSavePromise = null;
  });
  await activeGraphSavePromise;
}

function scheduleGraphSaveImpl(
  get: () => AppState,
  set: (patch: Partial<AppState>) => void,
  reason: GraphSaveReason = "debounced",
) {
  const s = get();
  if (!s.activeSessionId) return;
  if (s.sessionLoading) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void runGraphSaveQueue(get, set, reason);
  }, SAVE_DEBOUNCE_MS);
}

async function flushGraphSaveImpl(
  get: () => AppState,
  set: (patch: Partial<AppState>) => void,
  reason: GraphSaveReason = "manual",
) {
  let shouldSaveNow = false;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    shouldSaveNow = true;
  }
  if (isSavingGraph) {
    needsGraphSave = true;
    if (activeGraphSavePromise) await activeGraphSavePromise;
    return;
  }
  if (shouldSaveNow) {
    await runGraphSaveQueue(get, set, reason);
  }
}

// Synchronous-ish save on page unload via sendBeacon
// (fetch in beforeunload is not reliable in modern browsers).
export function flushGraphSaveBeacon(get: () => AppState): void {
  const s = get();
  if (!s.activeSessionId) return;
  if (s.activeSessionGraphVersion == null) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const nodes = s.graphNodes.map((n) => ({
    id: n.id,
    x: n.position.x,
    y: n.position.y,
    data: n.data as unknown as Record<string, unknown>,
  }));
  const edges = s.graphEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    data: {},
  }));
  const url = `/api/sessions/${encodeURIComponent(s.activeSessionId)}/graph`;
  const body = JSON.stringify({ nodes, edges });
  try {
    void fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "If-Match": String(s.activeSessionGraphVersion),
        "X-Ima2-Graph-Save-Id": nextGraphSaveId(),
        "X-Ima2-Graph-Save-Reason": "beforeunload",
        "X-Ima2-Tab-Id": getGraphTabId(),
      },
      body,
      keepalive: true,
    });
  } catch {}
}

async function addHistory(
  item: GenerateItem,
  set: (
    partial:
      | Partial<AppState>
      | ((state: AppState) => Partial<AppState>),
  ) => void,
  _get: () => AppState,
): Promise<void> {
  const thumb = await compressImage(item.image).catch(() => item.image);
  const url = item.filename ? `/generated/${item.filename}` : item.image;
  const withThumb: GenerateItem = {
    ...item,
    thumb,
    url,
    createdAt: item.createdAt || Date.now(),
  };
  saveSelectedFilename(withThumb.filename ?? null);
  set((state) => ({
    history: [withThumb, ...state.history].slice(0, HISTORY_LIMIT),
    currentImage: withThumb,
  }));
}
