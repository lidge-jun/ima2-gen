import { useAppStore } from "../store/useAppStore";

function formatRelative(ts: number | undefined): string {
  if (!ts) return "";
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(ts).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

function buildTooltip(item: {
  prompt?: string;
  createdAt?: number;
  quality?: string;
  size?: string;
}): string {
  const head = item.prompt ? item.prompt.slice(0, 80) : "이미지";
  const meta = [
    formatRelative(item.createdAt),
    item.quality,
    item.size,
  ]
    .filter(Boolean)
    .join(" · ");
  return meta ? `${head}\n${meta}` : head;
}

export function HistoryStrip() {
  const history = useAppStore((s) => s.history);
  const currentImage = useAppStore((s) => s.currentImage);
  const selectHistory = useAppStore((s) => s.selectHistory);
  const openGallery = useAppStore((s) => s.openGallery);

  return (
    <div className="history-strip">
      <button
        type="button"
        className="history-thumb history-thumb--add"
        onClick={openGallery}
        aria-label="갤러리 열기"
        title={`전체 갤러리 (${history.length}장)`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </button>
      {history.map((item, i) => {
        const active = item.filename
          ? currentImage?.filename === item.filename
          : currentImage?.image === item.image;
        return (
          <button
            type="button"
            key={item.filename ?? `${i}-${item.image}`}
            className={`history-thumb${active ? " active" : ""}`}
            onClick={() => selectHistory(item)}
            title={buildTooltip(item)}
            aria-label={item.prompt ? `선택: ${item.prompt.slice(0, 40)}` : "이미지 선택"}
            aria-pressed={active}
          >
            <img
              src={item.thumb || item.url || item.image}
              alt=""
              loading="lazy"
              decoding="async"
            />
          </button>
        );
      })}
    </div>
  );
}
