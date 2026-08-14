import { useI18n } from "../../i18n";
import { HomeRecentRow } from "./HomeRecentRow";
import { HomePromptComposer } from "./HomePromptComposer";
import "../../styles/home-workspace.css";

export function HomeWorkspace() {
  const { t } = useI18n();

  return (
    <section className="home-workspace" aria-label={t("nav.home")}>
      <div className="home-workspace__inner">
        <div className="home-workspace__brand">
          <span className="home-chrome-logo">ima2</span>
        </div>
        <div className="home-workspace__composer">
          <HomePromptComposer />
        </div>
        <div className="home-workspace__recent">
          <h2>{t("home.recentTitle")}</h2>
          <HomeRecentRow />
        </div>
        <div className="home-workspace__wordmark" aria-hidden="true">
          IMA2
        </div>
      </div>
    </section>
  );
}
