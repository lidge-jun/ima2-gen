import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useAppStore } from "../store/useAppStore";
import { useCardNewsStore } from "../store/cardNewsStore";
import type { GenerateItem } from "../types";
import {
  deleteHistoryItem,
  restoreHistoryItem,
  getHistoryGrouped,
  getStorageStatus,
  openGeneratedDir,
  type StorageStatus,
} from "../lib/api";
import { cardNewsManifestDownloadUrl } from "../lib/cardNewsApi";
import { dateBucket } from "../lib/galleryUtils";
import { getGalleryItemKey } from "../lib/galleryNavigation";
import { useI18n } from "../i18n";
import { CardNewsGalleryTile } from "./CardNewsGalleryTile";
import { GalleryImageTile } from "./GalleryImageTile";
type TrashPending = {
  filename: string;
  trashId: string;
  item: GenerateItem;
  expiresAt: number;
};
type SessionGroup = {
  sessionId: string;
  title: string | null;
  label: string | null;
  displayLabel: string;
  items: GenerateItem[];
};

const STORAGE_NOTICE_DISMISSED_KEY = "ima2.storageNoticeDismissed.0.09.23";

export function GalleryModal() {
  const { t } = useI18n();
  const open = useAppStore((s) => s.galleryOpen);
  const close = useAppStore((s) => s.closeGallery);
  const history = useAppStore((s) => s.history);
  const selectHistory = useAppStore((s) => s.selectHistory);
  const currentImage = useAppStore((s) => s.currentImage);
  const removeFromHistory = useAppStore((s) => s.removeFromHistory);
  const addHistoryItem = useAppStore((s) => s.addHistoryItem);
  const showToast = useAppStore((s) => s.showToast);
  const toggleGalleryFavorite = useAppStore((s) => s.toggleGalleryFavorite);

  const [query, setQuery] = useState("");
  const [groupBy, setGroupBy] = useState<"date" | "session">("date");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sessionGroups, setSessionGroups] = useState<SessionGroup[]>([]);
  const [loose, setLoose] = useState<GenerateItem[]>([]);
  const [pending, setPending] = useState<TrashPending | null>(null);
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [storageDismissed, setStorageDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_NOTICE_DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const scrollRef = useRef<HTMLDivElement | null>(null), itemRefs = useRef<Record<string, HTMLElement | null>>({});
  const lastScrollTopRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setPending(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const status = await getStorageStatus();
        if (!cancelled) setStorageStatus(status);
      } catch {
        if (!cancelled) {
          setStorageStatus({
            generatedDirLabel: "~/.ima2/generated",
            generatedCount: 0,
            legacyCandidatesScanned: 0,
            legacySourcesFound: 0,
            legacyFilesFound: 0,
            state: "unknown",
            messageKind: "unknown",
            recoveryDocsPath: "docs/RECOVER_OLD_IMAGES.md",
            doctorCommand: "ima2 doctor",
            overrides: { generatedDir: false, configDir: false },
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || groupBy !== "session") return;
    let cancelled = false;
    (async () => {
      try {
        const page = await getHistoryGrouped({ limit: 500 });
        if (cancelled) return;
        const toItem = (h: (typeof page.loose)[number]): GenerateItem => {
          const k = h.kind;
          const narrowedKind: GenerateItem["kind"] =
            k === "classic" || k === "edit" || k === "generate" ||
            k === "card-news-card" || k === "card-news-set" ? k : null;
          return {
            image: h.url,
            url: h.url,
            filename: h.filename,
            prompt: h.prompt ?? undefined,
            size: h.size ?? undefined,
            quality: h.quality ?? undefined,
            model: h.model ?? undefined,
            provider: h.provider,
            createdAt: h.createdAt,
            sessionId: h.sessionId ?? null,
            nodeId: h.nodeId ?? null,
            clientNodeId: h.clientNodeId ?? null,
            kind: narrowedKind,
            setId: h.setId ?? null,
            cardId: h.cardId ?? null,
            cardOrder: h.cardOrder ?? null,
            headline: h.headline ?? null,
            body: h.body ?? null,
            cards: h.cards,
            isFavorite: h.isFavorite ?? false,
          };
        };
        setSessionGroups(
          page.sessions.map((s) => ({
            sessionId: s.sessionId,
            title: s.title ?? null,
            label: s.label ?? null,
            displayLabel: s.title || s.label || s.sessionId.slice(0, 8),
            items: s.items.map(toItem),
          })),
        );
        setLoose(page.loose.map(toItem));
      } catch {
        // Fallback: use current history only.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, groupBy]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().normalize("NFC");
    return history.filter((h) => {
      if (favoritesOnly && !h.isFavorite) return false;
      if (!q) return true;
      return (
        (h.prompt ?? "").toLowerCase().normalize("NFC").includes(q) ||
        (h.filename ?? "").toLowerCase().normalize("NFC").includes(q)
      );
    });
  }, [history, query, favoritesOnly]);

  const visibleSessionGroups = useMemo(() => {
    if (!favoritesOnly) return sessionGroups;
    return sessionGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.isFavorite),
      }))
      .filter((group) => group.items.length > 0);
  }, [sessionGroups, favoritesOnly]);

  const visibleLoose = useMemo(() => {
    if (!favoritesOnly) return loose;
    return loose.filter((item) => item.isFavorite);
  }, [loose, favoritesOnly]);

  const dateGroups = useMemo(() => {
    const map = new Map<string, GenerateItem[]>();
    for (const item of filtered) {
      const key = dateBucket(item.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries());
  }, [filtered]);
  const totalVisible = groupBy === "session"
    ? visibleSessionGroups.reduce((a, g) => a + g.items.length, 0) + visibleLoose.length
    : filtered.length;

  useLayoutEffect(() => {
    if (!open) return;
    const selectedKey = currentImage ? getGalleryItemKey(currentImage) : null;
    const selectedEl = selectedKey ? itemRefs.current[selectedKey] : null;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "center" });
      return;
    }
    if (scrollRef.current) scrollRef.current.scrollTop = lastScrollTopRef.current;
  }, [open, currentImage?.filename, currentImage?.image, groupBy, totalVisible, dateGroups.length, visibleSessionGroups.length, visibleLoose.length]);

  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => {
      setPending((cur) => {
        if (!cur) return null;
        if (Date.now() >= cur.expiresAt) return null;
        return { ...cur };
      });
    }, 500);
    return () => clearInterval(id);
  }, [pending]);

  async function handleDelete(item: GenerateItem, e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (!item.filename) return;
    try {
      const r = await deleteHistoryItem(item.filename);
      removeFromHistory(item.filename);
      setPending({
        filename: item.filename,
        trashId: r.trashId,
        item,
        expiresAt: Date.now() + 9500,
      });
    } catch (err) {
      console.error("[gallery] delete failed", err);
    }
  }

  async function handleUndo() {
    if (!pending) return;
    try {
      await restoreHistoryItem(pending.filename, pending.trashId);
      addHistoryItem(pending.item);
    } catch (err) {
      console.error("[gallery] restore failed", err);
    } finally {
      setPending(null);
    }
  }

  async function handleOpenGeneratedDir() {
    try {
      await openGeneratedDir();
      showToast(t("toast.openGeneratedDirOpened"));
    } catch { showToast(t("toast.openGeneratedDirFailed"), true); }
  }

  async function handleOpenCardNewsSet(item: GenerateItem) {
    if (!item.setId) return;
    try {
      await useCardNewsStore.getState().loadSet(item.setId);
      useAppStore.getState().setUIMode("card-news");
      close();
    } catch {
      showToast(t("gallery.openCardNewsSetFailed"), true);
    }
  }

  async function handleCopyCardNewsSetPath(item: GenerateItem, e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (!item.setId) return;
    const path = `generated/cardnews/${item.setId}`;
    try {
      await navigator.clipboard?.writeText(path);
      showToast(t("gallery.cardNewsPathCopied"));
    } catch {
      showToast(t("toast.copyFailed"), true);
    }
  }

  function handleDownloadCardNewsManifest(item: GenerateItem, e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (!item.setId) return;
    window.open(cardNewsManifestDownloadUrl(item.setId), "_blank", "noopener,noreferrer");
  }

  function dismissStorageNotice() {
    setStorageDismissed(true);
    try {
      localStorage.setItem(STORAGE_NOTICE_DISMISSED_KEY, "1");
    } catch {
      // Storage-disabled browsers can still hide it for the current session.
    }
  }

  if (!open) return null;

  const localizeBucket = (key: string): string => {
    if (key === "earlier" || key === "today" || key === "yesterday" || key === "thisWeek") {
      return t(`gallery.${key}`);
    }
    return key;
  };

  const renderTile = (item: GenerateItem, keyPrefix: string, idx: number) => {
    const active = currentImage?.image === item.image;
    const setItemRef = (node: HTMLElement | null) => {
      itemRefs.current[getGalleryItemKey(item)] = node;
    };
    if (item.kind === "card-news-set") {
      return (
        <div
          ref={setItemRef}
          key={`${keyPrefix}-${idx}-${item.filename ?? idx}`}
          className="gallery__tile-wrap gallery-card-news-set"
        >
          <CardNewsGalleryTile
            item={item}
            onOpen={(next) => void handleOpenCardNewsSet(next)}
            onCopyPath={handleCopyCardNewsSetPath}
            onDownloadManifest={handleDownloadCardNewsManifest}
          />
        </div>
      );
    }
    return (
      <GalleryImageTile
        key={`${keyPrefix}-${idx}-${item.filename ?? idx}`}
        item={item}
        active={active}
        itemRef={setItemRef}
        onSelect={(next) => {
          selectHistory(next);
          close();
        }}
        onDelete={handleDelete}
        onToggleFavorite={(next) => void toggleGalleryFavorite(next.filename!)}
        t={t}
      />
    );
  };

  const showSessions = groupBy === "session";
  const showStorageNotice =
    storageStatus != null &&
    storageStatus.state !== "ok" &&
    !storageDismissed;
  const storageNoticeKey =
    storageStatus?.state === "recoverable" ? "gallery.storageNoticeRecoverable"
    : storageStatus?.state === "not_found" ? "gallery.storageNoticeNotFound"
    : "gallery.storageNoticeUnknown";

  return (
    <div className="gallery-backdrop" onClick={close} role="presentation">
      <div
        className="gallery"
        role="dialog"
        aria-modal="true"
        aria-label={t("gallery.ariaLabel")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="gallery__header">
          <div className="gallery__title-row">
            <div className="gallery__title">{t("gallery.title")}</div>
            <div className="gallery__meta">
              {t("gallery.total", { n: totalVisible })}
              {query || favoritesOnly ? t("gallery.totalFiltered", { n: history.length }) : ""}
            </div>
            <div className="gallery__favorite-filter" role="tablist" aria-label={t("gallery.favoriteFilterAria")}>
              <button
                type="button"
                role="tab"
                aria-selected={!favoritesOnly}
                className={!favoritesOnly ? "active" : ""}
                onClick={() => setFavoritesOnly(false)}
              >
                {t("gallery.filterAll")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={favoritesOnly}
                className={favoritesOnly ? "active" : ""}
                onClick={() => setFavoritesOnly(true)}
              >
                {t("gallery.filterFavorites")}
              </button>
            </div>
            <div className="gallery__group-toggle" role="tablist" aria-label={t("gallery.sortByAria")}>
              <button
                type="button"
                role="tab"
                aria-selected={groupBy === "date"}
                className={groupBy === "date" ? "active" : ""}
                onClick={() => setGroupBy("date")}
              >
                {t("gallery.sortByDate")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={groupBy === "session"}
                className={groupBy === "session" ? "active" : ""}
                onClick={() => setGroupBy("session")}
              >
                {t("gallery.sortBySession")}
              </button>
            </div>
          </div>
          <input
            type="text"
            className="gallery__search"
            placeholder={showSessions ? t("gallery.searchDisabledPlaceholder") : t("gallery.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            disabled={showSessions}
          />
          <button
            type="button"
            className="gallery__close"
            onClick={close}
            aria-label={t("gallery.closeAria")}
            title={t("gallery.closeTitle")}
          >
            ×
          </button>
        </div>

        <div className={`gallery__storage-bar${showStorageNotice ? " gallery__storage-bar--notice" : ""}`}>
          {showStorageNotice ? (
            <div className="gallery__storage-copy">
              <div className="gallery__storage-title">{t("gallery.storageNoticeTitle")}</div>
              <div className="gallery__storage-text">{t(storageNoticeKey)}</div>
            </div>
          ) : (
            <div className="gallery__storage-copy gallery__storage-copy--quiet">
              {storageStatus?.generatedDirLabel ?? "~/.ima2/generated"}
            </div>
          )}
          <div className="gallery__storage-actions">
            <button
              type="button"
              className="gallery__storage-button"
              onClick={handleOpenGeneratedDir}
              title={t("gallery.openGeneratedDirTitle")}
            >
              {t("gallery.openGeneratedDir")}
            </button>
            {showStorageNotice && (
              <button
                type="button"
                className="gallery__storage-button gallery__storage-button--ghost"
                onClick={dismissStorageNotice}
              >
                {t("common.close")}
              </button>
            )}
          </div>
        </div>

        <div
          className="gallery__scroll"
          ref={scrollRef}
          onScroll={() => {
            lastScrollTopRef.current = scrollRef.current?.scrollTop ?? 0;
          }}
        >
          {showSessions ? (
            <>
              {visibleSessionGroups.map((g) => (
                <section key={g.sessionId} className="gallery__group">
                  <header className="gallery__group-header">
                    <span className="gallery__group-label" title={g.sessionId}>
                      {g.title ? g.displayLabel : t("gallery.sessionLabel", { name: g.displayLabel })}
                    </span>
                    <span className="gallery__group-count">{g.items.length}</span>
                  </header>
                  <div className="gallery__grid">
                    {g.items.map((item, i) => renderTile(item, g.sessionId, i))}
                  </div>
                </section>
              ))}
              {visibleLoose.length > 0 && (
                <section className="gallery__group">
                  <header className="gallery__group-header">
                    <span className="gallery__group-label">{t("gallery.standalone")}</span>
                    <span className="gallery__group-count">{visibleLoose.length}</span>
                  </header>
                  <div className="gallery__grid">
                    {visibleLoose.map((item, i) => renderTile(item, "loose", i))}
                  </div>
                </section>
              )}
              {visibleSessionGroups.length === 0 && visibleLoose.length === 0 && (
                <div className="gallery__empty">
                  {favoritesOnly ? t("gallery.emptyFavorites") : t("gallery.emptySessions")}
                </div>
              )}
            </>
          ) : filtered.length === 0 ? (
            <div className="gallery__empty">
              {history.length === 0
                ? t("gallery.emptyAll")
                : favoritesOnly
                  ? t("gallery.emptyFavorites")
                : t("gallery.noResults")}
            </div>
          ) : (
            dateGroups.map(([label, items]) => (
              <section key={label} className="gallery__group">
                <header className="gallery__group-header">
                  <span className="gallery__group-label">{localizeBucket(label)}</span>
                  <span className="gallery__group-count">{items.length}</span>
                </header>
                <div className="gallery__grid">
                  {items.map((item, i) => renderTile(item, label, i))}
                </div>
              </section>
            ))
          )}
        </div>

        {pending && (
          <div className="gallery__undo">
            <span>{t("gallery.deleted", { filename: pending.filename })}</span>
            <button type="button" onClick={handleUndo}>
              {t("gallery.undo")}
            </button>
            <span className="gallery__undo-timer">
              {t("gallery.secondsSuffix", { n: Math.max(0, Math.ceil((pending.expiresAt - Date.now()) / 1000)) })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
