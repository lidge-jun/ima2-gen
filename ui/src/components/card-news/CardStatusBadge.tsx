import { useI18n } from "../../i18n";
import type { CardNewsCard } from "../../lib/cardNewsApi";

type Props = {
  status: CardNewsCard["status"];
  locked: boolean;
};

export function CardStatusBadge({ status, locked }: Props) {
  const { t } = useI18n();
  const display = locked ? "locked" : status;
  const busy = display === "queued" || display === "generating";
  return (
    <span className={`card-news-status-badge card-news-status-badge--${display}`}>
      {busy ? <span className="card-news-spinner" aria-hidden="true" /> : null}
      {t(`cardNews.status.${display}`)}
    </span>
  );
}
