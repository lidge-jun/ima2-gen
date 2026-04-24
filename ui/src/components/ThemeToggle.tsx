import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";
import type { ThemePreference } from "../types";

const THEME_OPTIONS: ThemePreference[] = ["system", "dark", "light"];

export function ThemeToggle() {
  const { t } = useI18n();
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  return (
    <div className="theme-toggle" role="group" aria-label={t("theme.label")}>
      {THEME_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          className={`theme-toggle__btn ${theme === option ? "is-active" : ""}`}
          onClick={() => setTheme(option)}
          aria-pressed={theme === option}
          title={t(`theme.${option}`)}
        >
          {t(`theme.${option}`)}
        </button>
      ))}
    </div>
  );
}
