import { useI18n } from "../i18n";
import { useTheme, type ThemeMode } from "../hooks/useTheme";

const MODES: ThemeMode[] = ["light", "dark", "system"];

export function ThemeToggle() {
  const { t } = useI18n();
  const { mode, setMode } = useTheme();

  return (
    <div className="lang-toggle" role="group" aria-label={t("settings.theme.label")}>
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          className={`lang-toggle__btn ${mode === m ? "is-active" : ""}`}
          onClick={() => setMode(m)}
          aria-pressed={mode === m}
          title={t(`settings.theme.${m}`)}
        >
          <span className="lang-toggle__label">{t(`settings.theme.${m}`)}</span>
        </button>
      ))}
    </div>
  );
}
