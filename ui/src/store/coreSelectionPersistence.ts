import {
  filterCoreSelectionMemory, reconcileCoreSelection,
  type CoreSelectionMemory, type CoreSelectionState,
} from "../lib/coreSelection";
import {
  loadGenerationDefaults, loadVideoDefaults, saveGenerationDefaultsPatch,
  saveImageModel, saveVideoDefaults,
} from "./storePersistence";
import { CORE_SELECTION_MEMORY_STORAGE_KEY, IMAGE_MODEL_STORAGE_KEY } from "./persistenceRegistry";

function readMemoryEnvelope(): Record<string, unknown> | null {
  const raw = localStorage.getItem(CORE_SELECTION_MEMORY_STORAGE_KEY);
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

export function loadCoreSelectionMemory(): CoreSelectionMemory {
  try {
    const envelope = readMemoryEnvelope();
    return envelope?.version === 1 ? filterCoreSelectionMemory(envelope.lanes) : {};
  } catch {
    return {};
  }
}

export function saveCoreSelectionMemory(memory: CoreSelectionMemory): void {
  try {
    let envelope: Record<string, unknown> | null = null;
    try { envelope = readMemoryEnvelope(); } catch { /* Malformed v1 data can be replaced on an explicit action. */ }
    if (envelope && envelope.version !== undefined && envelope.version !== 1) return;
    const previous = envelope?.version === 1 ? filterCoreSelectionMemory(envelope.lanes) : {};
    // Replace supplied lane records, not individual slots: explicit clears stay cleared.
    const lanes = { ...previous, ...filterCoreSelectionMemory(memory) };
    localStorage.setItem(CORE_SELECTION_MEMORY_STORAGE_KEY, JSON.stringify({ version: 1, lanes }));
  } catch { /* Preference writes are best-effort; never clear unrelated keys. */ }
}

export function loadCoreSelectionSnapshot(): CoreSelectionState {
  const generation = loadGenerationDefaults();
  const video = loadVideoDefaults();
  let imageModel: string | null = null;
  try { imageModel = localStorage.getItem(IMAGE_MODEL_STORAGE_KEY); } catch { /* Safe default below. */ }
  return reconcileCoreSelection({
    provider: generation.provider, imageModel, videoModelSelected: video.model,
    comfyWorkflow: generation.comfyWorkflow, comfyVideoWorkflow: generation.comfyVideoWorkflow,
  });
}

export function persistCoreSelection(selection: CoreSelectionState): void {
  saveImageModel(selection.imageModel);
  saveVideoDefaults({ model: selection.videoModelSelected });
  saveGenerationDefaultsPatch({
    provider: selection.provider, comfyWorkflow: selection.comfyWorkflow,
    comfyVideoWorkflow: selection.comfyVideoWorkflow,
  });
}
