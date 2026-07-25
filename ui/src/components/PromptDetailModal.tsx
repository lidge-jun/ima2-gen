import { useI18n } from "../i18n";
import { useModalFocus } from "../hooks/useModalFocus";
import type { PromptItem } from "../lib/api";
import { FavoriteStarIcon } from "./controls";

export function PromptDetailModal({
  prompt,
  onClose,
  onLoad,
  onInsert,
  onDelete,
  onToggleFavorite,
}: {
  prompt: PromptItem;
  onClose: () => void;
  onLoad: () => void;
  onInsert: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}) {
  const { t } = useI18n();
  const dialogRef = useModalFocus<HTMLDivElement>(true, onClose);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.text);
    } catch {
      // ignore
    }
  };

  return (
    <div className="prompt-detail-modal" role="presentation">
      <div className="prompt-detail-modal__backdrop" onClick={onClose} />
      <div
        ref={dialogRef}
        className="prompt-detail-modal__content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-detail-title"
        tabIndex={-1}
      >
        <div className="prompt-detail-modal__header">
          <h2 id="prompt-detail-title" className="prompt-detail-modal__title">
            {prompt.name || t("promptLibrary.untitled")}
          </h2>
          <button className="prompt-detail-modal__close" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>

        <div className="prompt-detail-modal__body">
          <div className="prompt-detail-modal__label">{t("promptLibrary.content")}</div>
          <div className="prompt-detail-modal__prompt">{prompt.text}</div>

          {prompt.tags.length > 0 && (
            <div className="prompt-detail-modal__tags">
              <div className="prompt-detail-modal__label">{t("promptLibrary.tags")}</div>
              <div className="prompt-detail-modal__tag-list">
                {prompt.tags.map((tag) => (
                  <span key={tag} className="prompt-detail-modal__tag">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="prompt-detail-modal__footer">
          <button className="prompt-detail-modal__load" onClick={onLoad}>
            {t("promptLibrary.load")}
          </button>
          <button className="prompt-detail-modal__copy" onClick={handleCopy}>
            {t("promptLibrary.copy")}
          </button>
          <button className="prompt-detail-modal__insert" onClick={onInsert}>
            + {t("promptLibrary.insert")}
          </button>
          <button
            className={`prompt-detail-modal__favorite${prompt.isFavorite ? " prompt-detail-modal__favorite--on" : ""}`}
            onClick={onToggleFavorite}
            aria-pressed={prompt.isFavorite}
          >
            <FavoriteStarIcon />
            {prompt.isFavorite ? t("promptLibrary.unfavorite") : t("promptLibrary.favorite")}
          </button>
          <button className="prompt-detail-modal__delete" onClick={onDelete}>
            {t("common.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
