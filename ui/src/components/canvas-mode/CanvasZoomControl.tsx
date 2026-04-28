import { useI18n } from "../../i18n";

interface CanvasZoomControlProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

export function CanvasZoomControl({
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: CanvasZoomControlProps) {
  const { t } = useI18n();
  const percent = Math.round(zoom * 100);
  return (
    <div className="canvas-toolbar__zoom" role="group" aria-label={t("canvas.toolbar.zoomGroup")}>
      <button
        type="button"
        className="canvas-toolbar__zoom-button"
        onClick={onZoomOut}
        aria-label={t("canvas.toolbar.zoomOut")}
        title={t("canvas.toolbar.zoomOut")}
      >
        <MinusIcon />
      </button>
      <button
        type="button"
        className="canvas-toolbar__zoom-value"
        onClick={onZoomReset}
        aria-label={t("canvas.toolbar.zoomReset")}
        title={t("canvas.toolbar.zoomReset")}
      >
        {percent}%
      </button>
      <button
        type="button"
        className="canvas-toolbar__zoom-button"
        onClick={onZoomIn}
        aria-label={t("canvas.toolbar.zoomIn")}
        title={t("canvas.toolbar.zoomIn")}
      >
        <PlusIcon />
      </button>
    </div>
  );
}

function MinusIcon() {
  return (
    <svg className="canvas-toolbar__icon canvas-toolbar__icon--small" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="canvas-toolbar__icon canvas-toolbar__icon--small" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}
