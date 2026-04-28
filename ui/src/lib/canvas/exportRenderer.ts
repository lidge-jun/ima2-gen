import type { MergeCanvasInput } from "./mergeRenderer";
import { renderMergedCanvasImage } from "./mergeRenderer";

export async function exportCanvasImage(input: MergeCanvasInput): Promise<Blob> {
  const merged = await renderMergedCanvasImage(input);
  return merged.blob;
}

export function makeCanvasExportFilename(date = new Date()): string {
  const stamp = date.toISOString().slice(0, 19).replace(/[-:T]/g, "");
  return `canvas-export-${stamp}.png`;
}

export function downloadCanvasBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
