import { useCallback, useEffect, useState } from "react";
import { getGenerationRequestLog, type GenerationRequestLogEntry } from "../lib/api";
import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";
import { copyTextToClipboard } from "../lib/clipboard";
import { GenerationLogDetailModal } from "./GenerationLogDetailModal";

export function GenerationRequestLogPanel() {
  const { t } = useI18n();
  const showToast = useAppStore((state) => state.showToast);
  const activeGenerations = useAppStore((state) => state.activeGenerations);
  const [items, setItems] = useState<GenerationRequestLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Snapshot of the clicked entry. Log records are immutable append-only
  // writes, so a frozen snapshot stays correct even while the panel's
  // items refresh during active generations.
  const [selected, setSelected] = useState<GenerationRequestLogEntry | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await getGenerationRequestLog();
      setItems(result.items);
    } catch {
      setItems([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, activeGenerations]);

  const copyPrompt = async (item: GenerationRequestLogEntry) => {
    try {
      await copyTextToClipboard(item.prompt);
      showToast(t("generationLog.copied"));
    } catch {
      showToast(t("toast.copyFailed"), true);
    }
  };

  if (loading) {
    return <div className="generation-request-log__empty">{t("common.loading")}</div>;
  }

  if (error) {
    return (
      <div className="generation-request-log__empty" role="alert">
        <span>{t("generationLog.loadFailed")}</span>
        <button type="button" onClick={() => void refresh()}>{t("generationLog.retry")}</button>
      </div>
    );
  }

  return (
    <div className="generation-request-log" role="list">
      {items.length === 0 ? (
        <div className="generation-request-log__empty">{t("generationLog.empty")}</div>
      ) : items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="listitem"
          className="generation-request-log__item"
          onClick={() => setSelected(item)}
          title={t("generationLog.detailOpen")}
        >
          <span className="generation-request-log__prompt">{item.prompt}</span>
          <span className={`generation-request-log__count${item.succeeded === 0 ? " is-error" : " is-success"}`}>
            {item.succeeded}/{item.requested}
          </span>
        </button>
      ))}
      {selected ? (
        <GenerationLogDetailModal
          entry={selected}
          onClose={() => setSelected(null)}
          onCopyPrompt={(entry) => void copyPrompt(entry)}
        />
      ) : null}
    </div>
  );
}
