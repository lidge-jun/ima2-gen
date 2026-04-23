import { useAppStore } from "../store/useAppStore";
import { estimateCost } from "../lib/cost";

export function CostEstimate() {
  const provider = useAppStore((s) => s.provider);
  const quality = useAppStore((s) => s.quality);
  const getResolvedSize = useAppStore((s) => s.getResolvedSize);
  const size = getResolvedSize();

  const free = provider === "oauth";
  const cost = estimateCost(quality, size);
  const label = free ? "무료" : `약 $${cost.toFixed(3)}`;
  const color = free ? "var(--green)" : undefined;

  return (
    <div className="cost-estimate">
      <span>예상 비용</span>
      <span className="price" style={color ? { color } : undefined}>
        {label}
      </span>
    </div>
  );
}
