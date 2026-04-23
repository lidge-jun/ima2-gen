import { useAppStore } from "../store/useAppStore";
import { OptionGroup, type OptionItem } from "./OptionGroup";
import type { SizePreset } from "../types";
import {
  SIZE_PRESETS_ROW1,
  SIZE_PRESETS_ROW2,
  SIZE_PRESETS_ROW3,
  SIZE_PRESETS_ROW4,
  SIZE_PRESETS_ROW5,
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
      <div className="section-title">크기</div>
      <OptionGroup<SizePreset> title="" items={toItems(SIZE_PRESETS_ROW1)} value={sizePreset} onChange={setSizePreset} />
      <OptionGroup<SizePreset> title="" items={toItems(SIZE_PRESETS_ROW2)} value={sizePreset} onChange={setSizePreset} />
      <OptionGroup<SizePreset> title="" items={toItems(SIZE_PRESETS_ROW3)} value={sizePreset} onChange={setSizePreset} />
      <OptionGroup<SizePreset> title="" items={toItems(SIZE_PRESETS_ROW4)} value={sizePreset} onChange={setSizePreset} />
      <OptionGroup<SizePreset> title="" items={toItems(SIZE_PRESETS_ROW5)} value={sizePreset} onChange={setSizePreset} />
      {isCustom ? (
        <>
          <div className="option-row">
            <input
              type="number"
              className="custom-size-input"
              min={1024}
              max={3824}
              step={16}
              value={customW}
              onChange={(e) => setCustomSize(parseInt(e.target.value) || 1024, customH)}
              placeholder="가로"
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
              min={1024}
              max={3824}
              step={16}
              value={customH}
              onChange={(e) => setCustomSize(customW, parseInt(e.target.value) || 1024)}
              placeholder="세로"
            />
          </div>
          <div className="size-hint">
            한 변 최소 1024, 최대 3824, 16의 배수, 비율은 최대 3:1
          </div>
        </>
      ) : null}
    </div>
  );
}
