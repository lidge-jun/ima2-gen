import { useCallback, useEffect, useState } from "react";
import {
  getPromptImportDiscovery,
  reviewPromptImportDiscoveryCandidate,
  searchPromptImportDiscovery,
  type PromptDiscoveryCandidate,
} from "../lib/api";
import { useI18n } from "../i18n";

type PromptImportDiscoverySectionProps = {
  disabled?: boolean;
  onError: (message: string | null) => void;
  onSourcesChanged: () => Promise<void> | void;
};

const DEFAULT_SEEDS = ["gpt-image-2 prompt", "nano banana prompts", "typography image prompt"];

export function PromptImportDiscoverySection({
  disabled = false,
  onError,
  onSourcesChanged,
}: PromptImportDiscoverySectionProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("gpt-image-2 prompt");
  const [candidates, setCandidates] = useState<PromptDiscoveryCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [allowedPaths, setAllowedPaths] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void getPromptImportDiscovery()
      .then((result) => {
        if (!cancelled) setCandidates(result.candidates);
      })
      .catch(() => {
        if (!cancelled) setCandidates([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const searchDiscovery = useCallback(async () => {
    setBusy(true);
    setWarnings([]);
    onError(null);
    try {
      const result = await searchPromptImportDiscovery({
        q: query.trim(),
        seeds: DEFAULT_SEEDS,
      });
      setCandidates(result.candidates);
      setWarnings([
        ...result.warnings,
        ...(result.rateLimit?.remaining === 0 ? ["github-rate-limit-exhausted"] : []),
      ]);
      if (result.candidates.length === 0) onError(t("promptLibrary.discoveryNoResults"));
    } catch (err) {
      onError(err instanceof Error ? err.message : t("promptLibrary.importFailed"));
    } finally {
      setBusy(false);
    }
  }, [onError, query, t]);

  const reviewCandidate = useCallback(
    async (candidate: PromptDiscoveryCandidate, status: "approved" | "rejected") => {
      setBusy(true);
      setWarnings([]);
      onError(null);
      try {
        const pathText = allowedPaths[candidate.fullName] || "";
        const paths = pathText
          .split(/\r?\n|,/)
          .map((path) => path.trim())
          .filter(Boolean);
        const result = await reviewPromptImportDiscoveryCandidate({
          repo: candidate.fullName,
          status,
          allowedPaths: status === "approved" ? paths : [],
          defaultSearch: status === "approved" && paths.length > 0,
        });
        setWarnings(result.warnings);
        setCandidates((prev) => prev.map((item) => (
          item.fullName === candidate.fullName ? result.candidate : item
        )));
        await onSourcesChanged();
      } catch (err) {
        onError(err instanceof Error ? err.message : t("promptLibrary.importFailed"));
      } finally {
        setBusy(false);
      }
    },
    [allowedPaths, onError, onSourcesChanged, t],
  );

  return (
    <div className="prompt-import-dialog__discovery">
      <div className="prompt-import-dialog__section-title">
        <strong>{t("promptLibrary.discovery")}</strong>
        <span>{t("promptLibrary.discoveryReviewQueue")}</span>
      </div>
      <div className="prompt-import-dialog__discovery-actions">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("promptLibrary.discoverySearchPlaceholder")}
          aria-label={t("promptLibrary.discoverySearch")}
        />
        <button type="button" onClick={() => void searchDiscovery()} disabled={disabled || busy || !query.trim()}>
          {busy ? t("common.loading") : t("promptLibrary.discoverySearch")}
        </button>
      </div>
      {warnings.length > 0 ? (
        <div className="prompt-import-dialog__discovery-warning">
          {warnings.slice(0, 3).join(" · ")}
        </div>
      ) : null}
      {candidates.length === 0 ? (
        <div className="prompt-import-dialog__empty">{t("promptLibrary.discoveryNoResults")}</div>
      ) : (
        <div className="prompt-import-dialog__discovery-list">
          {candidates.map((candidate) => (
            <article key={candidate.fullName} className="prompt-import-dialog__discovery-candidate">
              <div>
                <strong>{candidate.fullName}</strong>
                <small>{candidate.description || candidate.htmlUrl}</small>
              </div>
              <div className="prompt-import-dialog__score">
                <span>{t("promptLibrary.discoveryScore")}: {candidate.score}</span>
                <span>{candidate.licenseSpdx}</span>
                <span>{candidate.status}</span>
              </div>
              {candidate.scoreReasons.length > 0 ? <em>{candidate.scoreReasons.slice(0, 3).join(" · ")}</em> : null}
              {candidate.warnings.length > 0 ? <b>{candidate.warnings.slice(0, 2).join(" · ")}</b> : null}
              <textarea
                value={allowedPaths[candidate.fullName] || ""}
                onChange={(event) => setAllowedPaths((prev) => ({
                  ...prev,
                  [candidate.fullName]: event.target.value,
                }))}
                placeholder="README.md, prompts/example.md"
                aria-label={t("promptLibrary.discoveryRequiresPaths")}
              />
              <div className="prompt-import-dialog__review-actions">
                <button
                  type="button"
                  onClick={() => void reviewCandidate(candidate, "approved")}
                  disabled={disabled || busy}
                >
                  {t("promptLibrary.discoveryApprove")}
                </button>
                <button
                  type="button"
                  onClick={() => void reviewCandidate(candidate, "rejected")}
                  disabled={disabled || busy}
                >
                  {t("promptLibrary.discoveryReject")}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
