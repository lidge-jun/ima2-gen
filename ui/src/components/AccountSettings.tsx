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
  const apiReady = data?.apiKeyValid === true;

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
          {statusLabel(oauth?.status)}
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
    </>
  );
}
