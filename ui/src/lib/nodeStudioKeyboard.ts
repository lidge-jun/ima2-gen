import type { KeyboardEvent } from "react";

function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && target.matches("input, textarea, select, [contenteditable=true]");
}

function isCanvasBackground(target: EventTarget | null, wrapper: HTMLElement | null): boolean {
  return target === wrapper
    || target instanceof HTMLElement && target.classList.contains("react-flow__pane");
}

export function shouldOpenNodePalette(
  event: KeyboardEvent<HTMLElement>,
  wrapper: HTMLElement | null,
  graphEmpty: boolean,
): boolean {
  if (isEditable(event.target) || !isCanvasBackground(event.target, wrapper)) return false;
  return event.key === "/" || event.key === " " && graphEmpty;
}

/**
 * Graph undo/redo chord detection (030): mod+z / mod+shift+z on the canvas,
 * never inside editable targets (prompt textareas keep native undo).
 */
export function graphHistoryChord(
  event: KeyboardEvent<HTMLElement>,
): "undo" | "redo" | null {
  if (isEditable(event.target)) return null;
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return null;
  if (event.key !== "z" && event.key !== "Z") return null;
  return event.shiftKey ? "redo" : "undo";
}

export function paletteAnchor(wrapper: HTMLElement | null): { clientX: number; clientY: number } {
  const rect = wrapper?.getBoundingClientRect();
  return rect
    ? { clientX: rect.left + rect.width / 2, clientY: rect.top + Math.min(180, rect.height / 2) }
    : { clientX: 320, clientY: 180 };
}
