import { useState } from "react";
import { useI18n } from "../i18n";
import type { PromptItem } from "../lib/api";
import { PromptDetailModal } from "./PromptDetailModal";

export function PromptLibraryRow({
  prompt,
  onLoad,
  onInsert,
  onDelete,
  onToggleFavorite,
}: {
  prompt: PromptItem;
  onLoad: () => void;
  onInsert: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}) {
  const { t } = useI18n();
  const [detailOpen, setDetailOpen] = useState(false);

  const preview = prompt.text.length > 45 ? prompt.text.slice(0, 45) + "..." : prompt.text;

  return (
    <>
      <div className="prompt-library-row" onClick={() => setDetailOpen(true)}>
        <div className="prompt-library-row__main">
          <div className="prompt-library-row__title">{prompt.name || t("promptLibrary.untitled")}</div>
          <div className="prompt-library-row__preview">{preview}</div>
        </div>
        <div className="prompt-library-row__actions">
          <button
            className="prompt-library-row__insert"
            onClick={(e) => {
              e.stopPropagation();
              onInsert();
            }}
            title={t("promptLibrary.insert")}
            aria-label={t("promptLibrary.insert")}
          >
            +
          </button>
          <button
            className={`prompt-library-row__star${prompt.isFavorite ? " prompt-library-row__star--on" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            aria-label={prompt.isFavorite ? t("promptLibrary.unfavorite") : t("promptLibrary.favorite")}
          >
            {prompt.isFavorite ? "★" : "☆"}
          </button>
          <span className="prompt-library-row__chevron">›</span>
        </div>
      </div>

      {detailOpen && (
        <PromptDetailModal
          prompt={prompt}
          onClose={() => setDetailOpen(false)}
          onLoad={() => {
            onLoad();
            setDetailOpen(false);
          }}
          onInsert={() => {
            onInsert();
            setDetailOpen(false);
          }}
          onDelete={onDelete}
          onToggleFavorite={onToggleFavorite}
        />
      )}
    </>
  );
}
