import { useAppStore } from "../store/useAppStore";

export function HistoryStrip() {
  const history = useAppStore((s) => s.history);
  const currentImage = useAppStore((s) => s.currentImage);
  const selectHistory = useAppStore((s) => s.selectHistory);

  if (history.length === 0) return <div className="history-strip" />;

  return (
    <div className="history-strip">
      {history.map((item, i) => {
        const active = currentImage?.image === item.image;
        return (
          <img
            key={`${i}-${item.filename ?? i}`}
            src={item.thumb || item.image}
            alt=""
            className={`history-thumb${active ? " active" : ""}`}
            onClick={() => selectHistory(item)}
          />
        );
      })}
    </div>
  );
}
