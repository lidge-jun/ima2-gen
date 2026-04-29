import { useCallback, type RefObject } from "react";
import {
  createCanvasVersion,
  deleteCanvasAnnotations,
  postEdit,
  updateCanvasVersion,
} from "../../lib/api";
import { renderMergedCanvasImage } from "../../lib/canvas/mergeRenderer";
import {
  blobToDataUrl,
  imageElementToPngDataUrl,
  renderMaskFromBoxes,
} from "../../lib/canvas/maskRenderer";
import {
  downloadCanvasBlob,
  exportCanvasImage,
  makeCanvasExportFilename,
} from "../../lib/canvas/exportRenderer";
import { objectKeyMatches } from "../../lib/canvas/objectKeys";
import type { Format, GenerateItem, ImageModel, Moderation, Provider, Quality } from "../../types";
import type { ReasoningEffort } from "../../lib/reasoning";
import {
  responseToGenerateItem,
  withSourcePrompt,
} from "./canvasModeHelpers";

interface UseCanvasModeSessionArgs {
  imageElementRef: RefObject<HTMLImageElement | null>;
  currentImage: GenerateItem | null;
  canvasDisplayImage: GenerateItem | null;
  canvasSourceImageRef: RefObject<GenerateItem | null>;
  lastMergedDataUrlRef: RefObject<string | null>;
  canvasVersionItem: GenerateItem | null;
  annotations: any;
  exportBackground: string;
  exportMatteColor: string;
  quality: Quality;
  format: Format;
  moderation: Moderation;
  provider: Provider;
  imageModel: ImageModel;
  reasoningEffort: ReasoningEffort;
  promptMode: "auto" | "direct";
  webSearchEnabled: boolean;
  getResolvedSize: () => string;
  setCanvasVersionItem: (item: GenerateItem | null) => void;
  setCanvasSaveState: (state: "idle" | "saving" | "saved" | "error") => void;
  setIsApplying: (value: boolean) => void;
  setIsExporting: (value: boolean) => void;
  setIsEditingWithMask: (value: boolean) => void;
  applyMergedCanvasImage: (item: GenerateItem) => void;
  addGeneratedHistoryItem: (item: GenerateItem) => Promise<void> | void;
  attachCanvasVersionReference: (item: GenerateItem) => Promise<void>;
  closeCanvas: () => void;
  resetCanvasSession: () => void;
  showToast: (message: string, error?: boolean) => void;
  t: (key: string) => string;
}

export function useCanvasModeSession({
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
}: UseCanvasModeSessionArgs) {
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
    canvasSourceImageRef,
    canvasVersionItem?.filename,
    currentImage,
    imageElementRef,
    lastMergedDataUrlRef,
    setCanvasSaveState,
    setCanvasVersionItem,
    setIsApplying,
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

  const handleExportCanvas = async (): Promise<void> => {
    if (!imageElementRef.current || !currentImage) return;
    setIsExporting(true);
    try {
      const matte = exportBackground === "matte";
      const blob = await exportCanvasImage({
        imageElement: imageElementRef.current,
        paths: annotations.paths,
        boxes: annotations.boxes,
        memos: annotations.memos,
        background: matte
          ? { mode: "matte", color: exportMatteColor }
          : { mode: "alpha" },
      });
      downloadCanvasBlob(blob, makeCanvasExportFilename({ matte }));
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
      const selectedBoxes = annotations.boxes.filter((box: { id: string }) =>
        annotations.selectedIds.some((id: string) => objectKeyMatches(id, "box", box.id)),
      );
      const maskBlob = await renderMaskFromBoxes({
        imageElement: imageElementRef.current,
        boxes: selectedBoxes.length > 0 ? selectedBoxes : annotations.boxes,
      });
      const prompt = canvasDisplayImage.prompt ?? currentImage?.prompt ?? "";
      if (!prompt.trim()) {
        showToast(t("toast.noPromptToFork"), true);
        return;
      }
      const response = await postEdit({
        image: editImage,
        mask: await blobToDataUrl(maskBlob),
        prompt,
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

  return {
    saveCanvasVersionAndUseReference,
    handleApplyCanvas,
    handleCloseCanvas,
    handleExportCanvas,
    handleEditWithMask,
  };
}
