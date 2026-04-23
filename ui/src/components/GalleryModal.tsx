import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useAppStore } from "../store/useAppStore";
import type { GenerateItem } from "../types";
import { deleteHistoryItem, restoreHistoryItem, getHistoryGrouped } from "../lib/api";
import { useI18n } from "../i18n";

type TrashPending = {
  filename: string;
  trashId: string;
  item: GenerateItem;
  expiresAt: number;
};

type SessionGroup = {
  sessionId: string;
  label: string;
  items: GenerateItem[];
};

type DateBucketKey = "earlier" | "today" | "yesterday" | "thisWeek" | string;

function dateBucket(createdAt: number | undefined): DateBucketKey {
  if (!createdAt) return "earlier";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "earlier";
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return "thisWeek";
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function GalleryModal() {
  const { t } = useI18n();
  const open = useAppStore((s) => s.galleryOpen);
  const close = useAppStore((s) => s.closeGallery);
  const history = useAppStore((s) => s.history);
  const selectHistory = useAppStore((s) => s.selectHistory);
  const currentImage = useAppStore((s) => s.currentImage);
  const removeFromHistory = useAppStore((s) => s.removeFromHistory);
  const addHistoryItem = useAppStore((s) => s.addHistoryItem);

  const [query, setQuery] = useState("");
  const [groupBy, setGroupBy] = useState<"date" | "session">("date");
  const [sessionGroups, setSessionGroups] = useState<SessionGroup[]>([]);
  const [loose, setLoose] = useState<GenerateItem[]>([]);
  const [pending, setPending] = useState<TrashPending | null>(null);

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
    if (!open || groupBy !== "session") return;
    let cancelled = false;
    (async () => {
      try {
        const page = await getHistoryGrouped({ limit: 500 });
        if (cancelled) return;
        const toItem = (h: (typeof page.loose)[number]): GenerateItem => {
          const k = h.kind;
          const narrowedKind: GenerateItem["kind"] =
            k === "classic" || k === "edit" || k === "generate" ? k : null;
          return {
            image: h.url,
            url: h.url,
            filename: h.filename,
            prompt: h.prompt ?? undefined,
            size: h.size ?? undefined,
            quality: h.quality ?? undefined,
            provider: h.provider,
            createdAt: h.createdAt,
            sessionId: h.sessionId ?? null,
            nodeId: h.nodeId ?? null,
            clientNodeId: h.clientNodeId ?? null,
            kind: narrowedKind,
          };
        };
        setSessionGroups(
          page.sessions.map((s) => ({
            sessionId: s.sessionId,
            label: s.sessionId.slice(0, 8),
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
    if (!q) return history;
    return history.filter(
      (h) =>
        (h.prompt ?? "").toLowerCase().normalize("NFC").includes(q) ||
        (h.filename ?? "").toLowerCase().normalize("NFC").includes(q),
    );
  }, [history, query]);

  const dateGroups = useMemo(() => {
    const map = new Map<string, GenerateItem[]>();
    for (const item of filtered) {
      const key = dateBucket(item.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries());
  }, [filtered]);

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

  if (!open) return null;

  const localizeBucket = (key: string): string => {
    if (key === "earlier" || key === "today" || key === "yesterday" || key === "thisWeek") {
      return t(`gallery.${key}`);
    }
    return key;
  };

  const renderTile = (item: GenerateItem, keyPrefix: string, idx: number) => {
    const active = currentImage?.image === item.image;
    return (
      <div
        key={`${keyPrefix}-${idx}-${item.filename ?? idx}`}
        className={`gallery__tile-wrap${active ? " gallery__tile-wrap--active" : ""}`}
      >
        <button
          type="button"
          className={`gallery__tile${active ? " gallery__tile--active" : ""}`}
          onClick={() => {
            selectHistory(item);
            close();
          }}
          title={item.prompt ?? ""}
        >
          <img src={item.thumb || item.image} alt={item.prompt ?? t("gallery.imageAltFallback")} loading="lazy" decoding="async" />
          {item.prompt && (
            <div className="gallery__caption">
              <span className="gallery__caption-text">{item.prompt}</span>
            </div>
          )}
        </button>
        {item.filename && (
          <button
            type="button"
            className="gallery__delete"
            onClick={(e) => handleDelete(item, e)}
            title={t("gallery.deleteTitle")}
            aria-label={t("gallery.deleteAria")}
          >
            ×
          </button>
        )}
      </div>
    );
  };

  const showSessions = groupBy === "session";
  const totalVisible = showSessions
    ? sessionGroups.reduce((a, g) => a + g.items.length, 0) + loose.length
    : filtered.length;

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
              {query ? t("gallery.totalFiltered", { n: history.length }) : ""}
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

        <div className="gallery__scroll">
          {showSessions ? (
            <>
              {sessionGroups.map((g) => (
                <section key={g.sessionId} className="gallery__group">
                  <header className="gallery__group-header">
                    <span className="gallery__group-label">{t("gallery.sessionLabel", { name: g.label })}</span>
                    <span className="gallery__group-count">{g.items.length}</span>
                  </header>
                  <div className="gallery__grid">
                    {g.items.map((item, i) => renderTile(item, g.sessionId, i))}
                  </div>
                </section>
              ))}
              {loose.length > 0 && (
                <section className="gallery__group">
                  <header className="gallery__group-header">
                    <span className="gallery__group-label">{t("gallery.standalone")}</span>
                    <span className="gallery__group-count">{loose.length}</span>
                  </header>
                  <div className="gallery__grid">
                    {loose.map((item, i) => renderTile(item, "loose", i))}
                  </div>
                </section>
              )}
              {sessionGroups.length === 0 && loose.length === 0 && (
                <div className="gallery__empty">{t("gallery.emptySessions")}</div>
              )}
            </>
          ) : filtered.length === 0 ? (
            <div className="gallery__empty">
              {history.length === 0
                ? t("gallery.emptyAll")
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
