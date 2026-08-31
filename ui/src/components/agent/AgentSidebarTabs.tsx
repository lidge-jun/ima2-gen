import { useCallback, useRef, type KeyboardEvent } from "react";
import { useI18n } from "../../i18n";
import type { AgentSidebarTab } from "./agentTypes";

type Props = {
  activeTab: AgentSidebarTab;
  onChange: (tab: AgentSidebarTab) => void;
};

const TABS: AgentSidebarTab[] = ["image", "library", "forms", "quality", "model", "queue"];

export function AgentSidebarTabs({ activeTab, onChange }: Props) {
  const { t } = useI18n();
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // APG tabs pattern: the tab list is one tab stop and arrow keys move between
  // tabs. Without this, reaching Queue took six Tab presses inside the panel.
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    const current = TABS.indexOf(activeTab);
    const base = current >= 0 ? current : 0;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (base + 1) % TABS.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (base - 1 + TABS.length) % TABS.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = TABS.length - 1;
    if (next === null) return;
    event.preventDefault();
    const tab = TABS[next];
    onChange(tab);
    tabRefs.current[tab]?.focus();
  }, [activeTab, onChange]);

  return (
    <div className="agent-sidebar-tabs" role="tablist" aria-label={t("agent.rightSidebar")}>
      {TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          id={`agent-sidebar-tab-${tab}`}
          ref={(node) => { tabRefs.current[tab] = node; }}
          aria-controls={`agent-sidebar-panel-${tab}`}
          className={activeTab === tab ? "active" : ""}
          aria-selected={activeTab === tab}
          tabIndex={activeTab === tab ? 0 : -1}
          onKeyDown={handleKeyDown}
          onClick={() => onChange(tab)}
        >
          {t(`agent.sidebarTabs.${tab}`)}
        </button>
      ))}
    </div>
  );
}
