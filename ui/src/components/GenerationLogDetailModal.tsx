import { createPortal } from "react-dom";
import { useI18n } from "../i18n";
import { useModalFocus } from "../hooks/useModalFocus";
import type { GenerationRequestLogEntry } from "../lib/api";

/**
 * Detail popup for one generation-request log row (260819 unit).
 *
 * Rendered through a portal to document.body: on mobile the right panel is a
 * transformed drawer, and a transformed ancestor becomes the containing block
 * for position:fixed, so an inline modal would be dragged off-screen with it.
 */
export function GenerationLogDetailModal({
  entry,
  onClose,
  onCopyPrompt,
}: {
  entry: GenerationRequestLogEntry;
  onClose: () => void;
  onCopyPrompt: (entry: GenerationRequestLogEntry) => void;
}) {
  const { t } = useI18n();
  const dialogRef = useModalFocus<HTMLDivElement>(true, onClose);
  const failed = entry.succeeded === 0;

  return createPortal(
    <div className="generation-log-detail" role="presentation">
      <div className="generation-log-detail__backdrop" onClick={onClose} />
      <div
        ref={dialogRef}
        className="generation-log-detail__content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="generation-log-detail-title"
        tabIndex={-1}
      >
        <div className="generation-log-detail__header">
          <h2 id="generation-log-detail-title" className="generation-log-detail__title">
            {t("generationLog.detailTitle")}
            <span
              className={`generation-log-detail__badge${failed ? " is-error" : " is-success"}`}
            >
              {entry.succeeded}/{entry.requested}
            </span>
          </h2>
          <button
            type="button"
            className="generation-log-detail__close"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </div>

        <div className="generation-log-detail__grid">
          <span className="generation-log-detail__label">{t("generationLog.detailTime")}</span>
          <span>{new Date(entry.createdAt).toLocaleString()}</span>

          <span className="generation-log-detail__label">{t("generationLog.detailRequestId")}</span>
          <span className="generation-log-detail__mono">{entry.requestId}</span>

          <span className="generation-log-detail__label">{t("generationLog.detailCounts")}</span>
          <span>
            {entry.succeeded} / {entry.requested}
          </span>

          {entry.error ? (
            <>
              <span className="generation-log-detail__label">{t("generationLog.detailError")}</span>
              <span className="generation-log-detail__mono is-error">{entry.error}</span>
            </>
          ) : null}

          {entry.errorMessage ? (
            <>
              <span className="generation-log-detail__label">{t("generationLog.detailErrorMessage")}</span>
              <span className="generation-log-detail__reason">{entry.errorMessage}</span>
            </>
          ) : null}
        </div>

        <div className="generation-log-detail__section">
          <div className="generation-log-detail__label">{t("generationLog.detailPrompt")}</div>
          <div className="generation-log-detail__prompt">
            {entry.prompt || t("generationLog.detailPromptEmpty")}
          </div>
        </div>

        <div className="generation-log-detail__footer">
          <button
            type="button"
            className="generation-log-detail__copy"
            onClick={() => onCopyPrompt(entry)}
            data-modal-initial-focus
          >
            {t("generationLog.copy")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
