import { useI18n } from "../../i18n";
import { formatAgentQueueStatus, formatAgentQueueTime } from "../../lib/agentQueueFormatting";
import { agentQueueErrorLabel, resolveAgentQueueError } from "../../lib/agentQueueError";
import type { AgentQueueItem } from "./agentTypes";

type Props = {
  item: AgentQueueItem;
  onCancel: (itemId: string) => void;
  onRetry: (itemId: string) => void;
};

export function AgentQueueRow({ item, onCancel, onRetry }: Props) {
  const { t } = useI18n();
  const canCancel = item.status === "queued" || item.status === "running";
  const canRetry = item.status === "failed" || item.status === "canceled";
  const variants = item.plan.plannedVariants || item.plan.prompts.length || 1;
  const parallel = item.plan.plannedParallelism || item.options.parallelism;
  const statusDetail = formatAgentQueueStatus(item);
  const time = formatAgentQueueTime(item.createdAt, (value, unit) => t("agent.queueTimeAgo", { value, unit: t(`agent.queueTimeUnit.${unit}`) }));
  const resolvedLabel = agentQueueErrorLabel(resolveAgentQueueError(item), t);

  return (
    <div className={`agent-queue-row agent-queue-row--${item.status}`}>
      <div className="agent-queue-row__main">
        <strong>{item.prompt}</strong>
        <span className={`agent-queue-row__badge agent-queue-row__badge--${item.status}`}>{t(`agent.queueStatus.${item.status}`)}</span>
        <span>{[statusDetail, resolvedLabel, t("agent.queuePlanSummary", { variants, parallel }), time].filter(Boolean).join(" · ")}</span>
        {item.plan.reason || item.errorCode || item.errorMessage ? (
          <details className="agent-queue-row__details">
            <summary>{t("agent.queueDetails")}</summary>
            {item.plan.reason ? <small>{item.plan.reason}</small> : null}
            {item.errorCode ? <small>{item.errorCode}</small> : null}
            {item.errorMessage ? <small>{item.errorMessage}</small> : null}
          </details>
        ) : null}
      </div>
      <div className="agent-queue-row__actions">
        {canCancel ? <button type="button" onClick={() => onCancel(item.id)}>{t("agent.cancelQueue")}</button> : null}
        {canRetry ? <button type="button" onClick={() => onRetry(item.id)}>{t("agent.retryQueue")}</button> : null}
      </div>
    </div>
  );
}
