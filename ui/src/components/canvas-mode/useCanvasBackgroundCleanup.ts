import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { createCanvasVersion } from "../../lib/api";
import { imageUsesAlpha } from "../../lib/canvas/alphaDetect";
import {
  getCornerBackgroundRemovalSeeds,
  renderBackgroundRemovalMaskOverlay,
  renderBackgroundRemovalPreview,
  type BackgroundRemovalOverlayResult,
  type BackgroundRemovalRenderResult,
  type BackgroundRemovalStats,
} from "../../lib/canvas/backgroundRemoval";
import type { GenerateItem } from "../../types";
import type { NormalizedPoint } from "../../types/canvas";
import { withSourcePrompt } from "./canvasModeHelpers";

interface BackgroundCleanupSnapshot {
  seeds: NormalizedPoint[];
  tolerance: number;
  preview: BackgroundRemovalRenderResult | null;
  maskOverlay: BackgroundRemovalOverlayResult | null;
  stats: BackgroundRemovalStats | null;
  pickingSeed: boolean;
}

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
  const [backgroundCleanupSeeds, setBackgroundCleanupSeeds] = useState<NormalizedPoint[]>([]);
  const [backgroundCleanupTolerance, setBackgroundCleanupTolerance] = useState(28);
  const [backgroundCleanupPreview, setBackgroundCleanupPreview] =
    useState<BackgroundRemovalRenderResult | null>(null);
  const [backgroundCleanupMaskOverlay, setBackgroundCleanupMaskOverlay] =
    useState<BackgroundRemovalOverlayResult | null>(null);
  const [backgroundCleanupStats, setBackgroundCleanupStats] =
    useState<BackgroundRemovalStats | null>(null);
  const [isBackgroundCleanupPickingSeed, setIsBackgroundCleanupPickingSeed] = useState(false);
  const [isBackgroundCleanupPreviewing, setIsBackgroundCleanupPreviewing] = useState(false);
  const [isBackgroundCleanupApplying, setIsBackgroundCleanupApplying] = useState(false);
  const undoRef = useRef<BackgroundCleanupSnapshot[]>([]);
  const renderSeqRef = useRef(0);
  const toleranceTimerRef = useRef<number | null>(null);

  const resetBackgroundCleanup = useCallback((): void => {
    renderSeqRef.current += 1;
    if (toleranceTimerRef.current != null) {
      window.clearTimeout(toleranceTimerRef.current);
      toleranceTimerRef.current = null;
    }
    setBackgroundCleanupSeeds([]);
    setBackgroundCleanupPreview(null);
    setBackgroundCleanupMaskOverlay(null);
    setBackgroundCleanupStats(null);
    setIsBackgroundCleanupPickingSeed(false);
    setIsBackgroundCleanupPreviewing(false);
    setIsBackgroundCleanupApplying(false);
  }, []);

  const getSnapshot = useCallback((): BackgroundCleanupSnapshot => ({
    seeds: [...backgroundCleanupSeeds],
    tolerance: backgroundCleanupTolerance,
    preview: backgroundCleanupPreview,
    maskOverlay: backgroundCleanupMaskOverlay,
    stats: backgroundCleanupStats,
    pickingSeed: isBackgroundCleanupPickingSeed,
  }), [
    backgroundCleanupMaskOverlay,
    backgroundCleanupPreview,
    backgroundCleanupSeeds,
    backgroundCleanupStats,
    backgroundCleanupTolerance,
    isBackgroundCleanupPickingSeed,
  ]);

  const pushUndo = useCallback((): void => {
    undoRef.current = [...undoRef.current.slice(-19), getSnapshot()];
  }, [getSnapshot]);

  const restoreSnapshot = useCallback((snapshot: BackgroundCleanupSnapshot): void => {
    setBackgroundCleanupSeeds(snapshot.seeds);
    setBackgroundCleanupTolerance(snapshot.tolerance);
    setBackgroundCleanupPreview(snapshot.preview);
    setBackgroundCleanupMaskOverlay(snapshot.maskOverlay);
    setBackgroundCleanupStats(snapshot.stats);
    setIsBackgroundCleanupPickingSeed(snapshot.pickingSeed);
    setIsBackgroundCleanupPreviewing(false);
    setIsBackgroundCleanupApplying(false);
  }, []);

  const undoBackgroundCleanup = useCallback((): boolean => {
    const previous = undoRef.current.pop();
    if (!previous) return false;
    restoreSnapshot(previous);
    return true;
  }, [restoreSnapshot]);

  const runBackgroundCleanupMaskOverlay = useCallback(async (
    seeds: NormalizedPoint[] = backgroundCleanupSeeds,
    tolerance: number = backgroundCleanupTolerance,
  ): Promise<void> => {
    if (!imageElementRef.current || !currentImage || seeds.length === 0) return;
    const renderSeq = renderSeqRef.current + 1;
    renderSeqRef.current = renderSeq;
    setIsBackgroundCleanupPreviewing(true);
    try {
      const result = await renderBackgroundRemovalMaskOverlay({
        imageElement: imageElementRef.current,
        seeds,
        tolerance,
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
  }, [
    backgroundCleanupSeeds,
    backgroundCleanupTolerance,
    currentImage,
    imageElementRef,
    showToast,
    t,
  ]);

  const runBackgroundCleanupPreview = useCallback(async (): Promise<BackgroundRemovalRenderResult | null> => {
    if (!imageElementRef.current || !currentImage) return null;
    pushUndo();
    const renderSeq = renderSeqRef.current + 1;
    renderSeqRef.current = renderSeq;
    const seeds = backgroundCleanupSeeds.length > 0
      ? backgroundCleanupSeeds
      : getCornerBackgroundRemovalSeeds();
    if (backgroundCleanupSeeds.length === 0) setBackgroundCleanupSeeds(seeds);
    setIsBackgroundCleanupPreviewing(true);
    try {
      const result = await renderBackgroundRemovalPreview({
        imageElement: imageElementRef.current,
        seeds,
        tolerance: backgroundCleanupTolerance,
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
  }, [
    backgroundCleanupSeeds,
    backgroundCleanupTolerance,
    currentImage,
    imageElementRef,
    pushUndo,
    showToast,
    t,
  ]);

  const addBackgroundCleanupSeed = useCallback((point: NormalizedPoint): void => {
    pushUndo();
    const nextSeeds = [...backgroundCleanupSeeds, point];
    setBackgroundCleanupSeeds(nextSeeds);
    setBackgroundCleanupPreview(null);
    setBackgroundCleanupStats(null);
    void runBackgroundCleanupMaskOverlay(nextSeeds);
  }, [backgroundCleanupSeeds, pushUndo, runBackgroundCleanupMaskOverlay]);

  const handleBackgroundCleanupAutoSample = useCallback((): void => {
    pushUndo();
    const seeds = getCornerBackgroundRemovalSeeds();
    setBackgroundCleanupSeeds(seeds);
    setBackgroundCleanupPreview(null);
    setBackgroundCleanupMaskOverlay(null);
    setBackgroundCleanupStats(null);
    setIsBackgroundCleanupPickingSeed(false);
    void runBackgroundCleanupMaskOverlay(seeds);
  }, [pushUndo, runBackgroundCleanupMaskOverlay]);

  const handleBackgroundCleanupPickSeed = useCallback((): void => {
    pushUndo();
    setIsBackgroundCleanupPickingSeed((value) => !value);
  }, [pushUndo]);

  const handleBackgroundCleanupToleranceChange = useCallback((value: number): void => {
    pushUndo();
    if (toleranceTimerRef.current != null) {
      window.clearTimeout(toleranceTimerRef.current);
      toleranceTimerRef.current = null;
    }
    setBackgroundCleanupTolerance(value);
    setBackgroundCleanupPreview(null);
    setBackgroundCleanupMaskOverlay(null);
    setBackgroundCleanupStats(null);
    const seeds = [...backgroundCleanupSeeds];
    if (seeds.length > 0) {
      toleranceTimerRef.current = window.setTimeout(() => {
        toleranceTimerRef.current = null;
        void runBackgroundCleanupMaskOverlay(seeds, value);
      }, 180);
    }
  }, [backgroundCleanupSeeds, pushUndo, runBackgroundCleanupMaskOverlay]);

  const handleBackgroundCleanupReset = useCallback((): void => {
    pushUndo();
    resetBackgroundCleanup();
  }, [pushUndo, resetBackgroundCleanup]);

  const handleBackgroundCleanupApply = useCallback(async (): Promise<void> => {
    if (!currentImage || !imageElementRef.current) return;
    const source = canvasSourceImageRef.current ?? currentImage;
    if (!source?.filename) {
      showToast(t("canvas.toolbar.cleanupFailed"), true);
      return;
    }
    setIsBackgroundCleanupApplying(true);
    setCanvasSaveState("saving");
    try {
      pushUndo();
      const result = await renderBackgroundRemovalPreview({
        imageElement: imageElementRef.current,
        seeds: backgroundCleanupSeeds.length > 0
          ? backgroundCleanupSeeds
          : getCornerBackgroundRemovalSeeds(),
        tolerance: backgroundCleanupTolerance,
      });
      if (!result) {
        setCanvasSaveState("error");
        return;
      }
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
      setIsBackgroundCleanupPickingSeed(false);
      showToast(t("canvas.toolbar.cleanupApplied"));
    } catch {
      setCanvasSaveState("error");
      showToast(t("canvas.toolbar.cleanupFailed"), true);
    } finally {
      setIsBackgroundCleanupApplying(false);
    }
  }, [
    applyMergedCanvasImage,
    attachCanvasVersionReference,
    backgroundCleanupSeeds,
    backgroundCleanupTolerance,
    canvasSourceImageRef,
    currentImage,
    imageElementRef,
    lastMergedDataUrlRef,
    pushUndo,
    setCanvasSaveState,
    setCanvasVersionItem,
    showToast,
    t,
  ]);

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
  }, [
    canvasOpen,
    canvasDisplayImage?.filename,
    canvasDisplayImage?.url,
    canvasDisplayImage?.image,
    canvasDisplayImage?.canvasMergedAt,
    backgroundCleanupPreview?.dataUrl,
    imageElementRef,
  ]);

  return {
    imageHasAlpha,
    backgroundCleanupSeeds,
    backgroundCleanupTolerance,
    backgroundCleanupPreview,
    backgroundCleanupMaskOverlay,
    backgroundCleanupStats,
    isBackgroundCleanupPickingSeed,
    isBackgroundCleanupPreviewing,
    isBackgroundCleanupApplying,
    resetBackgroundCleanup,
    undoBackgroundCleanup,
    addBackgroundCleanupSeed,
    runBackgroundCleanupPreview,
    handleBackgroundCleanupAutoSample,
    handleBackgroundCleanupPickSeed,
    handleBackgroundCleanupToleranceChange,
    handleBackgroundCleanupReset,
    handleBackgroundCleanupApply,
  };
}
