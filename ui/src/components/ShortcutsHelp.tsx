import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";

type Shortcut = { keys: string[]; label: string };

const SHORTCUTS: Shortcut[] = [
  { keys: ["Ctrl", "Enter"], label: "현재 프롬프트로 생성" },
  { keys: ["Ctrl", "K"], label: "프롬프트 입력창 포커스" },
  { keys: ["Ctrl", "G"], label: "갤러리 열기/닫기" },
  { keys: ["Ctrl", "V"], label: "클립보드 이미지를 참조로 추가" },
  { keys: ["?"], label: "이 도움말 열기/닫기" },
  { keys: ["Esc"], label: "열린 모달 닫기" },
];

const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPod|iPad/.test(navigator.platform);

function renderKey(key: string): string {
  if (!isMac) return key;
  if (key === "Ctrl") return "⌘";
  if (key === "Enter") return "↵";
  return key;
}

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const galleryOpen = useAppStore((s) => s.galleryOpen);
  const openGallery = useAppStore((s) => s.openGallery);
  const closeGallery = useAppStore((s) => s.closeGallery);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      const meta = e.metaKey || e.ctrlKey;

      // "?" — toggle help (works even while typing if Shift held)
      if (e.key === "?" && !meta) {
        if (!isTyping) {
          e.preventDefault();
          setOpen((v) => !v);
        }
        return;
      }

      // Esc — close this modal first (gallery has its own handler)
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        return;
      }

      // Cmd/Ctrl+K — focus prompt
      if (meta && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        const el = document.querySelector<HTMLTextAreaElement>(
          ".composer__textarea",
        );
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
        return;
      }

      // Cmd/Ctrl+G — toggle gallery
      if (meta && (e.key === "g" || e.key === "G")) {
        e.preventDefault();
        if (galleryOpen) closeGallery();
        else openGallery();
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, galleryOpen, openGallery, closeGallery]);

  return (
    <>
      <button
        type="button"
        className="shortcuts-fab"
        onClick={() => setOpen(true)}
        aria-label="키보드 단축키 보기"
        title="단축키 (?)"
      >
        ?
      </button>

      {open && (
        <div
          className="shortcuts-backdrop"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="shortcuts-modal"
            role="dialog"
            aria-modal="true"
            aria-label="키보드 단축키"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shortcuts-modal__header">
              <div className="shortcuts-modal__title">키보드 단축키</div>
              <button
                type="button"
                className="shortcuts-modal__close"
                onClick={() => setOpen(false)}
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <ul className="shortcuts-modal__list">
              {SHORTCUTS.map((s) => (
                <li key={s.label} className="shortcuts-modal__row">
                  <span className="shortcuts-modal__label">{s.label}</span>
                  <span className="shortcuts-modal__keys">
                    {s.keys.map((k, i) => (
                      <span key={i}>
                        {i > 0 && <span className="shortcuts-modal__plus">+</span>}
                        <kbd>{renderKey(k)}</kbd>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <div className="shortcuts-modal__foot">
              어디서든 <kbd>?</kbd> 를 눌러 이 창을 다시 열 수 있어요.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
