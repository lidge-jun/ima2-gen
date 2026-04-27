import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";

export function ResultActions() {
  const { t } = useI18n();
  const currentImage = useAppStore((s) => s.currentImage);
  const showToast = useAppStore((s) => s.showToast);
  const setPrompt = useAppStore((s) => s.setPrompt);
  const trashHistoryItem = useAppStore((s) => s.trashHistoryItem);
  const permanentlyDeleteHistoryItemByClick = useAppStore(
    (s) => s.permanentlyDeleteHistoryItemByClick,
  );
  const canvasOpen = useAppStore((s) => s.canvasOpen);
  const openCanvas = useAppStore((s) => s.openCanvas);

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
      showToast(t("toast.imageCopied"));
    } catch {
      showToast(t("toast.copyFailed"), true);
    }
  };

  const copyPrompt = () => {
    if (!currentImage.prompt) return;
    void navigator.clipboard.writeText(currentImage.prompt);
    showToast(t("toast.promptCopied"));
  };

  const newFromHere = async () => {
    if (!currentImage.prompt) {
      showToast(t("toast.noPromptToFork"), true);
      return;
    }
    setPrompt(currentImage.prompt);
    // 0.09.5: auto-attach the current image as a reference so continuations
    // preserve style/composition, not just prompt text.
    try {
      await useAppStore.getState().useCurrentAsReference();
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
    showToast(t("toast.forkStarted"));
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
      {currentImage.filename && (
        <>
          <button
            type="button"
            className="action-btn action-btn--danger"
            onClick={() => void trashHistoryItem(currentImage)}
            title={t("result.deleteTitle")}
          >
            {t("result.delete")}
          </button>
          <details className="result-actions__more">
            <summary className="action-btn">{t("result.more")}</summary>
            <button
              type="button"
              className="result-actions__danger-item"
              onClick={() => void permanentlyDeleteHistoryItemByClick(currentImage)}
            >
              {t("result.permanentDelete")}
            </button>
          </details>
        </>
      )}
    </div>
  );
}
