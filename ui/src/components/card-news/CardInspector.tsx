import { useCardNewsStore } from "../../store/cardNewsStore";
import { useI18n } from "../../i18n";

export function CardInspector() {
  const { t } = useI18n();
  const plan = useCardNewsStore((s) => s.activePlan);
  const selectedId = useCardNewsStore((s) => s.selectedCardId);
  const updateCard = useCardNewsStore((s) => s.updateCard);
  const retryCard = useCardNewsStore((s) => s.retryCard);
  const card = plan?.cards.find((c) => c.id === selectedId) || plan?.cards[0];

  if (!card) {
    return <aside className="card-news-inspector">{t("cardNews.noCard")}</aside>;
  }

  return (
    <aside className="card-news-inspector">
      <div className="section-title">{t("cardNews.inspector")}</div>
      <label className="card-news-field">
        <span>{t("cardNews.headline")}</span>
        <input
          value={card.headline}
          disabled={card.locked}
          onChange={(e) => updateCard(card.id, { headline: e.target.value })}
        />
      </label>
      <label className="card-news-field">
        <span>{t("cardNews.body")}</span>
        <textarea
          value={card.body}
          disabled={card.locked}
          onChange={(e) => updateCard(card.id, { body: e.target.value })}
        />
      </label>
      <label className="card-news-field">
        <span>{t("cardNews.visualPrompt")}</span>
        <textarea
          value={card.visualPrompt}
          disabled={card.locked}
          onChange={(e) => updateCard(card.id, { visualPrompt: e.target.value })}
        />
      </label>
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
