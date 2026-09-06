import { useSyncExternalStore } from "react";
import { getLaneCatalogSnapshot, refreshLaneCatalog, subscribeLaneCatalog } from "../lib/laneCatalog";

export function useLaneCatalog() {
  const snapshot = useSyncExternalStore(subscribeLaneCatalog, getLaneCatalogSnapshot);
  return { ...snapshot, refresh: refreshLaneCatalog };
}
