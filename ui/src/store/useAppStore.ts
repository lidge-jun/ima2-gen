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
  postNodeGenerate,
  listSessions as apiListSessions,
  createSession as apiCreateSession,
  getSession as apiGetSession,
  renameSession as apiRenameSession,
  deleteSession as apiDeleteSession,
  saveSessionGraph,
  type SessionSummary,
  type SessionFull,
} from "../lib/api";
import { compressImage } from "../lib/image";
import { snap16 } from "../lib/size";
import { newClientNodeId, initialPos, type ClientNodeId } from "../lib/graph";
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

type PersistedInFlight = { id: string; prompt: string; startedAt: number; phase?: string };
const INFLIGHT_TTL_MS = 180_000;

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
      .map((x) => ({ id: x.id, prompt: x.prompt, startedAt: x.startedAt }));
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
        useAppStore.getState().showToast("Local storage full — recent state may not persist", true);
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

const HISTORY_LIMIT = 200;

export type ImageNodeStatus = "empty" | "pending" | "ready" | "error";

export type ImageNodeData = {
  clientId: ClientNodeId;
  serverNodeId: string | null;
  parentServerNodeId: string | null;
  prompt: string;
  imageUrl: string | null;
  status: ImageNodeStatus;
  error?: string;
  elapsed?: number;
  webSearchCalls?: number;
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
      error: d.error as string | undefined,
      elapsed: d.elapsed as number | undefined,
      webSearchCalls: d.webSearchCalls as number | undefined,
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
  syncFromStorage: () => void;
  currentImage: GenerateItem | null;
  history: GenerateItem[];
  toast: ToastState;
  rightPanelOpen: boolean;
  toggleRightPanel: () => void;
  galleryOpen: boolean;
  openGallery: () => void;
  closeGallery: () => void;

  uiMode: UIMode;
  setUIMode: (m: UIMode) => void;

  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  setGraphNodes: (n: GraphNode[]) => void;
  setGraphEdges: (e: GraphEdge[]) => void;
  addRootNode: () => ClientNodeId;
  addChildNode: (parentClientId: ClientNodeId) => ClientNodeId;
  addSiblingNode: (sourceClientId: ClientNodeId) => ClientNodeId;
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
  flushGraphSave: () => Promise<void>;

  setProvider: (p: Provider) => void;
  setQuality: (q: Quality) => void;
  setSizePreset: (s: SizePreset) => void;
  setCustomSize: (w: number, h: number) => void;
  setFormat: (f: Format) => void;
  setModeration: (m: Moderation) => void;
  setCount: (c: Count) => void;
  setPrompt: (p: string) => void;
  selectHistory: (item: GenerateItem) => void;
  generate: () => Promise<void>;
  hydrateHistory: () => void;
  showToast: (message: string, error?: boolean) => void;
  getResolvedSize: () => string;
};

