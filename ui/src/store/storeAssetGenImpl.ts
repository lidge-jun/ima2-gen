import type { GenerateItem, GenerateResponse } from "../types";
import { isMultiResponse } from "../types";
import { postGenerateStream, postVideoGenerateStream } from "../lib/api";
import { createAsset } from "../lib/api-assets";
import { handleError } from "../lib/errorHandler";
import { isGeminiImageModel, isGrokImageModel } from "../lib/imageModels";
import { t } from "../i18n";
import {
  type PersistedInFlight,
  saveInFlight,
  isCanceledGenerationError,
} from "./storeHelpers";
import { addHistory } from "./storeGraphSave";
import type { AppState, StoreGet, StoreSet } from "./storeTypes";
import { clearFlightAbort, registerFlightAbort } from "./flightAbortRegistry";

function assetGenModel(s: AppState): AppState["imageModel"] | undefined {
  const provider = s.assetGenProvider;
  if (provider === "grok" || provider === "grok-api") return "grok-imagine-image-2.0";
  // GPT(oauth/api): reuse the globally selected model only when it is a GPT
  // model. Grok/Gemini models would be rejected by the server with
  // INVALID_IMAGE_MODEL, so fall back to the server default instead.
  if (isGrokImageModel(s.imageModel) || isGeminiImageModel(s.imageModel)) return undefined;
  return s.imageModel;
}

export async function registerAssetGenResult(item: GenerateItem, set: StoreSet, get: StoreGet): Promise<void> {
  if (!item.filename) return;
  const s = get();
  try {
    await createAsset({
      filePath: item.filename,
      kind: "image",
      name: (item.prompt || "").trim().slice(0, 80) || item.filename,
      folderId: s.selectedProjectId ?? undefined,
      tags: [],
      metadata: {
        source: "asset-gen",
        // Read from the ITEM, not the live store: the user can switch presets
        // while a generation is in flight, which would otherwise persist a
        // preset the image was never generated with.
        backgroundPreset: item.backgroundPreset ?? s.assetGenBackground,
        prompt: item.prompt,
        provider: item.provider,
        requestId: item.requestId,
      },
    });
    set((state) => ({ assetGenSaveFailures: state.assetGenSaveFailures.filter((id) => id !== item.requestId) }));
  } catch {
    set((state) => ({
      assetGenSaveFailures: state.assetGenSaveFailures.includes(item.requestId ?? "")
        ? state.assetGenSaveFailures
        : [...state.assetGenSaveFailures, item.requestId ?? ""],
    }));
  }
}

export async function retryAssetGenSaveImpl(requestId: string, set: StoreSet, get: StoreGet): Promise<void> {
  const item = get().assetGenItems.find((entry) => entry.requestId === requestId);
  if (!item) return;
  if (item.mediaType === "video") await registerAssetGenVideoResult(item, set, get);
  else await registerAssetGenResult(item, set, get);
}

async function generateAssetGenVideo(flightId: string, set: StoreSet, get: StoreGet, controller: AbortController): Promise<void> {
  const s = get();
  const prompt = s.assetGenPrompt.trim();
  const res = await postVideoGenerateStream(
    {
      prompt,
      provider: "grok",
      duration: s.assetGenVideoDuration,
      resolution: s.assetGenVideoResolution,
      aspectRatio: s.assetGenVideoAspect,
      requestId: flightId,
      backgroundPreset: s.assetGenBackground,
    },
    {},
    { signal: controller.signal },
  );
  const item: GenerateItem = {
    image: res.url,
    url: res.url,
    filename: res.filename,
    mediaType: "video",
    video: res.video ?? null,
    prompt,
    provider: "grok",
    requestId: res.requestId ?? flightId,
    elapsed: res.elapsed,
    // Captured at request time so registration cannot pick up a preset the
    // user switched to while this video was still generating.
    backgroundPreset: s.assetGenBackground,
    createdAt: Date.now(),
  };
  await addHistory(item, set, get, { autoSelectStartedAt: Date.now() });
  set((state) => ({ assetGenItems: [item, ...state.assetGenItems] }));
  await registerAssetGenVideoResult(item, set, get);
  get().showToast(t("toast.generatedSingle", { elapsed: String(res.elapsed ?? "") }));
}

