import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";

type WebSearchToggleProps = {
  variant?: "label" | "compact";
};

export function WebSearchToggle({ variant = "label" }: WebSearchToggleProps) {
  const { t } = useI18n();
  const webSearchEnabled = useAppStore((s) => s.webSearchEnabled);
  const setWebSearchEnabled = useAppStore((s) => s.setWebSearchEnabled);
  const label = webSearchEnabled ? t("settings.webSearch.on") : t("settings.webSearch.off");

  return (
    <button
      type="button"
      className={`web-search-toggle web-search-toggle--${variant}${webSearchEnabled ? " is-active" : ""}`}
      onClick={() => setWebSearchEnabled(!webSearchEnabled)}
      aria-pressed={webSearchEnabled}
      aria-label={label}
      title={label}
    >
      {variant === "compact" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 0 20" />
          <path d="M12 2a15.3 15.3 0 0 0 0 20" />
        </svg>
      ) : (
        <span>{label}</span>
      )}
    </button>
  );
}
