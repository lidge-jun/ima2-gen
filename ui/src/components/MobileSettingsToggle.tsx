import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";
import { useIsMobile } from "../hooks/useIsMobile";

function SettingsSlidersIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="4" y1="6" x2="14" y2="6" />
      <circle cx="17" cy="6" r="2.2" />
      <line x1="4" y1="12" x2="8" y2="12" />
      <circle cx="11" cy="12" r="2.2" />
      <line x1="14" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="14" y2="18" />
      <circle cx="17" cy="18" r="2.2" />
    </svg>
  );
}

export function MobileSettingsToggle() {
  const open = useAppStore((s) => s.rightPanelOpen);
  const toggle = useAppStore((s) => s.toggleRightPanel);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const uiMode = useAppStore((s) => s.uiMode);
  const { t } = useI18n();
  const isMobile = useIsMobile();

  if (!isMobile || settingsOpen || uiMode === "card-news") return null;

  const label = open ? t("panel.closeSettings") : t("panel.openSettings");

  return (
    <button
      type="button"
      className="mobile-settings-toggle"
      aria-expanded={open}
      aria-controls="right-panel-body"
      aria-label={label}
      title={label}
      onClick={toggle}
    >
      <SettingsSlidersIcon />
    </button>
  );
}
