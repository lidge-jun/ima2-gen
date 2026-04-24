import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useAppStore } from "../store/useAppStore";
import type { GenerateItem } from "../types";
import { deleteHistoryItem, restoreHistoryItem, getHistoryGrouped } from "../lib/api";

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

function dateBucket(createdAt: number | undefined): string {
  if (!createdAt) return "이전";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "이전";
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return "오늘";
  if (diffDays === 1) return "어제";
  if (diffDays < 7) return "이번 주";
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function GalleryModal() {
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
        const toItem = (h: (typeof page.loose)[number]): GenerateItem => ({
          image: h.url,
          url: h.url,
          filename: h.filename,
          prompt: h.prompt ?? undefined,
          size: h.size ?? undefined,
          quality: h.quality ?? undefined,
          provider: h.provider,
          createdAt: h.createdAt,
        });
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

  const normalizedQuery = useMemo(
    () => query.trim().toLowerCase().normalize("NFC"),
    [query],
  );

  const matchesQuery = useMemo(() => {
    if (!normalizedQuery) return () => true;
    return (h: GenerateItem) =>
      (h.prompt ?? "").toLowerCase().normalize("NFC").includes(normalizedQuery) ||
      (h.filename ?? "").toLowerCase().normalize("NFC").includes(normalizedQuery);
  }, [normalizedQuery]);

  const filtered = useMemo(() => {
    if (!normalizedQuery) return history;
    return history.filter(matchesQuery);
  }, [history, normalizedQuery, matchesQuery]);

  const filteredSessionGroups = useMemo(() => {
    if (!normalizedQuery) return sessionGroups;
    return sessionGroups
      .map((g) => ({ ...g, items: g.items.filter(matchesQuery) }))
      .filter((g) => g.items.length > 0);
  }, [sessionGroups, normalizedQuery, matchesQuery]);

  const filteredLoose = useMemo(() => {
    if (!normalizedQuery) return loose;
    return loose.filter(matchesQuery);
  }, [loose, normalizedQuery, matchesQuery]);

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
          <img src={item.thumb || item.image} alt={item.prompt ?? "생성 이미지"} loading="lazy" decoding="async" />
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
            title="삭제 (10초 내 복구 가능)"
            aria-label="이미지 삭제"
          >
            ×
          </button>
        )}
      </div>
    );
  };

  const showSessions = groupBy === "session";
  const totalVisible = showSessions
    ? filteredSessionGroups.reduce((a, g) => a + g.items.length, 0) +
      filteredLoose.length
    : filtered.length;

  return (
    <div className="gallery-backdrop" onClick={close} role="presentation">
      <div
        className="gallery"
        role="dialog"
        aria-modal="true"
        aria-label="이미지 갤러리"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="gallery__header">
          <div className="gallery__title-row">
            <div className="gallery__title">갤러리</div>
            <div className="gallery__meta">
              총 {totalVisible}장
              {query ? ` / 전체 ${history.length}장` : ""}
            </div>
            <div className="gallery__group-toggle" role="tablist" aria-label="정렬 기준">
              <button
                type="button"
                role="tab"
                aria-selected={groupBy === "date"}
                className={groupBy === "date" ? "active" : ""}
                onClick={() => setGroupBy("date")}
              >
                날짜
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={groupBy === "session"}
                className={groupBy === "session" ? "active" : ""}
                onClick={() => setGroupBy("session")}
              >
                세션
              </button>
            </div>
          </div>
          <input
            type="text"
            className="gallery__search"
            placeholder="프롬프트나 파일명을 검색 (Esc로 닫기)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button
            type="button"
            className="gallery__close"
            onClick={close}
            aria-label="갤러리 닫기"
            title="닫기 (Esc)"
          >
            ×
          </button>
        </div>

        <div className="gallery__scroll">
          {showSessions ? (
            <>
              {filteredSessionGroups.map((g) => (
                <section key={g.sessionId} className="gallery__group">
                  <header className="gallery__group-header">
                    <span className="gallery__group-label">세션 {g.label}</span>
                    <span className="gallery__group-count">{g.items.length}</span>
                  </header>
                  <div className="gallery__grid">
                    {g.items.map((item, i) => renderTile(item, g.sessionId, i))}
                  </div>
                </section>
              ))}
              {filteredLoose.length > 0 && (
                <section className="gallery__group">
                  <header className="gallery__group-header">
                    <span className="gallery__group-label">독립 이미지</span>
                    <span className="gallery__group-count">{filteredLoose.length}</span>
                  </header>
                  <div className="gallery__grid">
                    {filteredLoose.map((item, i) => renderTile(item, "loose", i))}
                  </div>
                </section>
              )}
              {filteredSessionGroups.length === 0 && filteredLoose.length === 0 && (
                <div className="gallery__empty">
                  {normalizedQuery
                    ? "검색 결과가 없습니다."
                    : "아직 저장된 세션이 없습니다."}
                </div>
              )}
            </>
          ) : filtered.length === 0 ? (
            <div className="gallery__empty">
              {history.length === 0
                ? "아직 생성된 이미지가 없습니다. 먼저 하나 만들어보세요."
                : "검색 결과가 없습니다."}
            </div>
          ) : (
            dateGroups.map(([label, items]) => (
              <section key={label} className="gallery__group">
                <header className="gallery__group-header">
                  <span className="gallery__group-label">{label}</span>
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
            <span>삭제됨: {pending.filename}</span>
            <button type="button" onClick={handleUndo}>
              되돌리기
            </button>
            <span className="gallery__undo-timer">
              {Math.max(0, Math.ceil((pending.expiresAt - Date.now()) / 1000))}초
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
