import type { PromptImportCandidate } from "../lib/api";
import { useI18n } from "../i18n";

type PromptImportCandidatePreviewProps = {
  candidate: PromptImportCandidate | null;
  selected: boolean;
  disabled?: boolean;
  onToggleSelected: (id: string, selected: boolean) => void;
  onImportOne: (candidate: PromptImportCandidate) => void;
};

function getSourceDetails(candidate: PromptImportCandidate): string {
  const source = candidate.source;
  if (!source) return "";
  if (source.owner && source.repo) {
    const ref = source.ref ? `@${source.ref}` : "";
    const path = source.path ? `:${source.path}` : "";
    return `${source.owner}/${source.repo}${ref}${path}`;
  }
  return source.filename ?? source.sourceId ?? source.kind ?? "";
}

function getTagValue(candidate: PromptImportCandidate, prefix: string): string | null {
  const tag = candidate.tags.find((item) => item.toLowerCase().startsWith(prefix));
  return tag ? tag.slice(prefix.length) : null;
}

function hasAttribution(candidate: PromptImportCandidate): boolean {
  return candidate.tags.includes("attribution-required") ||
    candidate.warnings?.some((warning) => warning.toLowerCase().includes("attribution")) === true;
}

export function PromptImportCandidatePreview({
  candidate,
  selected,
  disabled = false,
  onToggleSelected,
  onImportOne,
}: PromptImportCandidatePreviewProps) {
  const { t } = useI18n();

  if (!candidate) {
    return (
      <aside className="prompt-import-dialog__candidate-preview" aria-label={t("promptLibrary.previewPrompt")}>
        <div className="prompt-import-dialog__empty">{t("promptLibrary.importPreviewEmpty")}</div>
      </aside>
    );
  }

  const source = getSourceDetails(candidate);
  const license = getTagValue(candidate, "license:");
  const attribution = hasAttribution(candidate);

  return (
    <aside className="prompt-import-dialog__candidate-preview" aria-label={t("promptLibrary.previewPrompt")}>
      <div className="prompt-import-dialog__preview-header">
        <div>
          <span>{t("promptLibrary.previewPrompt")}</span>
          <h4>{candidate.name}</h4>
        </div>
        <button type="button" onClick={() => onImportOne(candidate)} disabled={disabled}>
          {t("promptLibrary.importThisPrompt")}
        </button>
      </div>

      <label className="prompt-import-dialog__preview-select">
        <input
          type="checkbox"
          checked={selected}
          disabled={disabled}
          onChange={(event) => onToggleSelected(candidate.id, event.target.checked)}
        />
        <span>{selected ? t("promptLibrary.selectedPrompt") : t("promptLibrary.selectPrompt")}</span>
      </label>

      <div className="prompt-import-dialog__preview-field">
        <strong>{t("promptLibrary.promptText")}</strong>
        <p>{candidate.text}</p>
      </div>

      {candidate.tags.length > 0 ? (
        <div className="prompt-import-dialog__preview-field">
          <strong>{t("promptLibrary.tags")}</strong>
          <div className="prompt-import-dialog__preview-chips">
            {candidate.tags.map((tag) => <em key={tag}>{tag}</em>)}
          </div>
        </div>
      ) : null}

      {candidate.warnings?.length ? (
        <div className="prompt-import-dialog__preview-field">
          <strong>{t("promptLibrary.compatibilityWarnings")}</strong>
          <div className="prompt-import-dialog__preview-chips">
            {candidate.warnings.map((warning) => <b key={warning}>{warning}</b>)}
          </div>
        </div>
      ) : null}

      {source || license || attribution ? (
        <div className="prompt-import-dialog__preview-field">
          <strong>{t("promptLibrary.sourceDetails")}</strong>
          {source ? <small>{source}</small> : null}
          {license ? <small>{t("promptLibrary.license")}: {license}</small> : null}
          {attribution ? <small>{t("promptLibrary.attributionRequired")}</small> : null}
        </div>
      ) : null}
    </aside>
  );
}
