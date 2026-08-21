import { useI18n } from "../../i18n";
import { useAppStore } from "../../store/useAppStore";
import type { AssetGenBackgroundPreset } from "../../types";

const PRESETS: { value: AssetGenBackgroundPreset; swatch: string | null; labelKey: string }[] = [
  { value: "chroma-green", swatch: "#00c853", labelKey: "assetGen.bgChroma" },
  { value: "white", swatch: "#ffffff", labelKey: "assetGen.bgWhite" },
  { value: "black", swatch: "#111111", labelKey: "assetGen.bgBlack" },
  // Transparent is not a color, so it gets a checkerboard swatch instead of a
  // flat chip — the same visual language the canvas uses for alpha.
  { value: "transparent", swatch: null, labelKey: "assetGen.bgTransparent" },
];

export function BackgroundPresetPicker() {
  const { t } = useI18n();
  const value = useAppStore((s) => s.assetGenBackground);
  const setValue = useAppStore((s) => s.setAssetGenBackground);
  const provider = useAppStore((s) => s.assetGenProvider);
  // Real alpha comes from the GPT image tool's background parameter. Grok has
  // no equivalent, so offering "transparent" there would promise a cutout the
  // lane cannot deliver.
  const transparentAvailable = provider !== "grok" && provider !== "grok-api";
  return (
    <div className="assetgen-field">
      <span className="assetgen-field__label" id="assetgen-bg-label">{t("assetGen.background")}</span>
      <div className="assetgen-bg-picker" role="group" aria-labelledby="assetgen-bg-label">
        {PRESETS.map((p) => {
          const disabled = p.value === "transparent" && !transparentAvailable;
          return (
          <button
            key={p.value}
            type="button"
            className={value === p.value ? "is-active" : ""}
            aria-pressed={value === p.value}
            disabled={disabled}
            {...(disabled ? { title: t("assetGen.bgTransparentGptOnly") } : {})}
            onClick={() => setValue(p.value)}
          >
            <span
              className={
                p.swatch === null
                  ? "assetgen-bg-picker__swatch assetgen-bg-picker__swatch--alpha"
                  : "assetgen-bg-picker__swatch"
              }
              {...(p.swatch === null ? {} : { style: { background: p.swatch } })}
              aria-hidden="true"
            />
            {t(p.labelKey)}
          </button>
          );
        })}
      </div>
      <p className="assetgen-field__hint">
        {!transparentAvailable
          ? t("assetGen.bgTransparentGptOnly")
          : value === "transparent"
            ? t("assetGen.backgroundHintTransparent")
            : t("assetGen.backgroundHint")}
      </p>
    </div>
  );
}
