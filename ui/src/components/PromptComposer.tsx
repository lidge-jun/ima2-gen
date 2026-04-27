import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";
import { SavePromptPopover } from "./SavePromptPopover";

const MAX_REFS = 5;

export function PromptComposer() {
  const prompt = useAppStore((s) => s.prompt);
  const setPrompt = useAppStore((s) => s.setPrompt);
  const insertedPrompts = useAppStore((s) => s.insertedPrompts);
  const removeInsertedPrompt = useAppStore((s) => s.removeInsertedPromptFromComposer);
  const generate = useAppStore((s) => s.generate);
  const { t } = useI18n();

  const refs = useAppStore((s) => s.referenceImages);
  const addReferences = useAppStore((s) => s.addReferences);
  const readDroppedImageMetadata = useAppStore((s) => s.readDroppedImageMetadata);
  const removeReference = useAppStore((s) => s.removeReference);
  const useCurrentAsReference = useAppStore((s) => s.useCurrentAsReference);
  const currentImage = useAppStore((s) => s.currentImage);

  const fileInput = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const promptMode = useAppStore((s) => s.promptMode);
  const setPromptMode = useAppStore((s) => s.setPromptMode);
  const multimode = useAppStore((s) => s.multimode);
  const multimodeMaxImages = useAppStore((s) => s.multimodeMaxImages);

  const canAddMore = refs.length < MAX_REFS;
  const placeholder = multimode
    ? refs.length > 0
      ? t("multimode.promptPlaceholderWithRefs")
      : t("multimode.promptPlaceholder")
    : refs.length > 0
      ? t("prompt.placeholderWithRefs")
      : t("prompt.placeholder");

  const handleImageFiles = async (files: File[]) => {
    if (files.length === 0) return;
    if (files.length === 1) {
      const handled = await readDroppedImageMetadata(files[0]);
      if (handled) return;
    }
    await addReferences(files);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (files.length > 0) void handleImageFiles(files);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!dragOver) setDragOver(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragOver(false);
  };

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
    e.preventDefault();
    const room = MAX_REFS - refs.length;
    void addReferences(files.slice(0, room));
  };

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
      className={`composer${dragOver ? " composer--drag" : ""}${multimode ? " composer--multimode" : ""}`}
      role="group"
      aria-label={
        multimode
          ? t("multimode.composerAriaLabel", { count: multimodeMaxImages })
          : t("prompt.label")
      }
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onPaste={onPaste}
    >
      <div className="composer__header">
        <span className="section-title composer__label">{t("prompt.label")}</span>
        <div className="composer__header-meta">
          {multimode && (
            <span className="composer__mode-badge">
              {t("multimode.composerBadge", { count: multimodeMaxImages })}
            </span>
          )}
          {refs.length > 0 && (
            <span className="composer__count">
              {t("prompt.refCount", { count: refs.length, max: MAX_REFS })}
            </span>
          )}
        </div>
      </div>

      {refs.length > 0 && (
        <div className="composer__chips">
          {refs.map((src, i) => (
            <div key={i} className="composer__chip" title={t("prompt.refChipTitle", { n: i + 1 })}>
              <img src={src} alt={t("prompt.refChipAlt", { n: i + 1 })} />
              <button
                type="button"
                className="composer__chip-remove"
                onClick={() => removeReference(i)}
                aria-label={t("prompt.refRemoveAria", { n: i + 1 })}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {insertedPrompts.length > 0 && (
        <div className="composer__prompt-chips">
          {insertedPrompts.map((item) => (
            <div key={item.id} className="composer__prompt-chip" title={item.name}>
              <span className="composer__prompt-chip-plus" aria-hidden="true">+</span>
              <span className="composer__prompt-chip-title">{item.name}</span>
              <button
                type="button"
                className="composer__prompt-chip-remove"
                onClick={() => removeInsertedPrompt(item.id)}
                aria-label={t("promptLibrary.removeInserted", { name: item.name })}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <textarea
        className="prompt-area composer__textarea"
        value={prompt}
        placeholder={placeholder}
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
          title={t("prompt.attachTitle")}
          aria-label={t("prompt.attachTitle")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
          <span>{t("prompt.attach")}</span>
        </button>
        <button
          type="button"
          className="composer__tool"
          onClick={() => void useCurrentAsReference()}
          disabled={!currentImage || !canAddMore}
          title={t("prompt.useCurrentTitle")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          <span>{t("prompt.useCurrent")}</span>
        </button>
        <button
          type="button"
          className={`composer__tool${promptMode === "direct" ? " composer__tool--on" : ""}`}
          onClick={() => setPromptMode(promptMode === "direct" ? "auto" : "direct")}
          title={t("prompt.directModeTitle")}
          aria-label={t("prompt.directModeTitle")}
          aria-pressed={promptMode === "direct"}
        >
          <span aria-hidden="true" style={{ fontWeight: 700, fontSize: 11 }}>1:1</span>
          <span>{t("prompt.directMode")}</span>
        </button>
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className="composer__tool"
            onClick={() => setSaveOpen((v) => !v)}
            disabled={!prompt.trim()}
            title={t("promptLibrary.saveTitle")}
            aria-label={t("promptLibrary.saveTitle")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            <span>{t("promptLibrary.save")}</span>
          </button>
          {saveOpen && (
            <SavePromptPopover
              text={prompt}
              mode={promptMode}
              onClose={() => setSaveOpen(false)}
            />
          )}
        </div>
        <span className="composer__hint">{t("prompt.hint")}</span>
      </div>

      {dragOver && (
        <div className="composer__dropzone" aria-hidden="true">
          {t("prompt.dropHere", { max: MAX_REFS })}
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
          if (files.length > 0) void handleImageFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
