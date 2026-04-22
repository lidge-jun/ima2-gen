import { useAppStore } from "../store/useAppStore";
import { ResultActions } from "./ResultActions";

export function Canvas() {
  const currentImage = useAppStore((s) => s.currentImage);
  const activeGenerations = useAppStore((s) => s.activeGenerations);
  const quality = useAppStore((s) => s.quality);
  const getResolvedSize = useAppStore((s) => s.getResolvedSize);
  const showToast = useAppStore((s) => s.showToast);

  const copyPrompt = () => {
    if (!currentImage?.prompt) return;
    void navigator.clipboard.writeText(currentImage.prompt);
    showToast("Prompt copied");
  };

  return (
    <main className="canvas">
      <div className={`progress-bar${activeGenerations > 0 ? " active" : ""}`} />
      {currentImage ? (
        <div className="result-container visible">
          <img className="result-img" src={currentImage.image} alt="result" />
          {currentImage.prompt ? (
            <div className="result-prompt" onClick={copyPrompt}>
              {currentImage.prompt}
            </div>
          ) : null}
          <div className="result-meta">
            {[
              currentImage.elapsed != null ? `${currentImage.elapsed}s` : null,
              currentImage.usage
                ? `${currentImage.usage.total_tokens ?? "?"} tokens`
                : null,
              quality,
              getResolvedSize(),
              currentImage.provider ?? null,
            ]
              .filter((v): v is string => Boolean(v))
              .join("  ·  ")}
          </div>
          <ResultActions />
        </div>
      ) : null}
    </main>
  );
}
