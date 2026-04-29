import type { PromptImportCandidate } from "../lib/api";
import { useI18n } from "../i18n";

type PromptImportSearchResultsProps = {
  candidates: PromptImportCandidate[];
  selectedIds: Set<string>;
  activeCandidateId: string | null;
  busy?: boolean;
  onSelectCandidate: (candidate: PromptImportCandidate) => void;
  onToggleSelected: (id: string, selected: boolean) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onImportOne: (candidate: PromptImportCandidate) => void;
};

function sourceSummary(candidate: PromptImportCandidate): string {
  const source = candidate.source;
  if (!source) return "";
  if (source.owner && source.repo) {
    const file = source.path ? ` · ${source.path}` : "";
    return `github · ${source.owner}/${source.repo}${file}`;
  }
  if (source.filename) return source.filename;
  if (source.sourceId) return source.sourceId;
  return source.kind ?? "";
}

function shortPrompt(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 220 ? `${normalized.slice(0, 220)}...` : normalized;
}

export function PromptImportSearchResults({
  candidates,
  selectedIds,
  activeCandidateId,
  busy = false,
  onSelectCandidate,
  onToggleSelected,
  onSelectAll,
  onClearSelection,
  onImportOne,
}: PromptImportSearchResultsProps) {
  const { t } = useI18n();

  if (candidates.length === 0) {
    return (
      <section className="prompt-import-dialog__results" aria-label={t("promptLibrary.searchResults")}>
        <div className="prompt-import-dialog__empty">{t("promptLibrary.importPreviewEmpty")}</div>
      </section>
    );
  }

  const allSelected = candidates.every((c) => selectedIds.has(c.id));

  return (
    <section className="prompt-import-dialog__results" aria-label={t("promptLibrary.searchResults")}>
      <header className="prompt-import-dialog__results-header">
        <strong>
          {t("promptLibrary.searchResultsHeader", { count: candidates.length })}
        </strong>
        <div className="prompt-import-dialog__results-header-actions">
          <button
            type="button"
            onClick={onSelectAll}
            disabled={allSelected}
          >
            {t("promptLibrary.selectAllCandidates")}
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            disabled={selectedIds.size === 0}
          >
            {t("promptLibrary.clearCandidateSelection")}
          </button>
        </div>
      </header>
      {candidates.map((candidate) => {
        const selected = selectedIds.has(candidate.id);
        const active = activeCandidateId === candidate.id;
        const source = sourceSummary(candidate);
        return (
          <article
            key={candidate.id}
            className={`prompt-import-dialog__result-card${active ? " active" : ""}`}
          >
            <button
              type="button"
              className="prompt-import-dialog__result-main"
              onClick={() => onSelectCandidate(candidate)}
            >
              <strong>{candidate.name}</strong>
              <span>{shortPrompt(candidate.text)}</span>
              {source ? <small>{source}</small> : null}
            </button>
            <div className="prompt-import-dialog__result-meta">
              {candidate.warnings?.slice(0, 2).map((warning) => (
                <b key={warning} className="prompt-import-dialog__hint-chip">{warning}</b>
              ))}
              {candidate.tags.slice(0, 4).map((tag) => (
                <em key={tag}>{tag}</em>
              ))}
            </div>
            <div className="prompt-import-dialog__result-actions">
              <label>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(event) => onToggleSelected(candidate.id, event.target.checked)}
                />
                <span>{selected ? t("promptLibrary.selectedPrompt") : t("promptLibrary.selectPrompt")}</span>
              </label>
              <button type="button" onClick={() => onSelectCandidate(candidate)}>
                {t("promptLibrary.previewPrompt")}
              </button>
              <button type="button" onClick={() => onImportOne(candidate)} disabled={busy}>
                {t("promptLibrary.importThisPrompt")}
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
