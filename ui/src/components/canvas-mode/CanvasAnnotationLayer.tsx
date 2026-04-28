import { useEffect, useRef } from "react";
import type { BoundingBox, CanvasMemo, DrawingPath, NormalizedPoint, SelectionBox } from "../../types/canvas";
import type { CanvasObjectKey } from "../../lib/canvas/objectKeys";
import {
  getAnnotationBounds,
  renderAnnotationPath,
  renderBoundingBox,
  renderSelectionOutline,
} from "../../lib/canvas/annotationRenderer";

interface CanvasAnnotationLayerProps {
  paths: DrawingPath[];
  boxes: BoundingBox[];
  memos?: CanvasMemo[];
  selectedIds?: CanvasObjectKey[];
  selectionBox?: SelectionBox | null;
  activePath: DrawingPath | null;
  activeBox: { start: NormalizedPoint; current: NormalizedPoint } | null;
}

export function CanvasAnnotationLayer({
  paths,
  boxes,
  memos = [],
  selectedIds = [],
  selectionBox = null,
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
    for (const id of selectedIds) {
      const bounds = getAnnotationBounds(id, { paths, boxes, memos });
      if (bounds) renderSelectionOutline(ctx, bounds, size);
    }
    if (selectionBox) renderSelectionOutline(ctx, selectionBox, size);
    if (activePath) renderAnnotationPath(ctx, activePath, size);
    if (activeBox) renderBoundingBox(ctx, activeBox, size, "active");
  }, [paths, boxes, memos, selectedIds, selectionBox, activePath, activeBox]);

  return <canvas ref={canvasRef} className="canvas-annotation-layer" aria-hidden="true" />;
}
