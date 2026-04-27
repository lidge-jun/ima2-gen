import type { GenerateItem } from "../types";

export type GalleryShortcutAction = "previous" | "next" | "first" | "last";

function itemMatches(item: GenerateItem, currentImage: GenerateItem | null): boolean {
  if (!currentImage) return false;
  if (currentImage.filename && item.filename === currentImage.filename) return true;
  return item.image === currentImage.image;
}

export function getHistoryIndex(
  history: GenerateItem[],
  currentImage: GenerateItem | null,
): number {
  return history.findIndex((item) => itemMatches(item, currentImage));
}

export function getShortcutTarget(
  history: GenerateItem[],
  currentImage: GenerateItem | null,
  action: GalleryShortcutAction,
): GenerateItem | null {
  if (history.length === 0) return null;
  if (action === "first") return history[0] ?? null;
  if (action === "last") return history[history.length - 1] ?? null;

  const currentIndex = getHistoryIndex(history, currentImage);
  if (currentIndex < 0) return null;
  const nextIndex = action === "previous" ? currentIndex - 1 : currentIndex + 1;
  return history[nextIndex] ?? null;
}

export function getNeighborAfterRemoval(
  history: GenerateItem[],
  filename: string,
): GenerateItem | null {
  const removeIndex = history.findIndex((item) => item.filename === filename);
  if (removeIndex < 0) return null;
  return history[removeIndex + 1] ?? history[removeIndex - 1] ?? null;
}
