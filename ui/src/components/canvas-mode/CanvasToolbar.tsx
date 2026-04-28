import { useEffect, useRef, useState } from "react";
import type {
  CanvasAnnotationStyle,
  CanvasEraserMode,
  CanvasExportBackground,
  CanvasTool,
  HexColor,
} from "../../types/canvas";
import { useI18n } from "../../i18n";
import { CanvasStylePopover } from "./CanvasStylePopover";

type AnnotationTool = CanvasTool;

interface CanvasToolbarProps {
  activeTool: AnnotationTool;
  hasAnnotations?: boolean;
  hasExportableContent?: boolean;
  onToolChange: (tool: AnnotationTool) => void;
  eraserMode?: CanvasEraserMode;
  onEraserModeChange?: (mode: CanvasEraserMode) => void;
  style: CanvasAnnotationStyle;
  onStyleChange: (style: CanvasAnnotationStyle) => void;
  onClear: () => void;
  onApply?: () => void;
  onExport?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onDeleteSelected?: () => void;
  selectedCount?: number;
  onEditWithMask?: () => void;
  canEditWithMask?: boolean;
  isEditingWithMask?: boolean;
  isApplying?: boolean;
  isExporting?: boolean;
  exportBackground?: CanvasExportBackground;
  exportMatteColor?: HexColor;
  onExportBackgroundChange?: (mode: CanvasExportBackground) => void;
  onExportMatteColorChange?: (color: HexColor) => void;
}

interface BackgroundControlProps {
  mode: CanvasExportBackground;
  matteColor: HexColor;
  onModeChange: (mode: CanvasExportBackground) => void;
  onMatteColorChange: (color: HexColor) => void;
}

function BackgroundControl({ mode, matteColor, onModeChange, onMatteColorChange }: BackgroundControlProps) {
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
          onChange={(e) => onMatteColorChange(e.target.value as HexColor)}
        />
      ) : null}
    </div>
  );
}

