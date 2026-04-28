import type { BoundingBox } from "../../types/canvas";

interface MaskInput {
  imageElement: HTMLImageElement;
  boxes: BoundingBox[];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("mask_blob_unavailable"));
    }, "image/png");
  });
}

export async function renderMaskFromBoxes(input: MaskInput): Promise<Blob> {
  const width = input.imageElement.naturalWidth;
  const height = input.imageElement.naturalHeight;
  if (!width || !height) throw new Error("mask_source_size_unavailable");
  if (input.boxes.length === 0) throw new Error("mask_boxes_required");

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("mask_context_unavailable");

  ctx.fillStyle = "rgba(0, 0, 0, 1)";
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = "destination-out";
  for (const box of input.boxes) {
    const x = clamp01(box.x) * width;
    const y = clamp01(box.y) * height;
    const w = clamp01(box.width) * width;
    const h = clamp01(box.height) * height;
    if (w > 0 && h > 0) ctx.fillRect(x, y, w, h);
  }
  return canvasToPngBlob(canvas);
}

export async function imageElementToPngDataUrl(imageElement: HTMLImageElement): Promise<string> {
  const width = imageElement.naturalWidth;
  const height = imageElement.naturalHeight;
  if (!width || !height) throw new Error("image_source_size_unavailable");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("image_context_unavailable");
  ctx.drawImage(imageElement, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("mask_blob_read_failed"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}