export const useAppStore = create<AppState>((set, get) => ({
  provider: "oauth",
  quality: "low",
  sizePreset: "1024x1024",
  customW: 1920,
  customH: 1088,
  format: "png",
  moderation: "low",
  count: 1,
  prompt: "",
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
      get().showToast("Maximum 5 references; extras ignored", true);
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
      get().showToast("No current image to use", true);
      return;
    }
    if (get().referenceImages.length >= 5) {
      get().showToast("Reference slots are full (max 5)", true);
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
        get().showToast("Could not fetch current image", true);
        return;
      }
    }
    set((s) => ({ referenceImages: [...s.referenceImages, dataUrl] }));
    get().showToast("Added current image as reference");
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
        const inflightKind = get().uiMode === "node" ? "node" : "classic";
        const inflightSessionId =
          inflightKind === "node" ? get().activeSessionId ?? undefined : undefined;
        const { jobs } = await getInflight({
          kind: inflightKind,
          sessionId: inflightSessionId,
        });
        const byId = new Map(jobs.map((j) => [j.requestId, j.phase] as const));
        let changed = false;
        const nextInflight = get().inFlight.map((f) => {
          const p = byId.get(f.id);
          if (p && p !== f.phase) {
            changed = true;
            return { ...f, phase: p };
          }
          return f;
        });
        if (changed) {
          saveInFlight(nextInflight);
          set({ inFlight: nextInflight });
        }
      } catch {}
      try {
        const { items } = await getHistory(HISTORY_LIMIT);
        const arr: GenerateItem[] = items.map((it) => ({
          image: it.url,
          filename: it.filename,
          thumb: it.url,
          prompt: it.prompt ?? undefined,
          size: it.size ?? undefined,
          quality: it.quality ?? undefined,
          format: it.format as Format | undefined,
          createdAt: it.createdAt,
        }));
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
      const serverIds = new Set(jobs.map((j) => j.requestId));
      const now = Date.now();
      const local = get().inFlight;
      // Keep local entries that are either still known to the server,
      // or started very recently (<10s — request may be in-flight before
      // /api/inflight registered). Drop anything else as stale.
      const merged = local.filter(
        (f) => serverIds.has(f.id) || now - f.startedAt < 10_000,
      );
      // Bring in server-only jobs (started from another tab / process)
      const localIds = new Set(merged.map((f) => f.id));
      for (const j of jobs) {
        if (!localIds.has(j.requestId)) {
          merged.push({ id: j.requestId, prompt: j.prompt || "", startedAt: j.startedAt });
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
    set((s) => ({
      inFlight: nextInflight,
      activeGenerations: nextInflight.length,
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
        await get().createAndSwitchSession("My first graph");
      }
    } catch (err) {
      console.warn("[sessions] load failed:", err);
    }
  },

  async switchSession(id) {
    set({ sessionLoading: true });
    await get().flushGraphSave();
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
    } catch (err) {
      console.warn("[sessions] switch failed:", err);
      set({ sessionLoading: false });
      get().showToast("Session load failed", true);
    }
  },

  async createAndSwitchSession(title = "Untitled") {
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
      get().showToast("Create session failed", true);
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
      get().showToast("Rename failed", true);
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
          await get().createAndSwitchSession("My first graph");
        }
      }
    } catch (err) {
      get().showToast("Delete failed", true);
    }
  },

  scheduleGraphSave() {
    scheduleGraphSaveImpl(get, set);
  },

  async flushGraphSave() {
    await flushGraphSaveImpl(get, set);
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

  async generateNode(clientId) {
    const requestedNode = get().graphNodes.find((n) => n.id === clientId);
    const targetClientId =
      requestedNode?.data.status === "ready" ? get().addSiblingNode(clientId) : clientId;
    const node = get().graphNodes.find((n) => n.id === targetClientId);
    if (!node) return;
    const { prompt, parentServerNodeId } = node.data;
    if (!prompt.trim()) {
      get().showToast("Prompt required", true);
      return;
    }
    const s = get();
    const size = s.getResolvedSize();

    // mark pending
    const flightId = `fn_${targetClientId}`;
    const startedAt = Date.now();
    const nextInFlight: PersistedInFlight[] = [
      ...s.inFlight,
      { id: flightId, prompt, startedAt },
    ];
    saveInFlight(nextInFlight);
    set({
      graphNodes: get().graphNodes.map((n) =>
        n.id === targetClientId
          ? { ...n, data: { ...n.data, status: "pending", error: undefined } }
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
        requestId: flightId,
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
                  elapsed: res.elapsed,
                  webSearchCalls: res.webSearchCalls,
                },
              }
            : n,
        ),
      });
      get().showToast(`Node ${res.nodeId.slice(0, 8)}… in ${res.elapsed}s`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Node generation failed";
      set({
        graphNodes: get().graphNodes.map((n) =>
          n.id === targetClientId
            ? { ...n, data: { ...n.data, status: "error", error: msg } }
            : n,
        ),
      });
      get().showToast(msg, true);
    } finally {
      const remaining = get().inFlight.filter((f) => f.id !== flightId);
      saveInFlight(remaining);
      set({
        activeGenerations: Math.max(0, get().activeGenerations - 1),
        inFlight: remaining,
      });
      get().scheduleGraphSave();
    }
  },

  deleteNode: (clientId) => {
    set({
      graphNodes: get().graphNodes.filter((n) => n.id !== clientId),
      graphEdges: get().graphEdges.filter((e) => e.source !== clientId && e.target !== clientId),
    });
    get().scheduleGraphSave();
  },

  deleteNodes: (clientIds) => {
    const set_ = new Set(clientIds);
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
  setPrompt: (prompt) => set({ prompt }),

  selectHistory: (item) => {
    saveSelectedFilename(item.filename ?? null);
    set({ currentImage: item });
  },

  getResolvedSize: () => {
    const { sizePreset, customW, customH } = get();
    return sizePreset === "custom" ? `${customW}x${customH}` : sizePreset;
  },

  async generate() {
    const s = get();
    const prompt = s.prompt.trim();
    if (!prompt) return;

    const size = s.getResolvedSize();

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
        requestId: flightId,
        ...(s.referenceImages.length
          ? { references: s.referenceImages.map((d) => d.replace(/^data:[^;]+;base64,/, "")) }
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
          };
          await addHistory(item, set, get);
        }
        get().showToast(`${res.images.length} images in ${res.elapsed}s`);
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
          };
        }
        await addHistory(item, set, get);
        get().showToast(`Generated in ${res.elapsed}s`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      get().showToast(msg, true);
    } finally {
      const remaining = get().inFlight.filter((f) => f.id !== flightId);
      saveInFlight(remaining);
      set({
        activeGenerations: Math.max(0, get().activeGenerations - 1),
        inFlight: remaining,
      });
    }
  },

  hydrateHistory() {
    void (async () => {
      try {
        const res = await getHistory(HISTORY_LIMIT);
        const history: GenerateItem[] = res.items.map((it) => ({
          image: it.url,
          url: it.url,
          filename: it.filename,
          prompt: it.prompt || undefined,
          provider: it.provider,
          quality: it.quality || undefined,
          size: it.size || undefined,
          usage: (it.usage as GenerateItem["usage"]) ?? undefined,
          thumb: it.url,
          createdAt: it.createdAt,
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
const SAVE_DEBOUNCE_MS = 800;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saveGraphPromise: Promise<void> | null = null;

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
  get().showToast("Session changed in another tab — reloaded latest graph", true);
}

function doSave(
  get: () => AppState,
  set: (patch: Partial<AppState>) => void,
): Promise<void> {
  const id = get().activeSessionId;
  const graphVersion = get().activeSessionGraphVersion;
  if (!id) return Promise.resolve();
  if (graphVersion == null) return Promise.resolve();
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
  return saveSessionGraph(id, graphVersion, nodes, edges)
    .then((res) => {
      set({ activeSessionGraphVersion: res.graphVersion });
    })
    .catch(async (err) => {
      if ((err as { status?: number }).status === 409) {
        await reloadSessionAfterConflict(get, set);
        return;
      }
      console.warn("[sessions] save failed:", err);
    });
}

function scheduleGraphSaveImpl(
  get: () => AppState,
  set: (patch: Partial<AppState>) => void,
) {
  const s = get();
  if (!s.activeSessionId) return;
  if (s.sessionLoading) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveGraphPromise = doSave(get, set).finally(() => {
      saveGraphPromise = null;
    });
  }, SAVE_DEBOUNCE_MS);
}

async function flushGraphSaveImpl(
  get: () => AppState,
  set: (patch: Partial<AppState>) => void,
) {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    await doSave(get, set);
  } else if (saveGraphPromise) {
    await saveGraphPromise;
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