async function registerAssetGenVideoResult(item: GenerateItem, set: StoreSet, get: StoreGet): Promise<void> {
  if (!item.filename) return;
  const s = get();
  try {
    await createAsset({
      filePath: item.filename,
      kind: "video",
      name: (item.prompt || "").trim().slice(0, 80) || item.filename,
      folderId: s.selectedProjectId ?? undefined,
      tags: [],
      metadata: {
        source: "asset-gen",
        backgroundPreset: item.backgroundPreset ?? s.assetGenBackground,
        prompt: item.prompt,
        provider: item.provider,
        requestId: item.requestId,
      },
    });
    set((state) => ({ assetGenSaveFailures: state.assetGenSaveFailures.filter((id) => id !== item.requestId) }));
  } catch {
    set((state) => ({
      assetGenSaveFailures: state.assetGenSaveFailures.includes(item.requestId ?? "")
        ? state.assetGenSaveFailures
        : [...state.assetGenSaveFailures, item.requestId ?? ""],
    }));
  }
}

export async function generateAssetGenImpl(set: StoreSet, get: StoreGet): Promise<void> {
  const s = get();
  const prompt = s.assetGenPrompt.trim();
  if (!prompt) return;

  const flightId = `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const controller = new AbortController();
  registerFlightAbort(flightId, controller);
  const startedAt = Date.now();
  const nextInFlight: PersistedInFlight[] = [
    ...s.inFlight,
    { id: flightId, prompt, startedAt },
  ];
  saveInFlight(nextInFlight);
  set({
    assetGenLastError: null,
    activeGenerations: s.activeGenerations + 1,
    inFlight: nextInFlight,
  });
  get().startInFlightPolling();

  try {
    if (s.assetGenKind === "video") {
      await generateAssetGenVideo(flightId, set, get, controller);
      return;
    }
    const payload = {
      prompt,
      quality: s.quality,
      size: "1024x1024",
      format: "png" as const,
      moderation: s.moderation,
      provider: s.assetGenProvider,
      n: 1,
      model: assetGenModel(s),
      requestId: flightId,
      mode: s.promptMode,
      backgroundPreset: s.assetGenBackground,
    };
    const res: GenerateResponse = await postGenerateStream(payload, { signal: controller.signal });
    const first = isMultiResponse(res) ? res.images[0] : null;
    const item: GenerateItem = {
      image: first ? first.image : (res as Extract<GenerateResponse, { image: string }>).image,
      filename: first ? first.filename : (res as Extract<GenerateResponse, { filename?: string | null }>).filename,
      reasoningEffort: res.reasoningEffort,
      prompt,
      elapsed: res.elapsed,
      provider: res.provider,
      providerUrl: (first ? first.providerUrl : (res as { providerUrl?: string | null }).providerUrl) ?? null,
      usage: res.usage,
      requestId: res.requestId ?? flightId,
      quality: res.quality,
      size: res.size,
      model: res.model ?? null,
      // Carried so the gallery can show a checkerboard and skip the keying
      // offer: a transparent result has no matte to key out.
      backgroundPreset: s.assetGenBackground,
      createdAt: (first ? first.createdAt : (res as { createdAt?: number }).createdAt) ?? Date.now(),
    };
    await addHistory(item, set, get, { autoSelectStartedAt: startedAt });
    set((state) => ({ assetGenItems: [item, ...state.assetGenItems] }));
    await registerAssetGenResult(item, set, get);
    get().showToast(t("toast.generatedSingle", { elapsed: res.elapsed }));
  } catch (err) {
    if (!isCanceledGenerationError(err)) {
      const resolved = handleError(err, get());
      const message = resolved.code === "JOB_TRACKING_TIMEOUT" ? resolved.message
        : err instanceof Error ? err.message : String(err);
      set({ assetGenLastError: message });
    }
  } finally {
    const remaining = get().inFlight.filter((f) => f.id !== flightId);
    saveInFlight(remaining);
    clearFlightAbort(flightId);
    set({
      activeGenerations: Math.max(0, get().activeGenerations - 1),
      inFlight: remaining,
    });
  }
}
