import { useEffect } from "react";
import { useI18n } from "../../i18n";
import { usePromptBuilderStore } from "../../store/promptBuilderStore";
import { PromptBuilderScopeBadge } from "./PromptBuilderScopeBadge";
import { PromptBuilderModelMenu } from "./PromptBuilderModelMenu";
import { PromptBuilderMessageList } from "./PromptBuilderMessageList";
import { PromptBuilderComposer } from "./PromptBuilderComposer";

type PromptBuilderPanelProps = {
  variant?: "panel" | "sidebar";
};

export function PromptBuilderPanel({ variant = "panel" }: PromptBuilderPanelProps) {
  const { t } = useI18n();
  const lastBackend = usePromptBuilderStore((state) => state.lastBackend);
  const loadConfig = usePromptBuilderStore((state) => state.loadConfig);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  return (
    <section
      className={`prompt-builder prompt-builder--${variant}`}
      aria-label={t("promptBuilder.title")}
    >
      <div className="prompt-builder__header">
        <div>
          <span className="section-title">{t("promptBuilder.title")}</span>
          <PromptBuilderScopeBadge />
          {lastBackend ? (
            <span className="prompt-builder__backend-badge">
              {t("promptBuilder.viaBackend", {
                backend: t(
                  `promptBuilder.backends.${lastBackend === "grok-api" ? "grokApi" : lastBackend}`,
                ),
              })}
            </span>
          ) : null}
        </div>
        <div className="prompt-builder__header-actions">
          <PromptBuilderModelMenu />
        </div>
      </div>

      <PromptBuilderMessageList />
      <PromptBuilderComposer />
    </section>
  );
}
