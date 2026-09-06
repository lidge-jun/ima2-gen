import { PROVIDER_SURFACE_SUPPORT } from "../generated/providers";
import type { ComfyLaneModel } from "./api-comfy";
import type { CoreSelectionState } from "./coreSelection";
import type { LaneCatalogSnapshot } from "./laneCatalog";

export type ComfyDisplayCode = "loading" | "error" | "unavailable" | "empty" | "disconnected"
  | "choose" | "selected-missing" | "selected-offline" | "selected-locked" | "ready";
export type ComfySelection = Partial<Pick<CoreSelectionState, "comfyWorkflow" | "comfyVideoWorkflow">>;
export interface ComfyDisplay {
  code: ComfyDisplayCode;
  laneAvailable: boolean;
  selected: { id: string; kind: "image" | "video"; label: string } | null;
  selectedAvailable: boolean;
  imageCount: number;
  videoCount: number;
}

export function isComfyModelAvailable(entry: ComfyLaneModel): boolean {
  return entry.executable !== false && !entry.description?.endsWith("(offline)");
}

export function deriveComfyDisplay(snapshot: LaneCatalogSnapshot, selection: ComfySelection | null): ComfyDisplay {
  const lane = snapshot.catalog?.comfy;
  const models = lane?.models ?? { image: [], video: [] };
  const kind = selection?.comfyVideoWorkflow ? "video" : "image";
  const id = selection?.comfyVideoWorkflow || selection?.comfyWorkflow || null;
  const entry = id ? models[kind].find((candidate) => candidate.id === id) : undefined;
  const support = PROVIDER_SURFACE_SUPPORT.comfy;
  const availableRows = (support.generate.supported && models.image.some(isComfyModelAvailable))
    || (support.video.supported && models.video.some(isComfyModelAvailable));
  const laneAvailable = snapshot.phase === "ready" && lane?.status === "ready" && availableRows;
  const selectedAvailable = Boolean(laneAvailable && entry && isComfyModelAvailable(entry)
    && (kind === "video" ? support.video.supported : support.generate.supported));
  const result = (code: ComfyDisplayCode): ComfyDisplay => ({ code, laneAvailable, selectedAvailable,
    selected: id ? { id, kind, label: entry?.label ?? id } : null,
    imageCount: models.image.length, videoCount: models.video.length });
  if (snapshot.phase === "idle" || snapshot.phase === "loading") return result("loading");
  if (snapshot.phase === "error") return result("error");
  if (!lane || lane.status === "key-missing" || lane.status === "locked") return result("unavailable");
  if (id && !entry) return result("selected-missing");
  if (models.image.length + models.video.length === 0) return result("empty");
  if (lane.status === "disconnected") return result("disconnected");
  if (entry?.executable === false) return result("selected-locked");
  if (entry?.description?.endsWith("(offline)")) return result("selected-offline");
  if (!availableRows) return result("unavailable");
  if (!id) return result("choose");
  return result(selectedAvailable ? "ready" : "unavailable");
}

const MESSAGE_KEYS: Record<Exclude<ComfyDisplayCode, "loading" | "error">, string> = {
  unavailable: "comfy.display.unavailable", empty: "comfy.display.empty",
  disconnected: "comfy.statusOffline", choose: "comfy.display.chooseWorkflow",
  "selected-missing": "comfy.display.selectedMissing", "selected-offline": "comfy.display.selectedOffline",
  "selected-locked": "comfy.display.selectedLocked", ready: "comfy.display.available",
};

export function comfyDisplayMessageKey(display: ComfyDisplay, snapshot: LaneCatalogSnapshot): string {
  if (display.code === "loading") return snapshot.catalog ? "comfy.display.refreshing" : "comfy.display.loading";
  if (display.code === "error") return snapshot.error === "app-auth" ? "comfy.display.appAccessRequired" : "comfy.display.loadFailed";
  return MESSAGE_KEYS[display.code];
}
