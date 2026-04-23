import { useBilling } from "../hooks/useBilling";

export function BillingBar() {
  const { data, error } = useBilling();

  let text = "확인 중...";
  let color = "var(--text-dim)";

  if (error || !data) {
    if (error) {
      text = "오프라인";
      color = "var(--red)";
    }
  } else if (data.credits) {
    const total = data.credits.total_granted ?? 0;
    const used = data.credits.total_used ?? 0;
    const remaining = total - used;
    text = `$${remaining.toFixed(2)} 남음`;
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
    text = `이번 달 $${(totalCost / 100).toFixed(2)}`;
    color = "var(--accent)";
  } else if (data.oauth) {
    text = "OAuth 무료 사용 가능";
    color = "var(--green)";
  } else if (data.apiKeyValid) {
    text = "API 키 비활성화됨 (OAuth 전용)";
    color = "var(--text-dim)";
  } else {
    text = "OAuth 모드";
    color = "var(--text-dim)";
  }

  return (
    <div className="billing-bar">
      <div className="label">API 상태</div>
      <div className="value" style={{ color }}>
        {text}
      </div>
    </div>
  );
}
