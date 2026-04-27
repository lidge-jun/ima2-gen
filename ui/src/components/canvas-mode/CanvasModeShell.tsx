import { useEffect, type ReactNode } from "react";
import { useAppStore } from "../../store/useAppStore";
import { useI18n } from "../../i18n";

export function CanvasModeShell({ children }: { children: ReactNode }) {
  const canvasOpen = useAppStore((s) => s.canvasOpen);
  const closeCanvas = useAppStore((s) => s.closeCanvas);
  const canvasZoom = useAppStore((s) => s.canvasZoom);
  const setCanvasZoom = useAppStore((s) => s.setCanvasZoom);
  const resetCanvasZoom = useAppStore((s) => s.resetCanvasZoom);
  const { t } = useI18n();

  useEffect(() => {
    if (!canvasOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeCanvas();
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setCanvasZoom(canvasZoom + 0.25);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setCanvasZoom(canvasZoom - 0.25);
      } else if (e.key === "0") {
        e.preventDefault();
        resetCanvasZoom();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canvasOpen, canvasZoom, closeCanvas, setCanvasZoom, resetCanvasZoom]);

  useEffect(() => {
    if (!canvasOpen) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [canvasOpen]);

  if (!canvasOpen) {
    return <>{children}</>;
  }

  return (
    <div className="canvas-mode-shell" onWheel={(e) => e.preventDefault()}>
      <div className="canvas-mode-grid" />
      <div className="canvas-mode-topbar">
        <span className="canvas-mode-topbar__label">Canvas Mode</span>
        <button
          type="button"
          className="canvas-mode-close"
          onClick={closeCanvas}
          aria-label={t("canvas.close")}
        >
          <kbd>ESC</kbd>
          <span>{t("canvas.close")}</span>
        </button>
      </div>
      <div className="canvas-mode-content">
        {children}
      </div>
    </div>
  );
}
