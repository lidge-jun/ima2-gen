import { useCardNewsStore } from "../../store/cardNewsStore";
import { useI18n } from "../../i18n";
import { CardNewsBatchBar } from "./CardNewsBatchBar";
import { PlannerMetaBadge } from "./PlannerMetaBadge";

export function CardStage() {
  const { t } = useI18n();
  const plan = useCardNewsStore((s) => s.activePlan);
  const selectedId = useCardNewsStore((s) => s.selectedCardId);
  const plannerMeta = useCardNewsStore((s) => s.plannerMeta);
  const retryCard = useCardNewsStore((s) => s.retryCard);
  const card = plan?.cards.find((c) => c.id === selectedId) || plan?.cards[0];

  if (!plan || !card) {
    return (
      <section className="card-news-empty">
        <h2>{t("cardNews.emptyTitle")}</h2>
        <p>{t("cardNews.emptyBody")}</p>
      </section>
    );
  }

  return (
    <section className="card-news-stage">
      <div className="card-news-stage__header">
        <div>
          <h2>{plan.title}</h2>
          <p>{plan.generationStrategy}</p>
          <PlannerMetaBadge meta={plannerMeta} />
        </div>
        <span>{card.order} / {plan.cards.length}</span>
      </div>
      <CardNewsBatchBar />
      <div className="card-news-preview">
        {card.status === "queued" || card.status === "generating" ? (
          <div className="card-news-preview__loading">{t("cardNews.progress.cardGenerating")}</div>
        ) : card.status === "error" ? (
          <div className="card-news-preview__error">
            <span>{card.error || t("cardNews.error")}</span>
            {!card.locked ? (
              <button type="button" onClick={() => void retryCard(card.id)}>
                {t("cardNews.retryCard")}
              </button>
            ) : null}
          </div>
        ) : card.url ? <img src={card.url} alt={card.headline} /> : <div className="card-news-preview__slot" />}
        <div className="card-news-preview__copy">
          <strong>{card.headline}</strong>
          <span>{card.body}</span>
        </div>
      </div>
      {card.url ? (
        <div className="card-news-result-actions">
          <button type="button" onClick={() => navigator.clipboard?.writeText(card.visualPrompt)}>
            {t("cardNews.actions.copyPrompt")}
          </button>
          <button type="button" onClick={() => navigator.clipboard?.writeText(`${card.headline}\n${card.body}`)}>
            {t("cardNews.actions.copyCopy")}
          </button>
          <a href={card.url} target="_blank" rel="noreferrer">{t("cardNews.actions.openImage")}</a>
          <a href={card.url} download>{t("cardNews.actions.downloadCard")}</a>
        </div>
      ) : null}
    </section>
  );
}
