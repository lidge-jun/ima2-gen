import { create } from "zustand";
import type {
  Count,
  Format,
  GenerateItem,
  GenerateResponse,
  Mode,
  Moderation,
  Provider,
  Quality,
  SizePreset,
  UIMode,
} from "../types";
import { isMultiResponse } from "../types";
import {
  postEdit,
  postGenerate,
  getHistory,
  postNodeGenerate,
  listSessions as apiListSessions,
  createSession as apiCreateSession,
  getSession as apiGetSession,
  renameSession as apiRenameSession,
  deleteSession as apiDeleteSession,
  saveSessionGraph,
  type SessionSummary,
} from "../lib/api";
import { compressImage, dataUrlToBase64, readFileAsDataURL } from "../lib/image";
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

type ToastState = { message: string; error: boolean; id: number } | null;

type AppState = {
  mode: Mode;
  provider: Provider;
  quality: Quality;
  sizePreset: SizePreset;
  customW: number;
  customH: number;
  format: Format;
  moderation: Moderation;
  count: Count;
  prompt: string;
  sourceImageDataUrl: string | null;
  activeGenerations: number;
  inFlight: { id: string; prompt: string }[];
  currentImage: GenerateItem | null;
  history: GenerateItem[];
  toast: ToastState;
  rightPanelOpen: boolean;
  toggleRightPanel: () => void;

  uiMode: UIMode;
  setUIMode: (m: UIMode) => void;

  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  setGraphNodes: (n: GraphNode[]) => void;
  setGraphEdges: (e: GraphEdge[]) => void;
  addRootNode: () => ClientNodeId;
  addChildNode: (parentClientId: ClientNodeId) => ClientNodeId;
  addChildNodeAt: (parentClientId: ClientNodeId, position: { x: number; y: number }) => ClientNodeId;
  connectNodes: (sourceClientId: ClientNodeId, targetClientId: ClientNodeId) => void;
  updateNodePrompt: (clientId: ClientNodeId, prompt: string) => void;
  generateNode: (clientId: ClientNodeId) => Promise<void>;
  deleteNode: (clientId: ClientNodeId) => void;
  deleteNodes: (clientIds: ClientNodeId[]) => void;

  // Sessions (0.06)
  sessions: SessionSummary[];
  activeSessionId: string | null;
  sessionLoading: boolean;
  loadSessions: () => Promise<void>;
  switchSession: (id: string) => Promise<void>;
  createAndSwitchSession: (title?: string) => Promise<void>;
  renameCurrentSession: (title: string) => Promise<void>;
  deleteSessionById: (id: string) => Promise<void>;
  scheduleGraphSave: () => void;
  flushGraphSave: () => Promise<void>;

  setMode: (mode: Mode) => void;
  setProvider: (p: Provider) => void;
  setQuality: (q: Quality) => void;
  setSizePreset: (s: SizePreset) => void;
  setCustomSize: (w: number, h: number) => void;
  setFormat: (f: Format) => void;
  setModeration: (m: Moderation) => void;
  setCount: (c: Count) => void;
  setPrompt: (p: string) => void;
  setSourceFromFile: (file: File) => Promise<void>;
  setSourceFromDataUrl: (dataUrl: string) => void;
  clearSource: () => void;
  useResultAsSource: () => void;
  selectHistory: (item: GenerateItem) => void;
  generate: () => Promise<void>;
  hydrateHistory: () => void;
  showToast: (message: string, error?: boolean) => void;
  getResolvedSize: () => string;
};

