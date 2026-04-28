import type { NormalizedPoint } from "../../types/canvas";
import { blobToDataUrl } from "./maskRenderer";

const DEFAULT_SEEDS: NormalizedPoint[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

export interface BackgroundRemovalImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface BackgroundRemovalStats {
  width: number;
  height: number;
  removedPixels: number;
  removedPercent: number;
}

export interface BackgroundRemovalResult {
  imageData: BackgroundRemovalImageData;
  stats: BackgroundRemovalStats;
}

export interface BackgroundRemovalRenderResult {
  blob: Blob;
  dataUrl: string;
  stats: BackgroundRemovalStats;
}

export interface BackgroundRemovalOverlayResult {
  dataUrl: string;
  stats: BackgroundRemovalStats;
}

export interface BackgroundRemovalOptions {
  imageElement: HTMLImageElement;
  seeds: NormalizedPoint[];
  tolerance: number;
}

interface SampledColor {
  r: number;
  g: number;
  b: number;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function pointToIndex(point: NormalizedPoint, width: number, height: number): number {
  const x = Math.max(0, Math.min(width - 1, Math.round(point.x * (width - 1))));
  const y = Math.max(0, Math.min(height - 1, Math.round(point.y * (height - 1))));
  return y * width + x;
}

function sampleSeedColors(input: BackgroundRemovalImageData, seeds: NormalizedPoint[]): SampledColor[] {
  const points = seeds.length > 0 ? seeds : DEFAULT_SEEDS;
  return points.map((point) => {
    const offset = pointToIndex(point, input.width, input.height) * 4;
    return {
      r: input.data[offset] ?? 0,
      g: input.data[offset + 1] ?? 0,
      b: input.data[offset + 2] ?? 0,
    };
  });
}

function isWithinTolerance(
  data: Uint8ClampedArray,
  offset: number,
  colors: SampledColor[],
  tolerance: number,
): boolean {
  for (const color of colors) {
    const distance = Math.max(
      Math.abs((data[offset] ?? 0) - color.r),
      Math.abs((data[offset + 1] ?? 0) - color.g),
      Math.abs((data[offset + 2] ?? 0) - color.b),
    );
    if (distance <= tolerance) return true;
  }
  return false;
}

function pushIfCandidate(
  index: number,
  input: BackgroundRemovalImageData,
  stack: Int32Array,
  visited: Uint8Array,
  top: number,
  colors: SampledColor[],
  tolerance: number,
): number {
  if (index < 0 || index >= visited.length || visited[index]) return top;
  const offset = index * 4;
  if ((input.data[offset + 3] ?? 0) === 0) {
    visited[index] = 1;
    return top;
  }
  if (!isWithinTolerance(input.data, offset, colors, tolerance)) return top;
  visited[index] = 1;
  stack[top] = index;
  return top + 1;
}

export function getCornerBackgroundRemovalSeeds(): NormalizedPoint[] {
  return DEFAULT_SEEDS.map((seed) => ({ ...seed }));
}

export function removeContiguousBackground(
  input: BackgroundRemovalImageData,
  seeds: NormalizedPoint[],
  tolerance: number,
): BackgroundRemovalResult {
  const { width, height, data } = input;
  const output = new Uint8ClampedArray(data);
  const totalPixels = width * height;
  const visited = new Uint8Array(totalPixels);
  const stack = new Int32Array(totalPixels);
  const colors = sampleSeedColors(input, seeds);
  const safeTolerance = clampByte(tolerance);
  let top = 0;
  let removedPixels = 0;

  for (const seed of seeds.length > 0 ? seeds : DEFAULT_SEEDS) {
    top = pushIfCandidate(
      pointToIndex(seed, width, height),
      input,
      stack,
      visited,
      top,
      colors,
      safeTolerance,
    );
  }

  while (top > 0) {
    const index = stack[--top];
    const offset = index * 4;
    if ((output[offset + 3] ?? 0) !== 0) {
      output[offset + 3] = 0;
      removedPixels += 1;
    }

    const x = index % width;
    if (x > 0) top = pushIfCandidate(index - 1, input, stack, visited, top, colors, safeTolerance);
    if (x < width - 1) top = pushIfCandidate(index + 1, input, stack, visited, top, colors, safeTolerance);
    if (index >= width) top = pushIfCandidate(index - width, input, stack, visited, top, colors, safeTolerance);
    if (index < totalPixels - width) {
      top = pushIfCandidate(index + width, input, stack, visited, top, colors, safeTolerance);
    }
  }

  return {
    imageData: { width, height, data: output },
    stats: {
      width,
      height,
      removedPixels,
      removedPercent: totalPixels > 0 ? removedPixels / totalPixels : 0,
    },
  };
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("background_cleanup_blob_failed"));
    }, "image/png");
  });
}

function drawSourceImage(imageElement: HTMLImageElement): {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
} {
  const width = imageElement.naturalWidth;
  const height = imageElement.naturalHeight;
  if (width <= 0 || height <= 0) throw new Error("background_cleanup_image_not_ready");

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("background_cleanup_context_failed");
  context.drawImage(imageElement, 0, 0, width, height);
  return { canvas, context, width, height };
}

export async function renderBackgroundRemovalPreview({
  imageElement,
  seeds,
  tolerance,
}: BackgroundRemovalOptions): Promise<BackgroundRemovalRenderResult> {
  try {
    const { canvas, context, width, height } = drawSourceImage(imageElement);
    const imageData = context.getImageData(0, 0, width, height);
    const result = removeContiguousBackground(
      { width, height, data: imageData.data },
      seeds,
      tolerance,
    );
    const cleaned = context.createImageData(width, height);
    cleaned.data.set(result.imageData.data);
    context.putImageData(cleaned, 0, 0);

    const blob = await canvasToPngBlob(canvas);
    return {
      blob,
      dataUrl: await blobToDataUrl(blob),
      stats: result.stats,
    };
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("background_cleanup_failed");
  }
}

export async function renderBackgroundRemovalMaskOverlay({
  imageElement,
  seeds,
  tolerance,
}: BackgroundRemovalOptions): Promise<BackgroundRemovalOverlayResult> {
  try {
    const { context, width, height } = drawSourceImage(imageElement);
    const source = context.getImageData(0, 0, width, height);
    const result = removeContiguousBackground(
      { width, height, data: source.data },
      seeds,
      tolerance,
    );
    const overlayCanvas = document.createElement("canvas");
    overlayCanvas.width = width;
    overlayCanvas.height = height;
    const overlayContext = overlayCanvas.getContext("2d");
    if (!overlayContext) throw new Error("background_cleanup_context_failed");
    const overlay = overlayContext.createImageData(width, height);
    for (let index = 0; index < width * height; index += 1) {
      const offset = index * 4;
      const wasOpaque = (source.data[offset + 3] ?? 0) > 0;
      const isRemoved = wasOpaque && (result.imageData.data[offset + 3] ?? 0) === 0;
      if (!isRemoved) continue;
      overlay.data[offset] = 168;
      overlay.data[offset + 1] = 85;
      overlay.data[offset + 2] = 247;
      overlay.data[offset + 3] = 150;
    }
    overlayContext.putImageData(overlay, 0, 0);
    const blob = await canvasToPngBlob(overlayCanvas);
    return {
      dataUrl: await blobToDataUrl(blob),
      stats: result.stats,
    };
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("background_cleanup_failed");
  }
}
