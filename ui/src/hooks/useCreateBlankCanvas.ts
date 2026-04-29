import { useCallback, useState } from "react";
import { useI18n } from "../i18n";
import { createBlankCanvasFile } from "../lib/canvas/blankCanvas";
import { useAppStore } from "../store/useAppStore";

export function useCreateBlankCanvas(): {
  creatingBlankCanvas: boolean;
  createBlankCanvas: () => Promise<void>;
} {
  const importLocalImageToHistory = useAppStore((s) => s.importLocalImageToHistory);
  const openCanvas = useAppStore((s) => s.openCanvas);
  const showToast = useAppStore((s) => s.showToast);
  const { t } = useI18n();
  const [creatingBlankCanvas, setCreatingBlankCanvas] = useState(false);

  const createBlankCanvas = useCallback(async (): Promise<void> => {
    if (creatingBlankCanvas) return;
    setCreatingBlankCanvas(true);
    try {
      const file = await createBlankCanvasFile();
      const item = await importLocalImageToHistory(file);
      if (item) openCanvas();
    } catch {
      showToast(t("canvas.blank.failed"), true);
    } finally {
      setCreatingBlankCanvas(false);
    }
  }, [creatingBlankCanvas, importLocalImageToHistory, openCanvas, showToast, t]);

  return { creatingBlankCanvas, createBlankCanvas };
}
