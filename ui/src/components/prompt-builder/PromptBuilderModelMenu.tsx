import { usePromptBuilderStore } from "../../store/promptBuilderStore";
import { useI18n } from "../../i18n";
import { Select } from "../controls";

export function PromptBuilderModelMenu() {
  const model = usePromptBuilderStore((s) => s.model);
  const modelOptions = usePromptBuilderStore((s) => s.modelOptions);
  const backend = usePromptBuilderStore((s) => s.backend);
  const updateConfig = usePromptBuilderStore((s) => s.updateConfig);
  const { t } = useI18n();

  return (
    <Select<string>
      className="prompt-builder__model-picker"
      items={modelOptions.map((value) => ({
        value,
        label: value === "auto" ? t("promptBuilder.modelAuto") : value,
      }))}
      value={model}
      onChange={(value) => void updateConfig(backend, value)}
      ariaLabel={t("promptBuilder.model")}
      portal
    />
  );
}