export const useAppStore = create<AppState>((set, get) => ({
  mode: "t2i",
  provider: "oauth",
  quality: "low",
  sizePreset: "1024x1024",
  customW: 1920,
  customH: 1088,
  format: "png",
  moderation: "low",
  count: 1,
  prompt: "",
  sourceImageDataUrl: null,
  activeGenerations: 0,
  inFlight: [],
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
    await get().flushGraphSave();
    set({ sessionLoading: true });
    try {
      const { session } = await apiGetSession(id);
      const graphNodes: GraphNode[] = session.nodes.map((n) => {
        const d = (n.data ?? {}) as Partial<ImageNodeData>;
        const data: ImageNodeData = {
          clientId: n.id as ClientNodeId,
          serverNodeId: (d.serverNodeId ?? null) as string | null,
          parentServerNodeId: (d.parentServerNodeId ?? null) as string | null,
          prompt: typeof d.prompt === "string" ? d.prompt : "",
          imageUrl: (d.imageUrl ?? null) as string | null,
          status: (d.status ?? (d.imageUrl ? "ready" : "empty")) as ImageNodeStatus,
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
      set({
        activeSessionId: id,
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
        set({ activeSessionId: null, graphNodes: [], graphEdges: [] });
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
    scheduleGraphSaveImpl(get);
  },

  async flushGraphSave() {
    await flushGraphSaveImpl(get);
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

  updateNodePrompt: (clientId, prompt) => {
    set({
      graphNodes: get().graphNodes.map((n) =>
        n.id === clientId ? { ...n, data: { ...n.data, prompt } } : n,
      ),
    });
    get().scheduleGraphSave();
  },

  async generateNode(clientId) {
    const node = get().graphNodes.find((n) => n.id === clientId);
    if (!node) return;
    const { prompt, parentServerNodeId } = node.data;
    if (!prompt.trim()) {
      get().showToast("Prompt required", true);
      return;
    }
    const s = get();
    const size = s.getResolvedSize();

    // mark pending
    const flightId = `fn_${clientId}`;
    set({
      graphNodes: get().graphNodes.map((n) =>
        n.id === clientId ? { ...n, data: { ...n.data, status: "pending", error: undefined } } : n,
      ),
      activeGenerations: s.activeGenerations + 1,
      inFlight: [...s.inFlight, { id: flightId, prompt }],
    });

    try {
      const res = await postNodeGenerate({
        parentNodeId: parentServerNodeId,
        prompt,
        quality: s.quality,
        size,
        format: s.format,
      });
      set({
        graphNodes: get().graphNodes.map((n) =>
          n.id === clientId
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
          n.id === clientId ? { ...n, data: { ...n.data, status: "error", error: msg } } : n,
        ),
      });
      get().showToast(msg, true);
    } finally {
      set({
        activeGenerations: Math.max(0, get().activeGenerations - 1),
        inFlight: get().inFlight.filter((f) => f.id !== flightId),
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

  setMode: (mode) => set({ mode }),
  setProvider: (provider) => set({ provider }),
  setQuality: (quality) => set({ quality }),
  setSizePreset: (sizePreset) => set({ sizePreset }),
  setCustomSize: (w, h) => set({ customW: snap16(w), customH: snap16(h) }),
  setFormat: (format) => set({ format }),
  setModeration: (moderation) => set({ moderation }),
  setCount: (count) => set({ count }),
  setPrompt: (prompt) => set({ prompt }),

  async setSourceFromFile(file) {
    const dataUrl = await readFileAsDataURL(file);
    set({ sourceImageDataUrl: dataUrl });
  },
  setSourceFromDataUrl: (dataUrl) => set({ sourceImageDataUrl: dataUrl }),
  clearSource: () => set({ sourceImageDataUrl: null }),

  useResultAsSource: () => {
    const cur = get().currentImage;
    if (!cur) return;
    set({
      sourceImageDataUrl: cur.image,
      mode: "i2i",
    });
    get().showToast("Source image loaded from result");
  },

  selectHistory: (item) => set({ currentImage: item }),

  getResolvedSize: () => {
    const { sizePreset, customW, customH } = get();
    return sizePreset === "custom" ? `${customW}x${customH}` : sizePreset;
  },

  async generate() {
    const s = get();
    const prompt = s.prompt.trim();
    if (!prompt) return;

    const size = s.getResolvedSize();
    const isEdit = s.mode === "i2i" && !!s.sourceImageDataUrl;

    const flightId = `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    set({
      activeGenerations: s.activeGenerations + 1,
      inFlight: [...s.inFlight, { id: flightId, prompt }],
    });

    try {
      const payload = {
        prompt,
        quality: s.quality,
        size,
        format: s.format,
        moderation: s.moderation,
        provider: s.provider,
        n: isEdit ? 1 : s.count,
        ...(isEdit && s.sourceImageDataUrl
          ? { image: dataUrlToBase64(s.sourceImageDataUrl) }
          : {}),
      };

      const res: GenerateResponse = isEdit
        ? await postEdit(payload)
        : await postGenerate(payload);

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
      const remaining = Math.max(0, get().activeGenerations - 1);
      set({
        activeGenerations: remaining,
        inFlight: get().inFlight.filter((f) => f.id !== flightId),
      });
    }
  },

  hydrateHistory() {
    void (async () => {
      try {
        const res = await getHistory(50);
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
          set({ history, currentImage: history[0] });
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
let saveInFlight: Promise<void> | null = null;

function doSave(get: () => AppState): Promise<void> {
  const id = get().activeSessionId;
  if (!id) return Promise.resolve();
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
  return saveSessionGraph(id, nodes, edges)
    .then(() => undefined)
    .catch((err) => {
      console.warn("[sessions] save failed:", err);
    });
}

function scheduleGraphSaveImpl(get: () => AppState) {
  if (!get().activeSessionId) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveInFlight = doSave(get).finally(() => {
      saveInFlight = null;
    });
  }, SAVE_DEBOUNCE_MS);
}

async function flushGraphSaveImpl(get: () => AppState) {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    await doSave(get);
  } else if (saveInFlight) {
    await saveInFlight;
  }
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
  const history = [withThumb, ...get().history].slice(0, 50);
  set({ history, currentImage: withThumb });
}
