import { useBilling } from "../hooks/useBilling";
import { useOAuthStatus } from "../hooks/useOAuthStatus";
import { useI18n } from "../i18n";

function statusLabel(status?: string): string {
  if (status === "ready") return "Ready";
  if (status === "auth_required") return "Login required";
  if (status === "starting") return "Starting";
  if (status === "offline") return "Offline";
  return "Checking";
}

export function AccountSettings() {
  const { t } = useI18n();
  const oauth = useOAuthStatus();
  const { data, error } = useBilling();
  const showApiKeyCard =
    data?.apiKeySource === "env" ||
    data?.apiKeySource === "config" ||
    data?.apiKeyValid === true;
  const oauthReady = oauth?.status === "ready";
  const apiSource =
    data?.apiKeySource === "config"
      ? t("settings.account.apiSourceConfig")
      : t("settings.account.apiSourceEnv");

  return (
    <div className="settings-stack">
      <article className="settings-card settings-card--hero">
        <div>
          <p className="settings-eyebrow">{t("settings.account.primaryEyebrow")}</p>
          <h3>{t("settings.account.oauthTitle")}</h3>
          <p>{t("settings.account.oauthBody")}</p>
        </div>
        <div className={`settings-status${oauthReady ? " is-ok" : ""}`}>
          <span aria-hidden="true" />
          {statusLabel(oauth?.status)}
        </div>
      </article>

      {showApiKeyCard ? (
        <article className="settings-card">
          <div>
            <p className="settings-eyebrow">{apiSource}</p>
            <h3>{t("settings.account.apiTitle")}</h3>
            <p>{t("settings.account.apiBody")}</p>
          </div>
          <div className="settings-status is-muted">
            <span aria-hidden="true" />
            {error ? t("settings.account.apiUnknown") : t("settings.account.apiDisabled")}
          </div>
        </article>
      ) : null}
    </div>
  );
}
