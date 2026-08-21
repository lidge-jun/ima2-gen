import { useCallback, useEffect, useSyncExternalStore } from "react";

export type ThemeMode = "light" | "dark" | "system";

export const THEME_MODE_STORAGE_KEY = "ima2.themeMode";

const listeners = new Set<() => void>();

function readStoredMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_MODE_STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* storage unavailable */
  }
  return "dark";
}

let currentMode: ThemeMode = readStoredMode();

function systemPrefersLight(): boolean {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: light)").matches;
}

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") return systemPrefersLight() ? "light" : "dark";
  return mode;
}

export function applyTheme(mode: ThemeMode): void {
  const resolved = resolveTheme(mode);
  const root = document.documentElement;
  if (resolved === "light") root.dataset.theme = "light";
  else delete root.dataset.theme;
}

/** Call once at app boot: applies the stored mode and keeps "system" live. */
export function initTheme(): void {
  applyTheme(currentMode);
  if (typeof matchMedia !== "undefined") {
    matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
      if (currentMode === "system") applyTheme("system");
    });
  }
}

function setMode(mode: ThemeMode): void {
  currentMode = mode;
  try {
    localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
  } catch {
    /* storage unavailable */
  }
  applyTheme(mode);
  for (const l of listeners) l();
}

export function useTheme(): { mode: ThemeMode; setMode: (mode: ThemeMode) => void } {
  const mode = useSyncExternalStore(
    useCallback((onChange: () => void) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    }, []),
    () => currentMode,
  );

  useEffect(() => {
    if (mode !== "system" || typeof matchMedia === "undefined") return undefined;
    const mq = matchMedia("(prefers-color-scheme: light)");
    const handle = () => applyTheme("system");
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, [mode]);

  return { mode, setMode };
}
