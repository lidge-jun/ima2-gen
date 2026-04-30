import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { createCanvasVersion } from "../../lib/api";
import { imageUsesAlpha } from "../../lib/canvas/alphaDetect";
import {
  floodFillMaskInto,
  getCornerBackgroundRemovalSeeds,
  renderBackgroundCleanupOverlayFromMask,
  renderBackgroundCleanupPreviewFromMask,
  type BackgroundRemovalOverlayResult,
  type BackgroundRemovalRenderResult,
  type BackgroundRemovalStats,
} from "../../lib/canvas/backgroundRemoval";
import {
  composeFinalRemoveMask,
  createCleanupMask,
  type CleanupMask,
} from "../../lib/canvas/backgroundCleanupMasks";
import type { GenerateItem } from "../../types";
import type {
  CanvasBackgroundCleanupBrushStroke,
  CanvasBackgroundCleanupClickEngine,
  CanvasBackgroundCleanupIntent,
  CanvasBackgroundCleanupSeed,
  CanvasBackgroundCleanupTool,
  NormalizedPoint,
} from "../../types/canvas";
import {
  cloneSnapshot,
  createStrokeId,
  drawImageData,
  getBrushStrokeSeedPoints,
  type BackgroundCleanupSnapshot,
} from "./backgroundCleanupState";
import { withSourcePrompt } from "./canvasModeHelpers";

interface UseCanvasBackgroundCleanupArgs {
  canvasOpen: boolean;
  currentImage: GenerateItem | null;
  canvasDisplayImage: GenerateItem | null;
  imageElementRef: RefObject<HTMLImageElement | null>;
  canvasSourceImageRef: RefObject<GenerateItem | null>;
  lastMergedDataUrlRef: RefObject<string | null>;
  setCanvasSaveState: (state: "idle" | "saving" | "saved" | "error") => void;
  setCanvasVersionItem: (item: GenerateItem | null) => void;
  applyMergedCanvasImage: (item: GenerateItem) => void;
  attachCanvasVersionReference: (item: GenerateItem) => Promise<void>;
  showToast: (message: string, error?: boolean) => void;
  t: (key: string) => string;
}

