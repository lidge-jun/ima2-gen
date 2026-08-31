import { useEffect, useId, useRef, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/* ---- Modal stack: only the topmost entry receives Escape and Tab ---- */
const modalStack: string[] = [];
function isTopmost(id: string): boolean {
  return modalStack.length > 0 && modalStack[modalStack.length - 1] === id;
}

export type CloseReason = "escape" | "closeButton" | "outsidePointer" | "programmatic";

export interface ModalFocusOptions {
  /** Set false for non-modal panels that should not trap Tab. Default true. */
  trap?: boolean;
  /** Set false to skip auto-focus on open. Default true. */
  autoFocus?: boolean;
  /** Control whether focus returns to the trigger on close. Default true.
      Can be a predicate receiving the close reason. */
  restoreFocus?: boolean | ((reason: CloseReason) => boolean);
}

export function useModalFocus<T extends HTMLElement>(
  open: boolean,
  onClose: (reason?: CloseReason) => void,
  options: ModalFocusOptions = {},
): RefObject<T | null> {
  const containerRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const stackId = useId();
  const { trap = true, autoFocus = true, restoreFocus = true } = options;

  useEffect(() => {
    if (!open) return;
    modalStack.push(stackId);
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const container = containerRef.current;
    const focusable = () => Array.from(
      container?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
    ).filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");

    if (autoFocus) {
      window.requestAnimationFrame(() => {
        const initial = container?.querySelector<HTMLElement>("[data-modal-initial-focus]")
          ?? focusable()[0]
          ?? container;
        initial?.focus();
      });
    }

    const shouldRestore = (reason: CloseReason): boolean => {
      if (typeof restoreFocus === "function") return restoreFocus(reason);
      return restoreFocus;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopmost(stackId)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current("escape");
        return;
      }
      if (!trap || event.key !== "Tab") return;
      const elements = focusable();
      if (elements.length === 0) {
        event.preventDefault();
        container?.focus();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    let closeReason: CloseReason = "programmatic";
    const origClose = onCloseRef.current;
    onCloseRef.current = (reason?: CloseReason) => {
      closeReason = reason ?? "programmatic";
      origClose(reason);
    };
    return () => {
      const idx = modalStack.indexOf(stackId);
      if (idx !== -1) modalStack.splice(idx, 1);
      document.removeEventListener("keydown", onKeyDown);
      if (shouldRestore(closeReason)) {
        window.requestAnimationFrame(() => previousFocus?.focus());
      }
    };
  }, [open, stackId, trap, autoFocus, restoreFocus]);

  return containerRef;
}
