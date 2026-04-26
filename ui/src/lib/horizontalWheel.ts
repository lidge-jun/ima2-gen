import type { WheelEvent } from "react";

export function handleHorizontalWheel(event: WheelEvent<HTMLElement>): void {
  const el = event.currentTarget;
  if (el.scrollWidth <= el.clientWidth) return;

  const verticalIntent = Math.abs(event.deltaY) > Math.abs(event.deltaX);
  if (!verticalIntent) return;

  const atStart = el.scrollLeft <= 0;
  const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
  const goingLeft = event.deltaY < 0;
  const goingRight = event.deltaY > 0;

  if ((goingLeft && atStart) || (goingRight && atEnd)) return;

  event.preventDefault();
  el.scrollLeft += event.deltaY;
}
