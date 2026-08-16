import { useI18n } from "../../i18n";
import { AgentComposer } from "./AgentComposer";
import { AgentMessageList } from "./AgentMessageList";
import { AgentModelSelector } from "./AgentModelSelector";
import { AgentRunStatusBar } from "./AgentRunStatusBar";
import { AgentStatusBadge } from "./AgentStatusBadge";
import type { AgentRunProgress } from "./agentRunProgress";
import type { AgentGenerationSettings, AgentImageHandle, AgentRuntimeStatus, AgentSessionSummary, AgentTurn } from "./agentTypes";

type Props = {
  session: AgentSessionSummary | null;
  turns: AgentTurn[];
  imagesById: Record<string, AgentImageHandle>;
  currentImageId: string | null;
  runtimeStatus: AgentRuntimeStatus;
  runProgress: AgentRunProgress | null;
  settings?: AgentGenerationSettings;
  insertedPrompt?: { id: number; text: string } | null;
  onSettingsChange?: (patch: Partial<AgentGenerationSettings>) => void;
  onOpenModelTab?: () => void;
  onWebSearchChange: (enabled: boolean) => void;
  onAttachFiles: (files: File[]) => void;
  onImageSelect: (imageId: string) => void;
  onSend: (text: string) => void;
  onRetryRun?: (() => void) | undefined;
};

export function AgentChatPane({
  session,
  turns,
  imagesById,
  currentImageId,
  runtimeStatus,
  runProgress,
  settings,
  insertedPrompt,
  onSettingsChange,
  onOpenModelTab,
  onWebSearchChange,
  onAttachFiles,
  onImageSelect,
  onSend,
  onRetryRun,
}: Props) {
  const { t } = useI18n();

  return (
    <section className="agent-chat" aria-label={t("agent.chat")}>
      <header className="agent-pane-header">
        <div className="agent-pane-header__title">
          <span>{t("agent.chat")}</span>
          <strong>{session?.title ?? t("agent.newSession")}</strong>
        </div>
        <div className="agent-pane-header__actions">
          {settings && onSettingsChange ? <AgentModelSelector settings={settings} onChange={onSettingsChange} onOpenModelTab={onOpenModelTab} /> : null}
          <AgentStatusBadge status={runtimeStatus} compacted={session?.compacted} />
        </div>
      </header>
      <AgentMessageList turns={turns} imagesById={imagesById} currentImageId={currentImageId} onImageSelect={onImageSelect} />
      <AgentRunStatusBar progress={runProgress} onRetry={onRetryRun} />
      <AgentComposer webSearchEnabled={session?.webSearchEnabled ?? false} insertedPrompt={insertedPrompt} onWebSearchChange={onWebSearchChange} onAttachFiles={onAttachFiles} onSend={onSend} />
    </section>
  );
}
