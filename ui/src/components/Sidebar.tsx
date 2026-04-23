import { ProviderSelect } from "./ProviderSelect";
import { UIModeSwitch } from "./UIModeSwitch";
import { PromptComposer } from "./PromptComposer";
import { GenerateButton } from "./GenerateButton";
import { InFlightList } from "./InFlightList";
import { HistoryStrip } from "./HistoryStrip";
import { SessionPicker } from "./SessionPicker";
import { StyleSheetPanel } from "./StyleSheetPanel";
import { LanguageToggle } from "./LanguageToggle";
import { useAppStore } from "../store/useAppStore";
import { IS_DEV_UI } from "../lib/devMode";
import { useI18n } from "../i18n";

export function Sidebar() {
  const { t } = useI18n();
  const uiModeRaw = useAppStore((s) => s.uiMode);
  const uiMode = IS_DEV_UI ? uiModeRaw : "classic";
  return (
    <aside className="sidebar">
      <div className="sidebar__scroll">
        <div className="logo">
          <div className="logo-mark" aria-hidden="true" />
          <div className="logo-copy">
            <div className="logo-title">ima2-gen</div>
            <div className="logo-subtitle">gpt-image-2 studio</div>
          </div>
          <LanguageToggle />
        </div>
        <UIModeSwitch />
        {uiMode === "classic" ? (
          <>
            <ProviderSelect />
            <PromptComposer />
            <StyleSheetPanel />
            <GenerateButton />
            <InFlightList />
          </>
        ) : (
          <>
            <SessionPicker />
            <StyleSheetPanel />
            <div className="sidebar__node-hint">
              {t("sidebar.nodeModeHint")}
            </div>
            <InFlightList />
          </>
        )}
      </div>
      <HistoryStrip />
    </aside>
  );
}
