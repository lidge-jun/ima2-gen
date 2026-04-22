import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";

export function Toast() {
  const toast = useAppStore((s) => s.toast);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;

  const cls = ["toast", visible ? "visible" : "", toast.error ? "error" : ""]
    .filter(Boolean)
    .join(" ");

  return <div className={cls}>{toast.message}</div>;
}
