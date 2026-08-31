import { useModalFocus } from "../../hooks/useModalFocus";

type Options = {
  modal?: boolean;
};

/** Thin wrapper — delegates to the shared modal-focus stack. */
export function useAgentDialogFocus(open: boolean, onClose: () => void, options: Options = {}) {
  return useModalFocus<HTMLDivElement>(open, onClose, {
    trap: options.modal !== false,
  });
}
