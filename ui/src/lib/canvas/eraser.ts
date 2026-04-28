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
const EPSILON = 0.000001;

interface SegmentCut {
  leftT: number;
  rightT: number;
}

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
  let current: NormalizedPoint[] = isPointErased(path.points[0], eraserPoints, radius)
    ? []
    : [path.points[0]];

  for (let i = 1; i < path.points.length; i += 1) {
    const a = path.points[i - 1];
    const b = path.points[i];
    const bErased = isPointErased(b, eraserPoints, radius);
    const cut = getSegmentEraserCut(a, b, eraserPoints, radius);

    if (cut) {
      if (current.length === 0 && !isPointErased(a, eraserPoints, radius)) {
        current = [a];
      }
      if (current.length > 0 && cut.leftT > EPSILON) {
        addPoint(current, pointAtSegment(a, b, cut.leftT));
      }
      if (current.length >= MIN_FRAGMENT_POINTS) kept.push(current);
      current = [];

      if (cut.rightT < 1 - EPSILON && !bErased) {
        current = [pointAtSegment(a, b, cut.rightT), b];
      }
      continue;
    }

    if (bErased) {
      if (current.length >= MIN_FRAGMENT_POINTS) kept.push(current);
      current = [];
      continue;
    }

    if (current.length === 0 && !isPointErased(a, eraserPoints, radius)) {
      current = [a];
    }
    addPoint(current, b);
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

function getSegmentEraserCut(
  a: NormalizedPoint,
  b: NormalizedPoint,
  eraserPoints: NormalizedPoint[],
  radius: number,
): SegmentCut | null {
  const segmentLength = distance(a, b);
  if (segmentLength <= EPSILON) {
    return isPointErased(a, eraserPoints, radius) ? { leftT: 0, rightT: 1 } : null;
  }

  let bestT: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const eraserPoint of eraserPoints) {
    const t = projectPointToSegmentT(eraserPoint, a, b);
    const projected = pointAtSegment(a, b, t);
    const candidateDistance = distance(eraserPoint, projected);
    if (candidateDistance < bestDistance) {
      bestDistance = candidateDistance;
      bestT = t;
    }
  }

  for (let i = 1; i < eraserPoints.length; i += 1) {
    const samples = [0, 0.25, 0.5, 0.75, 1];
    for (const sample of samples) {
      const eraserPoint = pointAtSegment(eraserPoints[i - 1], eraserPoints[i], sample);
      const t = projectPointToSegmentT(eraserPoint, a, b);
      const projected = pointAtSegment(a, b, t);
      const candidateDistance = distance(eraserPoint, projected);
      if (candidateDistance < bestDistance) {
        bestDistance = candidateDistance;
        bestT = t;
      }
    }
  }

  if (bestT === null || bestDistance > radius) return null;

  const halfGap = Math.max(radius / segmentLength, 0.01);
  return {
    leftT: Math.max(0, bestT - halfGap),
    rightT: Math.min(1, bestT + halfGap),
  };
}

function projectPointToSegmentT(point: NormalizedPoint, a: NormalizedPoint, b: NormalizedPoint): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = point.x - a.x;
  const wy = point.y - a.y;
  const lenSq = vx * vx + vy * vy;
  if (lenSq === 0) return 0;
  return Math.max(0, Math.min(1, (wx * vx + wy * vy) / lenSq));
}

function pointAtSegment(a: NormalizedPoint, b: NormalizedPoint, t: number): NormalizedPoint {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function addPoint(points: NormalizedPoint[], point: NormalizedPoint): void {
  const last = points.at(-1);
  if (!last || distance(last, point) > EPSILON) points.push(point);
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
