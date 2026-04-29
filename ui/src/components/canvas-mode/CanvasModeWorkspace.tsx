import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type DragEvent as ReactDragEvent,
  type MouseEvent,
  type WheelEvent,
} from "react";
import { useAppStore } from "../../store/useAppStore";
import { ResultActions } from "../ResultActions";
import { MultimodeSequencePreview } from "../MultimodeSequencePreview";
import { useI18n } from "../../i18n";
import { isEditableTarget } from "../../lib/domEvents";
import { getImageModelShortLabel } from "../../lib/imageModels";
import type { GenerateItem } from "../../types";
import {
  deleteCanvasAnnotations,
  fetchCanvasAnnotations,
  saveCanvasAnnotations,
} from "../../lib/api";
import { useCanvasAnnotations } from "../../hooks/useCanvasAnnotations";
import { CanvasModeStage } from "./CanvasModeStage";
import { CanvasToolbar } from "./CanvasToolbar";
import { CanvasModeTopbar } from "./CanvasModeTopbar";
import { CanvasViewportMiniMap } from "./CanvasViewportMiniMap";
import {
  BRUSH_ERASER_CURSOR,
  OBJECT_ERASER_CURSOR,
  findCanvasVersionForSource,
  formatQualityAlias,
  formatSizeAlias,
  getCanvasDisplaySrc,
} from "./canvasModeHelpers";
import type { CanvasModeWorkspaceProps } from "./canvasModeTypes";
import { useCanvasBackgroundCleanup } from "./useCanvasBackgroundCleanup";
import { useCanvasModePointerHandlers } from "./useCanvasModePointerHandlers";
import { useCanvasModeShortcuts } from "./useCanvasModeShortcuts";
import { useCanvasModeSession } from "./useCanvasModeSession";

