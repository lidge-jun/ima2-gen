import { useEffect } from "react";
import { AccountSettings } from "./AccountSettings";
import { LanguageToggle } from "./LanguageToggle";
import { ThemeToggle } from "./ThemeToggle";
import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";
import type { SettingsSection } from "../types";

const SETTINGS_SECTIONS: SettingsSection[] = [
  "account",
  "appearance",
  "language",
  "future",
];

export function SettingsWorkspace() {
  const { t } = useI18n();
  const active = useAppStore((s) => s.activeSettingsSection);
  const setActive = useAppStore((s) => s.setActiveSettingsSection);
  const closeSettings = useAppStore((s) => s.closeSettings);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSettings();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeSettings]);

  return (
    <main className="settings-workspace" aria-labelledby="settings-title">
      <div className="settings-shell">
        <header className="settings-header">
          <div>
            <p className="settings-eyebrow">{t("settings.eyebrow")}</p>
            <h2 id="settings-title">{t("settings.title")}</h2>
            <p>{t("settings.subtitle")}</p>
          </div>
          <button
            type="button"
            className="settings-close"
            onClick={closeSettings}
            aria-label={t("settings.closeAria")}
            title={t("settings.closeTitle")}
          >
            X
          </button>
        </header>

        <div className="settings-layout">
          <nav className="settings-nav" aria-label={t("settings.navAria")}>
            {SETTINGS_SECTIONS.map((section) => (
              <button
                key={section}
                type="button"
                className={`settings-nav__item${active === section ? " is-active" : ""}`}
                onClick={() => setActive(section)}
              >
                <span>{t(`settings.sections.${section}.title`)}</span>
                <small>{t(`settings.sections.${section}.hint`)}</small>
              </button>
            ))}
          </nav>

          <section className="settings-content" aria-live="polite">
            {active === "account" ? <AccountSettings /> : null}
            {active === "appearance" ? (
              <div className="settings-stack">
                <article className="settings-card">
                  <h3>{t("settings.appearance.themeTitle")}</h3>
                  <p>{t("settings.appearance.themeBody")}</p>
                  <ThemeToggle />
                </article>
              </div>
            ) : null}
            {active === "language" ? (
              <div className="settings-stack">
                <article className="settings-card">
                  <h3>{t("settings.language.title")}</h3>
                  <p>{t("settings.language.body")}</p>
                  <LanguageToggle />
                </article>
              </div>
            ) : null}
            {active === "future" ? (
              <div className="settings-stack">
                <article className="settings-card settings-card--muted">
                  <h3>{t("settings.future.title")}</h3>
                  <p>{t("settings.future.body")}</p>
                </article>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
