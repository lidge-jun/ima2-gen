const BLANK_CANVAS_WIDTH = 1024;
const BLANK_CANVAS_HEIGHT = 1024;
const BLANK_CANVAS_FILENAME = "blank-canvas.png";

export async function createBlankCanvasFile(): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = BLANK_CANVAS_WIDTH;
  canvas.height = BLANK_CANVAS_HEIGHT;

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
