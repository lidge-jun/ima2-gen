import { useEffect } from "react";
import { useCardNewsStore } from "../../store/cardNewsStore";
import { useI18n } from "../../i18n";
import { ImageTemplatePicker } from "./ImageTemplatePicker";
import { RoleTemplatePicker } from "./RoleTemplatePicker";
import { CardDeckRail } from "./CardDeckRail";
import { CardStage } from "./CardStage";
import { CardInspector } from "./CardInspector";

export function CardNewsWorkspace() {
  const { t } = useI18n();
  const hydrate = useCardNewsStore((s) => s.hydrate);
  const error = useCardNewsStore((s) => s.error);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <main className="card-news-workspace" aria-label={t("cardNews.workspace")}>
      <div className="card-news-setup">
        <ImageTemplatePicker />
        <RoleTemplatePicker />
      </div>
      <div className="card-news-main">
        {error ? <div className="card-news-error" role="alert">{error}</div> : null}
        <CardStage />
        <CardDeckRail />
      </div>
      <CardInspector />
    </main>
  );
}
