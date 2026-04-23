import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import type { StyleSheet } from "../lib/api";
import { useI18n } from "../i18n";

const EMPTY_SHEET: StyleSheet = {
  palette: [],
  composition: "",
  mood: "",
  medium: "",
  subject_details: "",
  negative: [],
};

export function StyleSheetPanel() {
  const { t } = useI18n();
  const sheet = useAppStore((s) => s.styleSheet);
  const enabled = useAppStore((s) => s.styleSheetEnabled);
  const extracting = useAppStore((s) => s.styleSheetExtracting);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const toggleEnabled = useAppStore((s) => s.toggleStyleSheetEnabled);
  const extract = useAppStore((s) => s.extractStyleSheet);
  const save = useAppStore((s) => s.saveStyleSheet);

  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<StyleSheet>(sheet ?? EMPTY_SHEET);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  if (!activeSessionId) return null;

  const openEditor = () => {
    setDraft(sheet ?? EMPTY_SHEET);
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await save(draft, enabled);
      setEditorOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    if (toggling) return;
    setToggling(true);
    try {
      await toggleEnabled();
    } finally {
      setToggling(false);
    }
  };

  const hasSheet = !!sheet && (
    sheet.composition || sheet.mood || sheet.medium ||
    sheet.subject_details || sheet.palette.length > 0
  );

  return (
    <div className="style-sheet-panel">
      <div className="style-sheet-panel__header">
        <label className="style-sheet-panel__toggle">
          <input
            type="checkbox"
            checked={enabled}
            disabled={!hasSheet || toggling}
            onChange={() => void handleToggle()}
          />
          <span>{t("styleSheet.toggle")}</span>
          </label>
      </div>

      {hasSheet ? (
        <div className="style-sheet-panel__summary">
          {sheet!.medium && <div><b>{t("styleSheet.fields.medium")}:</b> {sheet!.medium}</div>}
          {sheet!.palette.length > 0 && (
            <div className="style-sheet-panel__chips">
              {sheet!.palette.slice(0, 6).map((c, i) => (
                <span key={i} className="style-sheet-panel__chip" title={c}>{c}</span>
              ))}
            </div>
          )}
          {sheet!.mood && <div className="style-sheet-panel__muted">{t("styleSheet.fields.mood")}: {sheet!.mood}</div>}
        </div>
      ) : (
        <div className="style-sheet-panel__muted">
          {t("styleSheet.emptyHint")}
        </div>
      )}

      <div className="style-sheet-panel__actions">
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => void extract()}
          disabled={extracting}
        >
          {extracting ? t("styleSheet.extracting") : t("styleSheet.extract")}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={openEditor}
          disabled={extracting}
        >
          {t("styleSheet.edit")}
        </button>
      </div>

      {editorOpen && (
        <StyleSheetEditor
          value={draft}
          onChange={setDraft}
          onCancel={() => setEditorOpen(false)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}

type EditorProps = {
  value: StyleSheet;
  onChange: (next: StyleSheet) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
};

function StyleSheetEditor({ value, onChange, onCancel, onSave, saving }: EditorProps) {
  const { t } = useI18n();
  const update = (patch: Partial<StyleSheet>) => onChange({ ...value, ...patch });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, saving]);

  return (
    <div className="style-sheet-editor__backdrop" onClick={saving ? undefined : onCancel}>
      <div
        className="style-sheet-editor"
        role="dialog"
        aria-modal="true"
        aria-label={t("styleSheet.editorTitle")}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{t("styleSheet.editorTitle")}</h3>
        <label>
          {t("styleSheet.fields.medium")}
          <input
            value={value.medium}
            onChange={(e) => update({ medium: e.target.value })}
            placeholder={t("styleSheet.placeholderMedium")}
          />
        </label>
        <label>
          {t("styleSheet.fields.composition")}
          <textarea
            rows={2}
            value={value.composition}
            onChange={(e) => update({ composition: e.target.value })}
            placeholder={t("styleSheet.placeholderComposition")}
          />
        </label>
        <label>
          {t("styleSheet.fields.mood")}
          <input
            value={value.mood}
            onChange={(e) => update({ mood: e.target.value })}
            placeholder={t("styleSheet.placeholderMood")}
          />
        </label>
        <label>
          {t("styleSheet.fields.subject")}
          <textarea
            rows={2}
            value={value.subject_details}
            onChange={(e) => update({ subject_details: e.target.value })}
            placeholder={t("styleSheet.placeholderSubject")}
          />
        </label>
        <label>
          {t("styleSheet.fields.palette")}
          <input
            value={value.palette.join(", ")}
            onChange={(e) =>
              update({
                palette: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .slice(0, 6),
              })
            }
            placeholder={t("styleSheet.placeholderPalette")}
          />
        </label>
        <label>
          {t("styleSheet.fields.negative")}
          <input
            value={value.negative.join(", ")}
            onChange={(e) =>
              update({
                negative: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .slice(0, 4),
              })
            }
            placeholder={t("styleSheet.placeholderNegative")}
          />
        </label>
        <div className="style-sheet-editor__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>
            {t("styleSheet.cancel")}
          </button>
          <button type="button" className="btn btn--primary" onClick={onSave} disabled={saving}>
            {saving ? t("styleSheet.extracting") : t("styleSheet.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
