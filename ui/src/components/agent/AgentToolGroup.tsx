import { useMemo, useId, useState } from "react";
import { useI18n } from "../../i18n";
import { agentToolLabelKey, getAgentToolCalls } from "../../lib/agentToolFormatting";
import { ChevronDownIcon, ChevronRightIcon } from "./AgentIcons";
import { AgentResultThumb } from "./AgentResultThumb";
import { AgentToolCallRow } from "./AgentToolCallRow";
import type { AgentImageHandle, AgentToolCallSummary, AgentTurn } from "./agentTypes";

type Props = {
  turns: AgentTurn[];
  imagesById: Record<string, AgentImageHandle>;
  currentImageId: string | null;
  onImageSelect: (imageId: string) => void;
};

function mergeTurns(turns: AgentTurn[]): { toolCalls: AgentToolCallSummary[]; imageIds: string[]; isStreaming: boolean; names: string[] } {
  const toolCalls: AgentToolCallSummary[] = [];
  const imageIdSet = new Set<string>();
  let isStreaming = false;
  const names: string[] = [];

  for (const turn of turns) {
    const calls = getAgentToolCalls(turn);
    toolCalls.push(...calls);
    for (const id of turn.imageIds ?? []) imageIdSet.add(id);
    for (const call of calls) {
      for (const id of call.imageIds ?? []) imageIdSet.add(id);
    }
    if (turn.status === "streaming") isStreaming = true;
    for (const call of calls) {
      if (!names.includes(call.name)) names.push(call.name);
    }
  }

  return {
    toolCalls,
    imageIds: [...imageIdSet],
    isStreaming,
    names,
  };
}

export function AgentToolGroup({ turns, imagesById, currentImageId, onImageSelect }: Props) {
  const { t } = useI18n();
  const detailsId = useId();
  const [expanded, setExpanded] = useState(false);
  const { toolCalls, imageIds, isStreaming, names } = useMemo(() => mergeTurns(turns), [turns]);
  const actionLabel = expanded ? t("agent.toolCollapse") : t("agent.toolExpand");
  // Raw ids joined with " + " ("ima2.web_search + ima2.generate_image") read as
  // debug output; the group header names what ran in the reader's language.
  const label = useMemo(() => {
    const readable = names.map((name) => {
      const key = agentToolLabelKey(name);
      return key ? t(key) : name;
    });
    return readable.join(" · ") || t("agent.toolGroup");
  }, [names, t]);

  return (
    <article className={`agent-message agent-message--tool is-collapsible${isStreaming ? " is-streaming" : ""}`} aria-busy={isStreaming ? "true" : undefined}>
      <div className="agent-message__tool-summary">
        <button
          type="button"
          className="agent-message__tool-toggle"
          aria-expanded={expanded}
          aria-controls={detailsId}
          aria-label={`${actionLabel}: ${label}`}
          onClick={() => setExpanded((next) => !next)}
        >
          <span className="agent-message__tool-summary-line">
            <span className="agent-message__tool-dot" aria-hidden="true" />
            <span className="agent-message__role">{t("agent.toolGroup")}</span>
            <span className="agent-message__tool-label">{label}</span>
            {imageIds.length > 0 ? <span className="agent-message__tool-count">{t("agent.toolImageCount", { count: imageIds.length })}</span> : null}
            {toolCalls.length > 0 ? <span className="agent-message__tool-count">{t("agent.toolCallCount", { count: toolCalls.length })}</span> : null}
            {expanded ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
          </span>
        </button>
      </div>
      <div id={detailsId} className="agent-message__tool-details" hidden={!expanded}>
        {toolCalls.length > 0 ? (
          <ul className="agent-tool-call-list">
            {toolCalls.map((call) => (
              <AgentToolCallRow
                key={call.id}
                call={call}
                imagesById={imagesById}
                currentImageId={currentImageId}
                onImageSelect={onImageSelect}
              />
            ))}
          </ul>
        ) : null}
        {imageIds.length > 0 ? (
          <div className="agent-message__tool-thumbs">
            {imageIds.map((imageId) => {
              const image = imagesById[imageId];
              if (!image) return null;
              return (
                <AgentResultThumb
                  key={imageId}
                  image={image}
                  selected={imageId === currentImageId}
                  compact
                  onSelect={onImageSelect}
                />
              );
            })}
          </div>
        ) : null}
      </div>
    </article>
  );
}
