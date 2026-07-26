import { useI18n } from "../../i18n";
import { getGalleryItemKey } from "../../lib/galleryNavigation";
import { useAppStore } from "../../store/useAppStore";

export function HomeRecentRow() {
  const history = useAppStore((state) => state.history);
  const { t } = useI18n();
  const recent = history.slice(0, 8);

  if (recent.length === 0) {
    return <p className="home-recent-empty" role="status">{t("history.emptyRecent")}</p>;
  }

  return (
    <div className="home-recent-row" role="list" aria-label={t("home.recentTitle")}>
      {recent.map((item) => (
        <div key={getGalleryItemKey(item)} className="home-recent-card" role="listitem">
          <img
            src={item.thumb || item.url || item.image}
            alt={item.prompt?.slice(0, 60) ?? ""}
            loading="lazy"
            decoding="async"
          />
        </div>
      ))}
    </div>
  );
}
