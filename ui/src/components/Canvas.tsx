import {
  lazy,
  Suspense,
  useCallback,
  useState,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { useAppStore } from "../store/useAppStore";
import { ResultActions } from "./ResultActions";
import { MultimodeSequencePreview } from "./MultimodeSequencePreview";
import { useI18n } from "../i18n";
import { isEditableTarget } from "../lib/domEvents";
import { getImageModelShortLabel } from "../lib/imageModels";
import type { GenerateItem } from "../types";

const LazyCanvasModeWorkspace = lazy(() =>
  import("./canvas-mode").then((module) => ({
    default: module.CanvasModeWorkspace,
  })),
);

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

function getClassicImageSrc(image: GenerateItem): string {
  const src = image.url ?? image.image;
  if (!image.canvasVersion || !image.canvasMergedAt || src.startsWith("data:")) return src;
  const separator = src.includes("?") ? "&" : "?";
  return `${src}${separator}canvasMergedAt=${image.canvasMergedAt}`;
}

export function Canvas() {
  const currentImage = useAppStore((s) => s.currentImage);
  const importLocalImageToHistory = useAppStore((s) => s.importLocalImageToHistory);
  const multimodeSequence = useAppStore((s) => {
    const id = s.multimodePreviewFlightId;
    return id ? s.multimodeSequences[id] ?? null : null;
  });
  const selectHistoryShortcutTarget = useAppStore((s) => s.selectHistoryShortcutTarget);
  const trashHistoryItem = useAppStore((s) => s.trashHistoryItem);
  const permanentlyDeleteHistoryItemByShortcut = useAppStore(
    (s) => s.permanentlyDeleteHistoryItemByShortcut,
  );
  const markGeneratedResultsSeen = useAppStore((s) => s.markGeneratedResultsSeen);
  const activeGenerations = useAppStore((s) => s.activeGenerations);
  const quality = useAppStore((s) => s.quality);
  const getResolvedSize = useAppStore((s) => s.getResolvedSize);
  const canvasOpen = useAppStore((s) => s.canvasOpen);
  const openCanvas = useAppStore((s) => s.openCanvas);
  const showToast = useAppStore((s) => s.showToast);
  const { t } = useI18n();
  const [dropActive, setDropActive] = useState(false);

  const copyPrompt = (): void => {
    if (!currentImage?.prompt) return;
    void navigator.clipboard.writeText(currentImage.prompt);
    showToast(t("toast.promptCopied"));
  };

  const handleViewerKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === "Delete" || event.key === "Backspace") {
      if (!currentImage) return;
      if (event.target !== event.currentTarget) return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      if (event.shiftKey) {
        void permanentlyDeleteHistoryItemByShortcut(currentImage);
        return;
      }
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

  const handleViewerMouseDown = (event: MouseEvent<HTMLElement>): void => {
    if (isEditableTarget(event.target)) return;
    markGeneratedResultsSeen();
    event.currentTarget.focus();
  };

  const handleCenterDragOver = useCallback((event: ReactDragEvent<HTMLElement>): void => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    setDropActive((prev) => (prev ? prev : true));
  }, []);

  const handleCenterDragLeave = useCallback((event: ReactDragEvent<HTMLElement>): void => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDropActive(false);
  }, []);

  const handleCenterDrop = useCallback(
    async (event: ReactDragEvent<HTMLElement>): Promise<void> => {
      if (!Array.from(event.dataTransfer.types).includes("Files")) return;
      event.preventDefault();
      setDropActive(false);
      const files = Array.from(event.dataTransfer.files).filter((file) =>
        /^image\/(png|jpeg|webp)$/.test(file.type),
      );
      if (files.length === 0) return;
      await importLocalImageToHistory(files[0]);
    },
    [importLocalImageToHistory],
  );

  if (canvasOpen && currentImage) {
    return (
      <Suspense fallback={<main className="canvas canvas--mode-open" aria-busy="true" />}>
        <LazyCanvasModeWorkspace currentImage={currentImage} />
      </Suspense>
    );
  }

  const displayQuality = formatQualityAlias(currentImage?.quality ?? quality);
  const displaySize = formatSizeAlias(currentImage?.size ?? getResolvedSize());
  const displayModel = getImageModelShortLabel(currentImage?.model);
  const imageSrc = currentImage ? getClassicImageSrc(currentImage) : null;

  return (
    <main
      className={`canvas${dropActive ? " canvas--drop-active" : ""}`}
      onDragOver={handleCenterDragOver}
      onDragLeave={handleCenterDragLeave}
      onDrop={handleCenterDrop}
    >
      {dropActive ? (
        <div className="canvas__drop-overlay" aria-hidden>
          <span className="canvas__drop-hint">{t("canvas.drop.hint")}</span>
        </div>
      ) : null}
      <div className={`progress-bar${activeGenerations > 0 ? " active" : ""}`} />
      {multimodeSequence ? (
        <MultimodeSequencePreview />
      ) : currentImage && imageSrc ? (
        <div
          className="result-container visible"
          tabIndex={0}
          onMouseDown={handleViewerMouseDown}
          onKeyDown={handleViewerKeyDown}
          aria-label={t("canvas.imageViewerAria")}
        >
          <div className="canvas-annotation-frame">
            <img
              className="result-img"
              key={`${currentImage.filename ?? currentImage.url ?? currentImage.image}:${currentImage.canvasMergedAt ?? ""}`}
              src={imageSrc}
              alt={t("canvas.resultAlt")}
              onDoubleClick={(event) => {
                event.stopPropagation();
                openCanvas();
              }}
            />
          </div>
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
              .filter((value): value is string => Boolean(value))
              .join(" · ")}
          </div>
          <ResultActions />
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
