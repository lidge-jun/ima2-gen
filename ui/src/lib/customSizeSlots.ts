import {
  MAX_CUSTOM_SIZE_SLOTS,
  normalizeCustomSizeSlot,
  replaceCustomSizeSlot,
  trimCustomSizeSlots,
  upsertCustomSizeSlot,
  type CustomSizeSlot,
} from "./size";

export const CUSTOM_SIZE_SLOTS_STORAGE_KEY = "ima2.customSizeSlots";

function isSlot(value: unknown): value is CustomSizeSlot {
  if (!value || typeof value !== "object") return false;
  const slot = value as Partial<CustomSizeSlot>;
  return (
    typeof slot.id === "string" &&
    typeof slot.w === "number" &&
    typeof slot.h === "number" &&
    typeof slot.updatedAt === "number"
  );
}

export function loadCustomSizeSlots(): CustomSizeSlot[] {
  try {
    const raw = localStorage.getItem(CUSTOM_SIZE_SLOTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return trimCustomSizeSlots(parsed.filter(isSlot));
  } catch {
    return [];
  }
}

export function saveCustomSizeSlots(slots: CustomSizeSlot[]): void {
  try {
    localStorage.setItem(
      CUSTOM_SIZE_SLOTS_STORAGE_KEY,
      JSON.stringify(trimCustomSizeSlots(slots)),
    );
  } catch {
    // Non-critical preference persistence. Generation can continue.
  }
}

export function makeCustomSizeSlot(w: number, h: number, ratio?: string): CustomSizeSlot {
  return normalizeCustomSizeSlot({
    id: `slot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    w,
    h,
    ratio,
    updatedAt: Date.now(),
  });
}

export {
  MAX_CUSTOM_SIZE_SLOTS,
  replaceCustomSizeSlot,
  trimCustomSizeSlots,
  upsertCustomSizeSlot,
  type CustomSizeSlot,
};
