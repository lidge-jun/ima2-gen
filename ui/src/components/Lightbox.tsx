import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { deleteHistoryItem, restoreHistoryItem } from "../lib/api";
import type { GenerateItem } from "../types";

type ZoomMode = "fit" | "actual";

const SWIPE_THRESHOLD_PX = 50;
const UNDO_WINDOW_MS = 8000;

export function Lightbox() {
  const open = useAppStore((s) => s.lightboxOpen);
  const close = useAppStore((s) => s.closeLightbox);
  const next = useAppStore((s) => s.lightboxNext);
  const prev = useAppStore((s) => s.lightboxPrev);
  const currentImage = useAppStore((s) => s.currentImage);
  const history = useAppStore((s) => s.history);
  const showToast = useAppStore((s) => s.showToast);
  const removeFromHistory = useAppStore((s) => s.removeFromHistory);
  const addHistoryItem = useAppStore((s) => s.addHistoryItem);
  const selectHistory = useAppStore((s) => s.selectHistory);

  const [zoom, setZoom] = useState<ZoomMode>("fit");
  const [showCaption, setShowCaption] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem("ima2.lightbox.caption");
      return v === null ? true : v === "1";
    } catch {
      return true;
    }
  });
  const [pendingUndo, setPendingUndo] = useState<{
    filename: string;
    trashId: string;
    item: GenerateItem;
    expiresAt: number;
  } | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const toggleCaption = useCallback(() => {
    setShowCaption((v) => {
      const nv = !v;
      try {
        localStorage.setItem("ima2.lightbox.caption", nv ? "1" : "0");
      } catch {}
      return nv;
    });
  }, []);

  // Reset zoom whenever the displayed image changes.
  useEffect(() => {
    setZoom("fit");
  }, [currentImage?.filename, currentImage?.url]);

  // Keyboard: ESC closes, arrows navigate, Space toggles zoom, H hides caption,
  // Delete/Backspace removes the current image.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
        return;
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setZoom((z) => (z === "fit" ? "actual" : "fit"));
        return;
      }
      if (e.key === "h" || e.key === "H" || e.key === "ㅗ") {
        e.preventDefault();
        toggleCaption();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        void handleDelete();
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // handleDelete is stable via useCallback below; toggleCaption too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, close, next, prev, toggleCaption]);

  // Lock background scroll while open. Body already has overflow:hidden, but
  // some mobile browsers still bounce — set inert + aria-hidden on the app
  // shell instead would be cleaner, but the existing layout already handles
  // it via z-index 200. This is a no-op safeguard.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const onBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) close();
    },
    [close],
  );

  const onTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    if (!t) return;
    touchStart.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const start = touchStart.current;
      touchStart.current = null;
      if (!start) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      // Horizontal-dominant swipe → navigate. Vertical-dominant → close.
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD_PX) {
        if (dx < 0) next();
        else prev();
        return;
      }
      if (Math.abs(dy) > SWIPE_THRESHOLD_PX && Math.abs(dy) > Math.abs(dx)) {
        close();
      }
    },
    [next, prev, close],
  );

  // Soft-delete the displayed image, jump to the neighbour, surface an undo
  // banner. Exits the lightbox if no neighbours remain.
  const handleDelete = useCallback(async () => {
    const cur = useAppStore.getState().currentImage;
    if (!cur || !cur.filename) return;
    const filename = cur.filename;
    const hist = useAppStore.getState().history;
    const idx = hist.findIndex((h) => h.filename === filename);
    const neighbour = idx >= 0 ? hist[idx + 1] ?? hist[idx - 1] ?? null : null;
    try {
      const r = await deleteHistoryItem(filename);
      removeFromHistory(filename);
      setPendingUndo({
        filename,
        trashId: r.trashId,
        item: cur,
        expiresAt: Date.now() + UNDO_WINDOW_MS,
      });
      if (neighbour) {
        selectHistory(neighbour);
      } else {
        close();
      }
    } catch (err) {
      console.warn("[ima2:lightbox] delete failed", err);
      showToast("삭제에 실패했습니다", true);
    }
  }, [close, removeFromHistory, selectHistory, showToast]);

  const handleUndo = useCallback(async () => {
    const p = pendingUndo;
    if (!p) return;
    try {
      await restoreHistoryItem(p.filename, p.trashId);
      addHistoryItem(p.item);
      setPendingUndo(null);
      selectHistory(p.item);
    } catch (err) {
      console.warn("[ima2:lightbox] restore failed", err);
      showToast("되돌리기에 실패했습니다", true);
    }
  }, [pendingUndo, addHistoryItem, selectHistory, showToast]);

  // Auto-clear undo banner once the trash TTL elapses.
  useEffect(() => {
    if (!pendingUndo) return;
    const id = window.setInterval(() => {
      setPendingUndo((cur) => {
        if (!cur) return null;
        if (Date.now() >= cur.expiresAt) return null;
        return { ...cur };
      });
    }, 500);
    return () => clearInterval(id);
  }, [pendingUndo]);

  const download = useCallback(async () => {
    if (!currentImage) return;
    const src = currentImage.url || currentImage.image;
    if (!src) return;
    try {
      const a = document.createElement("a");
      a.href = src;
      a.download = currentImage.filename || `image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.warn("[ima2:lightbox] download failed", err);
      showToast("다운로드에 실패했습니다", true);
    }
  }, [currentImage, showToast]);

  if (!open || !currentImage) return null;

  const src = currentImage.url || currentImage.image;
  const idx = history.findIndex(
    (h) =>
      (currentImage.filename && h.filename === currentImage.filename) ||
      h.image === currentImage.image,
  );
  const total = history.length;
  const hasPrev = idx > 0;
  const hasNext = idx >= 0 && idx < total - 1;
  const counter = idx >= 0 ? `${idx + 1} / ${total}` : null;

  return (
    <div
      className={`lightbox lightbox--${zoom}`}
      role="dialog"
      aria-modal="true"
      aria-label="이미지 전체 보기"
      onClick={onBackdropClick}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="lightbox__topbar">
        {counter ? <span className="lightbox__counter">{counter}</span> : <span />}
        <div className="lightbox__actions">
          <button
            type="button"
            className={`lightbox__btn${showCaption ? "" : " lightbox__btn--off"}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleCaption();
            }}
            aria-pressed={!showCaption}
            aria-label={showCaption ? "프롬프트 숨기기" : "프롬프트 보기"}
            title={showCaption ? "프롬프트 숨기기 (H)" : "프롬프트 보기 (H)"}
          >
            {showCaption ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="lightbox__btn"
            onClick={(e) => {
              e.stopPropagation();
              setZoom((z) => (z === "fit" ? "actual" : "fit"));
            }}
            aria-label={zoom === "fit" ? "원본 크기로 보기" : "화면에 맞추기"}
            title={zoom === "fit" ? "원본 크기 (Space)" : "화면에 맞춤 (Space)"}
          >
            {zoom === "fit" ? "100%" : "맞춤"}
          </button>
          <button
            type="button"
            className="lightbox__btn"
            onClick={(e) => {
              e.stopPropagation();
              void download();
            }}
            aria-label="다운로드"
            title="다운로드"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          {currentImage.filename ? (
            <button
              type="button"
              className="lightbox__btn lightbox__btn--danger"
              onClick={(e) => {
                e.stopPropagation();
                void handleDelete();
              }}
              aria-label="삭제"
              title="삭제 (Delete)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          ) : null}
          <button
            type="button"
            className="lightbox__btn lightbox__btn--close"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
            aria-label="닫기"
            title="닫기 (Esc)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {hasPrev ? (
        <button
          type="button"
          className="lightbox__nav lightbox__nav--prev"
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
          aria-label="이전 이미지"
          title="이전 (←)"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      ) : null}
      {hasNext ? (
        <button
          type="button"
          className="lightbox__nav lightbox__nav--next"
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
          aria-label="다음 이미지"
          title="다음 (→)"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      ) : null}

      <div
        className="lightbox__stage"
        onClick={(e) => {
          // Image click toggles zoom, anywhere else closes.
          if ((e.target as HTMLElement).tagName === "IMG") {
            e.stopPropagation();
            setZoom((z) => (z === "fit" ? "actual" : "fit"));
          }
        }}
      >
        <img
          className="lightbox__img"
          src={src}
          alt={currentImage.prompt ?? "전체 보기"}
          draggable={false}
        />
      </div>

      {currentImage.prompt && showCaption ? (
        <div className="lightbox__caption" onClick={(e) => e.stopPropagation()}>
          <span className="lightbox__caption-text">{currentImage.prompt}</span>
        </div>
      ) : null}

      {pendingUndo ? (
        <div className="lightbox__undo" onClick={(e) => e.stopPropagation()}>
          <span>삭제됨</span>
          <button
            type="button"
            className="lightbox__undo-btn"
            onClick={(e) => {
              e.stopPropagation();
              void handleUndo();
            }}
          >
            되돌리기
          </button>
          <span className="lightbox__undo-timer">
            {Math.max(0, Math.ceil((pendingUndo.expiresAt - Date.now()) / 1000))}초
          </span>
        </div>
      ) : null}
    </div>
  );
}
