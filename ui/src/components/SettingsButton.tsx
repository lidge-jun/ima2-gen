import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";

export function SettingsButton() {
  const { t } = useI18n();
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const toggleSettings = useAppStore((s) => s.toggleSettings);

  return (
    <button
      type="button"
      className={`settings-button${settingsOpen ? " is-active" : ""}`}
      onClick={toggleSettings}
      aria-label={t("settings.openAria")}
      aria-pressed={settingsOpen}
      title={t("settings.openTitle")}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Zm0 5.7a1.9 1.9 0 1 1 0-3.8 1.9 1.9 0 0 1 0 3.8Z" />
        <path d="m20.3 13.4.1-1.4-.1-1.4-2.2-.5a6.9 6.9 0 0 0-.6-1.3l1.2-1.9a9.6 9.6 0 0 0-2-2l-1.9 1.2c-.4-.2-.9-.4-1.3-.6L13 3.3a9.5 9.5 0 0 0-2.8 0l-.5 2.2c-.5.2-.9.3-1.3.6L6.5 4.9a9.6 9.6 0 0 0-2 2l1.2 1.9c-.2.4-.4.9-.6 1.3l-2.2.5a9.5 9.5 0 0 0 0 2.8l2.2.5c.2.5.3.9.6 1.3l-1.2 1.9a9.6 9.6 0 0 0 2 2l1.9-1.2c.4.2.9.4 1.3.6l.5 2.2a9.5 9.5 0 0 0 2.8 0l.5-2.2c.5-.2.9-.3 1.3-.6l1.9 1.2a9.6 9.6 0 0 0 2-2l-1.2-1.9c.2-.4.4-.9.6-1.3l2.2-.5Z" />
      </svg>
    </button>
  );
}
