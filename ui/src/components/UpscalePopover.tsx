// wp5 054: upscale parameter popover for image results (video takes none).
import { useState } from "react";
import { useModalFocus } from "../hooks/useModalFocus";
import { upscaleParamsError, type UpscaleParams } from "../lib/upscaleAction";
import { useI18n } from "../i18n";

type Props = {
  pending: boolean;
  onSubmit: (params: UpscaleParams) => void;
  onClose: () => void;
};

const SCALE_FACTORS = [2, 4, 8, 16] as const;
const FLAVORS = ["sublime", "photo", "photo_denoiser"] as const;

export function UpscalePopover({ pending, onSubmit, onClose }: Props) {
  const { t } = useI18n();
  const popoverRef = useModalFocus<HTMLDivElement>(true, onClose, {
    trap: false,
    restoreFocus: (reason) => reason !== "outsidePointer",
  });
  const [scaleFactor, setScaleFactor] = useState<2 | 4 | 8 | 16>(2);
  const [flavor, setFlavor] = useState<"sublime" | "photo" | "photo_denoiser" | "">("");
  const [sharpen, setSharpen] = useState(10);
  const [smartGrain, setSmartGrain] = useState(10);
  const [ultraDetail, setUltraDetail] = useState(30);

  const params: UpscaleParams = {
    scaleFactor,
    ...(flavor ? { flavor } : {}),
    sharpen, smartGrain, ultraDetail,
  };
  const error = upscaleParamsError("image", params);

  return (
    <div ref={popoverRef} className="upscale-popover" role="dialog" aria-label={t("result.upscaleTitle")}>
      <div className="option-row" role="group" aria-label="scaleFactor">
        {SCALE_FACTORS.map((value) => (
          <button key={value} type="button"
            className={`option-btn${scaleFactor === value ? " active" : ""}`}
            aria-pressed={scaleFactor === value}
            onClick={() => setScaleFactor(value)}>{value}x</button>
        ))}
      </div>
      <label className="upscale-popover__field">
        <span>{t("result.upscaleFlavor")}</span>
        <select value={flavor} onChange={(e) => setFlavor(e.target.value as typeof flavor)}>
          <option value="">{t("result.upscaleFlavorAuto")}</option>
          {FLAVORS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </label>
      {([
        ["sharpen", sharpen, setSharpen],
        ["smartGrain", smartGrain, setSmartGrain],
        ["ultraDetail", ultraDetail, setUltraDetail],
      ] as const).map(([label, value, setter]) => (
        <label key={label} className="upscale-popover__field">
          <span>{label} <output>{value}</output></span>
          <input type="range" min={0} max={100} step={5} value={value}
            onChange={(e) => setter(Number(e.target.value))} />
        </label>
      ))}
      {error ? <p className="element-detail__error" role="alert">{error}</p> : null}
      <div className="upscale-popover__actions">
        <button type="button" className="action-btn action-btn--primary" disabled={pending || Boolean(error)}
          onClick={() => onSubmit(params)}>
          {pending ? t("inflight.streaming") : t("result.upscaleStart")}
        </button>
        <button type="button" className="action-btn" onClick={onClose}>{t("common.cancel")}</button>
      </div>
    </div>
  );
}
