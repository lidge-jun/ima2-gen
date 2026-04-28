import { useEffect } from "react";

export function useVisualViewportInset(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    const apply = () => {
      const h = Math.round(vv.height);
      const offsetTop = Math.round(vv.offsetTop);
      document.documentElement.style.setProperty("--vv-h", `${h}px`);
      document.documentElement.style.setProperty("--vv-offset-top", `${offsetTop}px`);
    };

    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
    };
  }, []);
}