export function useCanvasBackgroundCleanup({
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
}: UseCanvasBackgroundCleanupArgs) {
  const [imageHasAlpha, setImageHasAlpha] = useState(false);
  const [cleanupIntent, setCleanupIntent] = useState<CanvasBackgroundCleanupIntent>("remove");
  const [cleanupTool, setCleanupTool] = useState<CanvasBackgroundCleanupTool>("click");
  const [cleanupClickEngine, setCleanupClickEngine] =
    useState<CanvasBackgroundCleanupClickEngine>("flat-flood-fill");
  const [backgroundCleanupSeeds, setBackgroundCleanupSeeds] =
    useState<CanvasBackgroundCleanupSeed[]>([]);
  const [backgroundCleanupBrushStrokes, setBackgroundCleanupBrushStrokes] =
    useState<CanvasBackgroundCleanupBrushStroke[]>([]);
  const [backgroundCleanupTolerance, setBackgroundCleanupTolerance] = useState(28);
  const [backgroundCleanupPreview, setBackgroundCleanupPreview] =
    useState<BackgroundRemovalRenderResult | null>(null);
  const [backgroundCleanupMaskOverlay, setBackgroundCleanupMaskOverlay] =
    useState<BackgroundRemovalOverlayResult | null>(null);
  const [backgroundCleanupStats, setBackgroundCleanupStats] =
    useState<BackgroundRemovalStats | null>(null);
  const [isBackgroundCleanupActive, setIsBackgroundCleanupActive] = useState(false);
  const [cleanupBrushRadius, setCleanupBrushRadius] = useState(0.018);
  const [cleanupBrushCursor, setCleanupBrushCursor] = useState<NormalizedPoint | null>(null);
  const [isBackgroundCleanupPreviewing, setIsBackgroundCleanupPreviewing] = useState(false);
  const [isBackgroundCleanupApplying, setIsBackgroundCleanupApplying] = useState(false);
  const removeMaskRef = useRef<CleanupMask | null>(null);
  const preserveMaskRef = useRef<CleanupMask | null>(null);
  const activeCleanupBrushStrokeRef = useRef<CanvasBackgroundCleanupBrushStroke | null>(null);
  const historyRef = useRef<{ past: BackgroundCleanupSnapshot[]; future: BackgroundCleanupSnapshot[] }>({
    past: [],
    future: [],
  });
  const renderSeqRef = useRef(0);
  const toleranceTimerRef = useRef<number | null>(null);

  const getSnapshot = useCallback((): BackgroundCleanupSnapshot => cloneSnapshot({
    intent: cleanupIntent,
    tool: cleanupTool,
    engine: cleanupClickEngine,
    seeds: backgroundCleanupSeeds,
    brushStrokes: backgroundCleanupBrushStrokes,
    brushRadius: cleanupBrushRadius,
    tolerance: backgroundCleanupTolerance,
    removeMask: removeMaskRef.current,
    preserveMask: preserveMaskRef.current,
    preview: backgroundCleanupPreview,
    maskOverlay: backgroundCleanupMaskOverlay,
    stats: backgroundCleanupStats,
    active: isBackgroundCleanupActive,
    brushCursor: cleanupBrushCursor,
  }), [
    backgroundCleanupBrushStrokes,
    backgroundCleanupMaskOverlay,
    backgroundCleanupPreview,
    backgroundCleanupSeeds,
    backgroundCleanupStats,
    backgroundCleanupTolerance,
    cleanupBrushCursor,
    cleanupBrushRadius,
    cleanupClickEngine,
    cleanupIntent,
    cleanupTool,
    isBackgroundCleanupActive,
  ]);

  const pushUndo = useCallback((): void => {
    historyRef.current = {
      past: [...historyRef.current.past.slice(-19), getSnapshot()],
      future: [],
    };
  }, [getSnapshot]);

  const restoreSnapshot = useCallback((snapshot: BackgroundCleanupSnapshot): void => {
    const restored = cloneSnapshot(snapshot);
    removeMaskRef.current = restored.removeMask;
    preserveMaskRef.current = restored.preserveMask;
    activeCleanupBrushStrokeRef.current = null;
    setCleanupIntent(restored.intent);
    setCleanupTool(restored.tool);
    setCleanupClickEngine(restored.engine);
    setBackgroundCleanupSeeds(restored.seeds);
    setBackgroundCleanupBrushStrokes(restored.brushStrokes);
    setCleanupBrushRadius(restored.brushRadius);
    setBackgroundCleanupTolerance(restored.tolerance);
    setBackgroundCleanupPreview(restored.preview);
    setBackgroundCleanupMaskOverlay(restored.maskOverlay);
    setBackgroundCleanupStats(restored.stats);
    setIsBackgroundCleanupActive(restored.active);
    setCleanupBrushCursor(restored.brushCursor);
    setIsBackgroundCleanupPreviewing(false);
    setIsBackgroundCleanupApplying(false);
  }, []);

  const renderOverlayFromMasks = useCallback(async (): Promise<void> => {
    if (!imageElementRef.current || !currentImage) return;
    const finalMask = composeFinalRemoveMask(removeMaskRef.current, preserveMaskRef.current);
    if (!finalMask) {
      setBackgroundCleanupMaskOverlay(null);
      setBackgroundCleanupStats(null);
      return;
    }
    const renderSeq = renderSeqRef.current + 1;
    renderSeqRef.current = renderSeq;
    setIsBackgroundCleanupPreviewing(true);
    try {
      const result = await renderBackgroundCleanupOverlayFromMask({
        imageElement: imageElementRef.current,
        mask: finalMask,
      });
      if (renderSeqRef.current !== renderSeq) return;
      setBackgroundCleanupMaskOverlay(result);
      setBackgroundCleanupStats(result.stats);
    } catch {
      if (renderSeqRef.current !== renderSeq) return;
      showToast(t("canvas.toolbar.cleanupFailed"), true);
    } finally {
      if (renderSeqRef.current === renderSeq) setIsBackgroundCleanupPreviewing(false);
    }
  }, [currentImage, imageElementRef, showToast, t]);

  const rebuildMasks = useCallback(async (
    seeds: CanvasBackgroundCleanupSeed[],
    strokes: CanvasBackgroundCleanupBrushStroke[],
    tolerance: number,
  ): Promise<void> => {
    if (!imageElementRef.current) return;
    const source = drawImageData(imageElementRef.current);
    const removeMask = createCleanupMask(source.width, source.height);
    const preserveMask = createCleanupMask(source.width, source.height);
    for (const seed of seeds) {
      const mask = seed.intent === "remove" ? removeMask : preserveMask;
      floodFillMaskInto(mask, source, [seed.point], tolerance);
    }
    for (const stroke of strokes) {
      const mask = stroke.intent === "remove" ? removeMask : preserveMask;
      floodFillMaskInto(mask, source, getBrushStrokeSeedPoints(stroke), tolerance);
    }
    removeMaskRef.current = removeMask;
    preserveMaskRef.current = preserveMask;
  }, [imageElementRef]);

  const resetBackgroundCleanup = useCallback((): void => {
    renderSeqRef.current += 1;
    if (toleranceTimerRef.current != null) {
      window.clearTimeout(toleranceTimerRef.current);
      toleranceTimerRef.current = null;
    }
    removeMaskRef.current = null;
    preserveMaskRef.current = null;
    activeCleanupBrushStrokeRef.current = null;
    historyRef.current = { past: [], future: [] };
    setBackgroundCleanupSeeds([]);
    setBackgroundCleanupBrushStrokes([]);
    setBackgroundCleanupPreview(null);
    setBackgroundCleanupMaskOverlay(null);
    setBackgroundCleanupStats(null);
    setIsBackgroundCleanupActive(false);
    setCleanupBrushCursor(null);
    setIsBackgroundCleanupPreviewing(false);
    setIsBackgroundCleanupApplying(false);
  }, []);

  const undoBackgroundCleanup = useCallback((): boolean => {
    const previous = historyRef.current.past.pop();
    if (!previous) return false;
    historyRef.current.future = [getSnapshot(), ...historyRef.current.future.slice(0, 19)];
    restoreSnapshot(previous);
    return true;
  }, [getSnapshot, restoreSnapshot]);

  const redoBackgroundCleanup = useCallback((): boolean => {
    const next = historyRef.current.future.shift();
    if (!next) return false;
    historyRef.current.past = [...historyRef.current.past.slice(-19), getSnapshot()];
    restoreSnapshot(next);
    return true;
  }, [getSnapshot, restoreSnapshot]);

  const addBackgroundCleanupClick = useCallback((point: NormalizedPoint): void => {
    pushUndo();
    const nextSeeds = [...backgroundCleanupSeeds, { point, intent: cleanupIntent }];
    setBackgroundCleanupSeeds(nextSeeds);
    setBackgroundCleanupPreview(null);
    void rebuildMasks(nextSeeds, backgroundCleanupBrushStrokes, backgroundCleanupTolerance)
      .then(renderOverlayFromMasks);
  }, [backgroundCleanupBrushStrokes, backgroundCleanupSeeds, backgroundCleanupTolerance, cleanupIntent, pushUndo, rebuildMasks, renderOverlayFromMasks]);

  const handleBackgroundCleanupAutoSample = useCallback((): void => {
    pushUndo();
    const seeds = getCornerBackgroundRemovalSeeds().map((point) => ({ point, intent: "remove" as const }));
    setBackgroundCleanupSeeds(seeds);
    setBackgroundCleanupPreview(null);
    setIsBackgroundCleanupActive(false);
    void rebuildMasks(seeds, backgroundCleanupBrushStrokes, backgroundCleanupTolerance)
      .then(renderOverlayFromMasks);
  }, [backgroundCleanupBrushStrokes, backgroundCleanupTolerance, pushUndo, rebuildMasks, renderOverlayFromMasks]);

  const handleBackgroundCleanupPickSeed = useCallback((): void => {
    pushUndo();
    setCleanupTool("click");
    setIsBackgroundCleanupActive((value) => !value);
  }, [pushUndo]);

  const handleBackgroundCleanupToleranceChange = useCallback((value: number): void => {
    pushUndo();
    if (toleranceTimerRef.current != null) window.clearTimeout(toleranceTimerRef.current);
    setBackgroundCleanupTolerance(value);
    setBackgroundCleanupPreview(null);
    toleranceTimerRef.current = window.setTimeout(() => {
      toleranceTimerRef.current = null;
      void rebuildMasks(backgroundCleanupSeeds, backgroundCleanupBrushStrokes, value).then(renderOverlayFromMasks);
    }, 180);
  }, [backgroundCleanupBrushStrokes, backgroundCleanupSeeds, pushUndo, rebuildMasks, renderOverlayFromMasks]);

  const runBackgroundCleanupPreview = useCallback(async (): Promise<BackgroundRemovalRenderResult | null> => {
    if (!imageElementRef.current || !currentImage) return null;
    let finalMask = composeFinalRemoveMask(removeMaskRef.current, preserveMaskRef.current);
    if (!finalMask) {
      const seeds = getCornerBackgroundRemovalSeeds().map((point) => ({ point, intent: "remove" as const }));
      setBackgroundCleanupSeeds(seeds);
      await rebuildMasks(seeds, backgroundCleanupBrushStrokes, backgroundCleanupTolerance);
      finalMask = composeFinalRemoveMask(removeMaskRef.current, preserveMaskRef.current);
    }
    if (!finalMask) return null;
    pushUndo();
    const renderSeq = renderSeqRef.current + 1;
    renderSeqRef.current = renderSeq;
    setIsBackgroundCleanupPreviewing(true);
    try {
      const result = await renderBackgroundCleanupPreviewFromMask({
        imageElement: imageElementRef.current,
        mask: finalMask,
      });
      if (renderSeqRef.current !== renderSeq) return null;
      setBackgroundCleanupPreview(result);
      setBackgroundCleanupMaskOverlay(null);
      setBackgroundCleanupStats(result.stats);
      return result;
    } catch {
      if (renderSeqRef.current !== renderSeq) return null;
      showToast(t("canvas.toolbar.cleanupFailed"), true);
      return null;
    } finally {
      if (renderSeqRef.current === renderSeq) setIsBackgroundCleanupPreviewing(false);
    }
  }, [backgroundCleanupBrushStrokes, backgroundCleanupTolerance, currentImage, imageElementRef, pushUndo, rebuildMasks, showToast, t]);

  const handleBackgroundCleanupReset = useCallback((): void => {
    pushUndo();
    resetBackgroundCleanup();
  }, [pushUndo, resetBackgroundCleanup]);

  const startBackgroundCleanupBrushStroke = useCallback((point: NormalizedPoint): void => {
    pushUndo();
    const stroke = { id: createStrokeId(), intent: cleanupIntent, points: [{ ...point }], radius: cleanupBrushRadius };
    activeCleanupBrushStrokeRef.current = stroke;
    setCleanupBrushCursor(point);
    setBackgroundCleanupBrushStrokes((strokes) => [...strokes, stroke]);
  }, [cleanupBrushRadius, cleanupIntent, pushUndo]);

  const updateBackgroundCleanupBrushStroke = useCallback((point: NormalizedPoint): void => {
    const active = activeCleanupBrushStrokeRef.current;
    if (!active) {
      setCleanupBrushCursor(point);
      return;
    }
    active.points = [...active.points, { ...point }];
    setCleanupBrushCursor(point);
    setBackgroundCleanupBrushStrokes((strokes) => strokes.map((stroke) => (
      stroke.id === active.id ? { ...active, points: active.points.map((p) => ({ ...p })) } : stroke
    )));
    void rebuildMasks(backgroundCleanupSeeds, backgroundCleanupBrushStrokes.map((stroke) => (
      stroke.id === active.id ? active : stroke
    )), backgroundCleanupTolerance).then(renderOverlayFromMasks);
  }, [backgroundCleanupBrushStrokes, backgroundCleanupSeeds, backgroundCleanupTolerance, rebuildMasks, renderOverlayFromMasks]);

  const endBackgroundCleanupBrushStroke = useCallback((): void => {
    activeCleanupBrushStrokeRef.current = null;
    void rebuildMasks(backgroundCleanupSeeds, backgroundCleanupBrushStrokes, backgroundCleanupTolerance)
      .then(renderOverlayFromMasks);
  }, [backgroundCleanupBrushStrokes, backgroundCleanupSeeds, backgroundCleanupTolerance, rebuildMasks, renderOverlayFromMasks]);

  const handleBackgroundCleanupApply = useCallback(async (): Promise<void> => {
    if (!currentImage || !imageElementRef.current) return;
    const source = canvasSourceImageRef.current ?? currentImage;
    if (!source?.filename) {
      showToast(t("canvas.toolbar.cleanupFailed"), true);
      return;
    }
    let finalMask = composeFinalRemoveMask(removeMaskRef.current, preserveMaskRef.current);
    if (!finalMask) {
      const seeds = getCornerBackgroundRemovalSeeds().map((point) => ({ point, intent: "remove" as const }));
      setBackgroundCleanupSeeds(seeds);
      await rebuildMasks(seeds, backgroundCleanupBrushStrokes, backgroundCleanupTolerance);
      finalMask = composeFinalRemoveMask(removeMaskRef.current, preserveMaskRef.current);
    }
    if (!finalMask) return;
    setIsBackgroundCleanupApplying(true);
    setCanvasSaveState("saving");
    try {
      pushUndo();
      const result = await renderBackgroundCleanupPreviewFromMask({
        imageElement: imageElementRef.current,
        mask: finalMask,
      });
      const response = await createCanvasVersion({
        sourceFilename: source.canvasSourceFilename ?? source.filename,
        image: result.blob,
        prompt: source.prompt,
      });
      const savedItem = withSourcePrompt(response.item, source);
      lastMergedDataUrlRef.current = result.dataUrl;
      setCanvasVersionItem(savedItem);
      applyMergedCanvasImage(savedItem);
      await attachCanvasVersionReference(savedItem);
      setCanvasSaveState("saved");
      setBackgroundCleanupPreview(null);
      setBackgroundCleanupMaskOverlay(null);
      setBackgroundCleanupStats(result.stats);
      setIsBackgroundCleanupActive(false);
      showToast(t("canvas.toolbar.cleanupApplied"));
    } catch {
      setCanvasSaveState("error");
      showToast(t("canvas.toolbar.cleanupFailed"), true);
    } finally {
      setIsBackgroundCleanupApplying(false);
    }
  }, [applyMergedCanvasImage, attachCanvasVersionReference, backgroundCleanupBrushStrokes, backgroundCleanupTolerance, canvasSourceImageRef, currentImage, imageElementRef, lastMergedDataUrlRef, pushUndo, rebuildMasks, setCanvasSaveState, setCanvasVersionItem, showToast, t]);

  const handleBackgroundCleanupEscape = useCallback((): boolean => {
    if (!isBackgroundCleanupActive) return false;
    activeCleanupBrushStrokeRef.current = null;
    setIsBackgroundCleanupActive(false);
    setCleanupBrushCursor(null);
    return true;
  }, [isBackgroundCleanupActive]);

  useEffect(() => {
    const node = imageElementRef.current;
    if (!node || !canvasOpen) {
      setImageHasAlpha(false);
      return;
    }
    const detect = () => setImageHasAlpha(imageUsesAlpha(node));
    if (node.complete) detect();
    else {
      node.addEventListener("load", detect);
      return () => node.removeEventListener("load", detect);
    }
  }, [canvasOpen, canvasDisplayImage?.canvasMergedAt, canvasDisplayImage?.filename, canvasDisplayImage?.image, canvasDisplayImage?.url, backgroundCleanupPreview?.dataUrl, imageElementRef]);

  return {
    imageHasAlpha,
    backgroundCleanupSeeds,
    backgroundCleanupBrushStrokes,
    backgroundCleanupTolerance,
    backgroundCleanupPreview,
    backgroundCleanupMaskOverlay,
    backgroundCleanupStats,
    cleanupIntent,
    setCleanupIntent,
    cleanupTool,
    setCleanupTool,
    cleanupClickEngine,
    setCleanupClickEngine,
    cleanupBrushRadius,
    setCleanupBrushRadius,
    cleanupBrushCursor,
    setCleanupBrushCursor,
    isBackgroundCleanupActive,
    setIsBackgroundCleanupActive,
    isBackgroundCleanupPickingSeed: isBackgroundCleanupActive && cleanupTool === "click",
    isBackgroundCleanupPreviewing,
    isBackgroundCleanupApplying,
    hasActiveCleanupStroke: Boolean(activeCleanupBrushStrokeRef.current),
    canUndoBackgroundCleanup: historyRef.current.past.length > 0,
    canRedoBackgroundCleanup: historyRef.current.future.length > 0,
    resetBackgroundCleanup,
    undoBackgroundCleanup,
    redoBackgroundCleanup,
    addBackgroundCleanupClick,
    addBackgroundCleanupSeed: addBackgroundCleanupClick,
    runBackgroundCleanupPreview,
    handleBackgroundCleanupAutoSample,
    handleBackgroundCleanupPickSeed,
    handleBackgroundCleanupToleranceChange,
    handleBackgroundCleanupReset,
    handleBackgroundCleanupApply,
    handleBackgroundCleanupEscape,
    startBackgroundCleanupBrushStroke,
    updateBackgroundCleanupBrushStroke,
    endBackgroundCleanupBrushStroke,
  };
}
