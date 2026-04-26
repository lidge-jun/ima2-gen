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
  return [card.headline, ...visible].filter(Boolean).join("\n");
}

function fieldStyle(field: CardNewsTextField, template?: ImageTemplate): CSSProperties {
  const slot = field.slotId ? template?.slots.find((item) => item.id === field.slotId) : null;
  if (!slot) return fallbackFieldStyle(field);
  return {
    left: `${slot.x / 20.48}%`,
    top: `${slot.y / 20.48}%`,
    width: `${slot.w / 20.48}%`,
    minHeight: `${slot.h / 20.48}%`,
  };
}

const PLACEMENT_STYLE: Record<CardNewsTextField["placement"], CSSProperties> = {
  "top-left": { left: "10%", top: "10%", width: "34%" },
  "top-center": { left: "50%", top: "10%", width: "42%", transform: "translateX(-50%)" },
  "top-right": { right: "10%", top: "10%", width: "34%" },
  "center-left": { left: "10%", top: "50%", width: "34%", transform: "translateY(-50%)" },
  center: { left: "50%", top: "50%", width: "44%", transform: "translate(-50%, -50%)" },
  "center-right": { right: "10%", top: "50%", width: "34%", transform: "translateY(-50%)" },
  "bottom-left": { left: "10%", bottom: "10%", width: "34%" },
  "bottom-center": { left: "50%", bottom: "10%", width: "42%", transform: "translateX(-50%)" },
  "bottom-right": { right: "10%", bottom: "10%", width: "34%" },
  free: { left: "50%", top: "50%", width: "44%", transform: "translate(-50%, -50%)" },
};

function fallbackFieldStyle(field: CardNewsTextField): CSSProperties {
  return PLACEMENT_STYLE[field.placement] || PLACEMENT_STYLE.center;
}

export function CardStage() {
  const { t } = useI18n();
  const plan = useCardNewsStore((s) => s.activePlan);
  const selectedId = useCardNewsStore((s) => s.selectedCardId);
  const selectedTextFieldId = useCardNewsStore((s) => s.selectedTextFieldId);
  const templates = useCardNewsStore((s) => s.templates);
  const plannerMeta = useCardNewsStore((s) => s.plannerMeta);
  const retryCard = useCardNewsStore((s) => s.retryCard);
  const selectTextField = useCardNewsStore((s) => s.selectTextField);
  const card = plan?.cards.find((c) => c.id === selectedId) || plan?.cards[0];
  const template = plan ? templates.find((item) => item.id === plan.imageTemplateId) : undefined;
  const visibleTextFields = card?.textFields.filter((field) => field.renderMode === "in-image") || [];

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
          </div>
        )}
        {visibleTextFields.length ? (
          <div className="card-news-stage-overlay">
            {visibleTextFields.map((field) => (
              <button
                type="button"
                key={field.id}
                className={`card-news-stage-overlay__field card-news-stage-overlay__field--${field.placement}${selectedTextFieldId === field.id ? " selected" : ""}`}
                style={fieldStyle(field, template)}
                onClick={() => selectTextField(field.id)}
                aria-label={t("cardNews.selectTextField", { text: field.text || field.kind })}
              >
                <span>{field.text || field.kind}</span>
              </button>
            ))}
          </div>
        ) : null}
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
