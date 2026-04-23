import { useAppStore } from "../store/useAppStore";
import { estimateCost } from "../lib/cost";
import { useI18n } from "../i18n";

export function CostEstimate() {
  const { t } = useI18n();
  const provider = useAppStore((s) => s.provider);
  const quality = useAppStore((s) => s.quality);
  const getResolvedSize = useAppStore((s) => s.getResolvedSize);
  const size = getResolvedSize();

  const free = provider === "oauth";
  const cost = estimateCost(quality, size);
  const label = free ? t("cost.free") : t("cost.approx", { amount: cost.toFixed(3) });
  const color = free ? "var(--green)" : undefined;

  return (
    <div className="cost-estimate">
      <span>{t("cost.label")}</span>
      <span className="price" style={color ? { color } : undefined}>
        {label}
      </span>
    </div>
  );
}
