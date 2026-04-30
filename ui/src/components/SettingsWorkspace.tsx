import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { AccountSettings } from "./AccountSettings";
import { ImageModelSelect } from "./ImageModelSelect";
import { ReasoningEffortSelect } from "./ReasoningEffortSelect";
import { WebSearchToggle } from "./WebSearchToggle";
import { LanguageToggle } from "./LanguageToggle";
import { ThemeToggle } from "./ThemeToggle";
import { HistoryStripLayoutToggle } from "./HistoryStripLayoutToggle";
import { useAppStore } from "../store/useAppStore";
import type { GalleryScope } from "../store/useAppStore";
import { useI18n } from "../i18n";
import type { SettingsSection } from "../types";

const SETTINGS_SECTIONS: SettingsSection[] = [
  "account",
  "generation",
  "appearance",
  "language",
  "future",
];

type SettingsSectionBlockProps = {
  id: SettingsSection;
  setRef: (id: SettingsSection, element: HTMLElement | null) => void;
  children: ReactNode;
};

function SettingsSectionBlock({ id, setRef, children }: SettingsSectionBlockProps) {
  const { t } = useI18n();

  return (
    <section
      id={id}
      ref={(element) => setRef(id, element)}
      className="settings-section"
      aria-labelledby={`settings-section-${id}`}
    >
      <header className="settings-section__header">
        <div>
          <h3 id={`settings-section-${id}`}>
            {t(`settings.sections.${id}.title`)}
          </h3>
          <p>{t(`settings.sections.${id}.hint`)}</p>
        </div>
      </header>
      <div className="settings-section__body">{children}</div>
    </section>
  );
}

