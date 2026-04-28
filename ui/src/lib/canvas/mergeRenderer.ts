import type { BoundingBox, CanvasMemo, DrawingPath } from "../../types/canvas";
import {
  renderAnnotationPath,
  renderBoundingBox,
  renderCanvasMemo,
} from "./annotationRenderer";

export interface MergeCanvasInput {
  imageElement: HTMLImageElement;
  paths: DrawingPath[];
  boxes: BoundingBox[];
  memos: CanvasMemo[];
  background?: { mode: "alpha" } | { mode: "matte"; color: string };
}

export interface MergeCanvasResult {
  blob: Blob;
  dataUrl: string;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("canvas_blob_unavailable"));
    }, type);
  });
}

export async function renderMergedCanvasImage(
  input: MergeCanvasInput,
): Promise<MergeCanvasResult> {
  const canvas = document.createElement("canvas");
  canvas.width = input.imageElement.naturalWidth;
  canvas.height = input.imageElement.naturalHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_context_unavailable");

  if (input.background?.mode === "matte") {
    ctx.fillStyle = input.background.color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(input.imageElement, 0, 0, canvas.width, canvas.height);

  const size = { width: canvas.width, height: canvas.height };
  for (const path of input.paths) renderAnnotationPath(ctx, path, size);
  for (const box of input.boxes) renderBoundingBox(ctx, box, size, "committed");
  for (const memo of input.memos) renderCanvasMemo(ctx, memo, size);

  const blob = await canvasToBlob(canvas, "image/png");
  return { blob, dataUrl: canvas.toDataURL("image/png") };
}
