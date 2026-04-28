import { useEffect, useRef, useState } from "react";
import type { CanvasAnnotationStyle } from "../../types/canvas";
import { CANVAS_STROKE_WIDTHS, CANVAS_STYLE_COLORS } from "../../hooks/useCanvasAnnotations";
import { useI18n } from "../../i18n";

interface CanvasStylePopoverProps {
  style: CanvasAnnotationStyle;
  onStyleChange: (style: CanvasAnnotationStyle) => void;
}

export function CanvasStylePopover({ style, onStyleChange }: CanvasStylePopoverProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [open]);

  return (
    <div
      ref={ref}
      className={`canvas-toolbar__split-button${open ? " canvas-toolbar__split-button--active" : ""}`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="canvas-toolbar__button canvas-toolbar__style-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("canvas.toolbar.style")}
        title={t("canvas.toolbar.style")}
      >
        <span
          className="canvas-style-trigger__swatch"
          style={{ background: style.color }}
          aria-hidden="true"
        />
        <span
          className="canvas-style-trigger__width"
          style={{ height: `${Math.min(8, Math.max(2, style.strokeWidth))}px` }}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="canvas-style-popover" role="dialog" aria-label={t("canvas.toolbar.style")}>
          <div
            className="canvas-style-popover__row"
            role="group"
            aria-label={t("canvas.toolbar.color")}
          >
            {CANVAS_STYLE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`canvas-style-swatch${style.color === color ? " canvas-style-swatch--active" : ""}`}
                style={{ background: color }}
                onClick={() => onStyleChange({ ...style, color })}
                aria-pressed={style.color === color}
                aria-label={color}
                title={color}
              />
            ))}
          </div>
          <div
            className="canvas-style-popover__row"
            role="group"
            aria-label={t("canvas.toolbar.strokeWidth")}
          >
            {CANVAS_STROKE_WIDTHS.map((width) => (
              <button
                key={width}
                type="button"
                className={`canvas-style-width${style.strokeWidth === width ? " canvas-style-width--active" : ""}`}
                onClick={() => onStyleChange({ ...style, strokeWidth: width })}
                aria-pressed={style.strokeWidth === width}
                aria-label={`${width}px`}
                title={`${width}px`}
              >
                <span style={{ height: `${width}px`, background: style.color }} />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
