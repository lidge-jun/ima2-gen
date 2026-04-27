import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";

export function TrashUndoToast() {
  const pending = useAppStore((s) => s.trashPending);
  const restorePendingTrash = useAppStore((s) => s.restorePendingTrash);
  const clearPendingTrash = useAppStore((s) => s.clearPendingTrash);
  const { t } = useI18n();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!pending) return;
    setNow(Date.now());
    const id = window.setInterval(() => {
      const next = Date.now();
      setNow(next);
      if (next >= pending.expiresAt) clearPendingTrash();
    }, 500);
    return () => window.clearInterval(id);
  }, [clearPendingTrash, pending]);

  if (!pending) return null;

  return (
    <div className="trash-undo-toast">
      <span>{t("gallery.deleted", { filename: pending.filename })}</span>
      <button type="button" onClick={() => void restorePendingTrash()}>
        {t("gallery.undo")}
      </button>
      <span className="trash-undo-toast__timer">
        {t("gallery.secondsSuffix", {
          n: Math.max(0, Math.ceil((pending.expiresAt - now) / 1000)),
        })}
      </span>
    </div>
  );
}
