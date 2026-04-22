import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { useAppStore } from "../store/useAppStore";

const MAX_REFS = 5;

export function PromptComposer() {
  const prompt = useAppStore((s) => s.prompt);
  const setPrompt = useAppStore((s) => s.setPrompt);
  const generate = useAppStore((s) => s.generate);

  const refs = useAppStore((s) => s.referenceImages);
  const addReferences = useAppStore((s) => s.addReferences);
  const removeReference = useAppStore((s) => s.removeReference);
  const useCurrentAsReference = useAppStore((s) => s.useCurrentAsReference);
  const currentImage = useAppStore((s) => s.currentImage);

  const fileInput = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const canAddMore = refs.length < MAX_REFS;

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (files.length > 0) void addReferences(files);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!dragOver) setDragOver(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragOver(false);
  };

  // Extract image files from a ClipboardEvent (Cmd/Ctrl+V).
  // Covers both inline bitmaps (Screenshot, "copy image") and files copied
  // from Finder/Explorer. Falls back silently if the clipboard only has text.
  const extractClipboardImages = (items: DataTransferItemList | null): File[] => {
    if (!items) return [];
    const files: File[] = [];
    for (const it of Array.from(items)) {
      if (it.kind !== "file") continue;
      if (!it.type.startsWith("image/")) continue;
      const f = it.getAsFile();
      if (f) files.push(f);
    }
    return files;
  };

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    if (!canAddMore) return;
    const files = extractClipboardImages(e.clipboardData?.items ?? null);
    if (files.length === 0) return;
    // Image paste detected → prevent the default (which would dump a base64
    // blob into the textarea) and attach instead.
    e.preventDefault();
    const room = MAX_REFS - refs.length;
    void addReferences(files.slice(0, room));
  };

  // Global paste fallback: when the composer isn't focused but the user hits
  // Cmd/Ctrl+V anywhere, still attach. Skip if they're typing in another input.
  useEffect(() => {
    const handler = (e: globalThis.ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;
      const files = extractClipboardImages(e.clipboardData?.items ?? null);
      if (files.length === 0) return;
      if (refs.length >= MAX_REFS) return;
      e.preventDefault();
      const room = MAX_REFS - refs.length;
      void addReferences(files.slice(0, room));
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [refs.length, addReferences]);

  return (
    <div
      className={`composer${dragOver ? " composer--drag" : ""}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onPaste={onPaste}
    >
      <div className="composer__header">
        <span className="section-title composer__label">Prompt</span>
        {refs.length > 0 && (
          <span className="composer__count">
            {refs.length}/{MAX_REFS} refs
          </span>
        )}
      </div>

      {refs.length > 0 && (
        <div className="composer__chips">
          {refs.map((src, i) => (
            <div key={i} className="composer__chip" title={`Reference ${i + 1}`}>
              <img src={src} alt={`reference ${i + 1}`} />
              <button
                type="button"
                className="composer__chip-remove"
                onClick={() => removeReference(i)}
                aria-label={`Remove reference ${i + 1}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <textarea
        className="prompt-area composer__textarea"
        value={prompt}
        placeholder={
          refs.length > 0
            ? "Describe what to do with the attached image(s)…"
            : "Describe the image, drag & drop, or paste (⌘/Ctrl+V) to attach…"
        }
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void generate();
          }
        }}
      />

      <div className="composer__toolbar">
        <button
          type="button"
          className="composer__tool"
          onClick={() => canAddMore && fileInput.current?.click()}
          disabled={!canAddMore}
          title="Attach reference image"
          aria-label="Attach reference image"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
          <span>Attach</span>
        </button>
        <button
          type="button"
          className="composer__tool"
          onClick={() => void useCurrentAsReference()}
          disabled={!currentImage || !canAddMore}
          title="Use current result as reference"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          <span>Use current</span>
        </button>
        <span className="composer__hint">⌘/Ctrl + Enter to generate</span>
      </div>

      {dragOver && (
        <div className="composer__dropzone" aria-hidden="true">
          Drop to attach as reference (max {MAX_REFS})
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) void addReferences(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
