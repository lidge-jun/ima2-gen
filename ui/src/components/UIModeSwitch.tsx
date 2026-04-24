import { useAppStore } from "../store/useAppStore";
import { ENABLE_NODE_MODE } from "../lib/devMode";
import { useI18n } from "../i18n";

export function UIModeSwitch() {
  const { t } = useI18n();
  const uiMode = useAppStore((s) => s.uiMode);
  const setUIMode = useAppStore((s) => s.setUIMode);

  if (!ENABLE_NODE_MODE) return null;

  return (
    <div className="ui-mode-switch" role="tablist" aria-label={t("uiMode.ariaLabel")}>
      <button
        type="button"
        role="tab"
        aria-selected={uiMode === "classic"}
        className={`ui-mode-switch__tab${uiMode === "classic" ? " active" : ""}`}
        onClick={() => setUIMode("classic")}
      >
        {t("uiMode.classic")}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={uiMode === "node"}
        className={`ui-mode-switch__tab${uiMode === "node" ? " active" : ""}`}
        onClick={() => setUIMode("node")}
      >
        {t("uiMode.node")}
      </button>
    </div>
  );
}
