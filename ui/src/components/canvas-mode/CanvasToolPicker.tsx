import { useEffect, useRef, useState, type ComponentType } from "react";
import type { CanvasTool } from "../../types/canvas";

export interface CanvasToolOption {
  id: Exclude<CanvasTool, "eraser">;
  shortcut: string;
  label: string;
  icon: ComponentType;
}

interface CanvasToolPickerProps {
  tools: readonly CanvasToolOption[];
  activeTool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
}

export function CanvasToolPicker({ tools, activeTool, onToolChange }: CanvasToolPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = tools.find((tool) => tool.id === activeTool) ?? tools[0];
  const ActiveIcon = active.icon;

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div ref={ref} className="canvas-tool-picker">
      <button
        type="button"
        className={`canvas-toolbar__button canvas-tool-picker__trigger${
          activeTool !== "eraser" ? " canvas-toolbar__button--active" : ""
        }`}
        onClick={() => setOpen((value) => !value)}
        aria-label={`${active.label} (${active.shortcut})`}
        aria-pressed={activeTool === active.id}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${active.label} (${active.shortcut})`}
      >
        <ActiveIcon />
        <span className="canvas-toolbar__shortcut" aria-hidden="true">{active.shortcut}</span>
      </button>
      {open ? (
        <div className="canvas-tool-picker__menu" role="menu">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const activeItem = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                className={`canvas-tool-picker__item${activeItem ? " active" : ""}`}
                role="menuitemradio"
                aria-checked={activeItem}
                onClick={() => {
                  onToolChange(tool.id);
                  setOpen(false);
                }}
              >
                <Icon />
                <span>{tool.label}</span>
                <kbd>{tool.shortcut}</kbd>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
