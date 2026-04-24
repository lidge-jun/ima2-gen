import { UIModeSwitch } from "./UIModeSwitch";
import { PromptComposer } from "./PromptComposer";
import { GenerateButton } from "./GenerateButton";
import { InFlightList } from "./InFlightList";
import { HistoryStrip } from "./HistoryStrip";
import { SessionPicker } from "./SessionPicker";
import { NodeStyleButton } from "./NodeStyleButton";
import { SettingsButton } from "./SettingsButton";
import { useAppStore } from "../store/useAppStore";
import { ENABLE_NODE_MODE } from "../lib/devMode";
import { useI18n } from "../i18n";

export function Sidebar() {
  const { t } = useI18n();
  const uiModeRaw = useAppStore((s) => s.uiMode);
  const referenceImages = useAppStore((s) => s.referenceImages);
  const clearReferences = useAppStore((s) => s.clearReferences);
  const styleSheetEnabled = useAppStore((s) => s.styleSheetEnabled);
  const uiMode = ENABLE_NODE_MODE ? uiModeRaw : "classic";
  return (
    <aside className="sidebar">
      <div className="sidebar__scroll">
        <div className="logo">
          <div className="logo-mark" aria-hidden="true" />
          <div className="logo-copy">
            <div className="logo-title">ima2-gen</div>
            <div className="logo-subtitle">gpt-image-2 studio</div>
          </div>
          <SettingsButton />
        </div>
        <UIModeSwitch />
        {uiMode === "classic" ? (
          <>
            <PromptComposer />
            <GenerateButton />
            <InFlightList />
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
      <HistoryStrip />
    </aside>
  );
}
