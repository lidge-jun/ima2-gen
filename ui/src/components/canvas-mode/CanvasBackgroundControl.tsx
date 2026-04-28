import type { CanvasExportBackground, HexColor } from "../../types/canvas";
import { useI18n } from "../../i18n";

interface CanvasBackgroundControlProps {
  mode: CanvasExportBackground;
  matteColor: HexColor;
  onModeChange: (mode: CanvasExportBackground) => void;
  onMatteColorChange: (color: HexColor) => void;
}

export function CanvasBackgroundControl({
  mode,
  matteColor,
  onModeChange,
  onMatteColorChange,
}: CanvasBackgroundControlProps) {
  const { t } = useI18n();
  return (
    <div className="canvas-toolbar__bg" role="group" aria-label={t("canvas.toolbar.bgGroup")}>
      <button
        type="button"
        className={`canvas-toolbar__bg-tab${mode === "alpha" ? " active" : ""}`}
        onClick={() => onModeChange("alpha")}
      >
        {t("canvas.toolbar.bgAlpha")}
      </button>
      <button
        type="button"
        className={`canvas-toolbar__bg-tab${mode === "matte" ? " active" : ""}`}
        onClick={() => onModeChange("matte")}
      >
        {t("canvas.toolbar.bgMatte")}
      </button>
      {mode === "matte" ? (
        <input
          type="color"
          aria-label={t("canvas.toolbar.bgMatteColor")}
          value={matteColor}
          onChange={(event) => onMatteColorChange(event.target.value as HexColor)}
        />
      ) : null}
    </div>
  );
}
