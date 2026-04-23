import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";

export function GenerateButton() {
  const activeGenerations = useAppStore((s) => s.activeGenerations);
  const generate = useAppStore((s) => s.generate);
  const { t } = useI18n();

  const loading = activeGenerations > 0;
  const label = loading
    ? t("generate.buttonLoading", { n: activeGenerations })
    : t("generate.button");

  return (
    <button
      type="button"
      className={`generate-btn${loading ? " loading" : ""}`}
      onClick={() => void generate()}
    >
      {label}
    </button>
  );
}
