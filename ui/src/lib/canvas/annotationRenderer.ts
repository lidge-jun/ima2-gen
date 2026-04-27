import type { BoundingBox, DrawingPath, NormalizedPoint } from "../../types/canvas";

export interface ImageSize {
  width: number;
  height: number;
}

interface ActiveBox {
  start: NormalizedPoint;
  current: NormalizedPoint;
}

function toCanvasPoint(point: NormalizedPoint, size: ImageSize): { x: number; y: number } {
  return { x: point.x * size.width, y: point.y * size.height };
}

export function renderAnnotationPath(
  ctx: CanvasRenderingContext2D,
  path: DrawingPath,
  size: ImageSize,
): void {
  if (path.points.length < 2) return;

  const start = toCanvasPoint(path.points[0], size);
  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = path.color;
  ctx.lineWidth = path.strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.moveTo(start.x, start.y);

  for (const point of path.points.slice(1)) {
    const p = toCanvasPoint(point, size);
    ctx.lineTo(p.x, p.y);
  }

  ctx.stroke();

  if (path.tool === "arrow") {
    const last = toCanvasPoint(path.points[path.points.length - 1], size);
    const prev = toCanvasPoint(path.points[path.points.length - 2], size);
    drawArrowHead(ctx, prev, last, path.color, path.strokeWidth);
  }

  ctx.restore();
}

export function renderBoundingBox(
  ctx: CanvasRenderingContext2D,
  box: BoundingBox | ActiveBox,
  size: ImageSize,
  mode: "active" | "committed",
): void {
  const normalized = "start" in box
    ? {
        x: Math.min(box.start.x, box.current.x),
        y: Math.min(box.start.y, box.current.y),
        width: Math.abs(box.current.x - box.start.x),
        height: Math.abs(box.current.y - box.start.y),
        color: "#ef4444",
        strokeWidth: 3,
      }
    : box;

  ctx.save();
  ctx.strokeStyle = normalized.color;
  ctx.lineWidth = mode === "active" ? Math.max(2, normalized.strokeWidth) : normalized.strokeWidth;
  if (mode === "active") ctx.setLineDash([8, 6]);
  ctx.strokeRect(
    normalized.x * size.width,
    normalized.y * size.height,
    normalized.width * size.width,
    normalized.height * size.height,
  );
  ctx.restore();
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
  lineWidth: number,
): void {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const length = Math.max(12, lineWidth * 4);
  const spread = Math.PI / 7;

  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - length * Math.cos(angle - spread), to.y - length * Math.sin(angle - spread));
  ctx.lineTo(to.x - length * Math.cos(angle + spread), to.y - length * Math.sin(angle + spread));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
