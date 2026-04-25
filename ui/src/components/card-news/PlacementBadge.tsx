import { useI18n } from "../../i18n";
import type { CardNewsTextPlacement } from "../../lib/cardNewsApi";

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export function placementLabel(placement: CardNewsTextPlacement, t: TranslateFn): string {
  const key = `cardNews.placements.${placement}`;
  const label = t(key);
  return label === key ? placement : label;
}

export function PlacementBadge({ placement }: { placement: CardNewsTextPlacement }) {
  const { t } = useI18n();
  return <span className="card-news-placement-chip">{placementLabel(placement, t)}</span>;
}
