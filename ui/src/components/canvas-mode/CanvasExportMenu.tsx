import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useI18n } from "../../i18n";
import type { CanvasExportFormat } from "../../lib/canvas/exportRenderer";

const FORMATS: CanvasExportFormat[] = ["png", "svg", "pptx"];

/**
 * Export format picker for the canvas toolbar.
 *
 * Follows the WAI-ARIA menu-button pattern: arrow/Home/End move between items, Escape
 * closes and returns focus to the trigger, and the open state is announced. The toolbar
 * is dense, so the trigger keeps a 44px hit box per the touch-target rule.
 */
export function CanvasExportMenu({
  onExport,
  disabled,
  isExporting,
}: {
  onExport: (format: CanvasExportFormat) => void;
  disabled: boolean;
  isExporting: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? []);
    window.requestAnimationFrame(() => items()[0]?.focus());

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? []);
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "Home" ? 0
      : event.key === "End" ? items.length - 1
      : current < 0 ? 0
      : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div className="canvas-export-menu">
      <button
        ref={triggerRef}
        type="button"
        className={`canvas-toolbar__button${isExporting ? " canvas-toolbar__button--busy" : ""}`}
        onClick={() => setOpen((value) => !value)}
        disabled={disabled || isExporting}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-busy={isExporting || undefined}
        aria-label={t("canvas.toolbar.export")}
        title={t("canvas.toolbar.export")}
      >
        <DownloadGlyph />
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          className="canvas-export-menu__list"
          aria-label={t("canvas.toolbar.exportFormat")}
          onKeyDown={onMenuKeyDown}
        >
          {FORMATS.map((format) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              className="canvas-export-menu__item"
              onClick={() => {
                close(true);
                onExport(format);
              }}
            >
              {t(`canvas.toolbar.exportAs.${format}`)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DownloadGlyph() {
  return (
    // Same geometry and class as the other toolbar glyphs so stroke width, size and
    // color stay consistent across the bar.
    <svg className="canvas-toolbar__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 4v11" />
      <path d="m8 11 4 4 4-4" />
      <path d="M5 20h14" />
    </svg>
  );
}
