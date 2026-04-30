import {
  cloneCleanupMask,
  type CleanupMask,
} from "../../lib/canvas/backgroundCleanupMasks";
import type {
  BackgroundRemovalOverlayResult,
  BackgroundRemovalRenderResult,
  BackgroundRemovalStats,
} from "../../lib/canvas/backgroundRemoval";
import type {
  CanvasBackgroundCleanupBrushStroke,
  CanvasBackgroundCleanupClickEngine,
  CanvasBackgroundCleanupIntent,
  CanvasBackgroundCleanupSeed,
  CanvasBackgroundCleanupTool,
  NormalizedPoint,
} from "../../types/canvas";

export interface SourceImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface BackgroundCleanupSnapshot {
  intent: CanvasBackgroundCleanupIntent;
  tool: CanvasBackgroundCleanupTool;
  engine: CanvasBackgroundCleanupClickEngine;
  seeds: CanvasBackgroundCleanupSeed[];
  brushStrokes: CanvasBackgroundCleanupBrushStroke[];
  brushRadius: number;
  tolerance: number;
  removeMask: CleanupMask | null;
  preserveMask: CleanupMask | null;
  preview: BackgroundRemovalRenderResult | null;
  maskOverlay: BackgroundRemovalOverlayResult | null;
  stats: BackgroundRemovalStats | null;
  active: boolean;
  brushCursor: NormalizedPoint | null;
}

export function cloneSnapshot(snapshot: BackgroundCleanupSnapshot): BackgroundCleanupSnapshot {
  return {
    ...snapshot,
    seeds: snapshot.seeds.map((seed) => ({ intent: seed.intent, point: { ...seed.point } })),
    brushStrokes: snapshot.brushStrokes.map((stroke) => ({
      ...stroke,
      points: stroke.points.map((point) => ({ ...point })),
    })),
    brushCursor: snapshot.brushCursor ? { ...snapshot.brushCursor } : null,
    removeMask: snapshot.removeMask ? cloneCleanupMask(snapshot.removeMask) : null,
    preserveMask: snapshot.preserveMask ? cloneCleanupMask(snapshot.preserveMask) : null,
  };
}

export function createStrokeId(): string {
  return `cleanup_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function getBrushStrokeSeedPoints(
  stroke: Pick<CanvasBackgroundCleanupBrushStroke, "points" | "radius">,
): NormalizedPoint[] {
  const seeds: NormalizedPoint[] = [];
  const offset = Math.max(0, stroke.radius * 0.55);
  for (const point of stroke.points) {
    seeds.push({ ...point });
    if (offset <= 0) continue;
    seeds.push(
      { x: clampUnit(point.x - offset), y: point.y },
      { x: clampUnit(point.x + offset), y: point.y },
      { x: point.x, y: clampUnit(point.y - offset) },
      { x: point.x, y: clampUnit(point.y + offset) },
    );
  }
  return seeds;
}

export function drawImageData(imageElement: HTMLImageElement): SourceImageData {
  const width = imageElement.naturalWidth;
  const height = imageElement.naturalHeight;
  if (width <= 0 || height <= 0) throw new Error("background_cleanup_image_not_ready");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("background_cleanup_context_failed");
  context.drawImage(imageElement, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  return { width, height, data: imageData.data };
}
