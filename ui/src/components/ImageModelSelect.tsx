import type { ImageModel } from "../types";
import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { IMAGE_MODEL_OPTIONS, UNSUPPORTED_IMAGE_MODELS } from "../lib/imageModels";
import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";

type ImageModelSelectProps = {
  variant: "settings" | "sidebar";
};

export function ImageModelSelect({ variant }: ImageModelSelectProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const imageModel = useAppStore((s) => s.imageModel);
  const setImageModel = useAppStore((s) => s.setImageModel);
  const id = variant === "settings" ? "settings-image-model" : "sidebar-image-model";
  const current = IMAGE_MODEL_OPTIONS.find((option) => option.value === imageModel)
    ?? IMAGE_MODEL_OPTIONS[0];

  const onChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setImageModel(event.target.value as ImageModel);
  };

  useEffect(() => {
    if (variant !== "sidebar" || !open) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, variant]);

  if (variant === "sidebar") {
    return (
      <div ref={rootRef} className="image-model-select image-model-select--sidebar">
        <button
          id={id}
          type="button"
          className="image-model-select__trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={t("sidebar.imageModelAria")}
          onClick={() => setOpen((next) => !next)}
        >
          {current.shortLabel}
        </button>
        {open ? (
          <div className="image-model-select__menu" role="listbox" aria-label={t("sidebar.imageModelAria")}>
            {IMAGE_MODEL_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`image-model-select__item${option.value === imageModel ? " is-active" : ""}`}
                role="option"
                aria-selected={option.value === imageModel}
                onClick={() => {
                  setImageModel(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.shortLabel}</span>
                <small>{t(option.fullLabelKey)}</small>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="image-model-select image-model-select--settings">
      <select id={id} value={imageModel} onChange={onChange}>
        {IMAGE_MODEL_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.fullLabelKey)}
          </option>
        ))}
        {UNSUPPORTED_IMAGE_MODELS.map((option) => (
          <option key={option.value} value={option.value} disabled>
            {t(option.fullLabelKey)}
          </option>
        ))}
      </select>
    </div>
  );
}
