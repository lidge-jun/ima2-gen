import type { MouseEvent } from "react";
import type { GenerateItem } from "../types";

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

type GalleryImageTileProps = {
  item: GenerateItem;
  active: boolean;
  itemRef: (node: HTMLElement | null) => void;
  onSelect: (item: GenerateItem) => void;
  onDelete: (item: GenerateItem, event: MouseEvent<HTMLButtonElement>) => void;
  onToggleFavorite?: (item: GenerateItem) => void;
  t: TranslateFn;
};

export function GalleryImageTile({ item, active, itemRef, onSelect, onDelete, onToggleFavorite, t }: GalleryImageTileProps) {
  return (
    <div
      ref={itemRef}
      className={`gallery__tile-wrap${active ? " gallery__tile-wrap--active" : ""}${item.isFavorite ? " gallery__tile-wrap--favorite" : ""}`}
    >
      <button
        type="button"
        className={`gallery__tile${active ? " gallery__tile--active" : ""}`}
        onClick={() => onSelect(item)}
        title={item.prompt ?? ""}
      >
        <img
          src={item.thumb || item.image}
          alt={item.prompt ?? t("gallery.imageAltFallback")}
          loading="lazy"
          decoding="async"
        />
        {item.prompt && (
          <div className="gallery__caption">
            <span className="gallery__caption-text">{item.prompt}</span>
          </div>
        )}
      </button>
      {item.filename && onToggleFavorite && (
        <button
          type="button"
          className={`gallery__favorite${item.isFavorite ? " gallery__favorite--on" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite(item);
          }}
          title={item.isFavorite ? t("gallery.unfavoriteTitle") : t("gallery.favoriteTitle")}
          aria-label={item.isFavorite ? t("gallery.unfavoriteAria") : t("gallery.favoriteAria")}
        >
          {item.isFavorite ? "★" : "☆"}
        </button>
      )}
      {item.filename && (
        <button
          type="button"
          className="gallery__delete"
          onClick={(event) => onDelete(item, event)}
          title={t("gallery.deleteTitle")}
          aria-label={t("gallery.deleteAria")}
        >
          ×
        </button>
      )}
    </div>
  );
}
