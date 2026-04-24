import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";
import { StyleSheetDialog } from "./StyleSheetDialog";

// 0.09.7.1 — standalone Style button for node mode (no PromptComposer there).

export function NodeStyleButton() {
  const { t } = useI18n();
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const enabled = useAppStore((s) => s.styleSheetEnabled);
  const [open, setOpen] = useState(false);

  if (!activeSessionId) return null;

  return (
    <>
      <button
        type="button"
        className={`btn btn--secondary btn--sm${enabled ? " is-on" : ""}`}
        onClick={() => setOpen(true)}
        aria-pressed={enabled}
        title={t("prompt.styleTitle")}
      >
        {t("prompt.style")}
      </button>
      <StyleSheetDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
