import { useAppStore } from "../store/useAppStore";

export function GenerateButton() {
  const activeGenerations = useAppStore((s) => s.activeGenerations);
  const generate = useAppStore((s) => s.generate);

  const loading = activeGenerations > 0;
  const label = loading ? `생성 중 (${activeGenerations})` : "생성";

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
