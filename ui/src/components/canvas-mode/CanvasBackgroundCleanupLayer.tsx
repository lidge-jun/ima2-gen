import type {
  CanvasBackgroundCleanupBrushStroke,
  CanvasBackgroundCleanupSeed,
  NormalizedPoint,
} from "../../types/canvas";

interface CanvasBackgroundCleanupLayerProps {
  seeds: CanvasBackgroundCleanupSeed[];
  brushStrokes: CanvasBackgroundCleanupBrushStroke[];
  brushCursor: NormalizedPoint | null;
  brushRadius: number;
  active: boolean;
}

function toSvgPoint(point: NormalizedPoint): string {
  return `${point.x * 100} ${point.y * 100}`;
}

function strokePoints(points: NormalizedPoint[]): string {
  return points.map(toSvgPoint).join(" ");
}

export function CanvasBackgroundCleanupLayer({
  seeds,
  brushStrokes,
  brushCursor,
  brushRadius,
  active,
}: CanvasBackgroundCleanupLayerProps) {
  if (!active && seeds.length === 0 && brushStrokes.length === 0) return null;
  const cursorRadius = brushRadius * 100;
  return (
    <svg className="canvas-cleanup-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {brushStrokes.map((stroke) => (
        <polyline
          key={stroke.id}
          className={`canvas-cleanup-overlay__stroke canvas-cleanup-overlay__stroke--${stroke.intent}`}
          points={strokePoints(stroke.points)}
          strokeWidth={Math.max(0.3, stroke.radius * 200)}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {active && brushCursor ? (
        <circle
          className="canvas-cleanup-cursor"
          cx={brushCursor.x * 100}
          cy={brushCursor.y * 100}
          r={Math.max(0.6, cursorRadius)}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </svg>
  );
}
