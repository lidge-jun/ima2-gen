import { getLaneCatalog, type LaneCatalog } from "./api-comfy";

export type LaneCatalogSnapshot = Readonly<{
  phase: "idle" | "loading" | "ready" | "error";
  catalog: LaneCatalog | null;
  observedAt: number | null;
  error: "request" | "invalid" | "app-auth" | null;
}>;

const INITIAL: LaneCatalogSnapshot = { phase: "idle", catalog: null, observedAt: null, error: null };
const listeners = new Set<() => void>();
let snapshot = INITIAL;
let revision = 0;
let active: AbortController | null = null;
let focusWindow: Pick<Window, "addEventListener" | "removeEventListener"> | null = null;
const onFocus = () => { void refreshLaneCatalog(); };

export function getLaneCatalogSnapshot(): LaneCatalogSnapshot { return snapshot; }

function publish(next: LaneCatalogSnapshot): void {
  snapshot = next;
  for (const listener of [...listeners]) if (listeners.has(listener)) listener();
}

function current(ownRevision: number, controller: AbortController): boolean {
  return ownRevision === revision && active === controller && !controller.signal.aborted && listeners.size > 0;
}

function errorKind(error: unknown): NonNullable<LaneCatalogSnapshot["error"]> {
  const details = error as { status?: unknown; code?: unknown } | null;
  if (details?.status === 401 || details?.status === 403) return "app-auth";
  return details?.code === "MODEL_CATALOG_INVALID" ? "invalid" : "request";
}

/** Observational refresh: failures publish fixed state and never reject as a failed user write. */
export async function refreshLaneCatalog(): Promise<void> {
  const ownRevision = ++revision;
  active?.abort();
  active = null;
  if (listeners.size === 0) { publish(INITIAL); return; }
  const controller = new AbortController();
  active = controller;
  publish({ ...snapshot, phase: "loading", error: null });
  // A subscriber can synchronously refresh or unsubscribe while loading is published.
  if (!current(ownRevision, controller)) return;
  try {
    const catalog = await getLaneCatalog(controller.signal);
    if (current(ownRevision, controller)) publish({ phase: "ready", catalog, observedAt: Date.now(), error: null });
  } catch (error) {
    if (current(ownRevision, controller)) publish({ ...snapshot, phase: "error", error: errorKind(error) });
  } finally {
    if (ownRevision === revision && active === controller) active = null;
  }
}

export function subscribeLaneCatalog(listener: () => void): () => void {
  const first = listeners.size === 0;
  listeners.add(listener);
  if (first) {
    if (typeof window !== "undefined") {
      focusWindow = window;
      focusWindow.addEventListener("focus", onFocus);
    }
    void refreshLaneCatalog();
  }
  return () => {
    if (!listeners.delete(listener) || listeners.size > 0) return;
    ++revision;
    active?.abort(); active = null;
    focusWindow?.removeEventListener("focus", onFocus); focusWindow = null;
    // Retained labels are stale, not ready, on the first render of the next mount.
    publish({ ...snapshot, phase: "idle", error: null });
  };
}
