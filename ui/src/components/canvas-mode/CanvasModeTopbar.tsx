import { CanvasZoomControl } from "./CanvasZoomControl";

interface CanvasModeTopbarProps {
  zoom: number;
  closeLabel: string;
  shortcutHint: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onClose: () => void;
}

export function CanvasModeTopbar({
  zoom,
  closeLabel,
  shortcutHint,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onClose,
}: CanvasModeTopbarProps) {
  return (
    <div className="canvas-mode-topbar">
      <div className="canvas-mode-topbar__stack">
        <span className="canvas-mode-topbar__label">Canvas Mode</span>
        <CanvasZoomControl
          zoom={zoom}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onZoomReset={onZoomReset}
        />
        <span className="canvas-mode-topbar__shortcuts">{shortcutHint}</span>
      </div>
      <button
        type="button"
        className="canvas-mode-close"
        onClick={onClose}
        aria-label={closeLabel}
      >
        <kbd>ESC</kbd>
        <span>{closeLabel}</span>
      </button>
    </div>
  );
}
