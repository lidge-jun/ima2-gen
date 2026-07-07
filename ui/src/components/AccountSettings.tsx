import { useState } from "react";
import { useBilling } from "../hooks/useBilling";
import { useGrokStatus } from "../hooks/useGrokStatus";
import { useOAuthStatus } from "../hooks/useOAuthStatus";
import { useAgyStatus } from "../hooks/useAgyStatus";
import { useI18n } from "../i18n";
import { ApiBaseUrlInput } from "./ApiBaseUrlInput";
import { ApiKeyInput } from "./ApiKeyInput";
import { GeminiKeySection } from "./GeminiKeySection";
import { useKeyStatus } from "../hooks/useKeyStatus";

function statusLabel(t: (key: string) => string, status?: string): string {
  if (status === "ready") return t("settings.account.status.ready");
  if (status === "auth_required") return t("settings.account.status.authRequired");
  if (status === "starting") return t("settings.account.status.starting");
  if (status === "offline") return t("settings.account.status.offline");
  if (status === "no_image_model") return t("settings.account.status.noImageModel");
  if (status === "error") return t("settings.account.status.error");
  return t("settings.account.status.checking");
}

export function AccountSettings() {
  const { t } = useI18n();
  const oauth = useOAuthStatus();
  const grok = useGrokStatus();
  const agy = useAgyStatus();
  const { data, error } = useBilling();
  const { data: keyStatus, mutate: mutateKeys } = useKeyStatus();
  const [keysOpen, setKeysOpen] = useState(false);
  const showApiKeyCard =
    data?.apiKeySource === "env" ||
    data?.apiKeySource === "config" ||
    data?.apiKeyValid === true;
  const oauthReady = oauth?.status === "ready";
  const apiSource =
    data?.apiKeySource === "config"
      ? t("settings.account.apiSourceConfig")
      : t("settings.account.apiSourceEnv");
  const apiReady = data?.apiKeyValid === true;
  const grokReady = grok?.status === "ready";

  return (
    <>
      <article className="settings-row">
        <div className="settings-row__copy">
          <p className="settings-eyebrow">{t("settings.account.primaryEyebrow")}</p>
          <h4>{t("settings.account.oauthTitle")}</h4>
          <p>{t("settings.account.oauthBody")}</p>
        </div>
        <div className={`settings-status${oauthReady ? " is-ok" : ""}`}>
          <span aria-hidden="true" />
          {statusLabel(t, oauth?.status)}
        </div>
      </article>

      {showApiKeyCard ? (
        <article className="settings-row">
          <div className="settings-row__copy">
            <p className="settings-eyebrow">{apiSource}</p>
            <h4>{t("settings.account.apiTitle")}</h4>
            <p>{t("settings.account.apiBody")}</p>
          </div>
          <div className={`settings-status${apiReady ? " is-ok" : " is-muted"}`}>
            <span aria-hidden="true" />
            {error
              ? t("settings.account.apiUnknown")
              : apiReady
                ? t("settings.account.apiReady")
                : t("settings.account.apiUnavailable")}
          </div>
        </article>
      ) : null}

      <article className="settings-row">
        <div className="settings-row__copy">
          <p className="settings-eyebrow">{t("settings.account.grokEyebrow")}</p>
          <h4>{t("settings.account.grokTitle")}</h4>
          <p>{t("settings.account.grokBody")}</p>
        </div>
        <div className={`settings-status${grokReady ? " is-ok" : " is-muted"}`}>
          <span aria-hidden="true" />
          {statusLabel(t, grok?.status)}
        </div>
      </article>

      <article className="settings-row">
        <div className="settings-row__copy">
          <p className="settings-eyebrow">{t("settings.account.agyEyebrow")}</p>
          <h4>{t("settings.account.agyTitle")}</h4>
          {agy?.installed ? (
            <p>{t("settings.account.agyInstalledBody")}</p>
          ) : (
            <p>
              {t("settings.account.agyMissingBody")}{" "}
              <a
                href="https://antigravity.google/docs/cli-install"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("settings.account.agyMissingLink")}
              </a>
            </p>
          )}
          <p style={{ fontSize: "12px", color: "var(--text-dim, #888)", marginTop: "4px" }}>
            {t("settings.account.agyFineprint")}
          </p>
        </div>
        <div className={`settings-status${agy?.installed ? " is-ok" : " is-muted"}`}>
          <span aria-hidden="true" />
          {agy?.installed ? t("settings.account.agyInstalled") : t("settings.account.agyMissing")}
        </div>
      </article>

      {keyStatus && (
        <article className="settings-row settings-accordion">
          <button
            type="button"
            className="settings-accordion__trigger"
            onClick={() => setKeysOpen(!keysOpen)}
          >
            <h4>{t("settings.apiKeys.accordionTitle")}</h4>
            <span className={`settings-accordion__arrow${keysOpen ? " is-open" : ""}`}>▼</span>
          </button>
          {keysOpen && (
            <div className="settings-accordion__body">
              {keyStatus.openaiBaseUrl && (
                <ApiBaseUrlInput
                  value={keyStatus.openaiBaseUrl.value}
                  defaultValue={keyStatus.openaiBaseUrl.defaultValue}
                  custom={keyStatus.openaiBaseUrl.custom}
                  onSaved={mutateKeys}
                />
              )}
              <ApiKeyInput
                provider="openai"
                label={t("settings.apiKeys.openai.label")}
                placeholder={t("settings.apiKeys.openai.placeholder")}
                maskedKey={keyStatus.openai?.maskedKey ?? null}
                source={keyStatus.openai?.source ?? "none"}
                configured={keyStatus.openai?.configured ?? false}
                onSaved={mutateKeys}
              />
              <ApiKeyInput
                provider="xai"
                label={t("settings.apiKeys.xai.label")}
                placeholder={t("settings.apiKeys.xai.placeholder")}
                maskedKey={keyStatus.xai?.maskedKey ?? null}
                source={keyStatus.xai?.source ?? "none"}
                configured={keyStatus.xai?.configured ?? false}
                onSaved={mutateKeys}
              />
              <GeminiKeySection
                keyStatus={keyStatus}
                onSaved={mutateKeys}
              />
            </div>
          )}
        </article>
      )}
    </>
  );
}
