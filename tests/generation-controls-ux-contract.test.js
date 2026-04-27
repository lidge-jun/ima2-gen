import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("generation controls custom plus UX contract", () => {
  it("keeps the right panel as the generation control home", () => {
    const rightPanel = readSource("ui/src/components/RightPanel.tsx");

    assert.match(rightPanel, /import \{ SizePicker \} from "\.\/SizePicker"/);
    assert.match(rightPanel, /import \{ CountPicker \} from "\.\/CountPicker"/);
    assert.match(rightPanel, /<SizePicker \/>/);
    assert.match(rightPanel, /<CountPicker \/>/);
    assert.doesNotMatch(rightPanel, /COUNT_ITEMS/);
  });

  it("preserves the existing size preset grid and visible auto option", () => {
    const sizePicker = readSource("ui/src/components/SizePicker.tsx");
    const sizeLib = readSource("ui/src/lib/size.ts");

    for (const row of ["SIZE_PRESETS_ROW1", "SIZE_PRESETS_ROW2", "SIZE_PRESETS_ROW3", "SIZE_PRESETS_ROW4"]) {
      assert.match(sizePicker, new RegExp(`toItems\\(${row}\\)`));
    }
    assert.match(sizePicker, /getSizePresetsRow5\(\)\.filter\(\(item\) => item\.value === "auto"\)/);
    assert.match(sizeLib, /value: "auto"/);
    assert.match(sizeLib, /value: "3840x2160"/);
    assert.match(sizeLib, /value: "2160x3840"/);
    assert.doesNotMatch(sizeLib, /3824x2160/);
    assert.doesNotMatch(sizeLib, /2160x3824/);
  });

  it("keeps arbitrary custom slot sizes out of the SizePreset union", () => {
    const types = readSource("ui/src/types.ts");

    assert.match(types, /export type SizePreset =/);
    assert.match(types, /"3840x2160"/);
    assert.match(types, /"2160x3840"/);
    assert.match(types, /"custom"/);
    assert.doesNotMatch(types, /"2400x1024"/);
    assert.doesNotMatch(types, /"3840x1648"/);
  });

  it("caps saved custom size slots at three and uses explicit replace behavior", () => {
    const sizeLib = readSource("ui/src/lib/size.ts");
    const slotLib = readSource("ui/src/lib/customSizeSlots.ts");
    const sizePicker = readSource("ui/src/components/SizePicker.tsx");

    assert.match(sizeLib, /export const MAX_CUSTOM_SIZE_SLOTS = 3/);
    assert.match(slotLib, /CUSTOM_SIZE_SLOTS_STORAGE_KEY = "ima2\.customSizeSlots"/);
    assert.match(slotLib, /replaceCustomSizeSlot/);
    assert.match(sizePicker, /slots\.length >= MAX_CUSTOM_SIZE_SLOTS/);
    assert.match(sizePicker, /setReplaceSlotId/);
    assert.match(sizePicker, /replaceCustomSizeSlot\(slots, replaceSlotId, normalized\)/);
  });

  it("offers 21:9 only as a custom ratio preset", () => {
    const sizeLib = readSource("ui/src/lib/size.ts");

    assert.match(sizeLib, /CUSTOM_RATIO_PRESETS/);
    assert.match(sizeLib, /id: "21:9"/);
    assert.doesNotMatch(sizeLib, /value: "21:9"/);
  });

  it("supports manual count input clamped to 1..8", () => {
    const countPicker = readSource("ui/src/components/CountPicker.tsx");
    const store = readSource("ui/src/store/useAppStore.ts");

    assert.match(countPicker, /const QUICK_COUNTS = \[1, 2, 4\] as const/);
    assert.match(countPicker, /inputMode="numeric"/);
    assert.match(countPicker, /Math\.min\(8, Math\.max\(1, Math\.trunc\(value \|\| 1\)\)\)/);
    assert.match(store, /function normalizeCount\(value: number\): Count/);
    assert.match(store, /setCount: \(count\) => set\(\{ count: normalizeCount\(count\) \}\)/);
  });

  it("updates 3840 constraints across cost, i18n, and contracts", () => {
    const cost = readSource("ui/src/lib/cost.ts");
    const en = readSource("ui/src/i18n/en.json");
    const ko = readSource("ui/src/i18n/ko.json");

    assert.match(cost, /"3840x2160"/);
    assert.match(cost, /"2160x3840"/);
    assert.doesNotMatch(cost, /3824x2160/);
    assert.match(en, /max edge 3840/);
    assert.match(ko, /최대 변 3840/);
    for (const source of [en, ko]) {
      assert.match(source, /"customPlus"/);
      assert.match(source, /"customSlotLimit"/);
      assert.match(source, /"count"/);
      assert.match(source, /"highCountHint"/);
    }
  });
});
