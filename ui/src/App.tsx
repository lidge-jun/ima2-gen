import { useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { Canvas } from "./components/Canvas";
import { NodeCanvas } from "./components/NodeCanvas";
import { RightPanel } from "./components/RightPanel";
import { HistoryStrip } from "./components/HistoryStrip";
import { SettingsWorkspace } from "./components/SettingsWorkspace";
import { Toast } from "./components/Toast";
import { ErrorCard } from "./components/ErrorCard";
import { GalleryModal } from "./components/GalleryModal";
import { CustomSizeConfirmModal } from "./components/CustomSizeConfirmModal";
import { CardNewsWorkspace } from "./components/card-news/CardNewsWorkspace";
import { useAppStore, flushGraphSaveBeacon } from "./store/useAppStore";
import { ENABLE_CARD_NEWS_MODE, ENABLE_NODE_MODE } from "./lib/devMode";

export default function App() {
  const hydrateHistory = useAppStore((s) => s.hydrateHistory);
  const loadSessions = useAppStore((s) => s.loadSessions);
  const startInFlightPolling = useAppStore((s) => s.startInFlightPolling);
  const reconcileInflight = useAppStore((s) => s.reconcileInflight);
  const syncFromStorage = useAppStore((s) => s.syncFromStorage);
  const theme = useAppStore((s) => s.theme);
  const resolvedTheme = useAppStore((s) => s.resolvedTheme);
  const themeFamily = useAppStore((s) => s.themeFamily);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const syncThemeFromStorage = useAppStore((s) => s.syncThemeFromStorage);
  const syncThemeFamilyFromStorage = useAppStore((s) => s.syncThemeFamilyFromStorage);
  const refreshResolvedTheme = useAppStore((s) => s.refreshResolvedTheme);
  const uiModeRaw = useAppStore((s) => s.uiMode);
  const uiMode =
    uiModeRaw === "card-news" && ENABLE_CARD_NEWS_MODE ? "card-news" :
      uiModeRaw === "node" && ENABLE_NODE_MODE ? "node" :
        "classic";

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
    // Legacy attribute (kept so existing :root[data-theme="dark|light"] selectors continue to match).
    root.dataset.theme = resolvedTheme;
    // Two-axis attributes for AI platform style themes.
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
        className={`app${settingsOpen ? " app--settings-open" : ""}`}
        data-theme-mode={resolvedTheme}
        data-theme-family={themeFamily}
      >
        <Sidebar />
        <HistoryStrip />
        {settingsOpen ? (
          <SettingsWorkspace />
        ) : uiMode === "classic" ? (
          <Canvas />
        ) : uiMode === "node" ? (
          <NodeCanvas />
        ) : uiMode === "card-news" ? (
          <CardNewsWorkspace />
        ) : (
          <Canvas />
        )}
        {uiMode === "card-news" ? null : <RightPanel />}
      </div>
      <CustomSizeConfirmModal />
      <Toast />
      <ErrorCard />
      <GalleryModal />
    </>
  );
}
