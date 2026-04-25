import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { ResultActions } from "./ResultActions";

export function Canvas() {
  const currentImage = useAppStore((s) => s.currentImage);
  const activeGenerations = useAppStore((s) => s.activeGenerations);
  const quality = useAppStore((s) => s.quality);
  const getResolvedSize = useAppStore((s) => s.getResolvedSize);
  const showToast = useAppStore((s) => s.showToast);
  const setPrompt = useAppStore((s) => s.setPrompt);
  const openLightbox = useAppStore((s) => s.openLightbox);

  const [promptView, setPromptView] = useState<"enhanced" | "original">("enhanced");

  const hasOriginal = Boolean(
    currentImage?.originalPrompt &&
      currentImage.originalPrompt !== currentImage.prompt,
  );
  const showingOriginal = hasOriginal && promptView === "original";
  const visiblePrompt = showingOriginal
    ? currentImage?.originalPrompt
    : currentImage?.prompt;

  const copyVisible = () => {
    if (!visiblePrompt) return;
    void navigator.clipboard.writeText(visiblePrompt);
    showToast(
      showingOriginal
        ? "원본 프롬프트를 복사했습니다"
        : "프롬프트를 복사했습니다",
    );
  };

  const displayQuality = currentImage?.quality ?? quality;
  const displaySize = currentImage?.size ?? getResolvedSize();

  const isGenerating = activeGenerations > 0;
  const showSkeleton = !currentImage && isGenerating;
  const showEmpty = !currentImage && !isGenerating;

  const tryExamplePrompt = (text: string) => {
    setPrompt(text);
    const el = document.querySelector<HTMLTextAreaElement>(
      ".composer__textarea",
    );
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  };

  return (
    <main className="canvas">
      <div className={`progress-bar${isGenerating ? " active" : ""}`} />

      {showEmpty ? (
        <div className="canvas-empty">
          <div className="canvas-empty__icon" aria-hidden="true">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
          <div className="canvas-empty__title">무엇을 만들어볼까요?</div>
          <div className="canvas-empty__hint">
            왼쪽에 프롬프트를 입력하고{" "}
            <kbd>Ctrl</kbd>+<kbd>Enter</kbd> 로 생성하세요.
          </div>
          <div className="canvas-empty__examples">
            {[
              "비 내리는 도쿄 골목, 네온 반사, 시네마틱 사진",
              "미니멀한 한국 전통 수묵화, 소나무와 학",
              "우주복을 입은 시바견, 달 표면, 사실적 렌더링",
            ].map((p) => (
              <button
                key={p}
                type="button"
                className="canvas-empty__example"
                onClick={() => tryExamplePrompt(p)}
                title="이 예시를 프롬프트로 사용"
              >
                {p}
              </button>
            ))}
          </div>
          <div className="canvas-empty__shortcuts">
            팁: 이미지를 드래그&amp;드롭하거나 붙여넣기(<kbd>Ctrl</kbd>+<kbd>V</kbd>)로 참조 추가 ·{" "}
            <kbd>?</kbd> 로 단축키 전체 보기
          </div>
        </div>
      ) : showSkeleton ? (
        <div className="canvas-skeleton" role="status" aria-live="polite">
          <div className="canvas-skeleton__frame">
            <div className="canvas-skeleton__shimmer" aria-hidden="true" />
          </div>
          <div className="canvas-skeleton__label">
            {activeGenerations > 1
              ? `${activeGenerations}개 이미지를 생성하고 있어요…`
              : "이미지를 생성하고 있어요…"}
          </div>
          <div className="canvas-skeleton__sub">
            품질에 따라 10–60초 정도 걸릴 수 있습니다.
          </div>
        </div>
      ) : currentImage ? (
        <div className="result-container visible">
          {isGenerating ? (
            <div className="result-pending-badge" aria-live="polite">
              추가 생성 중 {activeGenerations}개…
            </div>
          ) : null}
          <img
            className="result-img"
            key={currentImage.filename ?? currentImage.url ?? currentImage.image}
            src={currentImage.url ?? currentImage.image}
            alt="생성 결과"
            role="button"
            tabIndex={0}
            title="클릭하여 전체 보기"
            onClick={() => openLightbox()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openLightbox();
              }
            }}
            style={{ cursor: "zoom-in" }}
          />
          {visiblePrompt ? (
            <div
              className={`result-prompt${showingOriginal ? " result-prompt--original" : ""}`}
              onClick={copyVisible}
              title="클릭하여 프롬프트 복사"
            >
              {hasOriginal ? (
                <div
                  className="result-prompt__toggle"
                  role="tablist"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={!showingOriginal}
                    className={`result-prompt__tab${!showingOriginal ? " is-active" : ""}`}
                    onClick={() => setPromptView("enhanced")}
                  >
                    다듬은
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={showingOriginal}
                    className={`result-prompt__tab${showingOriginal ? " is-active" : ""}`}
                    onClick={() => setPromptView("original")}
                  >
                    원본
                  </button>
                </div>
              ) : null}
              <div className="result-prompt__text">{visiblePrompt}</div>
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
