import { useEffect, useState } from "react";
import { useI18n } from "../../i18n";
import type { AgentRunProgress } from "./agentRunProgress";

type Props = {
  progress: AgentRunProgress | null;
  queueSummary?: { activeCount: number; failedCount: number };
  onQueueOpen?: () => void;
  onRetry?: (() => void) | undefined;
};

function formatElapsed(startedAt: number | null | undefined, now: number): string | null {
  if (!startedAt) return null;
  const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1_000));
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

export function AgentRunStatusBar({ progress, queueSummary, onQueueOpen, onRetry }: Props) {
  const { t } = useI18n();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!progress?.startedAt) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [progress?.startedAt]);

  const activeCount = queueSummary?.activeCount ?? ((progress?.queuedCount ?? 0) + (progress?.runningCount ?? 0));
  const failedCount = queueSummary?.failedCount ?? progress?.failedCount ?? 0;
  if (!progress?.active && !queueSummary) return null;
  const stageKey = progress?.status === "queued"
    ? "agent.progressQueued"
    : progress?.progressStage === "downloading"
      ? "agent.progressDownloading"
      : progress?.status === "running" || progress?.progressStage === "requesting" || progress?.progressStage === "polling"
        ? "agent.progressGenerating"
        : progress?.status === "error" ? "agent.progressFailed" : "agent.progressPlanning";
  const elapsed = formatElapsed(progress?.startedAt, now);
  const jobMeta = progress?.jobKind
    ? t("agent.progressJob", {
      kind: t(`agent.mediaKind.${progress.jobKind}`),
      count: progress.variantCount ?? 1,
    })
    : null;

  return (
    <div className={`agent-run-status agent-run-status--${progress?.status ?? "idle"}`} role="status" aria-live="polite">
      {progress?.active ? <span className="agent-run-status__indicator" aria-hidden="true" /> : null}
      {progress?.active ? <span className="agent-run-status__label">{t(stageKey)}</span> : null}
      {jobMeta ? <span className="agent-run-status__meta">{jobMeta}</span> : null}
      {elapsed ? <time className="agent-run-status__elapsed" dateTime={`PT${Math.floor((now - (progress?.startedAt ?? now)) / 1000)}S`}>{elapsed}</time> : null}
      {progress?.status === "error" && progress.lastError ? (
        <span className="agent-run-status__meta">{progress.lastError}</span>
      ) : null}
      {progress?.status === "error" && onRetry ? (
        <button type="button" className="agent-run-status__retry" onClick={onRetry}>
          {t("agent.retryQueue")}
        </button>
      ) : null}
      <button type="button" className="agent-run-status__queue" onClick={onQueueOpen} disabled={!onQueueOpen}>
        {t("agent.queueSummary", { active: activeCount, failed: failedCount })}
      </button>
    </div>
  );
}
