import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";

type Props = {
  open: boolean;
  originalPrompt: string;
  onClose: () => void;
  onApply: (newPrompt: string) => void;
  enhancer: (prompt: string) => Promise<string>;
};

export function EnhanceModal({ open, originalPrompt, onClose, onApply, enhancer }: Props) {
  const refCount = useAppStore((s) => s.referenceImages.length);
  const [enhanced, setEnhanced] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setEnhanced("");
    (async () => {
      try {
        const text = await enhancer(originalPrompt);
        if (!cancelled) setEnhanced(text);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, originalPrompt, enhancer]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="enhance-backdrop" onClick={onClose} role="presentation">
      <div
        className="enhance-modal"
        role="dialog"
        aria-modal="true"
        aria-label="프롬프트 다듬기"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="enhance-modal__header">
          <div className="enhance-modal__title">
            프롬프트 다듬기
            <span className="enhance-modal__badge">OAuth 사용</span>
            {refCount > 0 ? (
              <span className="enhance-modal__badge" title="첨부한 참조 이미지를 함께 보내 다듬습니다.">
                참조 {refCount}장
              </span>
            ) : null}
          </div>
          <button type="button" className="enhance-modal__close" onClick={onClose} aria-label="닫기">×</button>
        </div>
        <div className="enhance-modal__body">
          <div className="enhance-col">
            <div className="enhance-col__label">원본</div>
            <div className="enhance-col__text">{originalPrompt}</div>
          </div>
          <div className="enhance-col">
            <div className="enhance-col__label">다듬은 결과</div>
            {loading ? (
              <div className="enhance-col__loading">다듬는 중…</div>
            ) : error ? (
              <div className="enhance-col__error">에러: {error}</div>
            ) : (
              <textarea
                className="enhance-col__edit"
                value={enhanced}
                onChange={(e) => setEnhanced(e.target.value)}
              />
            )}
          </div>
        </div>
        <div className="enhance-modal__foot">
          <button type="button" className="action-btn" onClick={onClose}>취소</button>
          <button
            type="button"
            className="action-btn action-btn--primary"
            disabled={loading || !!error || !enhanced.trim()}
            onClick={() => onApply(enhanced.trim())}
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );
}
