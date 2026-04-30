import type { NormalizedPoint } from "../../types/canvas";

export interface CleanupMask {
  width: number;
  height: number;
  data: Uint8Array;
}

function assertSameSize(a: CleanupMask, b: CleanupMask): void {
  if (a.width !== b.width || a.height !== b.height || a.data.length !== b.data.length) {
    throw new Error("cleanup_mask_size_mismatch");
  }
}

function pointToPixel(point: NormalizedPoint, width: number, height: number): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(width - 1, Math.round(point.x * (width - 1)))),
    y: Math.max(0, Math.min(height - 1, Math.round(point.y * (height - 1)))),
  };
}

export function createCleanupMask(width: number, height: number): CleanupMask {
  return { width, height, data: new Uint8Array(width * height) };
}

export function cloneCleanupMask(mask: CleanupMask): CleanupMask {
  return { width: mask.width, height: mask.height, data: new Uint8Array(mask.data) };
}

export function orMaskInto(target: CleanupMask, addition: CleanupMask): void {
  assertSameSize(target, addition);
  for (let index = 0; index < target.data.length; index += 1) {
    if ((addition.data[index] ?? 0) > 0) target.data[index] = 255;
  }
}

export function subtractMaskInto(target: CleanupMask, subtract: CleanupMask): void {
  assertSameSize(target, subtract);
  for (let index = 0; index < target.data.length; index += 1) {
    if ((subtract.data[index] ?? 0) > 0) target.data[index] = 0;
  }
}

function paintDisk(mask: CleanupMask, centerX: number, centerY: number, radiusPx: number): void {
  if (radiusPx <= 0) return;
  const minX = Math.max(0, Math.floor(centerX - radiusPx));
  const maxX = Math.min(mask.width - 1, Math.ceil(centerX + radiusPx));
  const minY = Math.max(0, Math.floor(centerY - radiusPx));
  const maxY = Math.min(mask.height - 1, Math.ceil(centerY + radiusPx));
  const radiusSq = radiusPx * radiusPx;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy <= radiusSq) mask.data[y * mask.width + x] = 255;
    }
  }
}

export function rasterizeBrushStrokeInto(
  mask: CleanupMask,
  stroke: { points: NormalizedPoint[]; radius: number },
): void {
  if (stroke.radius <= 0 || stroke.points.length === 0) return;
  const radiusPx = stroke.radius * Math.max(mask.width, mask.height);
  const pixels = stroke.points.map((point) => pointToPixel(point, mask.width, mask.height));
  for (const point of pixels) paintDisk(mask, point.x, point.y, radiusPx);
  for (let index = 1; index < pixels.length; index += 1) {
    const prev = pixels[index - 1];
    const next = pixels[index];
    if (!prev || !next) continue;
    const distance = Math.hypot(next.x - prev.x, next.y - prev.y);
    const steps = Math.max(1, Math.ceil(distance / Math.max(1, radiusPx / 2)));
    for (let step = 1; step < steps; step += 1) {
      const t = step / steps;
      paintDisk(mask, prev.x + (next.x - prev.x) * t, prev.y + (next.y - prev.y) * t, radiusPx);
    }
  }
}

export function composeFinalRemoveMask(
  removeMask: CleanupMask | null,
  preserveMask: CleanupMask | null,
): CleanupMask | null {
  if (!removeMask) return null;
  const finalMask = cloneCleanupMask(removeMask);
  if (preserveMask) subtractMaskInto(finalMask, preserveMask);
  return finalMask;
}

export function applyRemoveMaskToImageData(source: ImageData, finalRemoveMask: CleanupMask): ImageData {
  if (source.width !== finalRemoveMask.width || source.height !== finalRemoveMask.height) {
    throw new Error("cleanup_mask_size_mismatch");
  }
  const output = new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
  for (let index = 0; index < finalRemoveMask.data.length; index += 1) {
    if ((finalRemoveMask.data[index] ?? 0) > 0) output.data[index * 4 + 3] = 0;
  }
  return output;
}
