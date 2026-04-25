import { useCardNewsStore } from "../../store/cardNewsStore";
import { useI18n } from "../../i18n";
import type { CardNewsCard } from "../../lib/cardNewsApi";

const EMPTY_CARDS: CardNewsCard[] = [];

export function CardNewsBatchBar() {
  const { t } = useI18n();
  const cards = useCardNewsStore((s) => s.activePlan?.cards ?? EMPTY_CARDS);
  const generating = useCardNewsStore((s) => s.generating);
  const summary = {
    total: cards.length,
    done: cards.filter((card) => card.status === "generated").length,
    queued: cards.filter((card) => card.status === "queued").length,
    errors: cards.filter((card) => card.status === "error").length,
    skipped: cards.filter((card) => card.locked || card.status === "skipped").length,
  };
  if (!summary.total) return null;

  return (
    <div className="card-news-batch-bar" aria-live="polite">
      <span>
        {generating
          ? t("cardNews.progress.generating", { done: summary.done, total: summary.total })
          : t("cardNews.progress.summary", { done: summary.done, total: summary.total })}
      </span>
      <span>
        {t("cardNews.progress.detail", {
          queued: summary.queued,
          errors: summary.errors,
          skipped: summary.skipped,
        })}
      </span>
    </div>
  );
}
