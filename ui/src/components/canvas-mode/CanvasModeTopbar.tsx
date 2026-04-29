import { CanvasZoomControl } from "./CanvasZoomControl";

interface CanvasModeTopbarProps {
  zoom: number;
  closeLabel: string;
  blankCanvasLabel: string;
  blankCanvasAriaLabel: string;
  blankCanvasShortcut: string;
  blankCanvasBusy: boolean;
  shortcutHint: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onCreateBlankCanvas: () => void;
  onClose: () => void;
}

export function CanvasModeTopbar({
  zoom,
  closeLabel,
  blankCanvasLabel,
  blankCanvasAriaLabel,
  blankCanvasShortcut,
  blankCanvasBusy,
  shortcutHint,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onCreateBlankCanvas,
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
      <div className="canvas-mode-topbar__center">
        <button
          type="button"
          className="canvas-mode-blank"
          onClick={onCreateBlankCanvas}
          disabled={blankCanvasBusy}
          aria-label={blankCanvasAriaLabel}
          title={blankCanvasAriaLabel}
        >
          <span aria-hidden="true">+</span>
          <span>{blankCanvasLabel}</span>
          <kbd>{blankCanvasShortcut}</kbd>
        </button>
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
