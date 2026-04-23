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
    showToast("프롬프트를 복사했습니다");
  };

  const displayQuality = currentImage?.quality ?? quality;
  const displaySize = currentImage?.size ?? getResolvedSize();

  return (
    <main className="canvas">
      <div className={`progress-bar${activeGenerations > 0 ? " active" : ""}`} />
      {currentImage ? (
        <div className="result-container visible">
          <img
            className="result-img"
            key={currentImage.filename ?? currentImage.url ?? currentImage.image}
            src={currentImage.url ?? currentImage.image}
            alt="생성 결과"
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
                ? `${currentImage.usage.total_tokens ?? "?"} 토큰`
                : null,
              displayQuality,
              displaySize,
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
