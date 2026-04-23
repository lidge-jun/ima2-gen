import { useBilling } from "../hooks/useBilling";
import { useI18n } from "../i18n";

export function BillingBar() {
  const { data, error } = useBilling();
  const { t } = useI18n();

  let text = t("billing.checking");
  let color = "var(--text-dim)";

  if (error || !data) {
    if (error) {
      text = t("billing.offline");
      color = "var(--red)";
    }
  } else if (data.credits) {
    const total = data.credits.total_granted ?? 0;
    const used = data.credits.total_used ?? 0;
    const remaining = total - used;
    text = t("billing.remaining", { remaining: remaining.toFixed(2) });
    color =
      remaining > 5
        ? "var(--green)"
        : remaining > 1
        ? "var(--amber)"
        : "var(--red)";
  } else if (data.costs?.data?.length) {
    const totalCost = data.costs.data.reduce((sum, bucket) => {
      return sum + bucket.results.reduce((s, r) => s + (r.amount?.value ?? 0), 0);
    }, 0);
    text = t("billing.thisMonth", { amount: (totalCost / 100).toFixed(2) });
    color = "var(--accent)";
  } else if (data.oauth) {
    text = t("billing.oauthFree");
    color = "var(--green)";
  } else if (data.apiKeyValid) {
    text = t("billing.apiDisabled");
    color = "var(--text-dim)";
  } else {
    text = t("billing.oauthMode");
    color = "var(--text-dim)";
  }

  return (
    <div className="billing-bar">
      <div className="label">{t("billing.label")}</div>
      <div className="value" style={{ color }}>
        {text}
      </div>
    </div>
  );
}
