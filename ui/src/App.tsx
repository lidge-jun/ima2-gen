import { useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { Canvas } from "./components/Canvas";
import { NodeCanvas } from "./components/NodeCanvas";
import { RightPanel } from "./components/RightPanel";
import { Toast } from "./components/Toast";
import { GalleryModal } from "./components/GalleryModal";
import { ShortcutsHelp } from "./components/ShortcutsHelp";
import { useAppStore, flushGraphSaveBeacon } from "./store/useAppStore";
import { IS_DEV_UI } from "./lib/devMode";

export default function App() {
  const hydrateHistory = useAppStore((s) => s.hydrateHistory);
  const loadSessions = useAppStore((s) => s.loadSessions);
  const startInFlightPolling = useAppStore((s) => s.startInFlightPolling);
  const reconcileInflight = useAppStore((s) => s.reconcileInflight);
  const syncFromStorage = useAppStore((s) => s.syncFromStorage);
  const uiModeRaw = useAppStore((s) => s.uiMode);
  const uiMode = IS_DEV_UI ? uiModeRaw : "classic";

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
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [syncFromStorage]);

  useEffect(() => {
    const onHide = () => {
      flushGraphSaveBeacon(useAppStore.getState);
    };
    window.addEventListener("beforeunload", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  return (
    <>
      <div className="app">
        <Sidebar />
        {uiMode === "classic" ? <Canvas /> : <NodeCanvas />}
        <RightPanel />
      </div>
      <Toast />
      <GalleryModal />
      <ShortcutsHelp />
    </>
  );
}
