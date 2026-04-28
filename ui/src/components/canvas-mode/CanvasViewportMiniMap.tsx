interface CanvasMiniMapViewportInput {
  zoom: number;
  panX: number;
  panY: number;
}

interface CanvasViewportMiniMapProps extends CanvasMiniMapViewportInput {
  imageSrc: string;
  resetLabel: string;
  onReset: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getCanvasMiniMapViewportStyle({
  zoom,
  panX,
  panY,
}: CanvasMiniMapViewportInput): CSSProperties {
  const size = clamp(100 / Math.max(1, zoom), 18, 100);
  const half = size / 2;
  const left = clamp(50 - panX / 40, half, 100 - half);
  const top = clamp(50 - panY / 40, half, 100 - half);

  return {
    width: `${size}%`,
    height: `${size}%`,
    left: `${left}%`,
    top: `${top}%`,
  };
}

export function CanvasViewportMiniMap({
  imageSrc,
  zoom,
  panX,
  panY,
  resetLabel,
  onReset,
}: CanvasViewportMiniMapProps) {
  return (
    <button
      type="button"
      className="canvas-viewport-minimap"
      onClick={onReset}
      aria-label={resetLabel}
      title={resetLabel}
    >
      <img src={imageSrc} alt="" aria-hidden="true" />
      <span
        className="canvas-viewport-minimap__window"
        style={getCanvasMiniMapViewportStyle({ zoom, panX, panY })}
        aria-hidden="true"
      />
    </button>
  );
}
import type { CSSProperties } from "react";
