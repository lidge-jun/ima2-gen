import { useAppStore } from "../store/useAppStore";

export function ResultActions() {
  const currentImage = useAppStore((s) => s.currentImage);
  const showToast = useAppStore((s) => s.showToast);
  const setPrompt = useAppStore((s) => s.setPrompt);

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

  const newFromHere = () => {
    if (!currentImage.prompt) {
      showToast("No prompt to seed from", true);
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
    showToast("Seeded from this image — edit and generate");
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
      <button
        type="button"
        className="action-btn action-btn--primary"
        onClick={newFromHere}
        title="Seed prompt from this image and continue"
      >
        New from here
      </button>
    </div>
  );
}
