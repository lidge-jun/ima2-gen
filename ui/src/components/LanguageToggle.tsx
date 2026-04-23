import { useAppStore } from "../store/useAppStore";
import { useI18n, SUPPORTED_LOCALES, type Locale } from "../i18n";

const LABEL: Record<Locale, string> = { ko: "KO", en: "EN" };

export function LanguageToggle() {
  const { t, locale } = useI18n();
  const setLocale = useAppStore((s) => s.setLocale);

  return (
    <div className="lang-toggle" role="group" aria-label={t("language.label")}>
      {SUPPORTED_LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          className={`lang-toggle__btn ${locale === l ? "is-active" : ""}`}
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          title={t(`language.${l}`)}
        >
          <span className="lang-toggle__label">{LABEL[l]}</span>
        </button>
      ))}
    </div>
  );
}
