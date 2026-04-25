import { useCardNewsStore } from "../../store/cardNewsStore";
import { useI18n } from "../../i18n";
import { CardStatusBadge } from "./CardStatusBadge";

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

function roleLabel(role: string, t: TranslateFn): string {
  const key = `cardNews.roles.${role}`;
  const label = t(key);
  return label === key ? role : label;
}

export function CardDeckRail() {
  const { t } = useI18n();
  const plan = useCardNewsStore((s) => s.activePlan);
  const selected = useCardNewsStore((s) => s.selectedCardId);
  const selectCard = useCardNewsStore((s) => s.selectCard);
  if (!plan) return null;

  return (
    <div className="card-news-deck" aria-label="Card deck">
      {plan.cards.map((card) => (
        <button
          type="button"
          key={card.id}
          className={`card-news-deck-card${selected === card.id ? " selected" : ""}`}
          onClick={() => selectCard(card.id)}
        >
          <span>{String(card.order).padStart(2, "0")}</span>
          {card.url ? <img src={card.url} alt="" className="card-news-deck-card__thumb" /> : null}
          <strong>{roleLabel(card.role, t)}</strong>
          <small>{card.headline || card.textFields.find((field) => field.renderMode === "in-image")?.text}</small>
          <CardStatusBadge status={card.status} locked={card.locked} />
        </button>
      ))}
    </div>
  );
}
