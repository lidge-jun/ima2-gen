import { useState, useCallback } from "react";
import { useI18n } from "../i18n";

type VertexJsonInputProps = {
  configured: boolean;
  maskedKey: string | null;
  source: string;
  onSaved: () => void;
};

export function VertexJsonInput({ configured, maskedKey, source, onSaved }: VertexJsonInputProps) {
  const { t } = useI18n();
  const [json, setJson] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const isEnv = source === "env";
  const dirty = json.trim().length > 0;
  const showMasked = configured && !editing && !dirty;

  const handleSave = useCallback(async () => {
    if (!dirty) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/keys/vertex", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceAccountJson: json.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || t("settings.apiKeys.saveFailed"));
      } else {
        setJson("");
        setEditing(false);
        setSuccess(true);
        onSaved();
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch {
      setError(t("settings.apiKeys.networkError"));
    } finally {
      setSaving(false);
    }
  }, [json, dirty, onSaved, t]);

  const handleDelete = useCallback(async () => {
    try {
      const response = await fetch("/api/keys/vertex", { method: "DELETE" });
      if (!response.ok) {
        setError(t("settings.apiKeys.removeFailed"));
        return;
      }
      setJson("");
      setEditing(false);
      onSaved();
    } catch {
      setError(t("settings.apiKeys.networkError"));
    }
  }, [onSaved, t]);

  const handleFocus = useCallback(() => {
    if (configured && !isEnv) {
      setEditing(true);
    }
  }, [configured, isEnv]);

  const handleBlur = useCallback(() => {
    if (!dirty) {
      setEditing(false);
    }
  }, [dirty]);

  return (
    <div className="vertex-json-section">
      <p className="settings-eyebrow">
        {isEnv ? t("settings.apiKeys.envSource") : t("settings.apiKeys.configSource")}
      </p>
      {configured && maskedKey && (
        <p className="vertex-project-id">{maskedKey}</p>
      )}
      {showMasked ? (
        <textarea
          className="vertex-json-textarea is-masked"
          value={`●●● (${t("settings.apiKeys.configuredReplace")})`}
          readOnly
          onFocus={handleFocus}
          onClick={handleFocus}
        />
      ) : (
        <textarea
          className={`vertex-json-textarea${error ? " is-invalid" : ""}`}
          placeholder={t("settings.apiKeys.vertex.placeholder")}
          value={json}
          onChange={(e) => { setJson(e.target.value); setError(null); }}
          onBlur={handleBlur}
          readOnly={isEnv}
          autoFocus={editing}
          spellCheck={false}
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
        />
      )}
      <div className="api-key-actions" style={{ marginTop: 8 }}>
        {!isEnv && (
          <button
            type="button"
            className="settings-action-btn"
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            {saving ? t("settings.apiKeys.saving") : success ? t("settings.apiKeys.saved") : t("settings.apiKeys.save")}
          </button>
        )}
        {configured && !isEnv && (
          <button
            type="button"
            className="settings-action-btn settings-action-btn--danger"
            onClick={handleDelete}
          >
            {t("settings.apiKeys.remove")}
          </button>
        )}
      </div>
      {error && <p className="api-key-error">{error}</p>}
      <div className={`settings-status${configured ? " is-ok" : ""}`} style={{ marginTop: 8 }}>
        <span aria-hidden="true" />
        {configured ? t("settings.apiKeys.status.valid") : t("settings.apiKeys.status.notConfigured")}
      </div>
    </div>
  );
}
