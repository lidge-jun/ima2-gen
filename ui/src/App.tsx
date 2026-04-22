import { useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { Canvas } from "./components/Canvas";
import { NodeCanvas } from "./components/NodeCanvas";
import { RightPanel } from "./components/RightPanel";
import { Toast } from "./components/Toast";
import { useAppStore } from "./store/useAppStore";

export default function App() {
  const hydrateHistory = useAppStore((s) => s.hydrateHistory);
  const loadSessions = useAppStore((s) => s.loadSessions);
  const flushGraphSave = useAppStore((s) => s.flushGraphSave);
  const uiMode = useAppStore((s) => s.uiMode);

  useEffect(() => {
    hydrateHistory();
    loadSessions();
  }, [hydrateHistory, loadSessions]);

  useEffect(() => {
    const onHide = () => {
      void flushGraphSave();
    };
    window.addEventListener("beforeunload", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flushGraphSave]);

  return (
    <>
      <div className="app">
        <Sidebar />
        {uiMode === "classic" ? <Canvas /> : <NodeCanvas />}
        <RightPanel />
      </div>
      <Toast />
    </>
  );
}
