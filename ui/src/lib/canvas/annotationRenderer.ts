import type {
  AnnotationSnapshot,
  BoundingBox,
  CanvasMemo,
  DrawingPath,
  NormalizedPoint,
  SelectionBox,
} from "../../types/canvas";
import { parseCanvasObjectKey } from "./objectKeys";

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
        color: "#64c8ff",
        strokeWidth: 2,
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

export function renderCanvasMemo(
  ctx: CanvasRenderingContext2D,
  memo: CanvasMemo,
  size: ImageSize,
): void {
  const x = memo.x * size.width;
  const y = memo.y * size.height;
  const width = Math.min(260, Math.max(150, size.width * 0.22));
  const padding = 12;
  const lineHeight = 18;

  ctx.save();
  ctx.font = "14px sans-serif";
  const lines = wrapMemoText(ctx, memo.text.trim() || " ", width - padding * 2);
  const height = Math.max(52, padding * 2 + lines.length * lineHeight);

  ctx.fillStyle = "rgba(255, 246, 179, 0.96)";
  ctx.strokeStyle = "rgba(44, 37, 12, 0.28)";
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, x, y, width, height, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#2f2a13";
  ctx.textBaseline = "top";
  lines.forEach((line, index) => {
    ctx.fillText(line, x + padding, y + padding + index * lineHeight);
  });
  ctx.restore();
}

export function getAnnotationBounds(
  objectKey: string,
  annotations: AnnotationSnapshot,
): BoundingBox | null {
  const parsed = parseCanvasObjectKey(objectKey);
  if (!parsed) return null;

  if (parsed.kind === "box") {
    return annotations.boxes.find((item) => item.id === parsed.id) ?? null;
  }

  const memo = parsed.kind === "memo"
    ? annotations.memos.find((item) => item.id === parsed.id)
    : null;
  if (memo) {
    return { id: memo.id, x: memo.x, y: memo.y, width: 0.18, height: 0.12, color: memo.color, strokeWidth: 1 };
  }

  if (parsed.kind !== "path") return null;
  const path = annotations.paths.find((item) => item.id === parsed.id);
  if (!path || path.points.length === 0) return null;
  const xs = path.points.map((point) => point.x);
  const ys = path.points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    id: path.id,
    x,
    y,
    width: Math.max(0.01, Math.max(...xs) - x),
    height: Math.max(0.01, Math.max(...ys) - y),
    color: path.color,
    strokeWidth: path.strokeWidth,
  };
}

export function renderSelectionOutline(
  ctx: CanvasRenderingContext2D,
  box: BoundingBox | SelectionBox,
  size: ImageSize,
): void {
  const normalized = "start" in box
    ? {
        x: Math.min(box.start.x, box.current.x),
        y: Math.min(box.start.y, box.current.y),
        width: Math.abs(box.current.x - box.start.x),
        height: Math.abs(box.current.y - box.start.y),
      }
    : box;

  ctx.save();
  ctx.strokeStyle = "#64c8ff";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
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

function wrapMemoText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || current === "") {
      current = next;
      continue;
    }
    lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
