import type { CanvasTool } from "../../types/canvas";
import { useI18n } from "../../i18n";

type AnnotationTool = Exclude<CanvasTool, "memo">;

interface CanvasToolbarProps {
  activeTool: AnnotationTool;
  hasAnnotations: boolean;
  onToolChange: (tool: AnnotationTool) => void;
  onClear: () => void;
}

export function CanvasToolbar({
  activeTool,
  hasAnnotations,
  onToolChange,
  onClear,
}: CanvasToolbarProps) {
  const { t } = useI18n();

  const tools = [
    { id: "pan", shortcut: "1", label: t("canvas.toolbar.pan"), icon: HandIcon },
    { id: "pen", shortcut: "2", label: t("canvas.toolbar.pen"), icon: PenIcon },
    { id: "box", shortcut: "3", label: t("canvas.toolbar.box"), icon: BoxIcon },
    { id: "arrow", shortcut: "4", label: t("canvas.toolbar.arrow"), icon: ArrowIcon },
  ] as const;

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
      <button
        type="button"
        className="canvas-toolbar__button canvas-toolbar__button--danger"
        onClick={onClear}
        disabled={!hasAnnotations}
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
