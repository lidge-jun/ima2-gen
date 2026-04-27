import { useEffect, useRef } from "react";
import type { BoundingBox, DrawingPath, NormalizedPoint } from "../../types/canvas";
import { renderAnnotationPath, renderBoundingBox } from "../../lib/canvas/annotationRenderer";

interface CanvasAnnotationLayerProps {
  paths: DrawingPath[];
  boxes: BoundingBox[];
  activePath: DrawingPath | null;
  activeBox: { start: NormalizedPoint; current: NormalizedPoint } | null;
}

export function CanvasAnnotationLayer({
  paths,
  boxes,
  activePath,
  activeBox,
}: CanvasAnnotationLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const size = { width: rect.width, height: rect.height };
    for (const path of paths) renderAnnotationPath(ctx, path, size);
    for (const box of boxes) renderBoundingBox(ctx, box, size, "committed");
    if (activePath) renderAnnotationPath(ctx, activePath, size);
    if (activeBox) renderBoundingBox(ctx, activeBox, size, "active");
  }, [paths, boxes, activePath, activeBox]);

  return <canvas ref={canvasRef} className="canvas-annotation-layer" aria-hidden="true" />;
}
