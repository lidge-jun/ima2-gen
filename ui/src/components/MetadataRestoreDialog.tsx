import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";

function valueOrDash(value?: string | number | boolean | null): string {
  if (value === undefined || value === null || value === "") return "-";
  return String(value);
}

export function MetadataRestoreDialog() {
  const { t } = useI18n();
  const pending = useAppStore((s) => s.metadataRestore);
  const applyMetadataRestore = useAppStore((s) => s.applyMetadataRestore);
  const addMetadataRestoreAsReference = useAppStore((s) => s.addMetadataRestoreAsReference);
  const cancelMetadataRestore = useAppStore((s) => s.cancelMetadataRestore);

  if (!pending) return null;

  const meta = pending.metadata;
  const prompt = meta.userPrompt || meta.prompt || meta.revisedPrompt || "";

  return (
    <div className="modal-backdrop metadata-restore-backdrop" role="presentation">
      <div
        className="modal metadata-restore"
        role="dialog"
        aria-modal="true"
        aria-labelledby="metadata-restore-title"
      >
        <div id="metadata-restore-title" className="modal__title">
          {t("metadata.restoreTitle")}
        </div>
        <div className="modal__body metadata-restore__body">
          <p>{t("metadata.restoreBody")}</p>
          <div className="metadata-restore__preview">
            <img src={pending.image} alt={t("metadata.imageAlt")} />
            <div className="metadata-restore__details">
              <div>
                <span>{t("metadata.prompt")}</span>
                <strong title={prompt}>{valueOrDash(prompt)}</strong>
              </div>
              <div>
                <span>{t("metadata.size")}</span>
                <strong>{valueOrDash(meta.size)}</strong>
              </div>
              <div>
                <span>{t("metadata.quality")}</span>
                <strong>{valueOrDash(meta.quality)}</strong>
              </div>
              <div>
                <span>{t("metadata.model")}</span>
                <strong>{valueOrDash(meta.model)}</strong>
              </div>
              <div>
                <span>{t("metadata.source")}</span>
                <strong>
                  {pending.source === "png-comment"
                    ? t("metadata.sourcePngComment")
                    : t("metadata.sourceXmp")}
                </strong>
              </div>
            </div>
          </div>
        </div>
        <div className="modal__actions">
          <button type="button" className="modal__btn modal__btn--secondary" onClick={cancelMetadataRestore}>
            {t("common.cancel")}
          </button>
          <button type="button" className="modal__btn modal__btn--secondary" onClick={addMetadataRestoreAsReference}>
            {t("metadata.useAsReferenceOnly")}
          </button>
          <button type="button" className="modal__btn" onClick={applyMetadataRestore}>
            {t("metadata.applySettings")}
          </button>
        </div>
      </div>
    </div>
  );
}
