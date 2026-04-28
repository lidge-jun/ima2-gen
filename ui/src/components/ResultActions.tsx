import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";
import { exportImageToComfy } from "../lib/api";
import type { GenerateItem } from "../types";

interface ResultActionsProps {
  imageOverride?: GenerateItem | null;
}

export function ResultActions({ imageOverride = null }: ResultActionsProps) {
  const { t } = useI18n();
  const currentImage = useAppStore((s) => s.currentImage);
  const showToast = useAppStore((s) => s.showToast);
  const setPrompt = useAppStore((s) => s.setPrompt);
  const useImageAsReference = useAppStore((s) => s.useImageAsReference);
  const trashHistoryItem = useAppStore((s) => s.trashHistoryItem);
  const permanentlyDeleteHistoryItemByClick = useAppStore(
    (s) => s.permanentlyDeleteHistoryItemByClick,
  );
  const canvasOpen = useAppStore((s) => s.canvasOpen);
  const openCanvas = useAppStore((s) => s.openCanvas);
  const [comfyExporting, setComfyExporting] = useState(false);

  const actionImage = imageOverride ?? currentImage;
  if (!actionImage) return null;
  const canExportToComfy = Boolean(actionImage.filename);

  const download = () => {
    const a = document.createElement("a");
    a.href = actionImage.image;
    a.download = actionImage.filename || "generated.png";
    a.click();
  };

  const copyImage = async () => {
    try {
      const res = await fetch(actionImage.image);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      showToast(t("toast.imageCopied"));
    } catch {
      showToast(t("toast.copyFailed"), true);
    }
  };

  const copyPrompt = () => {
    if (!actionImage.prompt) return;
    void navigator.clipboard.writeText(actionImage.prompt);
    showToast(t("toast.promptCopied"));
  };

  const newFromHere = async () => {
    const hasPrompt = Boolean(actionImage.prompt);
    if (hasPrompt) setPrompt(actionImage.prompt as string);
    try {
      await useImageAsReference(actionImage);
    } catch {
      // non-fatal — fall back to prompt-only fork
    }
    const promptEl = document.querySelector<HTMLTextAreaElement>(
      'textarea[name="prompt"], textarea#prompt, .sidebar textarea',
    );
    if (promptEl) {
      promptEl.focus();
      promptEl.setSelectionRange(promptEl.value.length, promptEl.value.length);
    }
    showToast(t(hasPrompt ? "toast.forkStarted" : "toast.forkStartedNoPrompt"));
  };

  const sendToComfyUI = async () => {
    if (!actionImage.filename || comfyExporting) return;
    setComfyExporting(true);
    try {
      const result = await exportImageToComfy({ filename: actionImage.filename });
      showToast(t("toast.comfyExported", { filename: result.uploadedFilename }));
    } catch (error) {
      const code = error instanceof Error ? (error as Error & { code?: string }).code : undefined;
      const key =
        code === "COMFY_URL_NOT_LOCAL"
          ? "toast.comfyExportInvalidUrl"
          : code === "COMFY_IMAGE_INVALID"
            ? "toast.comfyExportInvalidImage"
            : code === "COMFY_IMAGE_NOT_FOUND"
              ? "toast.comfyExportImageNotFound"
              : "toast.comfyExportFailed";
      showToast(t(key), true);
    } finally {
      setComfyExporting(false);
    }
  };

  return (
    <div className="result-actions">
      <button type="button" className="action-btn" onClick={download}>
        {t("result.download")}
      </button>
      <button type="button" className="action-btn" onClick={copyImage}>
        {t("result.copyImage")}
      </button>
      <button type="button" className="action-btn" onClick={copyPrompt}>
        {t("result.copyPrompt")}
      </button>
      <button
        type="button"
        className="action-btn action-btn--primary"
        onClick={newFromHere}
        title={t("result.continueHereTitle")}
      >
        {t("result.continueHere")}
      </button>
      {!canvasOpen && (
        <button
          type="button"
          className="action-btn"
          onClick={openCanvas}
          title={t("canvas.open")}
          aria-label={t("canvas.openAria")}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 4h8v8M12 4l-8 8"/>
          </svg>
        </button>
      )}
      {actionImage.filename && (
        <>
          <button
            type="button"
            className="action-btn action-btn--danger"
            onClick={() => void trashHistoryItem(actionImage)}
            title={t("result.deleteTitle")}
          >
            {t("result.delete")}
          </button>
          <details className="result-actions__more">
            <summary className="action-btn">{t("result.more")}</summary>
            <div className="result-actions__menu">
              {canExportToComfy && (
                <button
                  type="button"
                  className="result-actions__menu-item"
                  onClick={() => void sendToComfyUI()}
                  title={t("result.sendToComfyUITitle")}
                  disabled={comfyExporting}
                >
                  {t("result.sendToComfyUI")}
                </button>
              )}
              <button
                type="button"
                className="result-actions__menu-item result-actions__danger-item"
                onClick={() => void permanentlyDeleteHistoryItemByClick(actionImage)}
              >
                {t("result.permanentDelete")}
              </button>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
