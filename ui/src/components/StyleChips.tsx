import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { CHIP_GROUPS, isChipActive, toggleChip } from "../lib/styleChips";

export function StyleChips() {
  const prompt = useAppStore((s) => s.prompt);
  const setPrompt = useAppStore((s) => s.setPrompt);
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(CHIP_GROUPS.filter((g) => g.defaultOpen).map((g) => g.id)),
  );

  const toggleGroup = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onChip = (token: string) => {
    setPrompt(toggleChip(prompt, token));
  };

  return (
    <div className="chip-panel">
      {CHIP_GROUPS.map((group) => {
        const open = openIds.has(group.id);
        return (
          <div key={group.id} className="chip-group">
            <button
              type="button"
              className={`chip-group__header${open ? " open" : ""}`}
              onClick={() => toggleGroup(group.id)}
              aria-expanded={open}
            >
              <svg
                width="10" height="10" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true"
                style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}
              >
                <polyline points="9 6 15 12 9 18" />
              </svg>
              <span>{group.label}</span>
            </button>
            {open && (
              <div className="chip-group__body">
                {group.chips.map((token) => {
                  const active = isChipActive(prompt, token);
                  return (
                    <button
                      key={token}
                      type="button"
                      className={`chip${active ? " active" : ""}`}
                      onClick={() => onChip(token)}
                      aria-pressed={active}
                    >
                      {token}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
