import { useRef, useState, type PointerEvent, type RefObject } from "react";
import { isEditableTarget } from "../../lib/domEvents";
import { screenToNormalized } from "../../lib/canvas/coordinates";
import {
  findAnnotationsInBox,
  hitTestAnnotation,
  normalizeSelectionBox,
} from "../../lib/canvas/hitTest";
import type { NormalizedPoint } from "../../types/canvas";

interface UseCanvasModePointerHandlersArgs {
  canvasOpen: boolean;
  canvasZoom: number;
  canvasPanX: number;
  canvasPanY: number;
  spaceHeld: boolean;
  canDragViewportWithSelect: boolean;
  isBackgroundCleanupPickingSeed: boolean;
  annotationFrameRef: RefObject<HTMLDivElement | null>;
  annotations: any;
  setCanvasPan: (x: number, y: number) => void;
  addBackgroundCleanupSeed: (point: NormalizedPoint) => void;
}

export function useCanvasModePointerHandlers({
  canvasOpen,
  canvasZoom,
  canvasPanX,
  canvasPanY,
  spaceHeld,
  canDragViewportWithSelect,
  isBackgroundCleanupPickingSeed,
  annotationFrameRef,
  annotations,
  setCanvasPan,
  addBackgroundCleanupSeed,
}: UseCanvasModePointerHandlersArgs) {
  const selectionDragRef = useRef<{
    mode: "move" | "box" | null;
    lastPoint: NormalizedPoint | null;
    didMove: boolean;
  }>({ mode: null, lastPoint: null, didMove: false });
  const viewportPanRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    basePanX: number;
    basePanY: number;
    pointerId: number | null;
  }>({ active: false, startX: 0, startY: 0, basePanX: 0, basePanY: 0, pointerId: null });
  const [viewportPanActive, setViewportPanActive] = useState(false);

  const startViewportPan = (event: PointerEvent<HTMLDivElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId);
    viewportPanRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      basePanX: canvasPanX,
      basePanY: canvasPanY,
      pointerId: event.pointerId,
    };
    setViewportPanActive(true);
  };

  const handleAnnotationPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (!canvasOpen) return;
    if (isEditableTarget(event.target)) return;
    if (!annotationFrameRef.current) return;
    const isMiddle = event.button === 1;
    if (spaceHeld || isMiddle) {
      event.preventDefault();
      startViewportPan(event);
      return;
    }
    event.preventDefault();
    const point = screenToNormalized(event, annotationFrameRef.current);
    if (isBackgroundCleanupPickingSeed) {
      addBackgroundCleanupSeed(point);
      return;
    }
    if (annotations.activeTool === "select") {
      const hit = hitTestAnnotation({
        point,
        paths: annotations.paths,
        boxes: annotations.boxes,
        memos: annotations.memos,
      });
      if (hit) {
        if (event.shiftKey) annotations.toggleSelected(hit);
        else annotations.selectOne(hit);
        annotations.startSelectedMove();
        selectionDragRef.current = { mode: "move", lastPoint: point, didMove: false };
      } else if (canDragViewportWithSelect && canvasZoom > 1.01) {
        startViewportPan(event);
        return;
      } else {
        annotations.clearSelection();
        annotations.startSelectionBox(point);
        selectionDragRef.current = { mode: "box", lastPoint: point, didMove: false };
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (annotations.activeTool === "memo") {
      annotations.createMemo(point);
      requestAnimationFrame(() => {
        annotationFrameRef.current
          ?.querySelector<HTMLTextAreaElement>(".canvas-memo--active")
          ?.focus();
      });
      return;
    }
    if (annotations.activeTool === "eraser") {
      if (annotations.eraserMode === "object") {
        const hit = hitTestAnnotation({
          point,
          paths: annotations.paths,
          boxes: annotations.boxes,
          memos: annotations.memos,
        });
        if (hit) annotations.eraseObjectAtPoint(hit);
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      annotations.startEraserStroke(point);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    annotations.startDrawing(point);
  };

  const handleAnnotationPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (!canvasOpen) return;
    if (isEditableTarget(event.target)) return;
    if (!annotationFrameRef.current) return;
    if (viewportPanRef.current.active) {
      const dx = event.clientX - viewportPanRef.current.startX;
      const dy = event.clientY - viewportPanRef.current.startY;
      setCanvasPan(
        viewportPanRef.current.basePanX + dx,
        viewportPanRef.current.basePanY + dy,
      );
      return;
    }
    const point = screenToNormalized(event, annotationFrameRef.current);
    if (annotations.activeTool === "select") {
      if (selectionDragRef.current.mode === "move" && selectionDragRef.current.lastPoint) {
        const delta = {
          x: point.x - selectionDragRef.current.lastPoint.x,
          y: point.y - selectionDragRef.current.lastPoint.y,
        };
        if (Math.abs(delta.x) > 0.0005 || Math.abs(delta.y) > 0.0005) {
          annotations.moveSelected(delta);
          selectionDragRef.current.didMove = true;
        }
        selectionDragRef.current.lastPoint = point;
      } else if (selectionDragRef.current.mode === "box") {
        annotations.updateSelectionBox(point);
      }
      return;
    }
    if (annotations.activeTool === "memo") return;
    if (annotations.activeTool === "eraser") {
      if (annotations.eraserMode === "brush") annotations.updateEraserStroke(point);
      return;
    }
    annotations.moveDrawing(point);
  };

  const handleAnnotationPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    if (!canvasOpen) return;
    if (isEditableTarget(event.target)) return;
    if (viewportPanRef.current.active && viewportPanRef.current.pointerId === event.pointerId) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      viewportPanRef.current = {
        active: false,
        startX: 0,
        startY: 0,
        basePanX: 0,
        basePanY: 0,
        pointerId: null,
      };
      setViewportPanActive(false);
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (annotations.activeTool === "select") {
      if (selectionDragRef.current.mode === "move" && selectionDragRef.current.didMove) {
        annotations.commitSelectedMove();
      }
      if (selectionDragRef.current.mode === "box" && annotations.selectionBox) {
        annotations.endSelectionBox(findAnnotationsInBox({
          box: normalizeSelectionBox(annotations.selectionBox),
          annotations: annotations.toPayload(),
        }));
      }
      selectionDragRef.current = { mode: null, lastPoint: null, didMove: false };
      return;
    }
    if (annotations.activeTool === "memo") return;
    if (annotations.activeTool === "eraser") {
      if (annotations.eraserMode === "brush") annotations.endEraserStroke();
      return;
    }
    annotations.endDrawing();
  };

  const resetPointerSession = (): void => {
    selectionDragRef.current = { mode: null, lastPoint: null, didMove: false };
    viewportPanRef.current = {
      active: false,
      startX: 0,
      startY: 0,
      basePanX: 0,
      basePanY: 0,
      pointerId: null,
    };
    setViewportPanActive(false);
  };

  return {
    viewportPanActive,
    resetPointerSession,
    handleAnnotationPointerDown,
    handleAnnotationPointerMove,
    handleAnnotationPointerUp,
  };
}
