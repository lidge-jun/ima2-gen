import { useI18n } from "../../i18n";
import type { CardNewsPlannerMeta } from "../../lib/cardNewsApi";

type Props = {
  meta: CardNewsPlannerMeta | null;
};

export function PlannerMetaBadge({ meta }: Props) {
  const { t } = useI18n();
  if (!meta) return null;
  const modeLabel =
    meta.mode === "structured-output" ? t("cardNews.planner.structured") :
      meta.mode === "json-mode" ? t("cardNews.planner.jsonMode") :
        t("cardNews.planner.fallback");
  return (
    <span className="card-news-planner-badge">
      {modeLabel} · {meta.model}
      {meta.repaired ? ` · ${t("cardNews.planner.repaired")}` : ""}
    </span>
  );
}
