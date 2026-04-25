import { useCardNewsStore } from "../../store/cardNewsStore";
import { CardStatusBadge } from "./CardStatusBadge";

export function CardDeckRail() {
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
          <strong>{card.role}</strong>
          <CardStatusBadge status={card.status} locked={card.locked} />
        </button>
      ))}
    </div>
  );
}
