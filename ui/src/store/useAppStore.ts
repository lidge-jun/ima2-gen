import { create } from "zustand";
import type {
  Count,
  Format,
  GenerateItem,
  GenerateResponse,
  ImageModel,
  Moderation,
  Provider,
  Quality,
  ResolvedTheme,
  SettingsSection,
  SizePreset,
  ThemePreference,
  UIMode,
} from "../types";
import { isMultiResponse } from "../types";
import {
  postGenerate,
  getHistory,
  getInflight,
  cancelInflight,
  postNodeGenerateStream,
  listSessions as apiListSessions,
  createSession as apiCreateSession,
  getSession as apiGetSession,
  renameSession as apiRenameSession,
  deleteSession as apiDeleteSession,
  saveSessionGraph,
  getSessionStyleSheet,
  saveSessionStyleSheet,
  setSessionStyleSheetEnabled,
  extractSessionStyleSheet,
  type SessionSummary,
  type SessionFull,
  type StyleSheet,
} from "../lib/api";
import { compressImage } from "../lib/image";
import { compressToBase64, isHeic, hasAlphaChannel } from "../lib/compress";
import {
  normalizeCustomSizePairDetailed,
  parseRequestedCustomSide,
  type CustomSizeAdjustmentReason,
} from "../lib/size";
import {
  DEFAULT_IMAGE_MODEL,
  IMAGE_MODEL_STORAGE_KEY,
  isImageModel,
} from "../lib/imageModels";
import { newClientNodeId, initialPos, type ClientNodeId } from "../lib/graph";
import {
  applyComponentSelection,
  applySelectedNodeIds,
  getSelectedNodeIds,
} from "../lib/nodeSelection";
import {
  getDirectUnselectedChildren,
  getUnselectedDownstreamIds,
  nodeHasImage,
  topologicalSortSelected,
  validateBatchDependencies,
  type NodeBatchMode,
} from "../lib/nodeBatch";
import type { Node as FlowNode, Edge as FlowEdge } from "@xyflow/react";
import { t, loadLocale, saveLocale, type Locale } from "../i18n";
import type { ImaErrorCode } from "../lib/errorCodes";
import { handleError } from "../lib/errorHandler";
import { ENABLE_CARD_NEWS_MODE, ENABLE_NODE_MODE } from "../lib/devMode";

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
    if (raw === "card-news") return ENABLE_CARD_NEWS_MODE ? raw : "classic";
    if (raw === "node") return ENABLE_NODE_MODE ? raw : "classic";
    if (raw === "classic") return raw;
  } catch {}
  return "classic";
}

function loadThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem("ima2:theme");
    if (raw === "system" || raw === "dark" || raw === "light") return raw;
  } catch {}
  return "system";
}

function loadImageModel(): ImageModel {
  try {
    const raw = localStorage.getItem(IMAGE_MODEL_STORAGE_KEY);
    if (isImageModel(raw)) return raw;
  } catch {}
  return DEFAULT_IMAGE_MODEL;
}

function saveImageModel(model: ImageModel): void {
  try {
    localStorage.setItem(IMAGE_MODEL_STORAGE_KEY, model);
  } catch {}
}

function resolveThemePreference(theme: ThemePreference): ResolvedTheme {
  if (theme === "dark" || theme === "light") return theme;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

type PersistedInFlight = {
  id: string;
  prompt: string;
  startedAt: number;
  phase?: string;
  sessionId?: string | null;
  parentNodeId?: string | null;
  clientNodeId?: string | null;
  kind?: "classic" | "node";
};
const INFLIGHT_TTL_MS = 180_000;

type ServerInFlightJob = {
  requestId: string;
  kind?: string;
  prompt?: string;
  startedAt: number;
  phase?: string;
  meta?: Record<string, unknown>;
};

function toPersistedInFlightJob(job: ServerInFlightJob): PersistedInFlight {
  const meta = job.meta ?? {};
  const kind =
    job.kind === "classic" || job.kind === "node"
      ? job.kind
      : meta.kind === "classic" || meta.kind === "node"
        ? meta.kind
        : undefined;
  return {
    id: job.requestId,
    prompt: typeof job.prompt === "string" ? job.prompt : "",
    startedAt: job.startedAt,
    phase: typeof job.phase === "string" ? job.phase : undefined,
    sessionId: typeof meta.sessionId === "string" ? meta.sessionId : null,
    parentNodeId: typeof meta.parentNodeId === "string" ? meta.parentNodeId : null,
    clientNodeId: typeof meta.clientNodeId === "string" ? meta.clientNodeId : null,
    kind,
  };
}

function loadInFlight(): PersistedInFlight[] {
  try {
    const raw = localStorage.getItem("ima2.inFlight");
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const now = Date.now();
    return arr
      .filter(
        (x) =>
          x && typeof x.id === "string" && typeof x.prompt === "string" &&
          typeof x.startedAt === "number" && now - x.startedAt < INFLIGHT_TTL_MS,
      )
      .map((x) => ({
        id: x.id,
        prompt: x.prompt,
        startedAt: x.startedAt,
        phase: typeof x.phase === "string" ? x.phase : undefined,
        sessionId: typeof x.sessionId === "string" ? x.sessionId : null,
        parentNodeId: typeof x.parentNodeId === "string" ? x.parentNodeId : null,
        clientNodeId: typeof x.clientNodeId === "string" ? x.clientNodeId : null,
        kind: x.kind === "classic" || x.kind === "node" ? x.kind : undefined,
      }));
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
        useAppStore.getState().showToast(t("toast.localStorageFull"), true);
      } catch {}
    }
  }
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

