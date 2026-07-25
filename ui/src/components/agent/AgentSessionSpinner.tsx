import { useI18n } from "../../i18n";
import type { AgentSessionRunSummary } from "./agentTypes";

type Props = {
  summary?: AgentSessionRunSummary;
};

export function AgentSessionSpinner({ summary }: Props) {
  const { t } = useI18n();
  if (!summary || summary.status === "idle") return null;
  const label = summary.status === "running"
    ? t("agent.sessionRunning")
    : summary.status === "queued"
      ? t("agent.sessionQueued", { count: summary.queuedCount })
      : t("agent.sessionError");

  return (
    <span
      className={`agent-session-spinner agent-session-spinner--${summary.status}`}
      data-motion-essential
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true" />
      {summary.queuedCount > 0 ? <em>{summary.queuedCount}</em> : null}
    </span>
  );
}
