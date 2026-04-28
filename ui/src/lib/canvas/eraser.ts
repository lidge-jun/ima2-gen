import type { DrawingPath, NormalizedPoint } from "../../types/canvas";

export interface EraserStrokeInput {
  paths: DrawingPath[];
  points: NormalizedPoint[];
  radius: number;
  makeId?: () => string;
}

export interface EraserStrokeResult {
  paths: DrawingPath[];
  changed: boolean;
}

const MIN_FRAGMENT_POINTS = 2;

export function erasePathsByStroke({
  paths,
  points,
  radius,
  makeId = () => crypto.randomUUID(),
}: EraserStrokeInput): EraserStrokeResult {
  if (paths.length === 0 || points.length === 0 || radius <= 0) {
    return { paths, changed: false };
  }

  let changed = false;
  const nextPaths: DrawingPath[] = [];

  for (const path of paths) {
    const fragments = splitPathByEraser(path, points, radius, makeId);
    if (fragments.length !== 1 || fragments[0] !== path) changed = true;
    nextPaths.push(...fragments);
  }

  return { paths: nextPaths, changed };
}

export function splitPathByEraser(
  path: DrawingPath,
  eraserPoints: NormalizedPoint[],
  radius: number,
  makeId: () => string = () => crypto.randomUUID(),
): DrawingPath[] {
  if (path.points.length < MIN_FRAGMENT_POINTS || eraserPoints.length === 0 || radius <= 0) return [path];

  const kept: NormalizedPoint[][] = [];
  let current: NormalizedPoint[] = [];

  for (const point of path.points) {
    if (isPointErased(point, eraserPoints, radius)) {
      if (current.length >= MIN_FRAGMENT_POINTS) kept.push(current);
      current = [];
      continue;
    }
    current.push(point);
  }

  if (current.length >= MIN_FRAGMENT_POINTS) kept.push(current);

  if (kept.length === 0) return [];
  if (kept.length === 1 && kept[0].length === path.points.length) return [path];

  const arrowIndex = path.tool === "arrow" ? kept.length - 1 : -1;
  return kept.map((points, index) => ({
    ...path,
    id: index === 0 ? path.id : makeId(),
    tool: path.tool === "arrow" && index !== arrowIndex ? "pen" : path.tool,
    points,
  }));
}

export function isPointErased(
  point: NormalizedPoint,
  eraserPoints: NormalizedPoint[],
  radius: number,
): boolean {
  if (eraserPoints.length === 1) return distance(point, eraserPoints[0]) <= radius;
  for (let i = 1; i < eraserPoints.length; i += 1) {
    if (distanceToSegment(point, eraserPoints[i - 1], eraserPoints[i]) <= radius) return true;
  }
  return false;
}

export function distance(a: NormalizedPoint, b: NormalizedPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function distanceToSegment(point: NormalizedPoint, a: NormalizedPoint, b: NormalizedPoint): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = point.x - a.x;
  const wy = point.y - a.y;
  const lenSq = vx * vx + vy * vy;
  if (lenSq === 0) return distance(point, a);
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / lenSq));
  return distance(point, { x: a.x + t * vx, y: a.y + t * vy });
}