function loadActiveSessionId(): string | null {
  try {
    const raw = localStorage.getItem("ima2.activeSessionId");
    return typeof raw === "string" && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

function saveActiveSessionId(id: string | null): void {
  try {
    if (id) localStorage.setItem("ima2.activeSessionId", id);
    else localStorage.removeItem("ima2.activeSessionId");
  } catch {}
}

const HISTORY_LIMIT = 500;
const MAX_REFERENCE_IMAGES = 5;

type GraphSaveReason = "debounced" | "manual" | "switch-session" | "recovery" | "beforeunload" | "queued";
type GraphSaveResult = "saved" | "skipped" | "conflict" | "failed";

function narrowGenerateKind(k?: string | null): GenerateItem["kind"] {
  return k === "classic" || k === "edit" || k === "generate" ||
    k === "card-news-card" || k === "card-news-set" ? k : null;
}

function mapHistoryItem(it: Awaited<ReturnType<typeof getHistory>>["items"][number]): GenerateItem {
  return {
    image: it.url,
    url: it.url,
    filename: it.filename,
    thumb: it.url,
    prompt: it.prompt ?? undefined,
    size: it.size ?? undefined,
    quality: it.quality ?? undefined,
    format: it.format as Format | undefined,
    model: it.model ?? undefined,
    provider: it.provider,
    usage: (it.usage as GenerateItem["usage"]) ?? undefined,
    createdAt: it.createdAt,
    sessionId: it.sessionId ?? null,
    nodeId: it.nodeId ?? null,
    clientNodeId: it.clientNodeId ?? null,
    requestId: it.requestId ?? null,
    kind: narrowGenerateKind(it.kind),
    setId: it.setId ?? null,
    cardId: it.cardId ?? null,
    cardOrder: it.cardOrder ?? null,
    headline: it.headline ?? null,
    body: it.body ?? null,
    cards: it.cards,
    refsCount: it.refsCount ?? 0,
  };
}

function stripDataUrlPrefix(dataUrl: string): string {
  return dataUrl.replace(/^data:[^;]+;base64,/, "");
}

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
  recoveryRequestId?: string | null;
  pendingPhase?: string | null;
  pendingStartedAt?: number | null;
  partialImageUrl?: string | null;
  error?: string;
  elapsed?: number;
  webSearchCalls?: number;
  model?: string | null;
  referenceImages?: string[];
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
      recoveryRequestId: (d.recoveryRequestId ?? null) as string | null,
      pendingPhase: (d.pendingPhase ?? null) as string | null,
      pendingStartedAt:
        typeof d.pendingStartedAt === "number" ? d.pendingStartedAt : null,
      partialImageUrl: null,
      error: d.error as string | undefined,
      elapsed: d.elapsed as number | undefined,
      webSearchCalls: d.webSearchCalls as number | undefined,
      model: (d.model ?? null) as string | null,
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

type CustomSizeConfirmState = {
  requestedW: number;
  requestedH: number;
  adjustedW: number;
  adjustedH: number;
  reasons: CustomSizeAdjustmentReason[];
  continuation:
    | { kind: "classic" }
    | { kind: "node"; clientId: ClientNodeId };
} | null;

type AppState = {
  provider: Provider;
  quality: Quality;
  sizePreset: SizePreset;
  customW: number;
  customH: number;
  format: Format;
  moderation: Moderation;
  imageModel: ImageModel;
  count: Count;
  promptMode: "auto" | "direct";
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
  currentImage: GenerateItem | null;
  history: GenerateItem[];
  toast: ToastState;
  customSizeConfirm: CustomSizeConfirmState;
  rightPanelOpen: boolean;
  toggleRightPanel: () => void;
  galleryOpen: boolean;
  openGallery: () => void;
  closeGallery: () => void;

  settingsOpen: boolean;
  activeSettingsSection: SettingsSection;
  openSettings: (section?: SettingsSection) => void;
  closeSettings: () => void;
  toggleSettings: () => void;
  setActiveSettingsSection: (section: SettingsSection) => void;

  uiMode: UIMode;
  setUIMode: (m: UIMode) => void;

  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
  syncThemeFromStorage: () => void;
  refreshResolvedTheme: () => void;

  locale: Locale;
  setLocale: (l: Locale) => void;

  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  setGraphNodes: (n: GraphNode[]) => void;
  setGraphEdges: (e: GraphEdge[]) => void;
  nodeSelectionMode: boolean;
  nodeBatchRunning: boolean;
  nodeBatchStopping: boolean;
  toggleNodeSelectionMode: () => void;
  selectAllGraphNodes: () => void;
  selectNodeGraph: (clientId: ClientNodeId, additive: boolean) => void;
  clearNodeSelection: () => void;
  runNodeBatch: (mode: NodeBatchMode) => Promise<void>;
  cancelNodeBatch: () => void;
  addRootNode: () => ClientNodeId;
  addChildNode: (parentClientId: ClientNodeId) => ClientNodeId;
  addSiblingNode: (sourceClientId: ClientNodeId) => ClientNodeId;
  duplicateBranchRoot: (sourceClientId: ClientNodeId) => ClientNodeId;
  addChildNodeAt: (parentClientId: ClientNodeId, position: { x: number; y: number }) => ClientNodeId;
  connectNodes: (sourceClientId: ClientNodeId, targetClientId: ClientNodeId) => void;
  updateNodePrompt: (clientId: ClientNodeId, prompt: string) => void;
  addNodeReferences: (clientId: ClientNodeId, files: File[]) => Promise<void>;
  addNodeReferenceDataUrl: (clientId: ClientNodeId, dataUrl: string) => void;
  removeNodeReference: (clientId: ClientNodeId, index: number) => void;
  clearNodeReferences: (clientId: ClientNodeId) => void;
  generateNode: (clientId: ClientNodeId) => Promise<void>;
  runGenerateNode: (clientId: ClientNodeId, sizeOverride?: string) => Promise<void>;
  runGenerateNodeInPlace: (
    clientId: ClientNodeId,
    options?: {
      sizeOverride?: string;
      parentServerNodeIdOverride?: string | null;
      suppressToast?: boolean;
    },
  ) => Promise<string | null>;
  deleteNode: (clientId: ClientNodeId) => void;
  deleteNodes: (clientIds: ClientNodeId[]) => void;
  disconnectEdge: (edgeId: string) => void;
  disconnectEdges: (edgeIds: string[]) => void;

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
  flushGraphSave: (reason?: GraphSaveReason) => Promise<void>;

  // Style sheet (0.10)
  styleSheet: StyleSheet | null;
  styleSheetEnabled: boolean;
  styleSheetExtracting: boolean;
  loadStyleSheet: () => Promise<void>;
  saveStyleSheet: (sheet: StyleSheet | null, enabled?: boolean) => Promise<void>;
  toggleStyleSheetEnabled: () => Promise<void>;
  extractStyleSheet: () => Promise<void>;

  setProvider: (p: Provider) => void;
  setQuality: (q: Quality) => void;
  setSizePreset: (s: SizePreset) => void;
  setCustomSize: (w: number, h: number) => void;
  setFormat: (f: Format) => void;
  setModeration: (m: Moderation) => void;
  setImageModel: (m: ImageModel) => void;
  setCount: (c: Count) => void;
  setPromptMode: (m: "auto" | "direct") => void;
  setPrompt: (p: string) => void;
  selectHistory: (item: GenerateItem) => void;
  removeFromHistory: (filename: string) => void;
  addHistoryItem: (item: GenerateItem) => void;
  generate: () => Promise<void>;
  runGenerate: (sizeOverride?: string) => Promise<void>;
  confirmCustomSizeAdjustment: () => Promise<void>;
  cancelCustomSizeAdjustment: () => void;
  hydrateHistory: () => void;
  showToast: (message: string, error?: boolean) => void;
  errorCard: { code: ImaErrorCode; fallbackMessage?: string; id: number } | null;
  showErrorCard: (code: ImaErrorCode, params?: { fallbackMessage?: string }) => void;
  dismissErrorCard: () => void;
  getResolvedSize: () => string;
};

function formatSize(w: number, h: number): string {
  return `${w}x${h}`;
}

function getCustomSizeConfirmation(
  state: AppState,
  continuation: NonNullable<CustomSizeConfirmState>["continuation"],
): CustomSizeConfirmState {
  if (state.sizePreset !== "custom") return null;
  const result = normalizeCustomSizePairDetailed(
    state.customW,
    state.customH,
    state.customW,
    state.customH,
  );
  if (!result.adjusted) return null;
  return {
    requestedW: result.requestedW,
    requestedH: result.requestedH,
    adjustedW: result.w,
    adjustedH: result.h,
    reasons: result.reasons,
    continuation,
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  provider: "oauth",
  quality: "medium",
  sizePreset: "1024x1024",
  customW: 1920,
  customH: 1088,
  format: "png",
  moderation: "low",
  count: 1,
  promptMode: "auto",
  prompt: "",
  referenceImages: [],
  addReferences: async (files) => {
    const allowed = MAX_REFERENCE_IMAGES - get().referenceImages.length;
    const toAdd = files.slice(0, Math.max(0, allowed));
    const heicSkipped = toAdd.filter(isHeic);
    const usable = toAdd.filter((f) => !isHeic(f));
    const results = await Promise.all(
      usable.map(async (f) => {
        try {
          return await compressToBase64(f, {
            preserveTransparency: hasAlphaChannel(f),
          });
        } catch (err) {
          console.warn("[addReferences] compress failed", err);
          return null;
        }
      }),
    );
    const valid = results.filter((x): x is string => !!x);
    set((s) => ({
      referenceImages: [...s.referenceImages, ...valid].slice(0, MAX_REFERENCE_IMAGES),
    }));
    if (heicSkipped.length > 0) {
      get().showToast(t("toast.refHeicUnsupported"), true);
    }
    const failedCount = usable.length - valid.length;
    if (failedCount > 0) {
      get().showToast(t("toast.refTooLarge"), true);
    }
    if (files.length > allowed) {
      get().showToast(t("toast.refLimitExceeded"), true);
    }
  },
  addReferenceDataUrl: (dataUrl) => {
    set((s) =>
      s.referenceImages.length >= MAX_REFERENCE_IMAGES
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
      get().showToast(t("toast.noCurrentImageForRef"), true);
      return;
    }
    if (get().referenceImages.length >= MAX_REFERENCE_IMAGES) {
      get().showToast(t("toast.refSlotFull"), true);
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
        get().showToast(t("toast.currentImageLoadFailed"), true);
        return;
      }
    }
    set((s) => ({
      referenceImages: [...s.referenceImages, dataUrl].slice(0, MAX_REFERENCE_IMAGES),
    }));
    get().showToast(t("toast.addedCurrentAsRef"));
  },
  activeGenerations: loadInFlight().length,
  inFlight: loadInFlight(),
  startInFlightPolling: () => {
    if (typeof window === "undefined") return;
    const w = window as unknown as { __ima2InflightTimer?: number };
    if (w.__ima2InflightTimer) return;
    const tick = async () => {
      const cur = get().inFlight;
      if (cur.length === 0) {
        if (w.__ima2InflightTimer) {
          clearInterval(w.__ima2InflightTimer);
          w.__ima2InflightTimer = undefined;
        }
        return;
      }
      // Merge server-side phase info so the spinner label reflects real progress
      try {
        const inflightKind: "classic" | "node" = get().uiMode === "node" ? "node" : "classic";
        const inflightSessionId =
          inflightKind === "node" ? get().activeSessionId ?? undefined : undefined;
        const { jobs } = await getInflight({
          kind: inflightKind,
          sessionId: inflightSessionId,
        });
        const byId = new Map(jobs.map((j) => [j.requestId, j] as const));
        let changed = false;
        const now0 = Date.now();
        const GRACE_MS = 5000;
        const nextInflight: typeof cur = [];
        for (const f of get().inFlight) {
          // Out-of-scope entries (different kind/session) must not be dropped
          // based on this tick's byId — the server wasn't asked about them.
          const fKind = f.kind ?? "classic";
          const matchesScope =
            fKind === inflightKind &&
            (inflightKind !== "node" ||
              (f.sessionId ?? null) === (inflightSessionId ?? null));
          if (!matchesScope) {
            nextInflight.push(f);
            continue;
          }
          // If server no longer knows this job and enough time has passed,
          // drop it locally so the spinner does not linger after completion.
          if (!byId.has(f.id) && now0 - f.startedAt > GRACE_MS) {
            changed = true;
            continue;
          }
          const p = byId.get(f.id);
          if (p) {
            const serverJob = toPersistedInFlightJob(p);
            const nextJob = {
              ...f,
              phase: serverJob.phase,
              sessionId: serverJob.sessionId,
              parentNodeId: serverJob.parentNodeId,
              clientNodeId: serverJob.clientNodeId,
              kind: serverJob.kind,
            };
            if (
              nextJob.phase !== f.phase ||
              nextJob.sessionId !== f.sessionId ||
              nextJob.parentNodeId !== f.parentNodeId ||
              nextJob.clientNodeId !== f.clientNodeId ||
              nextJob.kind !== f.kind
            ) {
              changed = true;
            }
            nextInflight.push(nextJob);
          } else {
            nextInflight.push(f);
          }
        }
        if (changed) {
          saveInFlight(nextInflight);
          set({ inFlight: nextInflight, activeGenerations: nextInflight.length });
        }
      } catch {}
      try {
        const lastKnown = get().history.reduce(
          (max, it) => (it.createdAt && it.createdAt > max ? it.createdAt : max),
          0,
        );
        const { items } = await getHistory({ limit: HISTORY_LIMIT, since: lastKnown });
        const arr: GenerateItem[] = items.map(mapHistoryItem);
        const existing = get().history;
        const fresh = arr.filter(
          (a) => !existing.some((e) => e.filename === a.filename),
        );
        if (fresh.length > 0) {
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
        // Prune strategy: TTL-based only. Do not attempt to correlate
        // history items with inFlight entries — backend ordering may differ
        // from local generation order under concurrency. Matching by prompt
        // is also unreliable when the same prompt is queued twice.
        const now = Date.now();
        const remaining = get().inFlight.filter(
          (f) => now - f.startedAt < INFLIGHT_TTL_MS,
        );
        if (remaining.length !== get().inFlight.length) {
          saveInFlight(remaining);
          set({ inFlight: remaining, activeGenerations: remaining.length });
        }
      } catch {}
    };
    w.__ima2InflightTimer = window.setInterval(tick, 1500) as unknown as number;
  },
  reconcileInflight: async () => {
    try {
      const inflightKind = get().uiMode === "node" ? "node" : "classic";
      const inflightSessionId =
        inflightKind === "node" ? get().activeSessionId ?? undefined : undefined;
      const { jobs } = await getInflight({
        kind: inflightKind,
        sessionId: inflightSessionId,
      });
      const serverById = new Map(jobs.map((j) => [j.requestId, j] as const));
      const now = Date.now();
      const local = get().inFlight;
      // Keep local entries that are either still known to the server,
      // or started very recently (<10s — request may be in-flight before
      // /api/inflight registered). Keep out-of-scope entries because this
      // request only asked the server about the current mode/session.
      const merged = local.flatMap((f) => {
        const serverJob = serverById.get(f.id);
        if (serverJob) {
          const restored = toPersistedInFlightJob(serverJob);
          return [{ ...f, ...restored, prompt: f.prompt || restored.prompt }];
        }
        const fKind = f.kind ?? "classic";
        const matchesScope =
          fKind === inflightKind &&
          (inflightKind !== "node" ||
            (f.sessionId ?? null) === (inflightSessionId ?? null));
        if (!matchesScope) return [f];
        return now - f.startedAt < 10_000 ? [f] : [];
      });
      // Bring in server-only jobs (started from another tab / process)
      const localIds = new Set(merged.map((f) => f.id));
      for (const j of jobs) {
        if (!localIds.has(j.requestId)) {
          merged.push(toPersistedInFlightJob(j));
        }
      }
      saveInFlight(merged);
      set({ inFlight: merged, activeGenerations: merged.length });
      if (merged.length > 0) get().startInFlightPolling();
    } catch {
      // Silent — endpoint may not exist on older servers.
    }
  },
  syncFromStorage: () => {
    // Triggered by `storage` events (another tab changed localStorage).
    const nextInflight = loadInFlight();
    const nextSelected = loadSelectedFilename();
    const nextImageModel = loadImageModel();
    set((s) => ({
      inFlight: nextInflight,
      activeGenerations: nextInflight.length,
      imageModel: nextImageModel,
      currentImage:
        nextSelected && s.currentImage?.filename !== nextSelected
          ? s.history.find((h) => h.filename === nextSelected) ?? s.currentImage
          : s.currentImage,
    }));
    if (nextInflight.length > 0) get().startInFlightPolling();
  },
  currentImage: null,
  history: [],
  toast: null,
  customSizeConfirm: null,
  errorCard: null,
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
  openGallery: () => set({ galleryOpen: true }),
  closeGallery: () => set({ galleryOpen: false }),

  imageModel: loadImageModel(),

  settingsOpen: false,
  activeSettingsSection: "account",
  openSettings: (section = "account") =>
    set({ settingsOpen: true, activeSettingsSection: section }),
  closeSettings: () => set({ settingsOpen: false }),
  toggleSettings: () =>
    set((s) => ({
      settingsOpen: !s.settingsOpen,
      activeSettingsSection: s.settingsOpen ? s.activeSettingsSection : "account",
    })),
  setActiveSettingsSection: (section) => set({ activeSettingsSection: section }),

  uiMode: loadUIMode(),
  setUIMode: (m) => {
    const next =
      m === "card-news" && !ENABLE_CARD_NEWS_MODE ? "classic" :
        m === "node" && !ENABLE_NODE_MODE ? "classic" :
          m;
    try { localStorage.setItem("ima2.uiMode", next); } catch {}
    set({ uiMode: next });
  },

  theme: loadThemePreference(),
  resolvedTheme: resolveThemePreference(loadThemePreference()),
  setTheme: (theme) => {
    try {
      localStorage.setItem("ima2:theme", theme);
    } catch {}
    set({ theme, resolvedTheme: resolveThemePreference(theme) });
  },
  syncThemeFromStorage: () => {
    const theme = loadThemePreference();
    set({ theme, resolvedTheme: resolveThemePreference(theme) });
  },
  refreshResolvedTheme: () => {
    set((s) => ({ resolvedTheme: resolveThemePreference(s.theme) }));
  },

  locale: loadLocale(),
  setLocale: (l) => {
    saveLocale(l);
    set({ locale: l });
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
  disconnectEdge: (edgeId) => {
    get().disconnectEdges([edgeId]);
  },
  disconnectEdges: (edgeIds) => {
    const edgeIdSet = new Set(edgeIds);
    if (edgeIdSet.size === 0) return;
    const removedEdges = get().graphEdges.filter((edge) => edgeIdSet.has(edge.id));
    if (removedEdges.length === 0) return;
    const nextEdges = get().graphEdges.filter((edge) => !edgeIdSet.has(edge.id));
    const removedTargets = new Set(removedEdges.map((edge) => edge.target));
    const nextNodes = get().graphNodes.map((node) => {
      if (!removedTargets.has(node.id)) return node;
      const remainingIncoming = nextEdges.find((edge) => edge.target === node.id);
      const remainingParent = remainingIncoming
        ? get().graphNodes.find((candidate) => candidate.id === remainingIncoming.source)
        : null;
      return {
        ...node,
        data: {
          ...node.data,
          parentServerNodeId: remainingParent?.data.serverNodeId ?? null,
        },
      };
    });
    set({ graphNodes: nextNodes, graphEdges: nextEdges });
    get().scheduleGraphSave();
    get().showToast(t("edge.disconnected"));
  },
  nodeSelectionMode: false,
  nodeBatchRunning: false,
  nodeBatchStopping: false,
  toggleNodeSelectionMode: () => {
    const next = !get().nodeSelectionMode;
    set({
      nodeSelectionMode: next,
      ...(next ? {} : { graphNodes: applySelectedNodeIds(get().graphNodes, []) }),
    });
  },
  selectAllGraphNodes: () => {
    set({ graphNodes: applySelectedNodeIds(get().graphNodes, get().graphNodes.map((n) => n.id)) });
  },
  selectNodeGraph: (clientId, additive) => {
    set({
      graphNodes: applyComponentSelection(get().graphNodes, get().graphEdges, clientId, additive),
    });
  },
  clearNodeSelection: () => {
    set({ graphNodes: applySelectedNodeIds(get().graphNodes, []) });
  },
  cancelNodeBatch: () => {
    if (!get().nodeBatchRunning) return;
    set({ nodeBatchStopping: true });
    get().showToast(t("nodeBatch.stopQueued"));
  },

  sessions: [],
  activeSessionId: null,
  activeSessionGraphVersion: null,
  sessionLoading: false,
  styleSheet: null,
  styleSheetEnabled: false,
  styleSheetExtracting: false,

  async loadStyleSheet() {
    const sid = get().activeSessionId;
    if (!sid) {
      set({ styleSheet: null, styleSheetEnabled: false });
      return;
    }
    try {
      const res = await getSessionStyleSheet(sid);
      if (get().activeSessionId !== sid) return;
      set({ styleSheet: res.styleSheet, styleSheetEnabled: !!res.enabled });
    } catch (err) {
      console.warn("[styleSheet] load failed:", err);
    }
  },

  async saveStyleSheet(sheet, enabled) {
    const sid = get().activeSessionId;
    if (!sid) return;
    try {
      await saveSessionStyleSheet(sid, sheet, enabled);
      if (get().activeSessionId !== sid) return;
      set({
        styleSheet: sheet,
        ...(typeof enabled === "boolean" ? { styleSheetEnabled: enabled } : {}),
      });
      get().showToast(t("styleSheet.saved"));
    } catch (err) {
      console.warn("[styleSheet] save failed:", err);
      get().showToast((err as Error).message, true);
    }
  },

  async toggleStyleSheetEnabled() {
    const sid = get().activeSessionId;
    if (!sid) return;
    const next = !get().styleSheetEnabled;
    try {
      await setSessionStyleSheetEnabled(sid, next);
      if (get().activeSessionId !== sid) return;
      set({ styleSheetEnabled: next });
    } catch (err) {
      console.warn("[styleSheet] toggle failed:", err);
      get().showToast((err as Error).message, true);
    }
  },

  async extractStyleSheet() {
    const sid = get().activeSessionId;
    if (!sid) return;
    const prompt = get().prompt.trim();
    if (!prompt) {
      get().showToast(t("styleSheet.noPrompt"), true);
      return;
    }
    const ref = get().referenceImages[0];
    set({ styleSheetExtracting: true });
    try {
      const { styleSheet } = await extractSessionStyleSheet(sid, prompt, ref);
      if (get().activeSessionId !== sid) {
        set({ styleSheetExtracting: false });
        return;
      }
      set({ styleSheet, styleSheetEnabled: true, styleSheetExtracting: false });
      get().showToast(t("styleSheet.extracted"));
    } catch (err) {
      set({ styleSheetExtracting: false });
      console.warn("[styleSheet] extract failed:", err);
      const code = (err as { code?: string }).code;
      const msg =
        code === "STYLE_SHEET_NO_KEY"
          ? t("styleSheet.errNoKey")
          : code === "STYLE_SHEET_EMPTY" || code === "STYLE_SHEET_PARSE" || code === "STYLE_SHEET_SHAPE"
            ? t("styleSheet.errBadOutput")
            : (err as Error).message;
      get().showToast(msg, true);
    }
  },

  async loadSessions() {
    try {
      const { sessions } = await apiListSessions();
      set({ sessions });
      const current = get().activeSessionId;
      if (!current) {
        const savedId = loadActiveSessionId();
        const savedExists = savedId ? sessions.some((s) => s.id === savedId) : false;
        if (savedId && savedExists) {
          await get().switchSession(savedId);
        } else {
          await get().createAndSwitchSession(t("session.firstGraph"));
        }
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
      saveActiveSessionId(id);
      // Serialize reconcile and recovery so the two async writers don't race.
      // reconcileGraphPending already calls recoverGraphNodesFromHistory at the
      // end, but we await it explicitly here so any subsequent tick sees the
      // recovered state.
      await get().reconcileGraphPending().catch(() => {});
      // Fetch style sheet for the newly active session (non-blocking on failure).
      get().loadStyleSheet().catch(() => {});
    } catch (err) {
      console.warn("[sessions] switch failed:", err);
      set({ sessionLoading: false });
      get().showToast(t("toast.sessionLoadFailed"), true);
    }
  },

  async reconcileGraphPending() {
    const sid = get().activeSessionId;
    if (!sid) return;
    const pendingNodes = get().graphNodes.filter(
      (n) => n.data?.pendingRequestId && (n.data.status === "pending" || n.data.status === "reconciling"),
    );
    if (pendingNodes.length > 0) {
      let jobs: Array<{ requestId: string; phase?: string }> = [];
      try {
        const res = await getInflight({ kind: "node", sessionId: sid });
        jobs = res.jobs;
      } catch {
        // If inflight cannot be queried, skip pending transition but still
        // attempt orphan recovery below.
        jobs = [];
      }
      const byId = new Map(jobs.map((j) => [j.requestId, j.phase] as const));
      const now = Date.now();
      const GRACE_MS = 10_000;
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
        // Not in-flight anymore. Apply B grace window if we know when it started —
        // the server may have just finished and the response is still en route.
        const startedAt = n.data.pendingStartedAt ?? 0;
        if (startedAt && now - startedAt < GRACE_MS) {
          return {
            ...n,
            data: { ...n.data, status: "reconciling" as const },
          };
        }
        // Image may have landed, or job was lost.
        const hasAsset = !!n.data.imageUrl || !!n.data.serverNodeId;
        return {
          ...n,
          data: {
            ...n.data,
            pendingRequestId: null,
            pendingPhase: null,
            pendingStartedAt: null,
            partialImageUrl: null,
            status: hasAsset ? ("ready" as const) : ("stale" as const),
            error: hasAsset ? undefined : t("session.assetAbortedError"),
          },
        };
      });
      set({ graphNodes: next });
    }
    // Always attempt orphan recovery: covers A-sanitized empty nodes and
    // cross-session completions that never landed in this graph.
    await recoverGraphNodesFromHistory(get, set).catch(() => {});
  },

  async createAndSwitchSession(title?: string) {
    if (title == null) title = t("session.untitled");
    try {
      const { session } = await apiCreateSession(title);
      set({
        sessions: [session as SessionSummary, ...get().sessions],
        activeSessionId: session.id,
        activeSessionGraphVersion: session.graphVersion,
        graphNodes: [],
        graphEdges: [],
      });
      saveActiveSessionId(session.id);
    } catch (err) {
      console.warn("[sessions] create failed:", err);
      get().showToast(t("toast.sessionCreateFailed"), true);
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
      get().showToast(t("toast.sessionRenameFailed"), true);
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
        saveActiveSessionId(null);
        if (remaining.length > 0) {
          await get().switchSession(remaining[0].id);
        } else {
          await get().createAndSwitchSession(t("session.firstGraph"));
        }
      }
    } catch (err) {
      get().showToast(t("toast.sessionDeleteFailed"), true);
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
    const depth = 0;
    const siblings = get().graphNodes.filter((n) => !n.data.parentServerNodeId).length;
    const node: GraphNode = {
      id: clientId,
      type: "imageNode",
      position: initialPos(depth, siblings),
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
    const siblings = get().graphEdges.filter((e) => e.source === parentClientId).length;
    const node: GraphNode = {
      id: clientId,
      type: "imageNode",
      position: { x: parent.position.x + 360, y: parent.position.y + siblings * 320 },
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
      const depth = 0;
      const siblings = get().graphNodes.filter((n) => !n.data.parentServerNodeId).length;
      const node: GraphNode = {
        id: clientId,
        type: "imageNode",
        position: initialPos(depth, siblings),
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
    const siblings = get().graphEdges.filter((e) => e.source === parentClientId).length;
    const node: GraphNode = {
      id: clientId,
      type: "imageNode",
      position: { x: parent.position.x + 360, y: parent.position.y + siblings * 320 },
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

  addNodeReferences: async (clientId, files) => {
    const node = get().graphNodes.find((n) => n.id === clientId);
    if (!node) return;
    if (node.data.parentServerNodeId) {
      get().showToast(t("node.nodeRefsUnsupportedForEdit"), true);
      return;
    }
    const currentRefs = node.data.referenceImages ?? [];
    const allowed = MAX_REFERENCE_IMAGES - currentRefs.length;
    if (allowed <= 0) {
      get().showToast(t("toast.refLimitExceeded"), true);
      return;
    }
    const toAdd = files.slice(0, Math.max(0, allowed));
    const heicSkipped = toAdd.filter(isHeic);
    const usable = toAdd.filter((f) => !isHeic(f));
    const results = await Promise.all(
      usable.map(async (f) => {
        try {
          return await compressToBase64(f, {
            preserveTransparency: hasAlphaChannel(f),
          });
        } catch (err) {
          console.warn("[addNodeReferences] compress failed", err);
          return null;
        }
      }),
    );
    const valid = results.filter((x): x is string => !!x);
    if (valid.length > 0) {
      set({
        graphNodes: get().graphNodes.map((n) =>
          n.id === clientId
            ? {
                ...n,
                data: {
                  ...n.data,
                  referenceImages: [
                    ...(n.data.referenceImages ?? []),
                    ...valid,
                  ].slice(0, MAX_REFERENCE_IMAGES),
                },
              }
            : n,
        ),
      });
    }
    if (heicSkipped.length > 0) {
      get().showToast(t("toast.refHeicUnsupported"), true);
    }
    const failedCount = usable.length - valid.length;
    if (failedCount > 0) {
      get().showToast(t("toast.refTooLarge"), true);
    }
    if (files.length > allowed) {
      get().showToast(t("toast.refLimitExceeded"), true);
    }
  },

  addNodeReferenceDataUrl: (clientId, dataUrl) => {
    const node = get().graphNodes.find((n) => n.id === clientId);
    if (!node) return;
    if (node.data.parentServerNodeId) {
      get().showToast(t("node.nodeRefsUnsupportedForEdit"), true);
      return;
    }
    set({
      graphNodes: get().graphNodes.map((n) => {
        if (n.id !== clientId) return n;
        const refs = n.data.referenceImages ?? [];
        if (refs.length >= MAX_REFERENCE_IMAGES) return n;
        return {
          ...n,
          data: {
            ...n.data,
            referenceImages: [...refs, dataUrl],
          },
        };
      }),
    });
  },

  removeNodeReference: (clientId, index) => {
    set({
      graphNodes: get().graphNodes.map((n) =>
        n.id === clientId
          ? {
              ...n,
              data: {
                ...n.data,
                referenceImages: (n.data.referenceImages ?? []).filter((_, i) => i !== index),
              },
            }
          : n,
      ),
    });
  },

  clearNodeReferences: (clientId) => {
    set({
      graphNodes: get().graphNodes.map((n) =>
        n.id === clientId
          ? {
              ...n,
              data: {
                ...n.data,
                referenceImages: undefined,
              },
            }
          : n,
      ),
    });
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

    // Pre-seed the source image as a node-local draft reference. Keeping this
    // local prevents hidden classic references from influencing node mode.
    if (source.data.imageUrl) {
      const sourceUrl = source.data.imageUrl;
      (async () => {
        try {
          const resp = await fetch(sourceUrl);
          const blob = await resp.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              typeof reader.result === "string"
                ? resolve(reader.result)
                : reject(new Error("read failed"));
            reader.onerror = () => reject(reader.error ?? new Error("read failed"));
            reader.readAsDataURL(blob);
          });
          set({
            graphNodes: get().graphNodes.map((n) =>
              n.id === clientId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      referenceImages: [dataUrl],
                    },
                  }
                : n,
            ),
          });
        } catch {
          // non-fatal
        }
      })();
    }
    return clientId;
  },

  async generateNode(clientId) {
    const node = get().graphNodes.find((n) => n.id === clientId);
    if (!node) return;
    const { prompt, parentServerNodeId } = node.data;
    if (!prompt.trim()) {
      get().showToast(t("toast.promptRequired"), true);
      return;
    }
    const nodeRefs = node.data.referenceImages ?? [];
    if (parentServerNodeId && nodeRefs.length > 0) {
      get().showToast(t("node.nodeRefsUnsupportedForEdit"), true);
      return;
    }
    const pending = getCustomSizeConfirmation(get(), { kind: "node", clientId });
    if (pending) {
      set({ customSizeConfirm: pending });
      return;
    }
    await get().runGenerateNode(clientId);
  },

  async runGenerateNode(clientId, sizeOverride) {
    const requestedNode = get().graphNodes.find((n) => n.id === clientId);
    const targetClientId =
      requestedNode?.data.status === "ready" ? get().addSiblingNode(clientId) : clientId;
    await get().runGenerateNodeInPlace(targetClientId, { sizeOverride });
  },

  async runGenerateNodeInPlace(clientId, options = {}) {
    const node = get().graphNodes.find((n) => n.id === clientId);
    if (!node) return null;
    const { prompt, parentServerNodeId } = node.data;
    if (!prompt.trim()) {
      get().showToast(t("toast.promptRequired"), true);
      return null;
    }
    const nodeRefs = node.data.referenceImages ?? [];
    if (parentServerNodeId && nodeRefs.length > 0) {
      get().showToast(t("node.nodeRefsUnsupportedForEdit"), true);
      return null;
    }
    const s = get();
    const size = options.sizeOverride ?? s.getResolvedSize();
    const effectiveParentServerNodeId =
      options.parentServerNodeIdOverride !== undefined
        ? options.parentServerNodeIdOverride
        : parentServerNodeId;

    // Capture request session so a later session switch does not corrupt graph B.
    const requestSessionId = s.activeSessionId;
    // mark pending — request-unique flightId so retries on the same node don't collide.
    const startedAt = Date.now();
    const randSuffix = Math.random().toString(36).slice(2, 6);
    const flightId = `fn_${clientId}_${startedAt}_${randSuffix}`;
    const nextInFlight: PersistedInFlight[] = [
      ...s.inFlight,
      {
        id: flightId,
        prompt,
        startedAt,
        kind: "node",
        sessionId: requestSessionId,
        clientNodeId: clientId,
      },
    ];
    saveInFlight(nextInFlight);
    set({
      graphNodes: get().graphNodes.map((n) =>
        n.id === clientId
          ? {
              ...n,
              data: {
                ...n.data,
                status: "pending",
                pendingRequestId: flightId,
                recoveryRequestId: flightId,
                pendingPhase: "queued",
                pendingStartedAt: startedAt,
                partialImageUrl: null,
                error: undefined,
              },
            }
          : n,
      ),
      activeGenerations: s.activeGenerations + 1,
      inFlight: nextInFlight,
    });
    get().startInFlightPolling();

    let graphMutated = true; // pending set above already mutated the graph if same-session

    try {
      const res = await postNodeGenerateStream({
        parentNodeId: effectiveParentServerNodeId,
        prompt,
        quality: s.quality,
        size,
        format: s.format,
        moderation: s.moderation,
        model: s.imageModel,
        requestId: flightId,
        sessionId: requestSessionId,
        clientNodeId: clientId,
        ...(nodeRefs.length && !effectiveParentServerNodeId
          ? { references: nodeRefs.map(stripDataUrlPrefix) }
          : {}),
      }, {
        onPartial: (partial) => {
          if (get().activeSessionId !== requestSessionId) return;
          set({
            graphNodes: get().graphNodes.map((n) =>
              n.id === clientId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      status: "pending",
                      partialImageUrl: partial.image,
                      pendingPhase: "partial",
                    },
                  }
                : n,
            ),
          });
        },
        onPhase: (phase) => {
          if (get().activeSessionId !== requestSessionId) return;
          if (!phase.phase) return;
          set({
            graphNodes: get().graphNodes.map((n) =>
              n.id === clientId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      pendingPhase: phase.phase ?? n.data.pendingPhase,
                    },
                  }
                : n,
            ),
          });
        },
      });
      if (get().activeSessionId === requestSessionId) {
        set({
          graphNodes: get().graphNodes.map((n) => {
            if (n.id !== clientId) return n;
            const nextData = { ...n.data };
            delete nextData.referenceImages;
            delete nextData.partialImageUrl;
            return {
              ...n,
              data: {
                ...nextData,
                serverNodeId: res.nodeId,
                imageUrl: res.url,
                status: "ready",
                pendingRequestId: null,
                recoveryRequestId: null,
                pendingPhase: null,
                pendingStartedAt: null,
                elapsed: res.elapsed,
                webSearchCalls: res.webSearchCalls,
                model: res.model ?? null,
              },
            };
          }),
        });
        graphMutated = true;
        if (!options.suppressToast) {
          get().showToast(t("toast.nodeCreated", { id: res.nodeId.slice(0, 8), elapsed: res.elapsed }));
        }
      }
      return res.nodeId;
      // cross-session: result will be restored via recoverGraphNodesFromHistory
      // when the user returns to the originating session.
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("toast.nodeCreateFailed");
      if (get().activeSessionId === requestSessionId) {
        set({
          graphNodes: get().graphNodes.map((n) =>
            n.id === clientId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    status: "error",
                    pendingRequestId: null,
                    pendingPhase: null,
                    pendingStartedAt: null,
                    partialImageUrl: null,
                    error: msg,
                  },
                }
              : n,
          ),
        });
        graphMutated = true;
        handleError(err, get());
      }
      // cross-session: silent — user is on a different graph
      return null;
    } finally {
      // Global state cleanup must always run regardless of active session,
      // otherwise the spinner/counter leaks.
      const remaining = get().inFlight.filter((f) => f.id !== flightId);
      saveInFlight(remaining);
      set({
        activeGenerations: Math.max(0, get().activeGenerations - 1),
        inFlight: remaining,
      });
      // Persist the graph only if we actually mutated it AND we are still on
      // the originating session.
      if (get().activeSessionId === requestSessionId && graphMutated) {
        get().scheduleGraphSave();
      }
    }
  },

  async runNodeBatch(mode) {
    if (get().nodeBatchRunning) return;
    const selectedIds = getSelectedNodeIds(get().graphNodes);
    if (selectedIds.length === 0) {
      get().showToast(t("nodeBatch.noneSelected"), true);
      return;
    }
    const blocked = validateBatchDependencies(get().graphNodes, get().graphEdges, selectedIds);
    if (blocked.length > 0) {
      get().showToast(t("nodeBatch.parentRequired", { count: blocked.length }), true);
      return;
    }
    const orderedIds = topologicalSortSelected(get().graphNodes, get().graphEdges, selectedIds);
    const selectedSet = new Set(selectedIds);
    const candidates = orderedIds.filter((id) => {
      if (mode === "regenerate-all") return true;
      const node = get().graphNodes.find((n) => n.id === id);
      return node ? !nodeHasImage(node) : false;
    });
    if (candidates.length === 0) {
      get().showToast(t("nodeBatch.nothingToRun"));
      return;
    }

    set({ nodeBatchRunning: true, nodeBatchStopping: false });
    const latestServerNodeIdByClientId = new Map<string, string>();
    let completed = 0;
    try {
      for (const clientId of candidates) {
        if (get().nodeBatchStopping) break;
        const incoming = get().graphEdges.find((e) => e.target === clientId);
        const parentOverride = incoming
          ? latestServerNodeIdByClientId.get(incoming.source)
            ?? get().graphNodes.find((n) => n.id === clientId)?.data.parentServerNodeId
            ?? null
          : null;
        const nodeId = await get().runGenerateNodeInPlace(clientId as ClientNodeId, {
          parentServerNodeIdOverride: parentOverride,
          suppressToast: true,
        });
        if (!nodeId) {
          get().showToast(t("nodeBatch.failed", { done: completed, total: candidates.length }), true);
          break;
        }
        completed += 1;
        latestServerNodeIdByClientId.set(clientId, nodeId);
        const directChildren = getDirectUnselectedChildren(get().graphEdges, clientId, selectedSet);
        const downstream = new Set(getUnselectedDownstreamIds(get().graphEdges, selectedSet));
        set({
          graphNodes: get().graphNodes.map((n) => {
            if (!downstream.has(n.id)) return n;
            return {
              ...n,
              data: {
                ...n.data,
                status: "stale",
                parentServerNodeId: directChildren.includes(n.id)
                  ? nodeId
                  : n.data.parentServerNodeId,
                error: t("nodeBatch.staleBecauseParentChanged"),
              },
            };
          }),
        });
      }
      get().showToast(t("nodeBatch.finished", { done: completed, total: candidates.length }));
      get().scheduleGraphSave();
    } finally {
      set({ nodeBatchRunning: false, nodeBatchStopping: false });
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
  setCustomSize: (w, h) =>
    set((state) => ({
      customW: parseRequestedCustomSide(w, state.customW),
      customH: parseRequestedCustomSide(h, state.customH),
    })),
  setFormat: (format) => set({ format }),
  setModeration: (moderation) => set({ moderation }),
  setImageModel: (imageModel) => {
    saveImageModel(imageModel);
    set({ imageModel });
  },
  setCount: (count) => set({ count }),
  setPromptMode: (promptMode) => set({ promptMode }),
  setPrompt: (prompt) => set({ prompt }),

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

  getResolvedSize: () => {
    const { sizePreset, customW, customH } = get();
    return sizePreset === "custom" ? `${customW}x${customH}` : sizePreset;
  },

  async generate() {
    const s = get();
    const prompt = s.prompt.trim();
    if (!prompt) return;
    const pending = getCustomSizeConfirmation(s, { kind: "classic" });
    if (pending) {
      set({ customSizeConfirm: pending });
      return;
    }
    await get().runGenerate();
  },

  async runGenerate(sizeOverride) {
    const s = get();
    const prompt = s.prompt.trim();
    if (!prompt) return;

    const size = sizeOverride ?? s.getResolvedSize();

    const flightId = `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const startedAt = Date.now();
    const nextInFlight: PersistedInFlight[] = [
      ...s.inFlight,
      { id: flightId, prompt, startedAt },
    ];
    saveInFlight(nextInFlight);
    set({
      activeGenerations: s.activeGenerations + 1,
      inFlight: nextInFlight,
    });
    get().startInFlightPolling();

    try {
      const payload = {
        prompt,
        quality: s.quality,
        size,
        format: s.format,
        moderation: s.moderation,
        provider: s.provider,
        n: s.count,
        model: s.imageModel,
        requestId: flightId,
        mode: s.promptMode,
        ...(s.referenceImages.length
          ? { references: s.referenceImages.map(stripDataUrlPrefix) }
          : {}),
      };

      const res: GenerateResponse = await postGenerate(payload);

      if (isMultiResponse(res) && res.images.length > 1) {
        for (const img of res.images) {
          const item: GenerateItem = {
            image: img.image,
            filename: img.filename,
            prompt,
            elapsed: res.elapsed,
            provider: res.provider,
            usage: res.usage,
            quality: res.quality ?? s.quality,
            size: res.size ?? size,
            model: res.model ?? s.imageModel,
          };
          await addHistory(item, set, get);
        }
        get().showToast(t("toast.generatedBatch", { count: res.images.length, elapsed: res.elapsed }));
      } else {
        let item: GenerateItem;
        if (isMultiResponse(res)) {
          const first = res.images[0];
          item = {
            image: first.image,
            filename: first.filename,
            prompt,
            elapsed: res.elapsed,
            provider: res.provider,
            usage: res.usage,
            quality: res.quality ?? s.quality,
            size: res.size ?? size,
            model: res.model ?? s.imageModel,
          };
        } else {
          item = {
            image: res.image,
            filename: res.filename,
            prompt,
            elapsed: res.elapsed,
            provider: res.provider,
            usage: res.usage,
            quality: res.quality ?? s.quality,
            size: res.size ?? size,
            model: res.model ?? s.imageModel,
          };
        }
        await addHistory(item, set, get);
        get().showToast(t("toast.generatedSingle", { elapsed: res.elapsed }));
      }
    } catch (err) {
      handleError(err, get());
    } finally {
      const remaining = get().inFlight.filter((f) => f.id !== flightId);
      saveInFlight(remaining);
      set({
        activeGenerations: Math.max(0, get().activeGenerations - 1),
        inFlight: remaining,
      });
    }
  },

  async confirmCustomSizeAdjustment() {
    const pending = get().customSizeConfirm;
    if (!pending) return;
    const adjustedSize = formatSize(pending.adjustedW, pending.adjustedH);
    set({
      customW: pending.adjustedW,
      customH: pending.adjustedH,
      customSizeConfirm: null,
    });
    if (pending.continuation.kind === "classic") {
      await get().runGenerate(adjustedSize);
      return;
    }
    await get().runGenerateNode(pending.continuation.clientId, adjustedSize);
  },

  cancelCustomSizeAdjustment: () => set({ customSizeConfirm: null }),

  hydrateHistory() {
    void (async () => {
      try {
        const res = await getHistory({ limit: HISTORY_LIMIT });
        const history: GenerateItem[] = res.items.map(mapHistoryItem);
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
  showErrorCard(code, params) {
    set({ errorCard: { code, fallbackMessage: params?.fallbackMessage, id: Date.now() + Math.random() } });
  },
  dismissErrorCard() {
    set({ errorCard: null });
  },
}));

// ── Graph autosave (module-level debounce) ──
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

// Sanitize a node's data for PUT /api/sessions/:id/graph payload.
// pending / reconciling states are *transient* — persisting them to disk
// makes reloaded graphs look like aborted work and trips reconcileGraphPending.
// This function is payload-only: the in-memory `graphNodes` is NOT touched.
function sanitizeForSave(d: ImageNodeData): Record<string, unknown> {
  const safe = { ...(d as unknown as Record<string, unknown>) };
  delete safe.referenceImages;
  delete safe.partialImageUrl;
  const shouldSanitize = d.status === "pending" || d.status === "reconciling";
  if (!shouldSanitize) return safe;
  return {
    ...safe,
    status: "empty",
    pendingRequestId: null,
    recoveryRequestId: d.pendingRequestId ?? d.recoveryRequestId ?? null,
    pendingPhase: null,
    pendingStartedAt: null,
    error: undefined,
  };
}

// Recover nodes whose asset lives on disk (via /api/history) but whose
// client-side state was lost (A sanitize, reload, HMR, conflict reload).
// Candidate = node with neither imageUrl nor serverNodeId. Match requestId
// first, then fall back to (sessionId, clientNodeId, createdAt) so stale
// retry assets do not overwrite a newer pending node.
async function recoverGraphNodesFromHistory(
  get: () => AppState,
  set: (patch: Partial<AppState>) => void,
): Promise<void> {
  const sid = get().activeSessionId;
  if (!sid) return;
  const candidates = get().graphNodes.filter(
    (n) => !n.data.imageUrl && !n.data.serverNodeId,
  );
  if (candidates.length === 0) return;

  let items: Array<{
    url: string;
    createdAt: number;
    sessionId?: string | null;
    nodeId?: string | null;
    clientNodeId?: string | null;
    requestId?: string | null;
  }> = [];
  try {
    const res = await getHistory({ sessionId: sid, limit: HISTORY_LIMIT });
    items = res.items;
  } catch {
    // History fetch failure is non-fatal — leave nodes as they are.
    return;
  }

  let changed = false;
  const next = get().graphNodes.map((n) => {
    if (n.data.imageUrl || n.data.serverNodeId) return n;
    const startedAt = n.data.pendingStartedAt ?? 0;
    const requestKey = n.data.pendingRequestId ?? n.data.recoveryRequestId ?? null;
    const byRequest = requestKey
      ? items.find(
          (h) =>
            (h.sessionId ?? null) === sid &&
            (h.requestId ?? null) === requestKey,
        )
      : null;
    const recovered = byRequest ?? items.find(
      (h) =>
        (h.sessionId ?? null) === sid &&
        (h.clientNodeId ?? null) === n.id &&
        (!startedAt || (h.createdAt ?? 0) >= startedAt),
    );
    if (!recovered) return n;
    changed = true;
    return {
      ...n,
      data: {
        ...n.data,
        status: "ready" as const,
        imageUrl: recovered.url, // canonical — jpeg/webp all covered
        serverNodeId: recovered.nodeId ?? n.data.serverNodeId,
        pendingRequestId: null,
        recoveryRequestId: null,
        pendingPhase: null,
        pendingStartedAt: null,
        partialImageUrl: null,
        error: undefined,
      },
    };
  });

  if (!changed) return;
  set({ graphNodes: next });
  // Persist the recovered imageUrl so future reloads don't need to re-recover.
  scheduleGraphSaveImpl(get, set, "recovery");
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
  get().showToast(t("toast.sessionReloadedElsewhere"), true);
  // A graph version conflict only proves the client saved against an older
  // version. Reload first, then repair node assets from requestId history.
  await recoverGraphNodesFromHistory(get, set).catch(() => {});
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
    data: sanitizeForSave(n.data),
  }));
  const edges = graphEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    data: {},
  }));
  const saveId = `gs_${Date.now().toString(36)}_${++graphSaveSeq}`;
  try {
    const res = await saveSessionGraph(id, graphVersion, nodes, edges, {
      saveId,
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
    data: sanitizeForSave(n.data),
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
        "X-Ima2-Graph-Save-Id": `gs_${Date.now().toString(36)}_${++graphSaveSeq}`,
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
  set: (p: Partial<AppState>) => void,
  get: () => AppState,
): Promise<void> {
  const thumb = await compressImage(item.image).catch(() => item.image);
  const url = item.filename ? `/generated/${item.filename}` : item.image;
  const withThumb: GenerateItem = {
    ...item,
    thumb,
    url,
    createdAt: item.createdAt || Date.now(),
  };
  const history = [withThumb, ...get().history].slice(0, HISTORY_LIMIT);
  saveSelectedFilename(withThumb.filename ?? null);
  set({ history, currentImage: withThumb });
}
