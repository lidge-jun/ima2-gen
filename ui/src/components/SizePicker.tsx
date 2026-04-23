import { useAppStore } from "../store/useAppStore";
import { OptionGroup, type OptionItem } from "./OptionGroup";
import type { SizePreset } from "../types";
import {
  SIZE_PRESETS_ROW1,
  SIZE_PRESETS_ROW2,
  SIZE_PRESETS_ROW3,
  SIZE_PRESETS_ROW4,
  getSizePresetsRow5,
} from "../lib/size";
import { useI18n } from "../i18n";

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
  const { t } = useI18n();

  const isCustom = sizePreset === "custom";

  return (
    <div className="option-group">
      <div className="section-title">{t("size.title")}</div>
      <OptionGroup<SizePreset> title="" items={toItems(SIZE_PRESETS_ROW1)} value={sizePreset} onChange={setSizePreset} />
      <OptionGroup<SizePreset> title="" items={toItems(SIZE_PRESETS_ROW2)} value={sizePreset} onChange={setSizePreset} />
      <OptionGroup<SizePreset> title="" items={toItems(SIZE_PRESETS_ROW3)} value={sizePreset} onChange={setSizePreset} />
      <OptionGroup<SizePreset> title="" items={toItems(SIZE_PRESETS_ROW4)} value={sizePreset} onChange={setSizePreset} />
      <OptionGroup<SizePreset> title="" items={toItems(getSizePresetsRow5())} value={sizePreset} onChange={setSizePreset} />
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
              placeholder={t("size.width")}
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
              placeholder={t("size.height")}
            />
          </div>
          <div className="size-hint">
            {t("size.hint")}
          </div>
        </>
      ) : null}
    </div>
  );
}
