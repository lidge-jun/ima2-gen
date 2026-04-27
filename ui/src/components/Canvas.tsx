import type { KeyboardEvent } from "react";
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
  const history = useAppStore((s) => s.history);
  const selectHistory = useAppStore((s) => s.selectHistory);
  const activeGenerations = useAppStore((s) => s.activeGenerations);
  const quality = useAppStore((s) => s.quality);
  const getResolvedSize = useAppStore((s) => s.getResolvedSize);
  const showToast = useAppStore((s) => s.showToast);
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
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (event.target !== event.currentTarget) return;
    if (isEditableTarget(event.target)) return;

    const currentIndex = history.findIndex((item) =>
      currentImage?.filename
        ? item.filename === currentImage.filename
        : item.image === currentImage?.image,
    );
    if (currentIndex < 0) return;

    const nextIndex = event.key === "ArrowLeft" ? currentIndex - 1 : currentIndex + 1;
    const next = history[nextIndex];
    if (!next) return;

    event.preventDefault();
    selectHistory(next);
  };

  return (
    <main className="canvas">
      <div className={`progress-bar${activeGenerations > 0 ? " active" : ""}`} />
      {multimodeSequence ? (
        <MultimodeSequencePreview />
      ) : currentImage ? (
        <div
          className="result-container visible"
          tabIndex={0}
          onKeyDown={handleViewerKeyDown}
          aria-label={t("canvas.imageViewerAria")}
        >
          <img
            className="result-img"
            key={currentImage.filename ?? currentImage.url ?? currentImage.image}
            src={currentImage.url ?? currentImage.image}
            alt={t("canvas.resultAlt")}
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
