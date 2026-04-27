import type { PointerEvent as ReactPointerEvent } from "react";
import type { NormalizedPoint } from "../../types/canvas";

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function screenToNormalized(
  event: PointerEvent | ReactPointerEvent,
  element: HTMLElement,
): NormalizedPoint {
  const rect = element.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width),
    y: clamp((event.clientY - rect.top) / rect.height),
  };
}