export function CanvasModeWorkspace(_props: CanvasModeWorkspaceProps) {
  const currentImage = useAppStore((s) => s.currentImage);
  const history = useAppStore((s) => s.history);
  const importLocalImageToHistory = useAppStore((s) => s.importLocalImageToHistory);
  const [dropActive, setDropActive] = useState(false);
  const multimodeSequence = useAppStore((s) => {
    const id = s.multimodePreviewFlightId;
    return id ? s.multimodeSequences[id] ?? null : null;
  });
  const selectHistoryShortcutTarget = useAppStore((s) => s.selectHistoryShortcutTarget);
  const trashHistoryItem = useAppStore((s) => s.trashHistoryItem);
  const markGeneratedResultsSeen = useAppStore((s) => s.markGeneratedResultsSeen);
  const activeGenerations = useAppStore((s) => s.activeGenerations);
  const quality = useAppStore((s) => s.quality);
  const format = useAppStore((s) => s.format);
  const moderation = useAppStore((s) => s.moderation);
  const provider = useAppStore((s) => s.provider);
  const imageModel = useAppStore((s) => s.imageModel);
  const reasoningEffort = useAppStore((s) => s.reasoningEffort);
  const promptMode = useAppStore((s) => s.promptMode);
  const webSearchEnabled = useAppStore((s) => s.webSearchEnabled);
  const getResolvedSize = useAppStore((s) => s.getResolvedSize);
  const showToast = useAppStore((s) => s.showToast);
  const canvasOpen = useAppStore((s) => s.canvasOpen);
  const openCanvas = useAppStore((s) => s.openCanvas);
  const closeCanvas = useAppStore((s) => s.closeCanvas);
  const canvasZoom = useAppStore((s) => s.canvasZoom);
  const canvasPanX = useAppStore((s) => s.canvasPanX);
  const canvasPanY = useAppStore((s) => s.canvasPanY);
  const setCanvasPan = useAppStore((s) => s.setCanvasPan);
  const setCanvasZoom = useAppStore((s) => s.setCanvasZoom);
  const resetCanvasZoom = useAppStore((s) => s.resetCanvasZoom);
  const exportBackground = useAppStore((s) => s.canvasExportBackground);
  const exportMatteColor = useAppStore((s) => s.canvasExportMatteColor);
  const setExportBackground = useAppStore((s) => s.setCanvasExportBackground);
  const setExportMatteColor = useAppStore((s) => s.setCanvasExportMatteColor);
  const applyMergedCanvasImage = useAppStore((s) => s.applyMergedCanvasImage);
  const addGeneratedHistoryItem = useAppStore((s) => s.addGeneratedHistoryItem);
  const attachCanvasVersionReference = useAppStore((s) => s.attachCanvasVersionReference);
  const { t } = useI18n();
  const annotationFrameRef = useRef<HTMLDivElement>(null);
  const imageElementRef = useRef<HTMLImageElement>(null);
  const previousImageKeyRef = useRef<string | null>(null);
  const loadedDraftKeyRef = useRef<string | null>(null);
  const draftSaveTimerRef = useRef<number | null>(null);
  const canvasSourceImageRef = useRef<GenerateItem | null>(null);
  const lastMergedDataUrlRef = useRef<string | null>(null);
  const [canvasVersionItem, setCanvasVersionItem] = useState<GenerateItem | null>(null);
  const [canvasSaveState, setCanvasSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isApplying, setIsApplying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isEditingWithMask, setIsEditingWithMask] = useState(false);
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
  const latestCanvasVersion = findCanvasVersionForSource(history, currentImage);
  const canvasDisplayImage = canvasOpen ? (canvasVersionItem ?? latestCanvasVersion ?? currentImage) : currentImage;
  const baseImageSrc = canvasDisplayImage ? getCanvasDisplaySrc(canvasDisplayImage) : null;
  const backgroundCleanup = useCanvasBackgroundCleanup({
    canvasOpen,
    currentImage,
    canvasDisplayImage,
    imageElementRef,
    canvasSourceImageRef,
    lastMergedDataUrlRef,
    setCanvasSaveState,
    setCanvasVersionItem,
    applyMergedCanvasImage,
    attachCanvasVersionReference,
    showToast,
    t,
  });
  const {
    imageHasAlpha,
    backgroundCleanupSeeds,
    backgroundCleanupTolerance,
    backgroundCleanupPreview,
    backgroundCleanupMaskOverlay,
    backgroundCleanupStats,
    isBackgroundCleanupPickingSeed,
    isBackgroundCleanupPreviewing,
    isBackgroundCleanupApplying,
  } = backgroundCleanup;
  const imageSrc = backgroundCleanup.backgroundCleanupPreview?.dataUrl ?? baseImageSrc;

  const resetCanvasSession = () => {
    canvasSourceImageRef.current = null;
    loadedDraftKeyRef.current = null;
    if (draftSaveTimerRef.current != null) {
      window.clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
    setCanvasVersionItem(null);
    setCanvasSaveState("idle");
    backgroundCleanup.resetBackgroundCleanup();
    lastMergedDataUrlRef.current = null;
    resetPointerSession();
  };

  useEffect(() => {
    if (!canvasOpen) {
      previousImageKeyRef.current = imageKey;
      resetCanvasSession();
      return;
    }

    if (previousImageKeyRef.current === null) {
      previousImageKeyRef.current = imageKey;
      canvasSourceImageRef.current = currentImage;
      setCanvasVersionItem(latestCanvasVersion);
      return;
    }

    if (previousImageKeyRef.current !== imageKey) {
      annotations.resetLocal();
      resetCanvasSession();
      canvasSourceImageRef.current = currentImage;
      setCanvasVersionItem(latestCanvasVersion);
      previousImageKeyRef.current = imageKey;
    }
  }, [annotations.resetLocal, canvasOpen, currentImage, imageKey, latestCanvasVersion]);

  useEffect(() => {
    if (!canvasOpen || !currentImage || canvasSourceImageRef.current) return;
    canvasSourceImageRef.current = currentImage;
    setCanvasVersionItem(latestCanvasVersion);
  }, [canvasOpen, currentImage, latestCanvasVersion]);

  useEffect(() => {
    if (!canvasOpen || !currentImage?.filename || currentImage.canvasVersion) return;
    const filename = currentImage.filename;
    if (loadedDraftKeyRef.current === filename) return;
    loadedDraftKeyRef.current = filename;
    let cancelled = false;
    void fetchCanvasAnnotations(filename)
      .then((res) => {
        if (!cancelled && res.annotations) annotations.load(res.annotations);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [annotations.load, canvasOpen, currentImage?.canvasVersion, currentImage?.filename]);

  useEffect(() => {
    if (!canvasOpen || !currentImage?.filename || currentImage.canvasVersion) return;
    if (!annotations.isDirty) return;
    const filename = currentImage.filename;
    if (draftSaveTimerRef.current != null) window.clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = window.setTimeout(() => {
      const payload = annotations.toPayload();
      const request = annotations.hasAnnotations
        ? saveCanvasAnnotations(filename, payload)
        : deleteCanvasAnnotations(filename);
      void request
        .then(() => annotations.markSaved())
        .catch(() => {});
    }, 500);
    return () => {
      if (draftSaveTimerRef.current != null) {
        window.clearTimeout(draftSaveTimerRef.current);
        draftSaveTimerRef.current = null;
      }
    };
  }, [
    annotations,
    annotations.hasAnnotations,
    annotations.isDirty,
    canvasOpen,
    currentImage?.canvasVersion,
    currentImage?.filename,
  ]);

  const handleViewerMouseDown = (event: MouseEvent<HTMLElement>) => {
    if (isEditableTarget(event.target)) return;
    markGeneratedResultsSeen();
    event.currentTarget.focus();
  };

  const handleViewerWheel = (event: WheelEvent<HTMLElement>) => {
    if (!canvasOpen) return;
    event.preventDefault();
    if (event.ctrlKey) {
      setCanvasZoom(canvasZoom - event.deltaY * 0.01);
      return;
    }
    setCanvasPan(canvasPanX - event.deltaX, canvasPanY - event.deltaY);
  };

  const handleCenterDragOver = useCallback((e: ReactDragEvent<HTMLElement>) => {
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    setDropActive((prev) => (prev ? prev : true));
  }, []);

  const handleCenterDragLeave = useCallback((e: ReactDragEvent<HTMLElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDropActive(false);
  }, []);

  const handleCenterDrop = useCallback(
    async (e: ReactDragEvent<HTMLElement>) => {
      if (!Array.from(e.dataTransfer.types).includes("Files")) return;
      e.preventDefault();
      setDropActive(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        /^image\/(png|jpeg|webp)$/.test(f.type),
      );
      if (files.length === 0) return;
      await importLocalImageToHistory(files[0]);
    },
    [importLocalImageToHistory],
  );

  const { handleApplyCanvas, handleCloseCanvas, handleExportCanvas, handleEditWithMask } = useCanvasModeSession({
    imageElementRef,
    currentImage,
    canvasDisplayImage,
    canvasSourceImageRef,
    lastMergedDataUrlRef,
    canvasVersionItem,
    annotations,
    exportBackground,
    exportMatteColor,
    quality,
    format,
    moderation,
    provider,
    imageModel,
    reasoningEffort,
    promptMode,
    webSearchEnabled,
    getResolvedSize,
    setCanvasVersionItem,
    setCanvasSaveState,
    setIsApplying,
    setIsExporting,
    setIsEditingWithMask,
    applyMergedCanvasImage,
    addGeneratedHistoryItem,
    attachCanvasVersionReference,
    closeCanvas,
    resetCanvasSession,
    showToast,
    t,
  });

  const { spaceHeld, handleViewerKeyDown } = useCanvasModeShortcuts({
    canvasOpen,
    canvasZoom,
    currentImage,
    annotations,
    undoBackgroundCleanup: backgroundCleanup.undoBackgroundCleanup,
    handleCloseCanvas,
    selectHistoryShortcutTarget,
    trashHistoryItem,
    setCanvasZoom,
    resetCanvasZoom,
  });
  const canDragViewportWithSelect =
    canvasOpen &&
    canvasZoom > 1.01 &&
    annotations.activeTool === "select" &&
    !isBackgroundCleanupPickingSeed;
  const {
    viewportPanActive,
    resetPointerSession,
    handleAnnotationPointerDown,
    handleAnnotationPointerMove,
    handleAnnotationPointerUp,
  } = useCanvasModePointerHandlers({
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
    addBackgroundCleanupSeed: backgroundCleanup.addBackgroundCleanupSeed,
  });

  return (
    <main
      className={`canvas${canvasOpen ? " canvas--mode-open" : ""}${dropActive ? " canvas--drop-active" : ""}${spaceHeld ? " canvas--space-held" : ""}${viewportPanActive ? " canvas--pan-active" : ""}${canDragViewportWithSelect ? " canvas--zoom-hand" : ""}`}
      onDragOver={handleCenterDragOver}
      onDragLeave={handleCenterDragLeave}
      onDrop={handleCenterDrop}
    >
      {dropActive ? (
        <div className="canvas__drop-overlay" aria-hidden>
          <span className="canvas__drop-hint">{t("canvas.drop.hint")}</span>
        </div>
      ) : null}
      {canvasOpen && (
        <CanvasModeTopbar
          zoom={canvasZoom}
          closeLabel={t("canvas.close")}
          shortcutHint={t("canvas.toolbar.zoomShortcutHint")}
          onZoomIn={() => setCanvasZoom(canvasZoom + 0.1)}
          onZoomOut={() => setCanvasZoom(canvasZoom - 0.1)}
          onZoomReset={resetCanvasZoom}
          onClose={() => void handleCloseCanvas()}
        />
      )}
      <div className={`progress-bar${activeGenerations > 0 ? " active" : ""}`} />
      {multimodeSequence ? (
        <MultimodeSequencePreview />
      ) : currentImage ? (
        <div
          className="result-container visible"
          tabIndex={0}
          onMouseDown={handleViewerMouseDown}
          onWheel={handleViewerWheel}
          onKeyDown={handleViewerKeyDown}
          aria-label={t("canvas.imageViewerAria")}
        >
          <CanvasModeStage
            annotationFrameRef={annotationFrameRef}
            imageElementRef={imageElementRef}
            frameClassName={`canvas-annotation-frame${
              (imageHasAlpha || backgroundCleanupPreview) && canvasOpen ? " canvas-annotation-frame--alpha" : ""
            }${
              isBackgroundCleanupPickingSeed && canvasOpen ? " canvas-annotation-frame--cleanup-picking" : ""
            }${
              backgroundCleanupMaskOverlay && canvasOpen ? " canvas-annotation-frame--cleanup-mask" : ""
            }`}
            frameStyle={{
              cursor: viewportPanActive
                ? "grabbing"
                : spaceHeld || canDragViewportWithSelect
                  ? "grab"
                  : canvasOpen
                    ? isBackgroundCleanupPickingSeed
                      ? "crosshair"
                      : annotations.activeTool === "select"
                      ? "default"
                      : annotations.activeTool === "eraser"
                        ? annotations.eraserMode === "object"
                          ? OBJECT_ERASER_CURSOR
                          : BRUSH_ERASER_CURSOR
                        : "crosshair"
                    : "zoom-in",
              transform: canvasOpen
                ? `translate(${canvasPanX}px, ${canvasPanY}px) scale(${canvasZoom})`
                : undefined,
              transition: canvasOpen && !viewportPanActive ? "transform 0.2s ease" : undefined,
            }}
            imageKey={`${canvasDisplayImage?.filename ?? canvasDisplayImage?.url ?? canvasDisplayImage?.image}:${canvasDisplayImage?.canvasMergedAt ?? ""}`}
            imageSrc={imageSrc ?? currentImage.image}
            fallbackImage={currentImage.image}
            alt={t("canvas.resultAlt")}
            canvasOpen={canvasOpen}
            maskOverlayUrl={backgroundCleanupMaskOverlay?.dataUrl ?? null}
            annotations={annotations}
            onOpenCanvas={openCanvas}
            onPointerDown={handleAnnotationPointerDown}
            onPointerMove={handleAnnotationPointerMove}
            onPointerUp={handleAnnotationPointerUp}
          />
          {canvasOpen && imageSrc ? (
            <CanvasViewportMiniMap
              imageSrc={imageSrc}
              zoom={canvasZoom}
              panX={canvasPanX}
              panY={canvasPanY}
              resetLabel={t("canvas.toolbar.zoomReset")}
              onReset={resetCanvasZoom}
            />
          ) : null}
          {canvasOpen && (
            <>
              <CanvasToolbar
                activeTool={annotations.activeTool}
                eraserMode={annotations.eraserMode}
                onEraserModeChange={annotations.setEraserMode}
                style={{ color: annotations.toolColor, strokeWidth: annotations.strokeWidth }}
                onStyleChange={annotations.setStyle}
                hasExportableContent={annotations.hasAnnotations}
                onToolChange={annotations.setTool}
                onClear={annotations.clear}
                onApply={() => void handleApplyCanvas()}
                onExport={() => void handleExportCanvas()}
                onUndo={annotations.undo}
                onRedo={annotations.redo}
                canUndo={annotations.canUndo}
                canRedo={annotations.canRedo}
                onDeleteSelected={annotations.deleteSelected}
                selectedCount={annotations.selectedIds.length}
                onEditWithMask={() => void handleEditWithMask()}
                canEditWithMask={annotations.boxes.length > 0}
                isEditingWithMask={isEditingWithMask}
                isApplying={isApplying}
                isExporting={isExporting}
                exportBackground={exportBackground}
                exportMatteColor={exportMatteColor}
                onExportBackgroundChange={setExportBackground}
                onExportMatteColorChange={setExportMatteColor}
                cleanupTolerance={backgroundCleanupTolerance}
                cleanupSeedCount={backgroundCleanupSeeds.length}
                cleanupStats={backgroundCleanupStats}
                cleanupHasPreview={Boolean(backgroundCleanupPreview)}
                isCleanupPickingSeed={isBackgroundCleanupPickingSeed}
                isCleanupPreviewing={isBackgroundCleanupPreviewing}
                isCleanupApplying={isBackgroundCleanupApplying}
                onCleanupAutoSample={backgroundCleanup.handleBackgroundCleanupAutoSample}
                onCleanupPickSeed={backgroundCleanup.handleBackgroundCleanupPickSeed}
                onCleanupToleranceChange={backgroundCleanup.handleBackgroundCleanupToleranceChange}
                onCleanupPreview={() => void backgroundCleanup.runBackgroundCleanupPreview()}
                onCleanupApply={() => void backgroundCleanup.handleBackgroundCleanupApply()}
                onCleanupReset={backgroundCleanup.handleBackgroundCleanupReset}
              />
            </>
          )}
          {canvasOpen && canvasSaveState !== "idle" ? (
            <div className={`canvas-save-state canvas-save-state--${canvasSaveState}`}>
              {canvasSaveState === "saving"
                ? t("canvas.version.saving")
                : canvasSaveState === "saved"
                  ? t("canvas.version.saved")
                  : t("canvas.version.failed")}
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
          <ResultActions imageOverride={canvasOpen ? canvasDisplayImage : null} />
          {currentImage.prompt ? <div className="result-prompt" onClick={copyPrompt}>{currentImage.prompt}</div> : null}
        </div>
      ) : null}
    </main>
  );
}
