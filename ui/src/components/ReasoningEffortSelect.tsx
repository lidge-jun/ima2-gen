import type { ChangeEvent } from "react";
import { REASONING_EFFORT_OPTIONS, type ReasoningEffort } from "../lib/reasoning";
import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";

export function ReasoningEffortSelect() {
  const { t } = useI18n();
  const reasoningEffort = useAppStore((s) => s.reasoningEffort);
  const setReasoningEffort = useAppStore((s) => s.setReasoningEffort);

  const onChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setReasoningEffort(event.target.value as ReasoningEffort);
  };

  return (
    <div className="image-model-select image-model-select--settings">
      <select id="settings-reasoning-effort" value={reasoningEffort} onChange={onChange}>
        {REASONING_EFFORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.fullLabelKey)}
          </option>
        ))}
      </select>
    </div>
  );
}
