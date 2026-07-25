import { useI18n } from "../i18n";
import { isEmptyProvenance, type ProvenanceView } from "../lib/provenance";

/**
 * Shows which model produced a result and how it was derived.
 *
 * Renders nothing when there is no metadata — an "unknown" badge would add noise
 * without adding information.
 */
export function ProvenanceChip({
  view,
  size = "sm",
}: {
  view: ProvenanceView;
  size?: "sm" | "md";
}) {
  const { t } = useI18n();
  if (isEmptyProvenance(view)) return null;

  return (
    <span className={`provenance-chip provenance-chip--${size}`}>
      {view.modelLabel ? <span className="provenance-chip__model">{view.modelLabel}</span> : null}
      {view.derivation ? (
        <span className="provenance-chip__derivation">{t(`provenance.${view.derivation}`)}</span>
      ) : null}
    </span>
  );
}
