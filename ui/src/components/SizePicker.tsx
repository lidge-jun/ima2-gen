import { useAppStore } from "../store/useAppStore";
import { OptionGroup, type OptionItem } from "./OptionGroup";
import type { SizePreset } from "../types";
import {
  SIZE_PRESETS_ROW1,
  SIZE_PRESETS_ROW2,
  SIZE_PRESETS_ROW3,
} from "../lib/size";

function toItems(row: ReadonlyArray<{ value: string; label: string; sub: string }>) {
  return row.map((it) => ({
    value: it.value as SizePreset,
    label: it.label,
    sub: it.sub,
  })) as ReadonlyArray<OptionItem<SizePreset>>;
}

export function SizePicker() {
  const sizePreset = useAppStore((s) => s.sizePreset);
  const setSizePreset = useAppStore((s) => s.setSizePreset);
  const customW = useAppStore((s) => s.customW);
  const customH = useAppStore((s) => s.customH);
  const setCustomSize = useAppStore((s) => s.setCustomSize);

  const isCustom = sizePreset === "custom";

  return (
    <div className="option-group">
      <div className="section-title">Size</div>
      <OptionGroup<SizePreset>
        title=""
        items={toItems(SIZE_PRESETS_ROW1)}
        value={sizePreset}
        onChange={setSizePreset}
      />
      <OptionGroup<SizePreset>
        title=""
        items={toItems(SIZE_PRESETS_ROW2)}
        value={sizePreset}
        onChange={setSizePreset}
      />
      <OptionGroup<SizePreset>
        title=""
        items={toItems(SIZE_PRESETS_ROW3)}
        value={sizePreset}
        onChange={setSizePreset}
      />
      {isCustom ? (
        <>
          <div className="option-row">
            <input
              type="number"
              className="custom-size-input"
              min={256}
              max={3840}
              step={16}
              value={customW}
              onChange={(e) =>
                setCustomSize(parseInt(e.target.value) || 1024, customH)
              }
              placeholder="W"
            />
            <span
              style={{
                color: "var(--text-dim)",
                alignSelf: "center",
                fontFamily: "var(--mono)",
                fontSize: 12,
              }}
            >
              x
            </span>
            <input
              type="number"
              className="custom-size-input"
              min={256}
              max={3840}
              step={16}
              value={customH}
              onChange={(e) =>
                setCustomSize(customW, parseInt(e.target.value) || 1024)
              }
              placeholder="H"
            />
          </div>
          <div className="size-hint">
            Both must be multiples of 16, max 3840, ratio ≤ 3:1
          </div>
        </>
      ) : null}
    </div>
  );
}
