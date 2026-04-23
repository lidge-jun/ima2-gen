import { useState } from "react";
import { useAppStore } from "../store/useAppStore";

export function SessionPicker() {
  const sessions = useAppStore((s) => s.sessions);
  const activeId = useAppStore((s) => s.activeSessionId);
  const switchSession = useAppStore((s) => s.switchSession);
  const createSession = useAppStore((s) => s.createAndSwitchSession);
  const renameSession = useAppStore((s) => s.renameCurrentSession);
  const deleteSession = useAppStore((s) => s.deleteSessionById);
  const [open, setOpen] = useState(false);

  const active = sessions.find((s) => s.id === activeId);

  const handleRename = () => {
    const next = window.prompt("세션 이름", active?.title ?? "새 세션");
    if (next && next.trim()) renameSession(next.trim());
  };

  const handleDelete = (id: string, title: string) => {
    if (!window.confirm(`"${title}" 세션을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
    void deleteSession(id);
  };

  return (
    <div className="session-picker">
      <div className="session-picker-row">
        <button
          type="button"
          className="session-current"
          onClick={() => setOpen((v) => !v)}
          title="세션 전환"
        >
          <span className="session-title">{active?.title ?? "불러오는 중..."}</span>
          <span className="session-caret">{open ? "▴" : "▾"}</span>
        </button>
        <button
          type="button"
          className="session-btn"
          onClick={() => void createSession("새 세션")}
          title="새 세션"
        >
          +
        </button>
        <button
          type="button"
          className="session-btn"
          onClick={handleRename}
          title="이름 변경"
          disabled={!active}
        >
          ✎
        </button>
      </div>
      {open && (
        <ul className="session-list">
          {sessions.map((s) => (
            <li key={s.id} className={s.id === activeId ? "is-active" : ""}>
              <button
                type="button"
                className="session-item"
                onClick={() => {
                  setOpen(false);
                  void switchSession(s.id);
                }}
              >
                <span className="session-item-title">{s.title}</span>
                <span className="session-item-count">{s.nodeCount}</span>
              </button>
              <button
                type="button"
                className="session-del"
                onClick={() => handleDelete(s.id, s.title)}
                title="삭제"
              >
                ×
              </button>
            </li>
          ))}
          {sessions.length === 0 && (
            <li className="session-empty">아직 세션이 없습니다</li>
          )}
        </ul>
      )}
    </div>
  );
}
