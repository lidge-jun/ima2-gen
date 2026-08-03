/**
 * Dismiss policy for portaled overlays that listen to scroll on `window`
 * during the capture phase.
 *
 * A capture-phase listener on `window` also receives scroll events that
 * originated inside the portaled menu, because capture runs window -> document
 * -> target regardless of the fact that `scroll` does not bubble. Dismissing on
 * those closes the menu the moment the user scrolls its own list (issue #119).
 *
 * Only scrolls from OUTSIDE the menu move the trigger and detach a
 * fixed-position panel from it, so only those should dismiss.
 */
export function shouldDismissOnScroll(
  event: Pick<Event, "target"> | undefined,
  menu: { contains(node: Node): boolean } | null | undefined,
): boolean {
  if (!event) return true;
  if (!menu) return true;
  const target = event.target;
  // `window` targets have no nodeType and cannot be passed to contains().
  if (target && typeof target === "object" && "nodeType" in target) {
    if (menu.contains(target as Node)) return false;
  }
  return true;
}
