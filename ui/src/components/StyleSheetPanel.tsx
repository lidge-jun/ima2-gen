import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import type { StyleSheet } from "../lib/api";

const EMPTY_SHEET: StyleSheet = {
  palette: [],
  composition: "",
  mood: "",
  medium: "",
  subject_details: "",
  negative: [],
};

export function StyleSheetPanel() {
  const sheet = useAppStore((s) => s.styleSheet);
  const enabled = useAppStore((s) => s.styleSheetEnabled);
  const extracting = useAppStore((s) => s.styleSheetExtracting);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const toggleEnabled = useAppStore((s) => s.toggleStyleSheetEnabled);
  const extract = useAppStore((s) => s.extractStyleSheet);
  const save = useAppStore((s) => s.saveStyleSheet);

  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<StyleSheet>(sheet ?? EMPTY_SHEET);

  if (!activeSessionId) return null;

  const openEditor = () => {
    setDraft(sheet ?? EMPTY_SHEET);
    setEditorOpen(true);
  };

  const handleSave = async () => {
    await save(draft, enabled);
    setEditorOpen(false);
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
            disabled={!hasSheet}
            onChange={() => void toggleEnabled()}
          />
          <span>🎨 Style consistency</span>
        </label>
      </div>

      {hasSheet ? (
        <div className="style-sheet-panel__summary">
          {sheet!.medium && <div><b>Medium:</b> {sheet!.medium}</div>}
          {sheet!.palette.length > 0 && (
            <div className="style-sheet-panel__chips">
              {sheet!.palette.slice(0, 6).map((c, i) => (
                <span key={i} className="style-sheet-panel__chip" title={c}>{c}</span>
              ))}
            </div>
          )}
          {sheet!.mood && <div className="style-sheet-panel__muted">Mood: {sheet!.mood}</div>}
        </div>
      ) : (
        <div className="style-sheet-panel__muted">
          No style sheet yet. Extract from the current prompt to lock in a look.
        </div>
      )}

      <div className="style-sheet-panel__actions">
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => void extract()}
          disabled={extracting}
        >
          {extracting ? "Extracting…" : "Extract from prompt"}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={openEditor}
          disabled={extracting}
        >
          Edit
        </button>
      </div>

      {editorOpen && (
        <StyleSheetEditor
          value={draft}
          onChange={setDraft}
          onCancel={() => setEditorOpen(false)}
          onSave={handleSave}
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
};

function StyleSheetEditor({ value, onChange, onCancel, onSave }: EditorProps) {
  const update = (patch: Partial<StyleSheet>) => onChange({ ...value, ...patch });

  return (
    <div className="style-sheet-editor__backdrop" onClick={onCancel}>
      <div className="style-sheet-editor" onClick={(e) => e.stopPropagation()}>
        <h3>Edit style sheet</h3>
        <label>
          Medium
          <input
            value={value.medium}
            onChange={(e) => update({ medium: e.target.value })}
            placeholder="photo / oil painting / anime / 3D render"
          />
        </label>
        <label>
          Composition
          <textarea
            rows={2}
            value={value.composition}
            onChange={(e) => update({ composition: e.target.value })}
            placeholder="centered portrait, rule of thirds, shallow depth of field…"
          />
        </label>
        <label>
          Mood
          <input
            value={value.mood}
            onChange={(e) => update({ mood: e.target.value })}
            placeholder="serene, moody, cinematic…"
          />
        </label>
        <label>
          Subject details
          <textarea
            rows={2}
            value={value.subject_details}
            onChange={(e) => update({ subject_details: e.target.value })}
            placeholder="identifying features that must persist across generations"
          />
        </label>
        <label>
          Palette (comma-separated hex or names)
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
            placeholder="#0a0a0a, #f97316, warm beige"
          />
        </label>
        <label>
          Negative (comma-separated)
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
            placeholder="blurry, extra fingers, watermark"
          />
        </label>
        <div className="style-sheet-editor__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={onSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
