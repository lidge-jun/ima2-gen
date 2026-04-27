import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";

export function SavePromptPopover({
  text: initialText,
  mode,
  onClose,
}: {
  text: string;
  mode?: "auto" | "direct" | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const savePromptToLibrary = useAppStore((s) => s.savePromptToLibrary);
  const [name, setName] = useState(initialText.slice(0, 30));
  const [promptText, setPromptText] = useState(initialText);
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!promptText.trim()) return;
    setSaving(true);
    await savePromptToLibrary({
      name: name.trim() || promptText.slice(0, 30),
      text: promptText.trim(),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      mode: mode || undefined,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="save-prompt-popover" onClick={(e) => e.stopPropagation()}>
      <div className="save-prompt-popover__header">
        <span>{t("promptLibrary.saveTitle")}</span>
        <button className="save-prompt-popover__close" onClick={onClose} aria-label={t("common.close")}>
          ×
        </button>
      </div>
      <div className="save-prompt-popover__body">
        <label>
          {t("promptLibrary.name")}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={promptText.slice(0, 30)}
          />
        </label>
        <label>
          {t("promptLibrary.content")}
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Enter prompt..."
            rows={4}
            autoFocus
          />
        </label>
        <label>
          {t("promptLibrary.tags")}
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="cta, product, summer"
          />
        </label>
      </div>
      <div className="save-prompt-popover__footer">
        <button onClick={handleSave} disabled={saving || !promptText.trim()} className="save-prompt-popover__save">
          {saving ? t("common.saving") : t("promptLibrary.save")}
        </button>
      </div>
    </div>
  );
}
