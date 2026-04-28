import type { GenerateItem } from "../types";

export type GalleryShortcutAction = "previous" | "next" | "first" | "last";

function itemMatches(item: GenerateItem, currentImage: GenerateItem | null): boolean {
  if (!currentImage) return false;
  if (currentImage.filename && item.filename === currentImage.filename) return true;
  return item.image === currentImage.image;
}

function getCanvasSourceFilenames(item: GenerateItem): string[] {
  return [
    item.canvasSourceFilename,
    item.canvasEditableFilename,
  ].filter((filename): filename is string => Boolean(filename));
}

export function getVisibleGalleryItems(history: GenerateItem[]): GenerateItem[] {
  return history.filter((item) => !item.canvasVersion);
}

export function resolveVisibleShortcutCurrent(
  history: GenerateItem[],
  currentImage: GenerateItem | null,
): GenerateItem | null {
  if (!currentImage) return null;
  const visibleHistory = getVisibleGalleryItems(history);
  if (!currentImage.canvasVersion) {
    return visibleHistory.find((item) => itemMatches(item, currentImage)) ?? null;
  }

  const sourceFilenames = getCanvasSourceFilenames(currentImage);
  const sourceMatch = visibleHistory.find((item) =>
    item.filename ? sourceFilenames.includes(item.filename) : false,
  );
  return sourceMatch ?? null;
}

export function getHistoryIndex(
  history: GenerateItem[],
  currentImage: GenerateItem | null,
): number {
  const visibleHistory = getVisibleGalleryItems(history);
  const visibleCurrent = resolveVisibleShortcutCurrent(history, currentImage);
  return visibleHistory.findIndex((item) => itemMatches(item, visibleCurrent));
}

export function getShortcutTarget(
  history: GenerateItem[],
  currentImage: GenerateItem | null,
  action: GalleryShortcutAction,
): GenerateItem | null {
  const visibleHistory = getVisibleGalleryItems(history);
  if (visibleHistory.length === 0) return null;
  if (action === "first") return visibleHistory[0] ?? null;
  if (action === "last") return visibleHistory[visibleHistory.length - 1] ?? null;

  const currentIndex = getHistoryIndex(history, currentImage);
  if (currentIndex < 0) return null;
  const nextIndex = action === "previous" ? currentIndex - 1 : currentIndex + 1;
  return visibleHistory[nextIndex] ?? null;
}

export function getNeighborAfterRemoval(
  history: GenerateItem[],
  filename: string,
): GenerateItem | null {
  const visibleHistory = getVisibleGalleryItems(history);
  const removeIndex = visibleHistory.findIndex((item) => item.filename === filename);
  if (removeIndex < 0) return null;
  return visibleHistory[removeIndex + 1] ?? visibleHistory[removeIndex - 1] ?? null;
}
