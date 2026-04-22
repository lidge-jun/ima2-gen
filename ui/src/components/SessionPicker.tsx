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
    const next = window.prompt("Session title", active?.title ?? "Untitled");
    if (next && next.trim()) renameSession(next.trim());
  };

  const handleDelete = (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    void deleteSession(id);
  };

  return (
    <div className="session-picker">
      <div className="session-picker-row">
        <button
          type="button"
          className="session-current"
          onClick={() => setOpen((v) => !v)}
          title="Switch session"
        >
          <span className="session-title">{active?.title ?? "Loading…"}</span>
          <span className="session-caret">{open ? "▾" : "▸"}</span>
        </button>
        <button
          type="button"
          className="session-btn"
          onClick={() => void createSession("Untitled")}
          title="New session"
        >
          +
        </button>
        <button
          type="button"
          className="session-btn"
          onClick={handleRename}
          title="Rename"
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
                title="Delete"
              >
                ×
              </button>
            </li>
          ))}
          {sessions.length === 0 && (
            <li className="session-empty">No sessions yet</li>
          )}
        </ul>
      )}
    </div>
  );
}
