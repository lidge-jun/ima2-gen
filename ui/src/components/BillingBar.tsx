import { useBilling } from "../hooks/useBilling";

export function BillingBar() {
  const { data, error } = useBilling();

  let text = "checking...";
  let color = "var(--text-dim)";

  if (error || !data) {
    if (error) {
      text = "offline";
      color = "var(--red)";
    }
  } else if (data.credits) {
    const total = data.credits.total_granted ?? 0;
    const used = data.credits.total_used ?? 0;
    const remaining = total - used;
    text = `$${remaining.toFixed(2)} remaining`;
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
    text = `$${(totalCost / 100).toFixed(2)} this month`;
    color = "var(--accent)";
  } else if (data.oauth) {
    text = "OAuth mode (no API key)";
    color = "var(--accent)";
  } else if (data.apiKeyValid) {
    text = "API key valid";
    color = "var(--green)";
  } else {
    text = "Could not fetch billing";
    color = "var(--text-dim)";
  }

  return (
    <div className="billing-bar">
      <div className="label">API Status</div>
      <div className="value" style={{ color }}>
        {text}
      </div>
    </div>
  );
}
