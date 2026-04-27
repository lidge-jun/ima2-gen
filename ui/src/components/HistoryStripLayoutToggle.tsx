import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";
import type { HistoryStripLayout } from "../types";

const OPTIONS: HistoryStripLayout[] = ["rail", "horizontal", "sidebar"];

export function HistoryStripLayoutToggle() {
  const { t } = useI18n();
  const layout = useAppStore((s) => s.historyStripLayout);
  const setLayout = useAppStore((s) => s.setHistoryStripLayout);

  return (
    <div
      className="history-layout-toggle"
      role="group"
      aria-label={t("settings.appearance.historyStripLayoutTitle")}
    >
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          className={`history-layout-toggle__btn ${layout === option ? "is-active" : ""}`}
          onClick={() => setLayout(option)}
          aria-pressed={layout === option}
          title={t(`settings.appearance.historyStripLayout.${option}`)}
        >
          {t(`settings.appearance.historyStripLayout.${option}`)}
        </button>
      ))}
    </div>
  );
}
