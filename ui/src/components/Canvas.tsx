import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { useAppStore } from "../store/useAppStore";
import { ResultActions } from "./ResultActions";
import { MultimodeSequencePreview } from "./MultimodeSequencePreview";
import { useI18n } from "../i18n";
import { isEditableTarget } from "../lib/domEvents";
import { getImageModelShortLabel } from "../lib/imageModels";
import type { GenerateItem, GenerateResponse } from "../types";
import { isMultiResponse } from "../types";
import {
  createCanvasVersion,
  deleteCanvasAnnotations,
  fetchCanvasAnnotations,
  postEdit,
  saveCanvasAnnotations,
  updateCanvasVersion,
} from "../lib/api";
import { useCanvasAnnotations } from "../hooks/useCanvasAnnotations";
import { screenToNormalized } from "../lib/canvas/coordinates";
import { renderMergedCanvasImage } from "../lib/canvas/mergeRenderer";
import {
  blobToDataUrl,
  imageElementToPngDataUrl,
  renderMaskFromBoxes,
} from "../lib/canvas/maskRenderer";
import {
  findAnnotationsInBox,
  hitTestAnnotation,
  normalizeSelectionBox,
} from "../lib/canvas/hitTest";
import { objectKeyMatches } from "../lib/canvas/objectKeys";
import {
  downloadCanvasBlob,
  exportCanvasImage,
  makeCanvasExportFilename,
} from "../lib/canvas/exportRenderer";
import { CanvasAnnotationLayer } from "./canvas-mode/CanvasAnnotationLayer";
import { CanvasMemoOverlay } from "./canvas-mode/CanvasMemoOverlay";
import { CanvasToolbar } from "./canvas-mode/CanvasToolbar";
import type { NormalizedPoint } from "../types/canvas";

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

function getCanvasDisplaySrc(image: GenerateItem): string {
  const src = image.url ?? image.image;
  if (!image.canvasVersion || !image.canvasMergedAt || src.startsWith("data:")) return src;
  const separator = src.includes("?") ? "&" : "?";
  return `${src}${separator}canvasMergedAt=${image.canvasMergedAt}`;
}

function withSourcePrompt(item: GenerateItem, source: GenerateItem | null): GenerateItem {
  if (!item.canvasVersion || item.prompt || !source?.prompt) return item;
  return { ...item, prompt: source.prompt };
}

function findCanvasVersionForSource(history: GenerateItem[], source: GenerateItem | null): GenerateItem | null {
  if (!source?.filename) return null;
  const match = history.find((item) =>
    item.canvasVersion &&
    (item.canvasSourceFilename === source.filename || item.canvasEditableFilename === source.filename)
  ) ?? null;
  return match ? withSourcePrompt(match, source) : null;
}

function responseToGenerateItem(response: GenerateResponse, prompt: string): GenerateItem {
  if (isMultiResponse(response)) {
    const first = response.images[0];
    if (!first) throw new Error("edit_empty_response");
    return {
      ...first,
      prompt,
      provider: response.provider,
      quality: response.quality,
      size: response.size,
      moderation: response.moderation,
      model: response.model,
      usage: response.usage,
      kind: "edit",
      createdAt: Date.now(),
    };
  }
  return {
    image: response.image,
    url: response.filename ? `/generated/${response.filename}` : response.image,
    thumb: response.image,
    filename: response.filename,
    prompt,
    elapsed: response.elapsed,
    provider: response.provider,
    quality: response.quality,
    size: response.size,
    moderation: response.moderation,
    model: response.model,
    usage: response.usage,
    revisedPrompt: response.revisedPrompt ?? null,
    promptMode: response.promptMode ?? null,
    kind: "edit",
    createdAt: Date.now(),
  };
}

