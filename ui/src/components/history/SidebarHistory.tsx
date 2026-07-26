import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAppStore } from "../../store/useAppStore";
import { useI18n } from "../../i18n";
import {
  getSidebarHistoryActiveKey,
  groupSidebarHistoryEntries,
  SIDEBAR_HISTORY_RENDER_LIMIT,
} from "../../lib/history/sidebarHistory";
import { SidebarHistoryImageCard } from "./SidebarHistoryImageCard";
import { SidebarHistorySequenceCard } from "./SidebarHistorySequenceCard";

const COLLAPSED_STORAGE_KEY = "ima2.sidebarHistoryCollapsed";

function SidebarSkeletonCard() {
  const { t } = useI18n();
  return (
    <div className="sidebar-history__item">
      <div className="sidebar-history__thumb sidebar-history__thumb--skeleton" aria-label={t("common.generating")} />
    </div>
  );
}

function SidebarCollectionSkeleton({ count }: { count: number }) {
  const slots = Math.min(count, 4);
  return (
    <div className="sidebar-history__item">
      <div className="sidebar-history__thumb sidebar-history__thumb--collection-skeleton">
        {Array.from({ length: slots }, (_, i) => (
          <div key={i} className="sidebar-collection-mini sidebar-collection-mini--skeleton" />
        ))}
      </div>
    </div>
  );
}

export function SidebarHistory() {
  const history = useAppStore((s) => s.history);
  const currentImage = useAppStore((s) => s.currentImage);
  const selectHistory = useAppStore((s) => s.selectHistory);
  const showHistorySequence = useAppStore((s) => s.showHistorySequence);
  const trashHistoryItem = useAppStore((s) => s.trashHistoryItem);
  const trashHistorySequence = useAppStore((s) => s.trashHistorySequence);
  const inFlight = useAppStore((s) => s.inFlight);
  const multimodeSequences = useAppStore((s) => s.multimodeSequences);
  const activePreviewSequenceId = useAppStore((s) => {
    const id = s.multimodePreviewFlightId;
    if (!id) return null;
    if (id.startsWith("history:")) return id.slice("history:".length);
    return s.multimodeSequences[id]?.sequenceId ?? null;
  });
  const openGallery = useAppStore((s) => s.openGallery);
  const thumbRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const { t } = useI18n();

  const activeKey = getSidebarHistoryActiveKey(currentImage, activePreviewSequenceId);

  const visibleHistory = useMemo(
    () => groupSidebarHistoryEntries(history).slice(0, SIDEBAR_HISTORY_RENDER_LIMIT),
    [history],
  );

  useEffect(() => {
    if (!activeKey || collapsed) return;
    thumbRefs.current[activeKey]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeKey, collapsed, visibleHistory]);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* Storage is optional for this view preference. */
    }
  }, [collapsed]);

  const setThumbRef = (key: string, node: HTMLButtonElement | null) => {
    thumbRefs.current[key] = node;
  };

  return (
    <section
      className={`sidebar-history${collapsed ? " sidebar-history--collapsed" : ""}`}
      aria-label={t("history.recentTitle")}
    >
      <div className="sidebar-history__header">
        <span className="section-title">{t("history.recentTitle")}</span>
        <div className="sidebar-history__header-actions">
          <button
            type="button"
            className="sidebar-history__gallery-button"
            onClick={openGallery}
            aria-label={t("history.galleryCard")}
            title={t("history.openGalleryTitle")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>
          <button
            type="button"
            className="sidebar-history__toggle"
            onClick={() => setCollapsed((value) => !value)}
            title={collapsed ? t("history.expandRecent") : t("history.collapseRecent")}
            aria-expanded={!collapsed}
          >
            {collapsed ? t("history.expandRecentShort") : t("history.collapseRecentShort")}
          </button>
        </div>
      </div>
      {collapsed ? null : (
        <div className="sidebar-history__grid">
          {inFlight.map((flight) => {
            const seq = multimodeSequences[flight.id];
            if (flight.kind === "multimode" && seq) {
              const skeletons: ReactNode[] = [
                <SidebarCollectionSkeleton key={`coll-sk-${flight.id}`} count={seq.requested} />,
              ];
              for (let i = 0; i < seq.requested; i++) {
                if (!seq.images[i]) {
                  skeletons.push(<SidebarSkeletonCard key={`sk-${flight.id}-${i}`} />);
                }
              }
              return skeletons;
            }
            return <SidebarSkeletonCard key={`sk-${flight.id}`} />;
          })}
          {visibleHistory.length === 0 && inFlight.length === 0 ? (
            <button
              type="button"
              className="sidebar-history__empty"
              onClick={openGallery}
            >
              {t("history.emptyRecent")}
            </button>
          ) : null}
          {visibleHistory.map((entry) => (
            entry.type === "sequence" ? (
              <SidebarHistorySequenceCard
                key={entry.key}
                entry={entry}
                active={activeKey === entry.key}
                selectLabel={t("history.selectRecent")}
                deleteLabel={t("history.deleteSequenceAria", { count: entry.items.length })}
                setRef={setThumbRef}
                onSelect={showHistorySequence}
                onDelete={(sequenceId) => void trashHistorySequence(sequenceId)}
              />
            ) : (
              <SidebarHistoryImageCard
                key={entry.key}
                item={entry.item}
                active={activeKey === entry.key}
                selectLabel={t("history.selectRecent")}
                deleteLabel={t("history.deleteImageAria")}
                setRef={setThumbRef}
                onSelect={selectHistory}
                onDelete={(item) => void trashHistoryItem(item)}
              />
            )
          ))}
        </div>
      )}
    </section>
  );
}
