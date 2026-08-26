import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../../store/useAppStore";
import { selectResolvedNaiOptions } from "../../store/storeHelpers";
import { useI18n } from "../../i18n";
import { Select } from "../controls";
import {
  NAI_CFG_RESCALE_RANGE,
  NAI_MAX_SEED,
  NAI_SCALE_RANGE,
  NAI_STEPS_RANGE,
  NAI_UI_NOISE_SCHEDULES,
  NAI_UI_QUALITY_PRESETS,
  NAI_UI_SAMPLERS,
  NAI_UI_UC_PRESETS,
  isNaiV5Model,
} from "../../lib/naiOptions";
import type { SizePreset } from "../../types";
import { NAI_IMAGE_MODEL_OPTIONS } from "../../lib/imageModels";

/** NovelAI prices per resolution tier, so these are presets rather than a
 *  free-form pair — storeHelpers already exempts nai from custom sizing.
 *  Keys are literals rather than a stored `labelKey`: the i18n contract test
 *  resolves t() statically and a variable key is unverifiable. */
const NAI_SIZES = [
  { value: "832x1216", label: "nai.size.portrait" },
  { value: "1216x832", label: "nai.size.landscape" },
  { value: "1024x1024", label: "nai.size.square" },
] as const;

export function NaiControlsPanel() {
  const { t } = useI18n();
  // Reads RESOLVED (fallback -> operator config -> user override), writes
  // OVERRIDES. useShallow is required: this selector builds a new object per
  // call and Zustand 5 passes selector output straight to useSyncExternalStore.
  const options = useAppStore(useShallow(selectResolvedNaiOptions));
  const setNaiOption = useAppStore((s) => s.setNaiOption);
  const resetNaiOptions = useAppStore((s) => s.resetNaiOptions);
  const imageModel = useAppStore((s) => s.imageModel);
  const setImageModel = useAppStore((s) => s.setImageModel);
  const sizePreset = useAppStore((s) => s.sizePreset);
  const setSizePreset = useAppStore((s) => s.setSizePreset);
  const isV5 = isNaiV5Model(imageModel);

  const seedText = options.seed === null ? "" : String(options.seed);

  return (
    <>
      <div className="option-group nai-controls">
        <div className="section-title">{t("nai.panel.modelTitle")}</div>
        <Select
          items={NAI_IMAGE_MODEL_OPTIONS.map((option) => ({
            value: option.value,
            label: option.shortLabel,
          }))}
          value={imageModel}
          onChange={(value) => {
            // Reset the V5-only options when leaving V5 so a hidden control's
            // value is not silently in effect. The payload and adapter guard
            // this too; this is the coherence half (005 R2-B2).
            if (!isNaiV5Model(value)) {
              setNaiOption("straightAlpha", false);
              setNaiOption("qualityPresetId", "standard");
            }
            setImageModel(value as typeof imageModel);
          }}
          ariaLabel={t("nai.panel.modelTitle")}
        />
      </div>

      <div className="option-group nai-controls">
        <div className="section-title">{t("nai.panel.sizeTitle")}</div>
        <div className="option-row">
          {NAI_SIZES.map((size) => (
            <button
              key={size.value}
              type="button"
              className={`option-btn${sizePreset === size.value ? " active" : ""}`}
              onClick={() => setSizePreset(size.value as SizePreset)}
            >
              {size.label === "nai.size.portrait"
                ? t("nai.size.portrait")
                : size.label === "nai.size.landscape"
                  ? t("nai.size.landscape")
                  : t("nai.size.square")}
              <br />
              <span className="option-sub">{size.value.replace("x", "×")}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="option-group nai-controls">
        <div className="section-title">{t("nai.panel.samplingTitle")}</div>

        <label className="nai-controls__row">
          <span>{t("nai.field.sampler")}</span>
          <Select
            items={NAI_UI_SAMPLERS.map((value) => ({ value, label: value }))}
            value={options.sampler}
            onChange={(value) => setNaiOption("sampler", value)}
            ariaLabel={t("nai.field.sampler")}
          />
        </label>

        <label className="nai-controls__row">
          <span>{t("nai.field.noiseSchedule")}</span>
          <Select
            items={NAI_UI_NOISE_SCHEDULES.map((value) => ({ value, label: value }))}
            value={options.noiseSchedule}
            onChange={(value) => setNaiOption("noiseSchedule", value)}
            ariaLabel={t("nai.field.noiseSchedule")}
          />
        </label>

        <label className="nai-controls__row nai-controls__row--slider">
          <span>{t("nai.field.steps")}</span>
          <input
            type="range"
            min={NAI_STEPS_RANGE.min}
            max={NAI_STEPS_RANGE.max}
            step={1}
            value={options.steps}
            onChange={(e) => setNaiOption("steps", Number(e.target.value))}
          />
          <output>{options.steps}</output>
        </label>

        <label className="nai-controls__row nai-controls__row--slider">
          <span>{t("nai.field.scale")}</span>
          <input
            type="range"
            min={NAI_SCALE_RANGE.min}
            max={NAI_SCALE_RANGE.max}
            step={0.1}
            value={options.scale}
            onChange={(e) => setNaiOption("scale", Number(e.target.value))}
          />
          <output>{options.scale.toFixed(1)}</output>
        </label>

        <label className="nai-controls__row nai-controls__row--slider">
          <span>{t("nai.field.cfgRescale")}</span>
          <input
            type="range"
            min={NAI_CFG_RESCALE_RANGE.min}
            max={NAI_CFG_RESCALE_RANGE.max}
            step={0.01}
            value={options.cfgRescale}
            onChange={(e) => setNaiOption("cfgRescale", Number(e.target.value))}
          />
          <output>{options.cfgRescale.toFixed(2)}</output>
        </label>
        <p className="option-help">{t("nai.help.cfgRescale")}</p>
      </div>

      <div className="option-group nai-controls">
        <div className="section-title">{t("nai.panel.presetTitle")}</div>

        <label className="nai-controls__row">
          <span>{t("nai.field.ucPreset")}</span>
          <Select
            items={NAI_UI_UC_PRESETS.map((value) => ({ value, label: t(`nai.ucPreset.${value}`) }))}
            value={options.ucPresetId}
            onChange={(value) => setNaiOption("ucPresetId", value)}
            ariaLabel={t("nai.field.ucPreset")}
          />
        </label>

        {/* V5-only. The payload strips it for V4.5 and the adapter pins it, so
            this gate is for coherence rather than correctness. */}
        {isV5 ? (
          <label className="nai-controls__row">
            <span>{t("nai.field.qualityPreset")}</span>
            <Select
              items={NAI_UI_QUALITY_PRESETS.map((value) => ({ value, label: t(`nai.qualityPreset.${value}`) }))}
              value={options.qualityPresetId}
              onChange={(value) => setNaiOption("qualityPresetId", value)}
              ariaLabel={t("nai.field.qualityPreset")}
            />
          </label>
        ) : null}
      </div>

      <div className="option-group nai-controls">
        <div className="section-title">{t("nai.panel.outputTitle")}</div>

        <label className="nai-controls__row nai-controls__row--toggle">
          <input
            type="checkbox"
            checked={options.varietyPlus}
            onChange={(e) => setNaiOption("varietyPlus", e.target.checked)}
          />
          <span>{t("nai.field.varietyPlus")}</span>
        </label>
        <p className="option-help">{t("nai.help.varietyPlus")}</p>

        {isV5 ? (
          <>
            <label className="nai-controls__row nai-controls__row--toggle">
              <input
                type="checkbox"
                checked={options.straightAlpha}
                onChange={(e) => setNaiOption("straightAlpha", e.target.checked)}
              />
              <span>{t("nai.field.straightAlpha")}</span>
            </label>
            <p className="option-help">{t("nai.help.straightAlpha")}</p>
          </>
        ) : null}

        <label className="nai-controls__row">
          <span>{t("nai.field.seed")}</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="custom-size-input"
            value={seedText}
            placeholder={t("nai.field.seedRandom")}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "");
              // Empty maps to null, never 0: zero is a valid NovelAI seed and
              // would silently pin every generation to the same image.
              // Clamped here rather than dropped on reload — an out-of-range
              // value used to display for the session and then vanish.
              setNaiOption("seed", digits === "" ? null : Math.min(Number(digits), NAI_MAX_SEED));
            }}
          />
        </label>
        <p className="option-help">{t("nai.help.seed")}</p>
      </div>

      <div className="option-group nai-controls">
        <button type="button" className="option-btn" onClick={resetNaiOptions}>
          {t("nai.resetDefaults")}
        </button>
      </div>
    </>
  );
}
