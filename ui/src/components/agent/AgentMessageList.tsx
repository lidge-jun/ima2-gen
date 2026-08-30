import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../i18n";
import { AgentMessage } from "./AgentMessage";
import { AgentRunGroup } from "./AgentRunGroup";
import type { AgentImageHandle, AgentTurn } from "./agentTypes";

type Props = {
  turns: AgentTurn[];
  imagesById: Record<string, AgentImageHandle>;
  currentImageId: string | null;
  onImageSelect: (imageId: string) => void;
};

type MessageGroup =
  | { kind: "single"; turn: AgentTurn }
  | { kind: "run"; turns: AgentTurn[]; key: string };

function groupTurns(turns: AgentTurn[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let runBatch: AgentTurn[] = [];

  const flushRun = () => {
    if (runBatch.length === 0) return;
    // Key on the run's first turn, not every turn id. A concatenated key changes
    // whenever the run grows, so React remounted the whole group: inside the
    // transcript log that re-announces settled content, and it also threw away
    // any tool details the user had expanded mid-run.
    groups.push({ kind: "run", turns: runBatch, key: `run-${runBatch[0].id}` });
    runBatch = [];
  };

  for (const turn of turns) {
    if (turn.role === "user") {
      flushRun();
      groups.push({ kind: "single", turn });
    } else {
      runBatch.push(turn);
    }
  }
  flushRun();
  return groups;
}

export function AgentMessageList({ turns, imagesById, currentImageId, onImageSelect }: Props) {
  const { t } = useI18n();
  const listRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const groups = useMemo(() => groupTurns(turns), [turns]);

  const updateScrollPosition = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= 120;
    if (nearBottomRef.current) setShowJump(false);
  }, []);

  const jumpToLatest = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    nearBottomRef.current = true;
    setShowJump(false);
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (nearBottomRef.current) el.scrollTop = el.scrollHeight;
    else setShowJump(true);
  }, [turns.length]);

  // role="log" is the append-only semantic for a transcript: implicitly polite
  // and non-atomic, so assistive tech reads new entries instead of re-reading
  // the whole thread on each append. The jump control lives outside the log so
  // showing it does not announce a button as transcript content.
  return (
    <div className="agent-message-list-wrap">
      <div ref={listRef} className="agent-message-list" role="log" aria-label={t("agent.workspace")} onScroll={updateScrollPosition}>
        {turns.length === 0 ? <div className="agent-message-list__empty">{t("agent.emptyChat")}</div> : null}
        {groups.map((group) =>
          group.kind === "run" ? (
            <AgentRunGroup key={group.key} turns={group.turns} imagesById={imagesById} currentImageId={currentImageId} onImageSelect={onImageSelect} />
          ) : (
            <AgentMessage key={group.turn.id} turn={group.turn} imagesById={imagesById} currentImageId={currentImageId} onImageSelect={onImageSelect} />
          ),
        )}
      </div>
      {showJump ? <button type="button" className="agent-message-list__jump" onClick={jumpToLatest}>{t("agent.emptyJumpLatest")}</button> : null}
    </div>
  );
}
