import { useEffect, useRef } from "react";

const FOCUSABLE =
  'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])';

type Options = {
  // Non-modal panels leave the rest of the workspace usable, so they must not
  // cycle Tab back into themselves (WAI-ARIA APG: only modal dialogs trap
  // focus). Escape still closes, and focus still returns to the trigger.
  modal?: boolean;
};

export function useAgentDialogFocus(open: boolean, onClose: () => void, options: Options = {}) {
  const modal = options.modal !== false;
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const heading = panel.querySelector<HTMLElement>("[data-autofocus]");
      (heading ?? panel.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    }, 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (!modal || event.key !== "Tab") return;
      const nodes = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      restoreRef.current?.focus();
    };
  }, [modal, onClose, open]);

  return panelRef;
}
