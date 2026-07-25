import { useCallback, type KeyboardEvent } from "react";

const NAV_KEYS = ["ArrowLeft", "ArrowRight", "Home", "End"] as const;

/**
 * Roving-tabindex keyboard navigation for a `role="tablist"` container.
 *
 * WAI-ARIA requires arrow keys to move between tabs; Tab itself must jump past the
 * whole group. Attach the returned handler to the tablist element and give each tab
 * `tabIndex={selected ? 0 : -1}`.
 */
export function useTablistKeys<T extends HTMLElement>() {
  return useCallback((event: KeyboardEvent<T>) => {
    if (!NAV_KEYS.includes(event.key as (typeof NAV_KEYS)[number])) return;
    const container = event.currentTarget;
    const tabs = Array.from(container.querySelectorAll<HTMLElement>("[role='tab']"))
      .filter((tab) => !tab.hasAttribute("disabled"));
    if (tabs.length === 0) return;
    event.preventDefault();
    const active = document.activeElement as HTMLElement | null;
    const current = active ? tabs.indexOf(active) : -1;
    const next =
      event.key === "Home" ? 0
      : event.key === "End" ? tabs.length - 1
      : current < 0 ? 0
      : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    const target = tabs[next];
    target?.focus();
    // Follow-focus selection: these tablists switch views immediately, so activating
    // on move matches the visible behavior of clicking the tab.
    target?.click();
  }, []);
}
