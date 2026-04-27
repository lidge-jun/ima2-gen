import type { KeyboardEvent, MouseEvent } from "react";
import { useAppStore } from "../store/useAppStore";
import { ResultActions } from "./ResultActions";
import { MultimodeSequencePreview } from "./MultimodeSequencePreview";
import { useI18n } from "../i18n";
import { isEditableTarget } from "../lib/domEvents";
import { getImageModelShortLabel } from "../lib/imageModels";

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

  const copyPrompt = () => {
    if (!currentImage?.prompt) return;
    void navigator.clipboard.writeText(currentImage.prompt);
    showToast(t("toast.promptCopied"));
  };

  const displayQuality = formatQualityAlias(currentImage?.quality ?? quality);
  const displaySize = formatSizeAlias(currentImage?.size ?? getResolvedSize());
  const displayModel = getImageModelShortLabel(currentImage?.model);

  const handleViewerKeyDown = (event: KeyboardEvent<HTMLElement>) => {
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
          <img
            className="result-img"
            key={currentImage.filename ?? currentImage.url ?? currentImage.image}
            src={currentImage.url ?? currentImage.image}
            alt={t("canvas.resultAlt")}
            onDoubleClick={(e) => {
              e.stopPropagation();
              openCanvas();
            }}
            style={{
              cursor: canvasOpen ? "default" : "zoom-in",
              transform: canvasOpen ? `scale(${canvasZoom})` : undefined,
              transition: canvasOpen ? "transform 0.2s ease" : undefined,
            }}
          />
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
