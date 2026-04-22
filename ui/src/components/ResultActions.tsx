import { useAppStore } from "../store/useAppStore";

export function ResultActions() {
  const currentImage = useAppStore((s) => s.currentImage);
  const showToast = useAppStore((s) => s.showToast);

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
      showToast("Copied to clipboard");
    } catch {
      showToast("Copy failed", true);
    }
  };

  const copyPrompt = () => {
    if (!currentImage.prompt) return;
    void navigator.clipboard.writeText(currentImage.prompt);
    showToast("Prompt copied");
  };

  return (
    <div className="result-actions">
      <button type="button" className="action-btn" onClick={download}>
        Download
      </button>
      <button type="button" className="action-btn" onClick={copyImage}>
        Copy to clipboard
      </button>
      <button type="button" className="action-btn" onClick={copyPrompt}>
        Copy prompt
      </button>
    </div>
  );
}
