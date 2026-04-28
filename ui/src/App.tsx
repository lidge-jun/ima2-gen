import { lazy, Suspense, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { Canvas } from "./components/Canvas";
import { RightPanel } from "./components/RightPanel";
import { HistoryStrip } from "./components/HistoryStrip";
import { Toast } from "./components/Toast";
import { ErrorCard } from "./components/ErrorCard";
import { GalleryModal } from "./components/GalleryModal";
import { CustomSizeConfirmModal } from "./components/CustomSizeConfirmModal";
import { MetadataRestoreDialog } from "./components/MetadataRestoreDialog";
import { TrashUndoToast } from "./components/TrashUndoToast";
import { MobileSettingsToggle } from "./components/MobileSettingsToggle";
import { MobileAppBar } from "./components/MobileAppBar";
import { MobileComposeSheet } from "./components/MobileComposeSheet";
import { useAppStore, flushGraphSaveBeacon } from "./store/useAppStore";
import { ENABLE_CARD_NEWS_MODE, ENABLE_NODE_MODE } from "./lib/devMode";
import { useGalleryViewerNavigation } from "./hooks/useGalleryViewerNavigation";
import { useBrowserAttentionBadge } from "./hooks/useBrowserAttentionBadge";
import { useIsMobile } from "./hooks/useIsMobile";
import { useVisualViewportInset } from "./hooks/useVisualViewportInset";

const LazyNodeCanvas = lazy(() =>
  import("./components/NodeCanvas").then((module) => ({ default: module.NodeCanvas })),
);
const LazySettingsWorkspace = lazy(() =>
  import("./components/SettingsWorkspace").then((module) => ({ default: module.SettingsWorkspace })),
);
const LazyCardNewsWorkspace = lazy(() =>
  import("./components/card-news/CardNewsWorkspace").then((module) => ({ default: module.CardNewsWorkspace })),
);
const LazyPromptLibraryPanel = lazy(() =>
  import("./components/PromptLibraryPanel").then((module) => ({ default: module.PromptLibraryPanel })),
);

function WorkspaceFallback() {
  return <main className="canvas canvas--lazy-loading" aria-busy="true" />;
}

export default function App() {
  useGalleryViewerNavigation();
  useVisualViewportInset();
  const hydrateHistory = useAppStore((s) => s.hydrateHistory);
  const loadSessions = useAppStore((s) => s.loadSessions);
  const startInFlightPolling = useAppStore((s) => s.startInFlightPolling);
  const reconcileInflight = useAppStore((s) => s.reconcileInflight);
  const syncFromStorage = useAppStore((s) => s.syncFromStorage);
  const theme = useAppStore((s) => s.theme);
  const resolvedTheme = useAppStore((s) => s.resolvedTheme);
  const themeFamily = useAppStore((s) => s.themeFamily);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const unseenGeneratedCount = useAppStore((s) => s.unseenGeneratedCount);
  const historyStripLayout = useAppStore((s) => s.historyStripLayout);
  const syncThemeFromStorage = useAppStore((s) => s.syncThemeFromStorage);
  const syncThemeFamilyFromStorage = useAppStore((s) => s.syncThemeFamilyFromStorage);
  const refreshResolvedTheme = useAppStore((s) => s.refreshResolvedTheme);
  const uiModeRaw = useAppStore((s) => s.uiMode);
  const uiMode =
    uiModeRaw === "card-news" && ENABLE_CARD_NEWS_MODE ? "card-news" :
      uiModeRaw === "node" && ENABLE_NODE_MODE ? "node" :
        "classic";
  const isMobile = useIsMobile();

  useBrowserAttentionBadge(unseenGeneratedCount);

  useEffect(() => {
    hydrateHistory();
    loadSessions();
    reconcileInflight();
    startInFlightPolling();
  }, [hydrateHistory, loadSessions, reconcileInflight, startInFlightPolling]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key === "ima2.inFlight" || e.key === "ima2.selectedFilename") {
        syncFromStorage();
      } else if (e.key === "ima2:theme") {
        syncThemeFromStorage();
      } else if (e.key === "ima2:themeFamily") {
        syncThemeFamilyFromStorage();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [syncFromStorage, syncThemeFromStorage, syncThemeFamilyFromStorage]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.dataset.themeMode = resolvedTheme;
    root.dataset.themeFamily = themeFamily;
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme, themeFamily]);

  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    media.addEventListener("change", refreshResolvedTheme);
    return () => media.removeEventListener("change", refreshResolvedTheme);
  }, [refreshResolvedTheme, theme]);

  useEffect(() => {
    const onHide = () => {
      flushGraphSaveBeacon(useAppStore.getState);
    };
    window.addEventListener("beforeunload", onHide);
    return () => {
      window.removeEventListener("beforeunload", onHide);
    };
  }, []);

  return (
    <>
      <div
        className={`app${settingsOpen ? " app--settings-open" : ""}${
          historyStripLayout === "horizontal" ? " app--history-horizontal" : ""
        }${
          historyStripLayout === "sidebar" ? " app--history-sidebar" : ""
        }`}
        data-theme-mode={resolvedTheme}
        data-theme-family={themeFamily}
        data-history-strip-layout={historyStripLayout}
        data-mobile={isMobile ? "1" : undefined}
        data-ui-mode={uiMode}
      >
        <Sidebar />
        <MobileAppBar />
        <HistoryStrip />
        <Suspense fallback={<WorkspaceFallback />}>
          {settingsOpen ? (
            <LazySettingsWorkspace />
          ) : uiMode === "classic" ? (
            <Canvas />
          ) : uiMode === "node" ? (
            <LazyNodeCanvas />
          ) : uiMode === "card-news" ? (
            <LazyCardNewsWorkspace />
          ) : (
            <Canvas />
          )}
        </Suspense>
        {uiMode === "card-news" ? null : <RightPanel />}
      </div>
      <CustomSizeConfirmModal />
      <TrashUndoToast />
      <Toast />
      <ErrorCard />
      <GalleryModal />
      <MetadataRestoreDialog />
      <MobileComposeSheet />
      <MobileSettingsToggle />
      {uiMode === "card-news" ? (
        <Suspense fallback={null}>
          <LazyPromptLibraryPanel />
        </Suspense>
      ) : null}
    </>
  );
}
