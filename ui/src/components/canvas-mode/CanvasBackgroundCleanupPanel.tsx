import { useEffect, useRef, useState } from "react";
import type { BackgroundRemovalStats } from "../../lib/canvas/backgroundRemoval";
import type {
  CanvasBackgroundCleanupIntent,
  CanvasBackgroundCleanupTool,
} from "../../types/canvas";
import { useI18n } from "../../i18n";
import { SegmentedControl } from "./SegmentedControl";

interface CanvasBackgroundCleanupPanelProps {
  seedCount: number;
  tolerance: number;
  stats: BackgroundRemovalStats | null;
  hasPreview: boolean;
  isPickingSeed: boolean;
  intent: CanvasBackgroundCleanupIntent;
  tool: CanvasBackgroundCleanupTool;
  brushRadius: number;
  isPreviewing: boolean;
  isApplying: boolean;
  keepOpen?: boolean;
  disabled?: boolean;
  onAutoSample: () => void;
  onPickSeed: () => void;
  onIntentChange: (intent: CanvasBackgroundCleanupIntent) => void;
  onToolChange: (tool: CanvasBackgroundCleanupTool) => void;
  onBrushRadiusChange: (value: number) => void;
  onToleranceChange: (value: number) => void;
  onPreview: () => void;
  onApply: () => void;
  onReset: () => void;
}

export function CanvasBackgroundCleanupPanel({
  seedCount,
  tolerance,
  stats,
  hasPreview,
  isPickingSeed,
  intent,
  tool,
  brushRadius,
  isPreviewing,
  isApplying,
  keepOpen,
  disabled,
  onAutoSample,
  onPickSeed,
  onIntentChange,
  onToolChange,
  onBrushRadiusChange,
  onToleranceChange,
  onPreview,
  onApply,
  onReset,
}: CanvasBackgroundCleanupPanelProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const removed = stats ? Math.round(stats.removedPercent * 1000) / 10 : 0;
  const active = isPickingSeed || tool === "brush";

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (keepOpen) return;
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [keepOpen, open]);

  return (
    <div className="canvas-toolbar__cleanup" ref={ref}>
      <button
        type="button"
        className={`canvas-toolbar__button${open || hasPreview ? " canvas-toolbar__button--active" : ""}`}
        onClick={() => setOpen((value) => !value)}
        disabled={disabled}
        aria-expanded={open}
        aria-label={t("canvas.toolbar.cleanup")}
        title={t("canvas.toolbar.cleanup")}
      >
        <CleanupIcon />
      </button>
      {open ? (
        <div className="canvas-toolbar__cleanup-panel" role="group" aria-label={t("canvas.toolbar.cleanup")}>
          <div className="canvas-toolbar__cleanup-row">
            <span className="canvas-toolbar__cleanup-title">{t("canvas.toolbar.cleanup")}</span>
            <span className="canvas-toolbar__cleanup-meta">
              {t("canvas.toolbar.cleanupSeedCount", { n: seedCount })}
            </span>
          </div>
          <SegmentedControl
            label={t("canvas.toolbar.cleanupMark")}
            value={intent}
            options={[
              { value: "remove", label: t("canvas.toolbar.cleanupRemove") },
              { value: "preserve", label: t("canvas.toolbar.cleanupPreserve") },
            ]}
            onChange={onIntentChange}
          />
          <SegmentedControl
            label={t("canvas.toolbar.cleanupInput")}
            value={tool}
            options={[
              { value: "click", label: t("canvas.toolbar.cleanupClick") },
              { value: "brush", label: t("canvas.toolbar.cleanupBrush") },
            ]}
            onChange={onToolChange}
          />
          <label className="canvas-toolbar__cleanup-slider">
            <span>{t("canvas.toolbar.cleanupTolerance")}</span>
            <input
              type="range"
              min="0"
              max="96"
              value={tolerance}
              onChange={(event) => onToleranceChange(Number(event.target.value))}
            />
            <output>{tolerance}</output>
          </label>
          {tool === "brush" ? (
            <label className="canvas-toolbar__cleanup-slider">
              <span>{t("canvas.toolbar.cleanupBrushSize")}</span>
              <input
                type="range"
                min="0.006"
                max="0.06"
                step="0.002"
                value={brushRadius}
                onChange={(event) => onBrushRadiusChange(Number(event.target.value))}
              />
              <output>{Math.round(brushRadius * 1000)}</output>
            </label>
          ) : null}
          <div className="canvas-toolbar__cleanup-actions">
            <button type="button" onClick={onAutoSample}>
              {t("canvas.toolbar.cleanupAutoSample")}
            </button>
            <button
              type="button"
              className={isPickingSeed ? "active" : ""}
              onClick={onPickSeed}
            >
              {active ? t("canvas.toolbar.cleanupActive") : t("canvas.toolbar.cleanupPickSeed")}
            </button>
          </div>
          <div className="canvas-toolbar__cleanup-actions">
            <button type="button" onClick={onPreview} disabled={isPreviewing || seedCount === 0}>
              {isPreviewing ? t("canvas.toolbar.cleanupPreviewing") : t("canvas.toolbar.cleanupPreview")}
            </button>
            <button type="button" onClick={onApply} disabled={isApplying || (!hasPreview && seedCount === 0)}>
              {isApplying ? t("canvas.toolbar.cleanupApplying") : t("canvas.toolbar.cleanupApply")}
            </button>
            <button type="button" onClick={onReset} disabled={!hasPreview && seedCount === 0}>
              {t("canvas.toolbar.cleanupReset")}
            </button>
          </div>
          {active ? (
            <div className="canvas-toolbar__cleanup-status canvas-toolbar__cleanup-status--active">
              {tool === "brush" ? t("canvas.toolbar.cleanupBrushHint") : t("canvas.toolbar.cleanupPickHint")}
            </div>
          ) : stats && !hasPreview ? (
            <div className="canvas-toolbar__cleanup-status canvas-toolbar__cleanup-status--active">
              {t("canvas.toolbar.cleanupMaskHint")}
            </div>
          ) : null}
          {stats ? (
            <div className="canvas-toolbar__cleanup-status">
              {t("canvas.toolbar.cleanupRemoved", { n: removed })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CleanupIcon() {
  return (
    <svg className="canvas-toolbar__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7.5h14" />
      <path d="M7 12h10" />
      <path d="M10 16.5h4" />
      <path d="M7.5 5.5 9 4l1.5 1.5L9 7 7.5 5.5Z" />
      <path d="M13.5 11 15 9.5l1.5 1.5L15 12.5 13.5 11Z" />
      <path d="M4.5 15.5 6 14l1.5 1.5L6 17 4.5 15.5Z" />
    </svg>
  );
}
