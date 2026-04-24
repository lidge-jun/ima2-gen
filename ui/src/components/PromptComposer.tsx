import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { useAppStore } from "../store/useAppStore";
import { StyleChips } from "./StyleChips";
import { EnhanceModal } from "./EnhanceModal";
import { enhancePrompt as apiEnhance } from "../lib/api";

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
  const [enhanceOpen, setEnhanceOpen] = useState(false);

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
      className={`composer${dragOver ? " composer--drag" : ""}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onPaste={onPaste}
    >
      <div className="composer__header">
        <span className="section-title composer__label">프롬프트</span>
        {refs.length > 0 && (
          <span className="composer__count">
            참조 {refs.length}/{MAX_REFS}
          </span>
        )}
      </div>

      <StyleChips />

      {refs.length > 0 && (
        <div className="composer__chips">
          {refs.map((src, i) => (
            <div key={i} className="composer__chip" title={`참조 이미지 ${i + 1}`}>
              <img src={src} alt={`참조 이미지 ${i + 1}`} />
              <button
                type="button"
                className="composer__chip-remove"
                onClick={() => removeReference(i)}
                aria-label={`참조 이미지 ${i + 1} 제거`}
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
        placeholder={
          refs.length > 0
            ? "첨부한 이미지로 무엇을 만들지 설명해 주세요..."
            : "원하는 이미지를 설명하고, 드래그 앤 드롭이나 붙여넣기로 참조 이미지를 추가할 수 있어요..."
        }
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void generate();
            return;
          }
          if ((e.key === "e" || e.key === "E") && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (prompt.trim()) setEnhanceOpen(true);
          }
        }}
      />

      <div className="composer__toolbar">
        <button
          type="button"
          className="composer__tool"
          onClick={() => canAddMore && fileInput.current?.click()}
          disabled={!canAddMore}
          title="참조 이미지 첨부"
          aria-label="참조 이미지 첨부"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
          <span>첨부</span>
        </button>
        <button
          type="button"
          className="composer__tool"
          onClick={() => prompt.trim() && setEnhanceOpen(true)}
          disabled={!prompt.trim()}
          title="프롬프트 자세히 다듬기"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          <span>다듬기</span>
        </button>
        <button
          type="button"
          className="composer__tool"
          onClick={() => void useCurrentAsReference()}
          disabled={!currentImage || !canAddMore}
          title="현재 결과를 참조로 사용"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          <span>현재 결과 사용</span>
        </button>
        <span className="composer__hint">Ctrl + Enter로 생성</span>
      </div>

      {dragOver && (
        <div className="composer__dropzone" aria-hidden="true">
          놓아서 참조 이미지로 추가 ({MAX_REFS}장까지)
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

      <EnhanceModal
        open={enhanceOpen}
        originalPrompt={prompt}
        onClose={() => setEnhanceOpen(false)}
        onApply={(next) => { setPrompt(next); setEnhanceOpen(false); }}
        enhancer={async (p) => (await apiEnhance(p, "ko")).prompt}
      />
    </div>
  );
}