export function CanvasToolbar({
  activeTool,
  hasAnnotations,
  hasExportableContent,
  onToolChange,
  eraserMode = "object",
  onEraserModeChange,
  style,
  onStyleChange,
  onClear,
  onApply,
  onExport,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onDeleteSelected,
  selectedCount = 0,
  onEditWithMask,
  canEditWithMask,
  isEditingWithMask,
  isApplying,
  isExporting,
  exportBackground = "alpha",
  exportMatteColor = "#ffffff",
  onExportBackgroundChange,
  onExportMatteColorChange,
}: CanvasToolbarProps) {
  const { t } = useI18n();
  const [eraserMenuOpen, setEraserMenuOpen] = useState(false);
  const eraserRef = useRef<HTMLDivElement>(null);
  const canExport = hasExportableContent ?? hasAnnotations ?? false;
  const eraserLabel = eraserMode === "object"
    ? t("canvas.toolbar.objectEraser")
    : t("canvas.toolbar.brushEraser");

  const tools = [
    { id: "select", shortcut: "1", label: t("canvas.toolbar.select"), icon: HandIcon },
    { id: "pen", shortcut: "2", label: t("canvas.toolbar.pen"), icon: PenIcon },
    { id: "box", shortcut: "3", label: t("canvas.toolbar.box"), icon: BoxIcon },
    { id: "arrow", shortcut: "4", label: t("canvas.toolbar.arrow"), icon: ArrowIcon },
    { id: "memo", shortcut: "5", label: t("canvas.toolbar.memo"), icon: MemoIcon },
  ] as const;

  useEffect(() => {
    if (!eraserMenuOpen) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (!eraserRef.current?.contains(event.target as Node)) setEraserMenuOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [eraserMenuOpen]);

  const selectEraserMode = (mode: CanvasEraserMode) => {
    onEraserModeChange?.(mode);
    onToolChange("eraser");
    setEraserMenuOpen(false);
  };

  return (
    <div className="canvas-toolbar" aria-label={t("canvas.toolbar.label")}>
      {tools.map((tool) => {
        const Icon = tool.icon;
        return (
          <button
            key={tool.id}
            type="button"
            className={`canvas-toolbar__button${activeTool === tool.id ? " canvas-toolbar__button--active" : ""}`}
            onClick={() => onToolChange(tool.id)}
            aria-label={`${tool.label} (${tool.shortcut})`}
            aria-pressed={activeTool === tool.id}
            title={`${tool.label} (${tool.shortcut})`}
          >
            <Icon />
            <span className="canvas-toolbar__shortcut" aria-hidden="true">{tool.shortcut}</span>
          </button>
        );
      })}
      <CanvasStylePopover style={style} onStyleChange={onStyleChange} />
      <div
        ref={eraserRef}
        className={`canvas-toolbar__split-button${activeTool === "eraser" ? " canvas-toolbar__split-button--active" : ""}`}
        onKeyDown={(event) => {
          if (event.key === "Escape" && eraserMenuOpen) {
            event.preventDefault();
            setEraserMenuOpen(false);
          }
        }}
      >
        <button
          type="button"
          className={`canvas-toolbar__button canvas-toolbar__button--split-main${
            activeTool === "eraser" ? " canvas-toolbar__button--active" : ""
          }`}
          onClick={() => onToolChange("eraser")}
          aria-label={`${eraserLabel} (6)`}
          aria-pressed={activeTool === "eraser"}
          title={`${eraserLabel} (6)`}
        >
          <EraserIcon />
          <span className="canvas-toolbar__shortcut" aria-hidden="true">6</span>
        </button>
        <button
          type="button"
          className="canvas-toolbar__button canvas-toolbar__button--split-menu"
          onClick={() => setEraserMenuOpen((open) => !open)}
          aria-label={t("canvas.toolbar.eraserMenu")}
          aria-haspopup="menu"
          aria-expanded={eraserMenuOpen}
          aria-controls="canvas-eraser-menu"
          title={t("canvas.toolbar.eraserMenu")}
        >
          <ChevronUpIcon />
        </button>
        {eraserMenuOpen ? (
          <div id="canvas-eraser-menu" className="canvas-toolbar__eraser-menu" role="menu">
            <button
              type="button"
              className={`canvas-toolbar__eraser-menu-item${
                eraserMode === "object" ? " canvas-toolbar__eraser-menu-item--active" : ""
              }`}
              role="menuitemradio"
              aria-checked={eraserMode === "object"}
              onClick={() => selectEraserMode("object")}
            >
              {t("canvas.toolbar.objectEraser")}
            </button>
            <button
              type="button"
              className={`canvas-toolbar__eraser-menu-item${
                eraserMode === "brush" ? " canvas-toolbar__eraser-menu-item--active" : ""
              }`}
              role="menuitemradio"
              aria-checked={eraserMode === "brush"}
              onClick={() => selectEraserMode("brush")}
            >
              {t("canvas.toolbar.brushEraser")}
            </button>
          </div>
        ) : null}
      </div>
      <span className="canvas-toolbar__divider" aria-hidden="true" />
      {onApply ? (
        <button
          type="button"
          className={`canvas-toolbar__button canvas-toolbar__button--primary${
            isApplying ? " canvas-toolbar__button--busy" : ""
          }`}
          onClick={onApply}
          disabled={!canExport || isApplying}
          aria-label={t("canvas.toolbar.apply")}
          title={t("canvas.toolbar.apply")}
        >
          <ApplyIcon />
        </button>
      ) : null}
      {onEditWithMask ? (
        <button
          type="button"
          className={`canvas-toolbar__button canvas-toolbar__button--primary canvas-toolbar__button--mask${
            isEditingWithMask ? " canvas-toolbar__button--busy" : ""
          }`}
          onClick={onEditWithMask}
          disabled={!canEditWithMask || isEditingWithMask}
          aria-label={canEditWithMask ? t("canvas.toolbar.editMask") : t("canvas.toolbar.editMaskDisabled")}
          title={canEditWithMask ? t("canvas.toolbar.editMask") : t("canvas.toolbar.editMaskDisabled")}
        >
          <MaskIcon />
        </button>
      ) : null}
      {onUndo ? (
        <button
          type="button"
          className="canvas-toolbar__button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label={t("canvas.toolbar.undo")}
          title={t("canvas.toolbar.undo")}
        >
          <UndoIcon />
        </button>
      ) : null}
      {onRedo ? (
        <button
          type="button"
          className="canvas-toolbar__button"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label={t("canvas.toolbar.redo")}
          title={t("canvas.toolbar.redo")}
        >
          <RedoIcon />
        </button>
      ) : null}
      {onDeleteSelected ? (
        <button
          type="button"
          className="canvas-toolbar__button canvas-toolbar__button--danger"
          onClick={onDeleteSelected}
          disabled={selectedCount === 0}
          aria-label={t("canvas.toolbar.deleteSelected")}
          title={t("canvas.toolbar.deleteSelected")}
        >
          <TrashIcon />
        </button>
      ) : null}
      {onExport && onExportBackgroundChange && onExportMatteColorChange ? (
        <BackgroundControl
          mode={exportBackground}
          matteColor={exportMatteColor}
          onModeChange={onExportBackgroundChange}
          onMatteColorChange={onExportMatteColorChange}
        />
      ) : null}
      {onExport ? (
        <button
          type="button"
          className={`canvas-toolbar__button${
            isExporting ? " canvas-toolbar__button--busy" : ""
          }`}
          onClick={onExport}
          disabled={!canExport || isExporting}
          aria-label={t("canvas.toolbar.export")}
          title={t("canvas.toolbar.export")}
        >
          <DownloadIcon />
        </button>
      ) : null}
      <button
        type="button"
        className="canvas-toolbar__button canvas-toolbar__button--danger"
        onClick={onClear}
        disabled={!canExport}
        aria-label={t("canvas.toolbar.clear")}
        title={t("canvas.toolbar.clear")}
      >
        <TrashIcon />
      </button>
    </div>
  );
}

function HandIcon() {
  return (
    <svg className="canvas-toolbar__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 12.5V7a2 2 0 0 1 4 0v4" />
      <path d="M12 11V5a2 2 0 0 1 4 0v7" />
      <path d="M16 12V8a2 2 0 0 1 4 0v5.5A6.5 6.5 0 0 1 13.5 20H12a6 6 0 0 1-4.24-1.76L4.7 15.18a1.7 1.7 0 0 1 2.4-2.4L9 14.68" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg className="canvas-toolbar__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m4 20 4.2-1.1L19.5 7.6a2.2 2.2 0 0 0-3.1-3.1L5.1 15.8 4 20Z" />
      <path d="m14.5 6.5 3 3" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg className="canvas-toolbar__icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="canvas-toolbar__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 19 19 5" />
      <path d="M10 5h9v9" />
    </svg>
  );
}

function MemoIcon() {
  return (
    <svg className="canvas-toolbar__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 4h12v16H6z" />
      <path d="M9 8h6" />
      <path d="M9 12h5" />
      <path d="M9 16h3" />
    </svg>
  );
}

function EraserIcon() {
  return (
    <svg className="canvas-toolbar__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m4 15 8.5-8.5a2.1 2.1 0 0 1 3 0l2 2a2.1 2.1 0 0 1 0 3L10 19H6.5L4 16.5V15Z" />
      <path d="M10 19h10" />
      <path d="m8.5 10.5 5 5" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg className="canvas-toolbar__icon canvas-toolbar__icon--small" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 14 5-5 5 5" />
    </svg>
  );
}

function ApplyIcon() {
  return (
    <svg className="canvas-toolbar__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5 10 17 19 7" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="canvas-toolbar__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v11" />
      <path d="m8 11 4 4 4-4" />
      <path d="M5 20h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="canvas-toolbar__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M7 7l1 13h8l1-13" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg className="canvas-toolbar__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 7 5 11l4 4" />
      <path d="M5 11h9a5 5 0 0 1 0 10h-2" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg className="canvas-toolbar__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m15 7 4 4-4 4" />
      <path d="M19 11h-9a5 5 0 0 0 0 10h2" />
    </svg>
  );
}

function MaskIcon() {
  return (
    <svg className="canvas-toolbar__icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <path d="M9 9h6v6H9z" />
    </svg>
  );
}