export function Canvas() {
  const currentImage = useAppStore((s) => s.currentImage);
  const history = useAppStore((s) => s.history);
  const multimodeSequence = useAppStore((s) => s.multimodeSequence);
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
  const selectionDragRef = useRef<{
    mode: "move" | "box" | null;
    lastPoint: NormalizedPoint | null;
    didMove: boolean;
  }>({ mode: null, lastPoint: null, didMove: false });
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
  const imageSrc = canvasDisplayImage ? getCanvasDisplaySrc(canvasDisplayImage) : null;

  const resetCanvasSession = () => {
    canvasSourceImageRef.current = null;
    loadedDraftKeyRef.current = null;
    if (draftSaveTimerRef.current != null) {
      window.clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
    setCanvasVersionItem(null);
    setCanvasSaveState("idle");
    lastMergedDataUrlRef.current = null;
    selectionDragRef.current = { mode: null, lastPoint: null, didMove: false };
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

  const handleViewerKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (isEditableTarget(event.target)) {
      if (event.key === "Escape") {
        event.preventDefault();
        (event.target as HTMLElement).blur();
        annotations.focusMemo(null);
      }
      return;
    }

    if (canvasOpen && ["1", "2", "3", "4", "5", "6"].includes(event.key)) {
      event.preventDefault();
      const tools = ["pan", "pen", "box", "arrow", "memo", "eraser"] as const;
      annotations.setTool(tools[Number(event.key) - 1]);
      return;
    }

    if (canvasOpen && event.key === "Escape") {
      event.preventDefault();
      void handleCloseCanvas();
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
    if (!canvasOpen) return;
    if (isEditableTarget(event.target)) return;
    if (!annotationFrameRef.current) return;
    event.preventDefault();
    const point = screenToNormalized(event, annotationFrameRef.current);
    if (annotations.activeTool === "pan") {
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

  const handleAnnotationPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!canvasOpen) return;
    if (isEditableTarget(event.target)) return;
    if (!annotationFrameRef.current) return;
    const point = screenToNormalized(event, annotationFrameRef.current);
    if (annotations.activeTool === "pan") {
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

  const handleAnnotationPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!canvasOpen) return;
    if (isEditableTarget(event.target)) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (annotations.activeTool === "pan") {
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

  const saveCanvasVersionAndUseReference = useCallback(async (): Promise<GenerateItem | null> => {
    if (!imageElementRef.current || !currentImage) return null;
    const source = canvasSourceImageRef.current ?? currentImage;
    if (!source?.filename) {
      showToast(t("canvas.version.failed"), true);
      return null;
    }
    setIsApplying(true);
    setCanvasSaveState("saving");
    try {
      const merged = await renderMergedCanvasImage({
        imageElement: imageElementRef.current,
        paths: annotations.paths,
        boxes: annotations.boxes,
        memos: annotations.memos,
      });
      lastMergedDataUrlRef.current = merged.dataUrl;
      const result = canvasVersionItem?.filename
        ? await updateCanvasVersion(canvasVersionItem.filename, {
            image: merged.blob,
            sourceFilename: source.canvasSourceFilename ?? source.filename,
            prompt: source.prompt,
          })
        : await createCanvasVersion({
            sourceFilename: source.filename,
            image: merged.blob,
            prompt: source.prompt,
          });
      const savedItem = withSourcePrompt(result.item, source);
      setCanvasVersionItem(savedItem);
      applyMergedCanvasImage(savedItem);
      await attachCanvasVersionReference(savedItem);
      await deleteCanvasAnnotations(source.filename).catch(() => {});
      annotations.resetLocal();
      annotations.markSaved();
      setCanvasSaveState("saved");
      showToast(t("canvas.version.saved"));
      return savedItem;
    } catch {
      setCanvasSaveState("error");
      showToast(t("canvas.version.failed"), true);
      return null;
    } finally {
      setIsApplying(false);
    }
  }, [
    annotations,
    applyMergedCanvasImage,
    attachCanvasVersionReference,
    canvasVersionItem?.filename,
    currentImage,
    showToast,
    t,
  ]);

  const handleApplyCanvas = async (): Promise<void> => {
    await saveCanvasVersionAndUseReference();
  };

  const handleCloseCanvas = async (): Promise<void> => {
    if (annotations.hasAnnotations || annotations.isDirty) {
      const saved = await saveCanvasVersionAndUseReference();
      if (!saved) return;
    }
    closeCanvas();
    resetCanvasSession();
  };

  useEffect(() => {
    if (!canvasOpen) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        if (event.key === "Escape") {
          event.preventDefault();
          (event.target as HTMLElement).blur();
          annotations.focusMemo(null);
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        void handleCloseCanvas();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) annotations.redo();
        else annotations.undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    annotations.focusMemo,
    annotations.redo,
    annotations.undo,
    canvasOpen,
    handleCloseCanvas,
  ]);

  const handleExportCanvas = async (): Promise<void> => {
    if (!imageElementRef.current || !currentImage) return;
    setIsExporting(true);
    try {
      const blob = await exportCanvasImage({
        imageElement: imageElementRef.current,
        paths: annotations.paths,
        boxes: annotations.boxes,
        memos: annotations.memos,
      });
      downloadCanvasBlob(blob, makeCanvasExportFilename());
    } catch {
      showToast(t("canvas.toolbar.exportFailed"), true);
    } finally {
      setIsExporting(false);
    }
  };

  const handleEditWithMask = async (): Promise<void> => {
    if (!imageElementRef.current || !canvasDisplayImage || annotations.boxes.length === 0) return;
    setIsEditingWithMask(true);
    try {
      let editImage = lastMergedDataUrlRef.current;
      if (annotations.isDirty || annotations.hasAnnotations) {
        const saved = await saveCanvasVersionAndUseReference();
        if (!saved) return;
        editImage = lastMergedDataUrlRef.current;
      }
      if (!editImage) editImage = await imageElementToPngDataUrl(imageElementRef.current);
      const selectedBoxes = annotations.boxes.filter((box) =>
        annotations.selectedIds.some((id) => objectKeyMatches(id, "box", box.id)),
      );
      const mask = await blobToDataUrl(await renderMaskFromBoxes({
        imageElement: imageElementRef.current,
        boxes: selectedBoxes.length > 0 ? selectedBoxes : annotations.boxes,
      }));
      const prompt = canvasDisplayImage.prompt ?? currentImage?.prompt ?? "";
      if (!prompt.trim()) {
        showToast(t("toast.noPromptToFork"), true);
        return;
      }
      const response = await postEdit({
        prompt,
        image: editImage,
        mask,
        quality,
        size: canvasDisplayImage.size ?? currentImage?.size ?? getResolvedSize(),
        format,
        moderation,
        provider,
        n: 1,
        model: imageModel,
        reasoningEffort,
        mode: promptMode,
        webSearchEnabled,
      });
      await addGeneratedHistoryItem(responseToGenerateItem(response, prompt));
    } catch (err) {
      const code = (err as { code?: string }).code;
      showToast(
        code === "EDIT_MASK_NOT_SUPPORTED"
          ? t("canvas.toolbar.editMaskUnsupported")
          : t("canvas.toolbar.editMaskFailed"),
        true,
      );
    } finally {
      setIsEditingWithMask(false);
    }
  };

  return (
    <main className={`canvas${canvasOpen ? " canvas--mode-open" : ""}`}>
      {canvasOpen && (
        <div className="canvas-mode-topbar">
          <span className="canvas-mode-topbar__label">Canvas Mode</span>
          <button
            type="button"
            className="canvas-mode-close"
            onClick={() => void handleCloseCanvas()}
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
              cursor: canvasOpen
                ? annotations.activeTool === "pan"
                  ? "default"
                  : annotations.activeTool === "eraser"
                    ? "cell"
                    : "crosshair"
                : "zoom-in",
              transform: canvasOpen ? `scale(${canvasZoom})` : undefined,
              transition: canvasOpen ? "transform 0.2s ease" : undefined,
            }}
          >
            <img
              ref={imageElementRef}
              className="result-img"
              key={`${canvasDisplayImage?.filename ?? canvasDisplayImage?.url ?? canvasDisplayImage?.image}:${canvasDisplayImage?.canvasMergedAt ?? ""}`}
              src={imageSrc ?? currentImage.image}
              alt={t("canvas.resultAlt")}
              onDoubleClick={(e) => {
                e.stopPropagation();
                openCanvas();
              }}
            />
            {canvasOpen && (
              <>
                <CanvasAnnotationLayer
                  paths={annotations.paths}
                  boxes={annotations.boxes}
                  memos={annotations.memos}
                  selectedIds={annotations.selectedIds}
                  selectionBox={annotations.selectionBox}
                  activePath={annotations.activePath}
                  activeBox={annotations.activeBox}
                />
                <CanvasMemoOverlay
                  memos={annotations.memos}
                  activeMemoId={annotations.activeMemoId}
                  onUpdate={annotations.updateMemo}
                  onDelete={annotations.deleteMemo}
                  onFocus={annotations.focusMemo}
                  onCommit={annotations.commitMemoEdit}
                />
              </>
            )}
          </div>
          {canvasOpen && (
            <CanvasToolbar
              activeTool={annotations.activeTool}
              eraserMode={annotations.eraserMode}
              onEraserModeChange={annotations.setEraserMode}
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
            />
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
          {currentImage.prompt ? (
            <div className="result-prompt" onClick={copyPrompt}>
              {currentImage.prompt}
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
