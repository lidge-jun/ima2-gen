import { useEffect, useState, type KeyboardEvent } from "react";
import { useAppStore } from "../store/useAppStore";
import { OptionGroup, type OptionItem } from "./OptionGroup";
import type { SizePreset } from "../types";
import {
  CUSTOM_RATIO_PRESETS,
  IMAGE_SIZE_MAX_SQUARE,
  MAX_CUSTOM_SIZE_SLOTS,
  SIZE_PRESETS_ROW1,
  SIZE_PRESETS_ROW2,
  SIZE_PRESETS_ROW3,
  SIZE_PRESETS_ROW4,
  formatSize,
  getSizePresetsRow5,
  normalizeCustomSizePairDetailed,
  parseRequestedCustomSide,
  sizeFromRatioPreset,
  type CustomRatioPreset,
} from "../lib/size";
import {
  loadCustomSizeSlots,
  makeCustomSizeSlot,
  replaceCustomSizeSlot,
  saveCustomSizeSlots,
  upsertCustomSizeSlot,
  type CustomSizeSlot,
} from "../lib/customSizeSlots";
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
  const [draftW, setDraftW] = useState(String(customW));
  const [draftH, setDraftH] = useState(String(customH));
  const [editorOpen, setEditorOpen] = useState(sizePreset === "custom");
  const [slots, setSlots] = useState<CustomSizeSlot[]>(() => loadCustomSizeSlots());
  const [replaceSlotId, setReplaceSlotId] = useState<string | null>(null);
  const [activeRatio, setActiveRatio] = useState<CustomRatioPreset["id"]>("free");

  const isCustom = sizePreset === "custom";
  const preview = normalizeCustomSizePairDetailed(draftW, draftH, customW, customH);
  const customRow = getSizePresetsRow5().filter((item) => item.value === "auto");

  useEffect(() => {
    setDraftW(String(customW));
    setDraftH(String(customH));
  }, [customW, customH]);

  useEffect(() => {
    if (!isCustom) {
      setEditorOpen(false);
      setReplaceSlotId(null);
    }
  }, [isCustom]);

  function setSlotsAndPersist(next: CustomSizeSlot[]) {
    setSlots(next);
    saveCustomSizeSlots(next);
  }

  function commitCustomSize() {
    const nextW = parseRequestedCustomSide(draftW, customW);
    const nextH = parseRequestedCustomSide(draftH, customH);
    setCustomSize(nextW, nextH);
    setDraftW(String(nextW));
    setDraftH(String(nextH));
  }

  function commitOnEnter(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitCustomSize();
    }
  }

  function openEditor() {
    setSizePreset("custom");
    setEditorOpen(true);
    setReplaceSlotId(slots.length >= MAX_CUSTOM_SIZE_SLOTS ? slots[0]?.id ?? null : null);
  }

  function selectPreset(nextPreset: SizePreset) {
    setSizePreset(nextPreset);
    if (nextPreset !== "custom") {
      setEditorOpen(false);
      setReplaceSlotId(null);
    }
  }

  function selectSlot(slot: CustomSizeSlot) {
    setSizePreset("custom");
    setCustomSize(slot.w, slot.h);
    setDraftW(String(slot.w));
    setDraftH(String(slot.h));
    setEditorOpen(false);
    setReplaceSlotId(slot.id);
  }

  function applyRatio(ratio: CustomRatioPreset) {
    setActiveRatio(ratio.id);
    const next = sizeFromRatioPreset(ratio);
    if (!next) return;
    setDraftW(String(next.w));
    setDraftH(String(next.h));
  }

  function saveSlot() {
    const normalized = makeCustomSizeSlot(preview.w, preview.h, activeRatio);
    const next =
      slots.length >= MAX_CUSTOM_SIZE_SLOTS && replaceSlotId
        ? replaceCustomSizeSlot(slots, replaceSlotId, normalized)
        : upsertCustomSizeSlot(slots, normalized);
    setSlotsAndPersist(next);
    setSizePreset("custom");
    setCustomSize(preview.w, preview.h);
    setDraftW(String(preview.w));
    setDraftH(String(preview.h));
    setReplaceSlotId(normalized.id);
    setEditorOpen(false);
  }

  const reasonText =
    preview.reasons.length > 0
      ? preview.reasons.map((reason) => t(`size.adjustedReasons.${reason}`)).join(", ")
      : t("size.noAdjustment");
  const squareMaxHint =
    preview.reasons.includes("maxPixels") && preview.requestedW === preview.requestedH && preview.w === preview.h
      ? t("size.squareMaxHint", {
        size: `${IMAGE_SIZE_MAX_SQUARE}×${IMAGE_SIZE_MAX_SQUARE}`,
      })
      : null;

  return (
    <div className="option-group size-picker">
      <div className="section-title">{t("size.title")}</div>
      <OptionGroup<SizePreset> title="" items={toItems(SIZE_PRESETS_ROW1)} value={sizePreset} onChange={selectPreset} />
      <OptionGroup<SizePreset> title="" items={toItems(SIZE_PRESETS_ROW2)} value={sizePreset} onChange={selectPreset} />
      <OptionGroup<SizePreset> title="" items={toItems(SIZE_PRESETS_ROW3)} value={sizePreset} onChange={selectPreset} />
      <OptionGroup<SizePreset> title="" items={toItems(SIZE_PRESETS_ROW4)} value={sizePreset} onChange={selectPreset} />
      <div className="option-row size-picker__quick-row">
        {toItems(customRow).map((item) => (
          <button
            key={item.value}
            type="button"
            className={`option-btn${sizePreset === item.value ? " active" : ""}`}
            onClick={() => selectPreset(item.value)}
          >
            {item.label}
            {item.sub ? (
              <>
                <br />
                <span className="option-sub">{item.sub}</span>
              </>
            ) : null}
          </button>
        ))}
        <button
          type="button"
          className={`option-btn${isCustom ? " active" : ""}`}
          onClick={openEditor}
        >
          {t("size.customPlus")}
          <br />
          <span className="option-sub">{t("size.customSub")}</span>
        </button>
      </div>
      {slots.length > 0 ? (
        <div className="option-row size-picker__slot-row">
          {slots.map((slot) => (
            <button
              key={slot.id}
              type="button"
              className={`option-btn size-picker__slot${isCustom && customW === slot.w && customH === slot.h ? " active" : ""}`}
              onClick={() => selectSlot(slot)}
            >
              {slot.w}×{slot.h}
              <br />
              <span className="option-sub">{slot.ratio || t("size.customSlot")}</span>
            </button>
          ))}
        </div>
      ) : null}
      {editorOpen ? (
        <>
          <div className="size-picker__ratio-row">
            {CUSTOM_RATIO_PRESETS.map((ratio) => (
              <button
                key={ratio.id}
                type="button"
                className={`size-picker__ratio${activeRatio === ratio.id ? " active" : ""}`}
                onClick={() => applyRatio(ratio)}
              >
                {ratio.id === "free" ? t("size.ratioFree") : ratio.label}
              </button>
            ))}
          </div>
          <div className="option-row">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="custom-size-input"
              value={draftW}
              onChange={(e) => setDraftW(e.target.value.replace(/\D/g, ""))}
              onBlur={commitCustomSize}
              onKeyDown={commitOnEnter}
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
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="custom-size-input"
              value={draftH}
              onChange={(e) => setDraftH(e.target.value.replace(/\D/g, ""))}
              onBlur={commitCustomSize}
              onKeyDown={commitOnEnter}
              placeholder={t("size.height")}
            />
          </div>
          <div className="size-picker__preview">
            <span>{t("size.normalizedPreview")}</span>
            <strong>{formatSize(preview.w, preview.h)}</strong>
          </div>
          <div className="size-picker__preview size-picker__preview--reason">
            {reasonText}
          </div>
          {squareMaxHint ? (
            <div className="size-picker__preview size-picker__preview--detail">
              {squareMaxHint}
            </div>
          ) : null}
          {slots.length >= MAX_CUSTOM_SIZE_SLOTS ? (
            <div className="size-picker__replace-row">
              <span>{t("size.replaceCustomSlot")}</span>
              {slots.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  className={`size-picker__replace${replaceSlotId === slot.id ? " active" : ""}`}
                  onClick={() => setReplaceSlotId(slot.id)}
                >
                  {slot.w}×{slot.h}
                </button>
              ))}
            </div>
          ) : null}
          <button type="button" className="size-picker__save" onClick={saveSlot}>
            {slots.length >= MAX_CUSTOM_SIZE_SLOTS ? t("size.replaceCustomSlot") : t("size.saveCustomSlot")}
          </button>
          <div className="size-hint">
            {t("size.hint")}
          </div>
        </>
      ) : null}
    </div>
  );
}
