import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { useAppStore } from "../store/useAppStore";
import { ResultActions } from "./ResultActions";
import { MultimodeSequencePreview } from "./MultimodeSequencePreview";
import { useI18n } from "../i18n";
import { isEditableTarget } from "../lib/domEvents";
import { getImageModelShortLabel } from "../lib/imageModels";
import { useCanvasAnnotations } from "../hooks/useCanvasAnnotations";
import { screenToNormalized } from "../lib/canvas/coordinates";
import { CanvasAnnotationLayer } from "./canvas-mode/CanvasAnnotationLayer";
import { CanvasToolbar } from "./canvas-mode/CanvasToolbar";

function formatQualityAlias(quality: string | null | undefined): string | null {
  if (quality === "low") return "l";
  if (quality === "medium") return "m";
  if (quality === "high") return "h";
  return quality ?? null;
}

function formatSizeAlias(size: string | null | undefined): string | null {
  if (!size) return null;
  const square = size.match(/^(\d+)x\1$/);
  if (square) return `${square[1]}²`;
  return size.replace("x", "×");
}

export function Canvas() {
  const currentImage = useAppStore((s) => s.currentImage);
  const multimodeSequence = useAppStore((s) => s.multimodeSequence);
  const selectHistoryShortcutTarget = useAppStore((s) => s.selectHistoryShortcutTarget);
  const trashHistoryItem = useAppStore((s) => s.trashHistoryItem);
  const markGeneratedResultsSeen = useAppStore((s) => s.markGeneratedResultsSeen);
  const activeGenerations = useAppStore((s) => s.activeGenerations);
  const quality = useAppStore((s) => s.quality);
  const getResolvedSize = useAppStore((s) => s.getResolvedSize);
  const showToast = useAppStore((s) => s.showToast);
  const canvasOpen = useAppStore((s) => s.canvasOpen);
  const openCanvas = useAppStore((s) => s.openCanvas);
  const closeCanvas = useAppStore((s) => s.closeCanvas);
  const canvasZoom = useAppStore((s) => s.canvasZoom);
  const { t } = useI18n();
  const annotationFrameRef = useRef<HTMLDivElement>(null);
  const previousImageKeyRef = useRef<string | null>(null);
  const annotations = useCanvasAnnotations();

  const copyPrompt = () => {
    if (!currentImage?.prompt) return;
    void navigator.clipboard.writeText(currentImage.prompt);
    showToast(t("toast.promptCopied"));
  };

  const displayQuality = formatQualityAlias(currentImage?.quality ?? quality);
  const displaySize = formatSizeAlias(currentImage?.size ?? getResolvedSize());
  const displayModel = getImageModelShortLabel(currentImage?.model);
  const imageKey = currentImage?.filename ?? currentImage?.url ?? currentImage?.image ?? null;

  useEffect(() => {
    if (!canvasOpen) {
      previousImageKeyRef.current = imageKey;
      return;
    }

    if (previousImageKeyRef.current === null) {
      previousImageKeyRef.current = imageKey;
      return;
    }

    if (previousImageKeyRef.current !== imageKey) {
      annotations.clear();
      previousImageKeyRef.current = imageKey;
    }
  }, [annotations.clear, canvasOpen, imageKey]);

  const handleViewerKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (canvasOpen && ["1", "2", "3", "4"].includes(event.key)) {
      event.preventDefault();
      const tools = ["pan", "pen", "box", "arrow"] as const;
      annotations.setTool(tools[Number(event.key) - 1]);
      return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      if (event.shiftKey || !currentImage) return;
      event.preventDefault();
      void trashHistoryItem(currentImage);
      return;
    }

    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) return;
    if (event.target !== event.currentTarget) return;
    if (isEditableTarget(event.target)) return;

    event.preventDefault();
    if (event.key === "ArrowLeft") selectHistoryShortcutTarget("previous");
    else if (event.key === "ArrowRight") selectHistoryShortcutTarget("next");
    else if (event.key === "Home") selectHistoryShortcutTarget("first");
    else if (event.key === "End") selectHistoryShortcutTarget("last");
  };

  const handleViewerMouseDown = (event: MouseEvent<HTMLElement>) => {
    if (isEditableTarget(event.target)) return;
    markGeneratedResultsSeen();
    event.currentTarget.focus();
  };

  const handleAnnotationPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!canvasOpen || annotations.activeTool === "pan") return;
    if (!annotationFrameRef.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    annotations.startDrawing(screenToNormalized(event, annotationFrameRef.current));
  };

  const handleAnnotationPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!canvasOpen || annotations.activeTool === "pan") return;
    if (!annotationFrameRef.current) return;
    annotations.moveDrawing(screenToNormalized(event, annotationFrameRef.current));
  };

  const handleAnnotationPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!canvasOpen || annotations.activeTool === "pan") return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    annotations.endDrawing();
  };

  return (
    <main className={`canvas${canvasOpen ? " canvas--mode-open" : ""}`}>
      {canvasOpen && (
        <div className="canvas-mode-topbar">
          <span className="canvas-mode-topbar__label">Canvas Mode</span>
          <button
            type="button"
            className="canvas-mode-close"
            onClick={closeCanvas}
            aria-label={t("canvas.close")}
          >
            <kbd>ESC</kbd>
            <span>{t("canvas.close")}</span>
          </button>
        </div>
      )}
      <div className={`progress-bar${activeGenerations > 0 ? " active" : ""}`} />
      {multimodeSequence ? (
        <MultimodeSequencePreview />
      ) : currentImage ? (
        <div
          className="result-container visible"
          tabIndex={0}
          onMouseDown={handleViewerMouseDown}
          onKeyDown={handleViewerKeyDown}
          aria-label={t("canvas.imageViewerAria")}
        >
          <div
            ref={annotationFrameRef}
            className="canvas-annotation-frame"
            onPointerDown={handleAnnotationPointerDown}
            onPointerMove={handleAnnotationPointerMove}
            onPointerUp={handleAnnotationPointerUp}
            onPointerCancel={handleAnnotationPointerUp}
            style={{
              cursor: canvasOpen && annotations.activeTool !== "pan" ? "crosshair" : canvasOpen ? "default" : "zoom-in",
              transform: canvasOpen ? `scale(${canvasZoom})` : undefined,
              transition: canvasOpen ? "transform 0.2s ease" : undefined,
            }}
          >
            <img
              className="result-img"
              key={currentImage.filename ?? currentImage.url ?? currentImage.image}
              src={currentImage.url ?? currentImage.image}
              alt={t("canvas.resultAlt")}
              onDoubleClick={(e) => {
                e.stopPropagation();
                openCanvas();
              }}
            />
            {canvasOpen && (
              <CanvasAnnotationLayer
                paths={annotations.paths}
                boxes={annotations.boxes}
                activePath={annotations.activePath}
                activeBox={annotations.activeBox}
              />
            )}
          </div>
          {canvasOpen && (
            <CanvasToolbar
              activeTool={annotations.activeTool}
              hasAnnotations={annotations.hasAnnotations}
              onToolChange={annotations.setTool}
              onClear={annotations.clear}
            />
          )}
          {currentImage.prompt ? (
            <div className="result-prompt" onClick={copyPrompt}>
              {currentImage.prompt}
            </div>
          ) : null}
          <div className="result-meta">
            {[
              currentImage.elapsed != null ? `${currentImage.elapsed}s` : null,
              currentImage.usage
                ? t("canvas.tokens", { n: currentImage.usage.total_tokens ?? "?" })
                : null,
              displayQuality,
              displaySize,
              displayModel,
              currentImage.provider ?? null,
            ]
              .filter((v): v is string => Boolean(v))
              .join(" · ")}
          </div>
          <ResultActions />
        </div>
      ) : null}
    </main>
  );
}
