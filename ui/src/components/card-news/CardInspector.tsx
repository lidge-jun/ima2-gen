import { useCardNewsStore } from "../../store/cardNewsStore";
import { useI18n } from "../../i18n";
import type { CardNewsTextField } from "../../lib/cardNewsApi";
import { TextFieldCard } from "./TextFieldCard";

function createTextField(): CardNewsTextField {
  return {
    id: `tf_${Date.now().toString(36)}`,
    kind: "body",
    text: "",
    renderMode: "in-image",
    placement: "center",
    slotId: null,
    hierarchy: "supporting",
    maxChars: null,
    language: null,
    source: "user",
  };
}

export function CardInspector() {
  const { t } = useI18n();
  const plan = useCardNewsStore((s) => s.activePlan);
  const selectedId = useCardNewsStore((s) => s.selectedCardId);
  const selectedTextFieldId = useCardNewsStore((s) => s.selectedTextFieldId);
  const updateCard = useCardNewsStore((s) => s.updateCard);
  const updateTextField = useCardNewsStore((s) => s.updateTextField);
  const addTextField = useCardNewsStore((s) => s.addTextField);
  const removeTextField = useCardNewsStore((s) => s.removeTextField);
  const selectTextField = useCardNewsStore((s) => s.selectTextField);
  const retryCard = useCardNewsStore((s) => s.retryCard);
  const card = plan?.cards.find((c) => c.id === selectedId) || plan?.cards[0];

  if (!card) {
    return <aside className="card-news-inspector">{t("cardNews.noCard")}</aside>;
  }

  return (
    <aside className="card-news-inspector">
      <div className="section-title">{t("cardNews.inspector")}</div>
      <div className="card-news-inspector-group">
        <span className="card-news-inspector-label">{t("cardNews.cardTitle")}</span>
        <label className="card-news-field">
          <span>{t("cardNews.headline")}</span>
          <input
            value={card.headline}
            disabled={card.locked}
            onChange={(e) => updateCard(card.id, { headline: e.target.value })}
          />
        </label>
      </div>
      <div className="card-news-inspector-group">
        <div className="card-news-inspector-row">
          <span className="card-news-inspector-label">{t("cardNews.textFields")}</span>
          <button
            type="button"
            className="secondary-btn"
            disabled={card.locked}
            onClick={() => addTextField(card.id, createTextField())}
          >
            {t("cardNews.addTextField")}
          </button>
        </div>
        {card.textFields.length ? card.textFields.map((field) => (
          <TextFieldCard
            key={field.id}
            field={field}
            locked={card.locked}
            selected={selectedTextFieldId === field.id}
            onSelect={() => selectTextField(field.id)}
            onChange={(patch) => updateTextField(card.id, field.id, patch)}
            onRemove={() => removeTextField(card.id, field.id)}
          />
        )) : <p className="card-news-muted">{t("cardNews.noTextFields")}</p>}
      </div>
      <details className="card-news-inspector-group card-news-advanced-prompt">
        <summary>{t("cardNews.designPrompt")}</summary>
        <label className="card-news-field">
          <span>{t("cardNews.visualPrompt")}</span>
          <textarea
            value={card.visualPrompt}
            disabled={card.locked}
            onChange={(e) => updateCard(card.id, { visualPrompt: e.target.value })}
          />
        </label>
      </details>
      {card.imageFilename ? (
        <div className="card-news-generated-meta">
          <span>{t("cardNews.generatedMeta")}</span>
          <code>{card.imageFilename}</code>
          <span>{card.status}</span>
        </div>
      ) : null}
      {card.locked ? <p className="card-news-locked-help">{t("cardNews.lockedHelp")}</p> : null}
      <button
        type="button"
        className={`secondary-btn${card.locked ? " active" : ""}`}
        onClick={() => updateCard(card.id, { locked: !card.locked })}
      >
        {card.locked ? t("cardNews.locked") : t("cardNews.unlocked")}
      </button>
      <button
        type="button"
        className="secondary-btn"
        disabled={card.locked || !["draft", "error"].includes(card.status)}
        onClick={() => void retryCard(card.id)}
      >
        {t("cardNews.retryCard")}
      </button>
    </aside>
  );
}
