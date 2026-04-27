import { useEffect, useRef } from "react";
import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";
import type { CustomSizeAdjustmentReason } from "../lib/size";

function reasonKey(reasons: CustomSizeAdjustmentReason[]): string {
  if (reasons.includes("ratio")) return "sizeConfirm.reasonRatio";
  if (reasons.includes("maxPixels") || reasons.includes("pixels")) return "sizeConfirm.reasonPixels";
  if (reasons.includes("minPixels")) return "sizeConfirm.reasonMinPixels";
  if (reasons.includes("min")) return "sizeConfirm.reasonMin";
  if (reasons.includes("maxEdge") || reasons.includes("max")) return "sizeConfirm.reasonMax";
  return "sizeConfirm.reasonSnap";
}

export function CustomSizeConfirmModal() {
  const pending = useAppStore((s) => s.customSizeConfirm);
  const confirm = useAppStore((s) => s.confirmCustomSizeAdjustment);
  const cancel = useAppStore((s) => s.cancelCustomSizeAdjustment);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    if (!pending) return;
    cancelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancel, pending]);

  if (!pending) return null;

  const requested = `${pending.requestedW}x${pending.requestedH}`;
  const adjusted = `${pending.adjustedW}x${pending.adjustedH}`;

  return (
    <div className="modal-backdrop custom-size-confirm-backdrop" role="presentation">
      <div
        className="modal custom-size-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-size-confirm-title"
        aria-describedby="custom-size-confirm-body"
      >
        <div id="custom-size-confirm-title" className="modal__title">
          {t("sizeConfirm.title")}
        </div>
        <div id="custom-size-confirm-body" className="modal__body">
          <p>{t("sizeConfirm.body")}</p>
          <dl className="size-confirm__pairs">
            <div className="size-confirm__pair">
              <dt>{t("sizeConfirm.requested")}</dt>
              <dd>{requested}</dd>
            </div>
            <div className="size-confirm__pair">
              <dt>{t("sizeConfirm.adjusted")}</dt>
              <dd>{adjusted}</dd>
            </div>
          </dl>
          <p className="size-confirm__reason">
            {t(reasonKey(pending.reasons))}
          </p>
        </div>
        <div className="modal__actions">
          <button
            ref={cancelRef}
            type="button"
            className="modal__btn modal__btn--secondary"
            onClick={cancel}
          >
            {t("sizeConfirm.cancel")}
          </button>
          <button
            type="button"
            className="modal__btn"
            onClick={() => void confirm()}
          >
            {t("sizeConfirm.approve")}
          </button>
        </div>
      </div>
    </div>
  );
}
