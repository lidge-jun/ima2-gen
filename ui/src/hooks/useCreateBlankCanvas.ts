import { useCallback, useState } from "react";
import { useI18n } from "../i18n";
import { createBlankCanvasFile, type BlankCanvasSize } from "../lib/canvas/blankCanvas";
import { useAppStore } from "../store/useAppStore";

const FALLBACK_BLANK_CANVAS_SIDE = 1024;

export function resolveBlankCanvasSize(resolvedSize: string): BlankCanvasSize {
  const match = /^(\d+)x(\d+)$/.exec(resolvedSize);
  if (!match) {
    return { width: FALLBACK_BLANK_CANVAS_SIDE, height: FALLBACK_BLANK_CANVAS_SIDE };
  }
  const width = Number.parseInt(match[1] ?? "", 10);
  const height = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: FALLBACK_BLANK_CANVAS_SIDE, height: FALLBACK_BLANK_CANVAS_SIDE };
  }
  return { width, height };
}

export function useCreateBlankCanvas(): {
  creatingBlankCanvas: boolean;
  createBlankCanvas: () => Promise<void>;
} {
  const importLocalImageToHistory = useAppStore((s) => s.importLocalImageToHistory);
  const openCanvas = useAppStore((s) => s.openCanvas);
  const showToast = useAppStore((s) => s.showToast);
  const getResolvedSize = useAppStore((s) => s.getResolvedSize);
  const { t } = useI18n();
  const [creatingBlankCanvas, setCreatingBlankCanvas] = useState(false);

  const createBlankCanvas = useCallback(async (): Promise<void> => {
    if (creatingBlankCanvas) return;
    setCreatingBlankCanvas(true);
    try {
      const size = resolveBlankCanvasSize(getResolvedSize());
      const file = await createBlankCanvasFile(size);
      const item = await importLocalImageToHistory(file);
      if (item) openCanvas();
    } catch {
      showToast(t("canvas.blank.failed"), true);
    } finally {
      setCreatingBlankCanvas(false);
    }
  }, [creatingBlankCanvas, getResolvedSize, importLocalImageToHistory, openCanvas, showToast, t]);

  return { creatingBlankCanvas, createBlankCanvas };
}
