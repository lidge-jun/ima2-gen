import { useEffect } from "react";
import { useI18n } from "../../i18n";
import {
  usePromptBuilderStore,
  type PromptBuilderBackend,
} from "../../store/promptBuilderStore";
import { Select } from "../controls";

function backendLabel(
  backend: PromptBuilderBackend,
  t: (key: string) => string,
): string {
  if (backend === "auto") return t("promptBuilder.backends.auto");
  if (backend === "oauth") return t("promptBuilder.backends.oauth");
  if (backend === "grok") return t("promptBuilder.backends.grok");
  if (backend === "api") return t("promptBuilder.backends.api");
  return t("promptBuilder.backends.grokApi");
}

export function PromptBuilderSettings() {
  const { t } = useI18n();
  const backend = usePromptBuilderStore((state) => state.backend);
  const model = usePromptBuilderStore((state) => state.model);
  const backendOptions = usePromptBuilderStore((state) => state.backendOptions);
  const modelOptions = usePromptBuilderStore((state) => state.modelOptions);
  const locked = usePromptBuilderStore((state) => state.locked);
  const configLoaded = usePromptBuilderStore((state) => state.configLoaded);
  const configLoading = usePromptBuilderStore((state) => state.configLoading);
  const error = usePromptBuilderStore((state) => state.error);
  const loadConfig = usePromptBuilderStore((state) => state.loadConfig);
  const updateConfig = usePromptBuilderStore((state) => state.updateConfig);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  return (
    <>
      <article className="settings-row">
        <div className="settings-row__copy">
          <h4>{t("settings.promptBuilder.title")}</h4>
          <p>{t("settings.promptBuilder.body")}</p>
          {locked.backend || locked.model ? (
            <p className="settings-row__microcopy">
              {t("settings.promptBuilder.envLocked")}
            </p>
          ) : null}
          {configLoading ? (
            <p className="settings-row__microcopy">
              {t("promptBuilder.configLoading")}
            </p>
          ) : null}
          {error ? (
            <p className="settings-row__microcopy" role="alert">{error}</p>
          ) : null}
        </div>
        <div className="settings-row__control">
          <Select<PromptBuilderBackend>
            value={backend}
            items={backendOptions.map((value) => ({
              value,
              label: backendLabel(value, t),
            }))}
            onChange={(value) => void updateConfig(value)}
            ariaLabel={t("settings.promptBuilder.backendLabel")}
            disabled={!configLoaded || configLoading || locked.backend || locked.model}
          />
        </div>
      </article>
      <article className="settings-row">
        <div className="settings-row__copy">
          <h4>{t("settings.promptBuilder.modelLabel")}</h4>
          <p>{t("settings.promptBuilder.modelBody")}</p>
        </div>
        <div className="settings-row__control">
          <Select<string>
            value={model}
            items={modelOptions.map((value) => ({
              value,
              label: value === "auto" ? t("promptBuilder.modelAuto") : value,
            }))}
            onChange={(value) => void updateConfig(backend, value)}
            ariaLabel={t("settings.promptBuilder.modelLabel")}
            disabled={!configLoaded || configLoading || locked.model}
          />
        </div>
      </article>
    </>
  );
}
