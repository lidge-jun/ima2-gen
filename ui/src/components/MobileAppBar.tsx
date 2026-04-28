import { useAppStore } from "../store/useAppStore";
import { ImageModelSelect } from "./ImageModelSelect";
import { useI18n } from "../i18n";
import { useIsMobile } from "../hooks/useIsMobile";
import { ENABLE_CARD_NEWS_MODE, ENABLE_NODE_MODE } from "../lib/devMode";

export function MobileAppBar() {
  const { t } = useI18n();
  const openComposeSheet = useAppStore((s) => s.openComposeSheet);
  const toggleSettings = useAppStore((s) => s.toggleSettings);
  const togglePromptLibrary = useAppStore((s) => s.togglePromptLibrary);
  const promptLibraryOpen = useAppStore((s) => s.promptLibraryOpen);
  const rightPanelOpen = useAppStore((s) => s.rightPanelOpen);
  const toggleRightPanel = useAppStore((s) => s.toggleRightPanel);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const uiModeRaw = useAppStore((s) => s.uiMode);
  const uiMode =
    uiModeRaw === "card-news" && ENABLE_CARD_NEWS_MODE ? "card-news" :
      uiModeRaw === "node" && ENABLE_NODE_MODE ? "node" :
        "classic";
  const isMobile = useIsMobile();

  if (!isMobile || settingsOpen || uiMode !== "classic") return null;

  const openPromptLibrary = () => {
    if (!promptLibraryOpen && !rightPanelOpen) toggleRightPanel();
    togglePromptLibrary();
  };

  return (
    <header className="mobile-app-bar" role="banner">
      <div className="mobile-app-bar__brand">
        <div className="logo-mark" aria-hidden="true" />
        <span className="mobile-app-bar__title">ima2-gen</span>
      </div>
      <div className="mobile-app-bar__actions">
        <ImageModelSelect variant="sidebar" />
        <button
          type="button"
          className="mobile-app-bar__icon-button"
          onClick={openPromptLibrary}
          aria-label={t("promptLibrary.title")}
          title={t("promptLibrary.title")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>
        <button
          type="button"
          className="mobile-app-bar__icon-button"
          onClick={() => toggleSettings()}
          aria-label={t("appBar.settings")}
          title={t("appBar.settings")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        <button
          type="button"
          className="mobile-app-bar__compose"
          onClick={openComposeSheet}
          aria-label={t("appBar.compose")}
        >
          {t("appBar.compose")}
        </button>
      </div>
    </header>
  );
}
