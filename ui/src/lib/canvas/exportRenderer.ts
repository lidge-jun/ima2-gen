import type { MergeCanvasInput } from "./mergeRenderer";
import { renderMergedCanvasImage } from "./mergeRenderer";
import { buildCanvasSvg } from "./svgExport";
import { buildCanvasPptx } from "./pptxExport";
import type { AnnotationSnapshot } from "../../types/canvas";

export type CanvasExportFormat = "png" | "svg" | "pptx";

export async function exportCanvasImage(input: MergeCanvasInput): Promise<Blob> {
  const merged = await renderMergedCanvasImage(input);
  return merged.blob;
}

export function makeCanvasExportFilename(
  options: { matte?: boolean; format?: CanvasExportFormat } = {},
  date = new Date(),
): string {
  const stamp = date.toISOString().slice(0, 19).replace(/[-:T]/g, "");
  const suffix = options.matte ? "-flat" : "";
  return `canvas-export-${stamp}${suffix}.${options.format ?? "png"}`;
}

/**
 * Produce the composition in the requested format.
 *
 * SVG vectorizes the annotation layer over an embedded raster; PPTX places the
 * flattened PNG on one slide and re-adds memos as editable text. Both reuse the same
 * merge/coordinate code as PNG so the three outputs cannot drift apart.
 */
export async function exportCanvasAs(
  format: CanvasExportFormat,
  input: MergeCanvasInput,
  annotations: AnnotationSnapshot,
): Promise<Blob> {
  const imageSize = {
    width: input.imageElement.naturalWidth,
    height: input.imageElement.naturalHeight,
  };

  if (format === "svg") {
    // Vector output must layer annotations over a CLEAN raster. Reusing the flattened
    // PNG here would draw every stroke twice — once baked in, once as vector.
    const base = await renderMergedCanvasImage({ ...input, paths: [], boxes: [], memos: [] });
    const svg = buildCanvasSvg({
      imageDataUrl: base.dataUrl,
      imageSize,
      annotations,
    });
    return new Blob([svg], { type: "image/svg+xml" });
  }

  const merged = await renderMergedCanvasImage(input);
  if (format === "png") return merged.blob;

  // PPTX: bake the drawing (paths/boxes) into the slide image, but leave memos out of
  // the raster so they can be re-added as editable text without appearing twice.
  const withoutMemos = await renderMergedCanvasImage({ ...input, memos: [] });
  return buildCanvasPptx({
    mergedDataUrl: withoutMemos.dataUrl,
    imageSize,
    memos: annotations.memos,
  });
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
