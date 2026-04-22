import { useAppStore } from "../store/useAppStore";

export function ModeTabs() {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);

  return (
    <div className="mode-tabs">
      <button
        type="button"
        className={`mode-tab${mode === "t2i" ? " active" : ""}`}
        onClick={() => setMode("t2i")}
      >
        Text to Image
      </button>
      <button
        type="button"
        className={`mode-tab${mode === "i2i" ? " active" : ""}`}
        onClick={() => setMode("i2i")}
      >
        Image to Image
      </button>
    </div>
  );
}
