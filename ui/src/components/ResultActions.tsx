import { useAppStore } from "../store/useAppStore";

export function ResultActions() {
  const currentImage = useAppStore((s) => s.currentImage);
  const showToast = useAppStore((s) => s.showToast);
  const setPrompt = useAppStore((s) => s.setPrompt);
  const vary = useAppStore((s) => s.varyCurrentResult);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const isFav = Boolean(currentImage?.favorite);

  if (!currentImage) return null;

  const download = () => {
    const a = document.createElement("a");
    a.href = currentImage.image;
    a.download = currentImage.filename || "generated.png";
    a.click();
  };

  const copyImage = async () => {
    try {
      const res = await fetch(currentImage.image);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      showToast("클립보드에 복사했습니다");
    } catch {
      showToast("복사에 실패했습니다", true);
    }
  };

  const copyPrompt = () => {
    if (!currentImage.prompt) return;
    void navigator.clipboard.writeText(currentImage.prompt);
    showToast("프롬프트를 복사했습니다");
  };

  const newFromHere = () => {
    if (!currentImage.prompt) {
      showToast("가져올 프롬프트가 없습니다", true);
      return;
    }
    setPrompt(currentImage.prompt);
    const promptEl = document.querySelector<HTMLTextAreaElement>(
      'textarea[name="prompt"], textarea#prompt, .sidebar textarea',
    );
    if (promptEl) {
      promptEl.focus();
      promptEl.setSelectionRange(promptEl.value.length, promptEl.value.length);
    }
    showToast("이 이미지의 프롬프트를 가져왔습니다. 수정 후 다시 생성하세요");
  };

  return (
    <div className="result-actions">
      <button
        type="button"
        className="action-btn action-btn--primary"
        onClick={() => void vary()}
        title="같은 프롬프트로 한 장 더 생성"
      >
        변형
      </button>
      <button type="button" className="action-btn" onClick={download}>
        다운로드
      </button>
      <button type="button" className="action-btn" onClick={copyImage}>
        이미지 복사
      </button>
      <button type="button" className="action-btn" onClick={copyPrompt}>
        프롬프트 복사
      </button>
      <button
        type="button"
        className={`action-btn action-btn--icon${isFav ? " action-btn--active" : ""}`}
        onClick={() => void toggleFavorite()}
        title={isFav ? "즐겨찾기 해제" : "즐겨찾기 추가"}
        aria-pressed={isFav}
      >
        {isFav ? "★" : "☆"}
      </button>
      <button
        type="button"
        className="action-btn"
        onClick={newFromHere}
        title="이 이미지의 프롬프트를 가져와 이어서 작업"
      >
        여기서 이어서
      </button>
    </div>
  );
}
