import { UIModeSwitch } from "./UIModeSwitch";
import { PromptComposer } from "./PromptComposer";
import { GenerateButton } from "./GenerateButton";
import { InFlightList } from "./InFlightList";
import { SessionPicker } from "./SessionPicker";
import { NodeStyleButton } from "./NodeStyleButton";
import { SettingsButton } from "./SettingsButton";
import { ImageModelSelect } from "./ImageModelSelect";
import { CardNewsComposer } from "./card-news/CardNewsComposer";
import { useAppStore } from "../store/useAppStore";
import { ENABLE_CARD_NEWS_MODE, ENABLE_NODE_MODE } from "../lib/devMode";
import { useI18n } from "../i18n";

export function Sidebar() {
  const { t } = useI18n();
  const uiModeRaw = useAppStore((s) => s.uiMode);
  const referenceImages = useAppStore((s) => s.referenceImages);
  const clearReferences = useAppStore((s) => s.clearReferences);
  const styleSheetEnabled = useAppStore((s) => s.styleSheetEnabled);
  const uiMode =
    uiModeRaw === "card-news" && ENABLE_CARD_NEWS_MODE ? "card-news" :
      uiModeRaw === "node" && ENABLE_NODE_MODE ? "node" :
        "classic";
  return (
    <aside className="sidebar">
      <div className="sidebar__scroll">
        <div className="logo">
          <div className="logo-mark" aria-hidden="true" />
          <div className="logo-copy">
            <div className="logo-title">ima2-gen</div>
            <div className="logo-subtitle">gpt-image-2 studio</div>
          </div>
          <div className="logo-actions">
            <PromptLibraryButton />
            <ImageModelSelect variant="sidebar" />
            <SettingsButton />
          </div>
        </div>
        <UIModeSwitch />
        {uiMode === "classic" ? (
          <>
            <PromptComposer />
            <GenerateButton />
            <InFlightList />
          </>
        ) : uiMode === "card-news" ? (
          <>
            <CardNewsComposer />
          </>
        ) : (
          <>
            <SessionPicker />
            <NodeStyleButton />
            {referenceImages.length > 0 ? (
              <div className="node-mode-ref-warning" role="status">
                <strong>{t("node.classicRefsParkedTitle")}</strong>
                <span>{t("node.classicRefsParkedBody")}</span>
                <button type="button" onClick={clearReferences}>
                  {t("node.clearParkedRefs")}
                </button>
              </div>
            ) : null}
            {styleSheetEnabled ? (
              <div className="node-mode-style-badge" role="status">
                {t("node.styleSheetActive")}
              </div>
            ) : null}
            <div className="sidebar__node-hint">
              {t("sidebar.nodeModeHint")}
            </div>
            <InFlightList />
          </>
        )}
      </div>
    </aside>
  );
}

function PromptLibraryButton() {
  const { t } = useI18n();
  const toggle = useAppStore((s) => s.togglePromptLibrary);
  return (
    <button
      type="button"
      className="settings-button"
      onClick={toggle}
      title={t("promptLibrary.title")}
      aria-label={t("promptLibrary.title")}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}
