import { useAppStore } from "../store/useAppStore";
import { IS_DEV_UI } from "../lib/devMode";

export function UIModeSwitch() {
  const uiMode = useAppStore((s) => s.uiMode);
  const setUIMode = useAppStore((s) => s.setUIMode);

  if (!IS_DEV_UI) return null;

  return (
    <div className="ui-mode-switch" role="tablist" aria-label="UI 모드">
      <button
        type="button"
        role="tab"
        aria-selected={uiMode === "classic"}
        className={`ui-mode-switch__tab${uiMode === "classic" ? " active" : ""}`}
        onClick={() => setUIMode("classic")}
      >
        기본
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={uiMode === "node"}
        className={`ui-mode-switch__tab${uiMode === "node" ? " active" : ""}`}
        onClick={() => setUIMode("node")}
      >
        노드
      </button>
    </div>
  );
}
