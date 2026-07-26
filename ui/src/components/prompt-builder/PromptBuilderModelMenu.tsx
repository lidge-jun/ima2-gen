import { useState } from "react";
import { usePromptBuilderStore, type PromptBuilderModel } from "../../store/promptBuilderStore";
import { useI18n } from "../../i18n";

const MODELS: PromptBuilderModel[] = ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol", "gpt-5.5", "gpt-5.4", "gpt-5.4-mini"];

export function PromptBuilderModelMenu() {
  const model = usePromptBuilderStore((s) => s.model);
  const setModel = usePromptBuilderStore((s) => s.setModel);
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  return (
    <div
      className="prompt-builder__model-picker"
      onBlur={(e) => {
        const next = e.relatedTarget;
        if (next instanceof Node && e.currentTarget.contains(next)) return;
        setOpen(false);
      }}
    >
      <button
        type="button"
        className="prompt-builder__model-trigger"
        aria-label={t("promptBuilder.model")}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
      >
        <span>{model}</span>
      </button>
      {open && (
        <div className="prompt-builder__model-menu" role="listbox" aria-label={t("promptBuilder.model")}>
          {MODELS.map((item) => (
            <button
              key={item}
              type="button"
              role="option"
              aria-selected={item === model}
              className={`prompt-builder__model-option${item === model ? " active" : ""}`}
              onClick={() => { setModel(item); setOpen(false); }}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
