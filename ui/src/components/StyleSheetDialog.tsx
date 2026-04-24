import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import type { StyleSheet } from "../lib/api";
import { useI18n } from "../i18n";

// 0.09.7.1 — centered dialog. Replaces the sidebar-docked panel.

const EMPTY_SHEET: StyleSheet = {
  palette: [],
  composition: "",
  mood: "",
  medium: "",
  subject_details: "",
  negative: [],
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export function StyleSheetDialog({ open, onClose }: Props) {
  const { t } = useI18n();
  const sheet = useAppStore((s) => s.styleSheet);
  const enabled = useAppStore((s) => s.styleSheetEnabled);
  const extracting = useAppStore((s) => s.styleSheetExtracting);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const toggleEnabled = useAppStore((s) => s.toggleStyleSheetEnabled);
  const extract = useAppStore((s) => s.extractStyleSheet);
  const save = useAppStore((s) => s.saveStyleSheet);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<StyleSheet>(sheet ?? EMPTY_SHEET);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!open) {
      setEditing(false);
      setSaving(false);
    } else {
      setDraft(sheet ?? EMPTY_SHEET);
    }
  }, [open, sheet]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  if (!open || !activeSessionId) return null;

  const hasSheet = !!sheet && (
    sheet.composition || sheet.mood || sheet.medium ||
    sheet.subject_details || sheet.palette.length > 0
  );

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await save(draft, enabled);
      setEditing(false);
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

  const update = (patch: Partial<StyleSheet>) => setDraft((s) => ({ ...s, ...patch }));

  return (
    <div
      className="style-sheet-editor__backdrop"
      onClick={saving ? undefined : onClose}
      role="presentation"
    >
      <div
        className="style-sheet-editor"
        role="dialog"
        aria-modal="true"
        aria-label={t("styleSheet.editorTitle")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="style-sheet-panel__header">
          <h3 style={{ margin: 0, fontSize: 16 }}>{t("styleSheet.editorTitle")}</h3>
          <label className="style-sheet-panel__toggle" style={{ marginLeft: "auto" }}>
            <input
              type="checkbox"
              checked={enabled}
              disabled={!hasSheet || toggling}
              onChange={() => void handleToggle()}
            />
            <span>{t("styleSheet.toggle")}</span>
          </label>
        </div>

        {!editing && (
          <>
            {hasSheet ? (
              <div className="style-sheet-panel__summary">
                {sheet!.medium && (
                  <div><b>{t("styleSheet.fields.medium")}:</b> {sheet!.medium}</div>
                )}
                {sheet!.palette.length > 0 && (
                  <div className="style-sheet-panel__chips">
                    {sheet!.palette.slice(0, 6).map((c, i) => (
                      <span key={i} className="style-sheet-panel__chip" title={c}>{c}</span>
                    ))}
                  </div>
                )}
                {sheet!.mood && (
                  <div className="style-sheet-panel__muted">
                    {t("styleSheet.fields.mood")}: {sheet!.mood}
                  </div>
                )}
              </div>
            ) : (
              <div className="style-sheet-panel__muted">{t("styleSheet.emptyHint")}</div>
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
                onClick={() => setEditing(true)}
                disabled={extracting}
              >
                {t("styleSheet.edit")}
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                style={{ marginLeft: "auto" }}
                onClick={onClose}
              >
                {t("styleSheet.cancel")}
              </button>
            </div>
          </>
        )}

        {editing && (
          <>
            <label>
              {t("styleSheet.fields.medium")}
              <input
                value={draft.medium}
                onChange={(e) => update({ medium: e.target.value })}
                placeholder={t("styleSheet.placeholderMedium")}
              />
            </label>
            <label>
              {t("styleSheet.fields.composition")}
              <textarea
                rows={2}
                value={draft.composition}
                onChange={(e) => update({ composition: e.target.value })}
                placeholder={t("styleSheet.placeholderComposition")}
              />
            </label>
            <label>
              {t("styleSheet.fields.mood")}
              <input
                value={draft.mood}
                onChange={(e) => update({ mood: e.target.value })}
                placeholder={t("styleSheet.placeholderMood")}
              />
            </label>
            <label>
              {t("styleSheet.fields.subject")}
              <textarea
                rows={2}
                value={draft.subject_details}
                onChange={(e) => update({ subject_details: e.target.value })}
                placeholder={t("styleSheet.placeholderSubject")}
              />
            </label>
            <label>
              {t("styleSheet.fields.palette")}
              <input
                value={draft.palette.join(", ")}
                onChange={(e) =>
                  update({
                    palette: e.target.value
                      .split(",").map((s) => s.trim()).filter(Boolean).slice(0, 6),
                  })
                }
                placeholder={t("styleSheet.placeholderPalette")}
              />
            </label>
            <label>
              {t("styleSheet.fields.negative")}
              <input
                value={draft.negative.join(", ")}
                onChange={(e) =>
                  update({
                    negative: e.target.value
                      .split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4),
                  })
                }
                placeholder={t("styleSheet.placeholderNegative")}
              />
            </label>
            <div className="style-sheet-editor__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                {t("styleSheet.cancel")}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? t("styleSheet.extracting") : t("styleSheet.save")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
