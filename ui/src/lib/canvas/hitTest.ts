import type {
  AnnotationSnapshot,
  BoundingBox,
  CanvasMemo,
  DrawingPath,
  NormalizedPoint,
  SelectionBox,
} from "../../types/canvas";
import { keyForBox, keyForMemo, keyForPath, type CanvasObjectKey } from "./objectKeys";

const MEMO_WIDTH = 0.18;
const MEMO_HEIGHT = 0.12;

export function normalizeSelectionBox(box: SelectionBox): BoundingBox {
  return {
    id: "selection-box",
    x: Math.min(box.start.x, box.current.x),
    y: Math.min(box.start.y, box.current.y),
    width: Math.abs(box.current.x - box.start.x),
    height: Math.abs(box.current.y - box.start.y),
    color: "#64c8ff",
    strokeWidth: 2,
  };
}

function pointInBox(point: NormalizedPoint, box: BoundingBox, tolerance = 0): boolean {
  return (
    point.x >= box.x - tolerance &&
    point.x <= box.x + box.width + tolerance &&
    point.y >= box.y - tolerance &&
    point.y <= box.y + box.height + tolerance
  );
}

function memoBox(memo: CanvasMemo): BoundingBox {
  return {
    id: memo.id,
    x: memo.x,
    y: memo.y,
    width: MEMO_WIDTH,
    height: MEMO_HEIGHT,
    color: memo.color,
    strokeWidth: 1,
  };
}

function distanceToSegment(point: NormalizedPoint, a: NormalizedPoint, b: NormalizedPoint): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = point.x - a.x;
  const wy = point.y - a.y;
  const lenSq = vx * vx + vy * vy;
  if (lenSq === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / lenSq));
  return Math.hypot(point.x - (a.x + t * vx), point.y - (a.y + t * vy));
}

function pathHit(point: NormalizedPoint, path: DrawingPath, tolerance: number): boolean {
  for (let i = 1; i < path.points.length; i += 1) {
    if (distanceToSegment(point, path.points[i - 1], path.points[i]) <= tolerance) return true;
  }
  return false;
}

function boxIntersects(a: BoundingBox, b: BoundingBox): boolean {
  return a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y;
}

function pathIntersectsBox(path: DrawingPath, box: BoundingBox): boolean {
  return path.points.some((point) => pointInBox(point, box));
}

export function hitTestAnnotation(input: {
  point: NormalizedPoint;
  paths: DrawingPath[];
  boxes: BoundingBox[];
  memos: CanvasMemo[];
  tolerance?: number;
}): CanvasObjectKey | null {
  const tolerance = input.tolerance ?? 0.015;
  for (const memo of [...input.memos].reverse()) {
    if (pointInBox(input.point, memoBox(memo), tolerance)) return keyForMemo(memo);
  }
  for (const box of [...input.boxes].reverse()) {
    if (pointInBox(input.point, box, tolerance)) return keyForBox(box);
  }
  for (const path of [...input.paths].reverse()) {
    if (pathHit(input.point, path, tolerance)) return keyForPath(path);
  }
  return null;
}

export function findAnnotationsInBox(input: {
  box: BoundingBox;
  annotations: AnnotationSnapshot;
}): CanvasObjectKey[] {
  const ids: CanvasObjectKey[] = [];
  for (const path of input.annotations.paths) {
    if (pathIntersectsBox(path, input.box)) ids.push(keyForPath(path));
  }
  for (const box of input.annotations.boxes) {
    if (boxIntersects(box, input.box)) ids.push(keyForBox(box));
  }
  for (const memo of input.annotations.memos) {
    if (boxIntersects(memoBox(memo), input.box)) ids.push(keyForMemo(memo));
  }
  return ids;
}
