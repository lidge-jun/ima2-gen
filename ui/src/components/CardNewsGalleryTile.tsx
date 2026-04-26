import type { MouseEvent } from "react";
import { useI18n } from "../i18n";
import type { GenerateItem } from "../types";

type CardNewsGalleryTileProps = {
  item: GenerateItem;
  onOpen: (item: GenerateItem) => void;
  onCopyPath: (item: GenerateItem, e: MouseEvent<HTMLButtonElement>) => void;
  onDownloadManifest: (item: GenerateItem, e: MouseEvent<HTMLButtonElement>) => void;
};

export function CardNewsGalleryTile({
  item,
  onOpen,
  onCopyPath,
  onDownloadManifest,
}: CardNewsGalleryTileProps) {
  const { t } = useI18n();
  const leadHeadline = item.cards?.find((card) => card.headline)?.headline;
  const title = leadHeadline || item.headline || t("gallery.cardNewsSet");

  return (
    <>
      <button
        type="button"
        className="gallery__tile"
        onClick={() => onOpen(item)}
        title={title}
      >
        {item.image ? <img src={item.image} alt={title} loading="lazy" /> : null}
        <div className="gallery__caption">
          <small>{t("gallery.cardNewsSet")}</small>
          <span className="gallery__caption-text">{title}</span>
        </div>
        <div className="gallery-card-news-strip">
          {(item.cards || []).slice(0, 5).map((card, cardIdx) => (
            <span key={`${card.url}-${cardIdx}`}>
              {card.url ? <img src={card.url} alt={card.headline ?? ""} loading="lazy" /> : null}
              <em>{card.cardOrder ?? cardIdx + 1}</em>
            </span>
          ))}
        </div>
      </button>
      <div className="gallery-card-news-actions">
        <span>{t("gallery.cardNewsCount", { n: item.cards?.length ?? 0 })}</span>
        <button type="button" onClick={() => onOpen(item)}>
          {t("gallery.openCardNewsSet")}
        </button>
        <button type="button" onClick={(e) => onCopyPath(item, e)}>
          {t("gallery.copyCardNewsSetPath")}
        </button>
        <button type="button" onClick={(e) => onDownloadManifest(item, e)}>
          {t("gallery.downloadCardNewsManifest")}
        </button>
      </div>
    </>
  );
}
