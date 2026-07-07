import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../i18n";

type ApiBaseUrlInputProps = {
  value: string;
  defaultValue: string;
  custom: boolean;
  onSaved: () => void;
};

export function ApiBaseUrlInput({ value, defaultValue, custom, onSaved }: ApiBaseUrlInputProps) {
  const { t } = useI18n();
  const [baseUrl, setBaseUrl] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const dirty = baseUrl.trim().replace(/\/+$/, "") !== value;

  useEffect(() => {
    setBaseUrl(value);
  }, [value]);

  const handleSave = useCallback(async () => {
    if (!dirty) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/config/api-provider/base-url", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || t("settings.apiKeys.openaiBaseUrl.saveFailed"));
        return;
      }
      setSuccess(true);
      onSaved();
      window.setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e.message || t("settings.apiKeys.openaiBaseUrl.saveFailed"));
    } finally {
      setSaving(false);
    }
  }, [baseUrl, dirty, onSaved, t]);

  const handleReset = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/config/api-provider/base-url", { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || t("settings.apiKeys.openaiBaseUrl.resetFailed"));
        return;
      }
      setBaseUrl(defaultValue);
      setSuccess(true);
      onSaved();
      window.setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e.message || t("settings.apiKeys.openaiBaseUrl.resetFailed"));
    } finally {
      setSaving(false);
    }
  }, [defaultValue, onSaved, t]);

  return (
    <article className="settings-row">
      <div className="settings-row__copy">
        <p className="settings-eyebrow">
          {custom ? t("settings.apiKeys.openaiBaseUrl.customSource") : t("settings.apiKeys.openaiBaseUrl.defaultSource")}
        </p>
        <h4>{t("settings.apiKeys.openaiBaseUrl.label")}</h4>
        <p>{t("settings.apiKeys.openaiBaseUrl.body")}</p>
        <div className="api-key-input-group">
          <input
            type="url"
            className={`api-key-input api-base-url-input${error ? " is-invalid" : ""}`}
            placeholder={t("settings.apiKeys.openaiBaseUrl.placeholder")}
            value={baseUrl}
            onChange={(e) => {
              setBaseUrl(e.target.value);
              setError(null);
              setSuccess(false);
            }}
            autoComplete="off"
            spellCheck={false}
          />
          <div className="api-key-actions">
            <button
              type="button"
              className="settings-action-btn"
              onClick={handleSave}
              disabled={!dirty || saving}
            >
              {saving ? t("settings.apiKeys.saving") : success ? t("settings.apiKeys.saved") : t("settings.apiKeys.save")}
            </button>
            {custom && (
              <button
                type="button"
                className="settings-action-btn settings-action-btn--danger"
                onClick={handleReset}
                disabled={saving}
              >
                {t("settings.apiKeys.openaiBaseUrl.reset")}
              </button>
            )}
          </div>
        </div>
        <p className="settings-row__microcopy">{t("settings.apiKeys.openaiBaseUrl.hint")}</p>
        {error && <p className="api-key-error">{error}</p>}
      </div>
      <div className={`settings-status${custom ? " is-ok" : " is-muted"}`}>
        <span aria-hidden="true" />
        {custom ? t("settings.apiKeys.openaiBaseUrl.status.custom") : t("settings.apiKeys.openaiBaseUrl.status.default")}
      </div>
    </article>
  );
}
