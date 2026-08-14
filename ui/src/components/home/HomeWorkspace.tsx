import { useI18n } from "../../i18n";
import { HomeHero } from "./HomeHero";
import "../../styles/home-workspace.css";

export function HomeWorkspace() {
  const { t } = useI18n();

  return (
    <section className="home-workspace" aria-label={t("nav.home")}>
      <div className="home-workspace__inner">
        <HomeHero />
      </div>
    </section>
  );
}