export function SettingsWorkspace() {
  const { t } = useI18n();
  const active = useAppStore((s) => s.activeSettingsSection);
  const setActive = useAppStore((s) => s.setActiveSettingsSection);
  const closeSettings = useAppStore((s) => s.closeSettings);
  const galleryDefaultScope = useAppStore((s) => s.galleryDefaultScope);
  const setGalleryDefaultScope = useAppStore((s) => s.setGalleryDefaultScope);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const unlockTimerRef = useRef<number | null>(null);
  const isProgrammaticScroll = useRef(false);
  const sectionRefs = useRef<Record<SettingsSection, HTMLElement | null>>({
    account: null,
    generation: null,
    appearance: null,
    language: null,
    future: null,
  });

  const setSectionRef = (id: SettingsSection, element: HTMLElement | null) => {
    sectionRefs.current[id] = element;
  };

  const scrollToSection = (section: SettingsSection) => {
    setActive(section);
    isProgrammaticScroll.current = true;
    sectionRefs.current[section]?.scrollIntoView({
      behavior: "auto",
      block: "start",
    });
    if (unlockTimerRef.current !== null) {
      window.clearTimeout(unlockTimerRef.current);
    }
    unlockTimerRef.current = window.setTimeout(() => {
      isProgrammaticScroll.current = false;
      unlockTimerRef.current = null;
    }, 120);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSettings();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeSettings]);

  useEffect(() => {
    const root = workspaceRef.current;
    if (!root || typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (isProgrammaticScroll.current) return;
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = visible?.target.id as SettingsSection | undefined;
        if (id && SETTINGS_SECTIONS.includes(id)) setActive(id);
      },
      { root, threshold: [0.35, 0.6] },
    );
    for (const section of SETTINGS_SECTIONS) {
      const element = sectionRefs.current[section];
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [setActive]);

  useEffect(() => {
    return () => {
      if (unlockTimerRef.current !== null) {
        window.clearTimeout(unlockTimerRef.current);
      }
    };
  }, []);

  return (
    <main
      ref={workspaceRef}
      className="settings-workspace"
      aria-labelledby="settings-title"
    >
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
          <nav className="settings-nav settings-nav--mobile" aria-label={t("settings.navAria")}>
            <select
              value={active}
              onChange={(e) => scrollToSection(e.target.value as SettingsSection)}
              aria-label={t("settings.navAria")}
            >
              {SETTINGS_SECTIONS.map((section) => (
                <option key={section} value={section}>
                  {t(`settings.sections.${section}.title`)}
                </option>
              ))}
            </select>
          </nav>
          <nav className="settings-nav" aria-label={t("settings.navAria")}>
            {SETTINGS_SECTIONS.map((section) => (
              <button
                key={section}
                type="button"
                className={`settings-nav__item${active === section ? " is-active" : ""}`}
                onClick={() => scrollToSection(section)}
                aria-label={t("settings.jumpTo", {
                  section: t(`settings.sections.${section}.title`),
                })}
              >
                <span>{t(`settings.sections.${section}.title`)}</span>
                <small>{t(`settings.sections.${section}.hint`)}</small>
              </button>
            ))}
          </nav>

          <section className="settings-content" aria-label={t("settings.contentAria")}>
            <SettingsSectionBlock id="account" setRef={setSectionRef}>
              <AccountSettings />
            </SettingsSectionBlock>

            <SettingsSectionBlock id="generation" setRef={setSectionRef}>
              <article className="settings-row">
                <div className="settings-row__copy">
                  <h4>{t("settings.imageModel.title")}</h4>
                  <p>{t("settings.imageModel.body")}</p>
                  <p className="settings-row__microcopy">
                    {t("settings.imageModel.unsupportedHelp")}
                  </p>
                </div>
                <div className="settings-row__control">
                  <ImageModelSelect variant="settings" />
                </div>
              </article>
              <article className="settings-row">
                <div className="settings-row__copy">
                  <h4>{t("settings.reasoning.title")}</h4>
                  <p>{t("settings.reasoning.body")}</p>
                </div>
                <div className="settings-row__control">
                  <ReasoningEffortSelect />
                </div>
              </article>
              <article className="settings-row">
                <div className="settings-row__copy">
                  <h4>{t("settings.webSearch.title")}</h4>
                  <p>{t("settings.webSearch.body")}</p>
                </div>
                <div className="settings-row__control">
                  <WebSearchToggle />
                </div>
              </article>
              <article className="settings-row">
                <div className="settings-row__copy">
                  <h4>{t("settings.gallery.defaultScopeTitle")}</h4>
                  <p>{t("settings.gallery.defaultScopeBody")}</p>
                </div>
                <div className="settings-row__control">
                  <select
                    value={galleryDefaultScope}
                    onChange={(e) =>
                      setGalleryDefaultScope(e.target.value as GalleryScope)
                    }
                    aria-label={t("settings.gallery.defaultScopeTitle")}
                  >
                    <option value="current-session">{t("gallery.scope.current")}</option>
                    <option value="all">{t("gallery.scope.all")}</option>
                  </select>
                </div>
              </article>
            </SettingsSectionBlock>

            <SettingsSectionBlock id="appearance" setRef={setSectionRef}>
              <article className="settings-row">
                <div className="settings-row__copy">
                  <h4>{t("settings.appearance.themeTitle")}</h4>
                  <p>{t("settings.appearance.themeBody")}</p>
                </div>
                <div className="settings-row__control">
                  <ThemeToggle />
                </div>
              </article>
              <article className="settings-row">
                <div className="settings-row__copy">
                  <h4>{t("settings.appearance.historyStripLayoutTitle")}</h4>
                  <p>{t("settings.appearance.historyStripLayoutBody")}</p>
                </div>
                <div className="settings-row__control">
                  <HistoryStripLayoutToggle />
                </div>
              </article>
            </SettingsSectionBlock>

            <SettingsSectionBlock id="language" setRef={setSectionRef}>
              <article className="settings-row">
                <div className="settings-row__copy">
                  <h4>{t("settings.language.title")}</h4>
                  <p>{t("settings.language.body")}</p>
                </div>
                <div className="settings-row__control">
                  <LanguageToggle />
                </div>
              </article>
            </SettingsSectionBlock>

            <SettingsSectionBlock id="future" setRef={setSectionRef}>
              <article className="settings-note">
                <h4>{t("settings.future.title")}</h4>
                <p>{t("settings.future.body")}</p>
              </article>
            </SettingsSectionBlock>
          </section>
        </div>
      </div>
    </main>
  );
}
