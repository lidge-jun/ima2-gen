import type { GenerateItem } from "../types";

const KEY = "ima2_history";

export function loadHistoryFromStorage(): GenerateItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GenerateItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistHistory(items: GenerateItem[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch (e) {
    if ((e as DOMException).name === "QuotaExceededError" && items.length > 5) {
      // Drop the oldest 5 and retry
      persistHistory(items.slice(0, Math.max(items.length - 5, 5)));
    }
  }
}
