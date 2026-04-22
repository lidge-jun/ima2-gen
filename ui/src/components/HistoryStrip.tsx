import { useAppStore } from "../store/useAppStore";

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
        aria-label="Open gallery"
        title="Open full gallery"
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
          <img
            key={item.filename ?? `${i}-${item.image}`}
            src={item.thumb || item.url || item.image}
            alt=""
            className={`history-thumb${active ? " active" : ""}`}
            onClick={() => selectHistory(item)}
          />
        );
      })}
    </div>
  );
}
