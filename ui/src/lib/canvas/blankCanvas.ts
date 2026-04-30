const DEFAULT_BLANK_CANVAS_WIDTH = 1024;
const DEFAULT_BLANK_CANVAS_HEIGHT = 1024;
const BLANK_CANVAS_FILENAME = "blank-canvas.png";

export type BlankCanvasSize = {
  width?: number;
  height?: number;
};

function normalizeBlankCanvasSide(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.max(1, Math.round(value));
}

export async function createBlankCanvasFile(size?: BlankCanvasSize): Promise<File> {
  const width = normalizeBlankCanvasSide(size?.width, DEFAULT_BLANK_CANVAS_WIDTH);
  const height = normalizeBlankCanvasSide(size?.height, DEFAULT_BLANK_CANVAS_HEIGHT);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("blank_canvas_context_unavailable");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error("blank_canvas_blob_unavailable"));
    }, "image/png");
  });

  return new File([blob], BLANK_CANVAS_FILENAME, { type: "image/png" });
}
