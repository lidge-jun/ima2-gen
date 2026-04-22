import { useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { Canvas } from "./components/Canvas";
import { RightPanel } from "./components/RightPanel";
import { Toast } from "./components/Toast";
import { useAppStore } from "./store/useAppStore";

export default function App() {
  const hydrateHistory = useAppStore((s) => s.hydrateHistory);

  useEffect(() => {
    hydrateHistory();
  }, [hydrateHistory]);

  return (
    <>
      <div className="app">
        <Sidebar />
        <Canvas />
        <RightPanel />
      </div>
      <Toast />
    </>
  );
}
