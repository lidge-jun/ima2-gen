import { usePromptBuilderStore, type PromptBuilderModel } from "../../store/promptBuilderStore";
import { useI18n } from "../../i18n";
import { Select, type SelectItem } from "../controls";

const MODELS: PromptBuilderModel[] = ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol", "gpt-5.5", "gpt-5.4", "gpt-5.4-mini"];
const MODEL_ITEMS: SelectItem<PromptBuilderModel>[] = MODELS.map((value) => ({ value, label: value }));

export function PromptBuilderModelMenu() {
  const model = usePromptBuilderStore((s) => s.model);
  const setModel = usePromptBuilderStore((s) => s.setModel);
  const { t } = useI18n();

  return (
    <Select<PromptBuilderModel>
      className="prompt-builder__model-picker"
      items={MODEL_ITEMS}
      value={model}
      onChange={setModel}
      ariaLabel={t("promptBuilder.model")}
      portal
    />
  );
}
