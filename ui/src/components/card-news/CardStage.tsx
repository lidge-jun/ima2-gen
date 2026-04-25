import { useCardNewsStore } from "../../store/cardNewsStore";
import { useI18n } from "../../i18n";
import { CardNewsBatchBar } from "./CardNewsBatchBar";
import { PlannerMetaBadge } from "./PlannerMetaBadge";
import type { CardNewsCard, CardNewsTextField, ImageTemplate } from "../../lib/cardNewsApi";
import type { CSSProperties } from "react";

function copyText(card: CardNewsCard): string {
  const visible = card.textFields
    .filter((field) => field.renderMode === "in-image" && field.text)
    .map((field) => `[${field.placement}] ${field.text}`);
  return [card.headline, card.body, ...visible].filter(Boolean).join("\n");
}

function fieldStyle(field: CardNewsTextField, template?: ImageTemplate): CSSProperties {
  const slot = field.slotId ? template?.slots.find((item) => item.id === field.slotId) : null;
  if (!slot) return {};
  return {
    left: `${slot.x / 20.48}%`,
    top: `${slot.y / 20.48}%`,
    width: `${slot.w / 20.48}%`,
    minHeight: `${slot.h / 20.48}%`,
  };
}

export function CardStage() {
  const { t } = useI18n();
  const plan = useCardNewsStore((s) => s.activePlan);
  const selectedId = useCardNewsStore((s) => s.selectedCardId);
  const templates = useCardNewsStore((s) => s.templates);
  const plannerMeta = useCardNewsStore((s) => s.plannerMeta);
  const retryCard = useCardNewsStore((s) => s.retryCard);
  const card = plan?.cards.find((c) => c.id === selectedId) || plan?.cards[0];
  const template = plan ? templates.find((item) => item.id === plan.imageTemplateId) : undefined;

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
        ) : card.url ? <img src={card.url} alt={card.headline} /> : (
          <div className="card-news-preview__slot">
            <div className="card-news-stage-overlay">
              {card.textFields.filter((field) => field.renderMode === "in-image").map((field) => (
                <span
                  key={field.id}
                  className={`card-news-stage-overlay__field card-news-stage-overlay__field--${field.placement}`}
                  style={fieldStyle(field, template)}
                >
                  [{field.placement}] {field.text}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="card-news-preview__copy">
          <strong>{card.headline}</strong>
          <span>{card.body}</span>
          {card.textFields.filter((field) => field.renderMode === "in-image").map((field) => (
            <small key={field.id}>[{field.placement}] {field.text}</small>
          ))}
        </div>
      </div>
      {card.url ? (
        <div className="card-news-result-actions">
          <button type="button" onClick={() => navigator.clipboard?.writeText(card.visualPrompt)}>
            {t("cardNews.actions.copyPrompt")}
          </button>
          <button type="button" onClick={() => navigator.clipboard?.writeText(copyText(card))}>
            {t("cardNews.actions.copyCopy")}
          </button>
          <a href={card.url} target="_blank" rel="noreferrer">{t("cardNews.actions.openImage")}</a>
          <a href={card.url} download>{t("cardNews.actions.downloadCard")}</a>
        </div>
      ) : null}
    </section>
  );
}
