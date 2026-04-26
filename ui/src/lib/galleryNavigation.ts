import type { GenerateItem } from "../types";

export function getGalleryItemKey(item: Pick<GenerateItem, "filename" | "image">): string {
  return item.filename || item.image;
}
