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
} from "../types";
import { isMultiResponse } from "../types";
import { postEdit, postGenerate } from "../lib/api";
import { compressImage, dataUrlToBase64, readFileAsDataURL } from "../lib/image";
import { loadHistoryFromStorage, persistHistory } from "../lib/storage";
import { snap16 } from "../lib/size";

function loadRightPanelOpen(): boolean {
  try {
    const raw = localStorage.getItem("ima2.rightPanelOpen");
    if (raw === null) return true;
    return JSON.parse(raw) === true;
  } catch {
    return true;
  }
}

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
  currentImage: GenerateItem | null;
  history: GenerateItem[];
  toast: ToastState;
  rightPanelOpen: boolean;
  toggleRightPanel: () => void;

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

    set({ activeGenerations: s.activeGenerations + 1 });

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
          };
        } else {
          item = {
            image: res.image,
            filename: res.filename,
            prompt,
            elapsed: res.elapsed,
            provider: res.provider,
            usage: res.usage,
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
      set({ activeGenerations: remaining });
    }
  },

  hydrateHistory() {
    const history = loadHistoryFromStorage();
    if (history.length > 0) {
      set({ history, currentImage: history[0] });
    }
  },

  showToast(message, error = false) {
    set({ toast: { message, error, id: Date.now() + Math.random() } });
  },
}));

async function addHistory(
  item: GenerateItem,
  set: (p: Partial<AppState>) => void,
  get: () => AppState,
): Promise<void> {
  const thumb = await compressImage(item.image).catch(() => item.image);
  const withThumb: GenerateItem = { ...item, thumb };
  const history = [withThumb, ...get().history].slice(0, 50);
  set({ history, currentImage: withThumb });
  persistHistory(history);
}
