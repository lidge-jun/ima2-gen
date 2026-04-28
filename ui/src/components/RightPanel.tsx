import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { OptionGroup } from "./OptionGroup";
import { SizePicker } from "./SizePicker";
import { CountPicker } from "./CountPicker";
import { CostEstimate } from "./CostEstimate";
import { PromptLibraryPanel } from "./PromptLibraryPanel";
import type { Format, Moderation, Quality } from "../types";
import { useI18n } from "../i18n";

const FORMAT_ITEMS = [
  { value: "png" as const, label: "PNG" },
  { value: "jpeg" as const, label: "JPEG" },
  { value: "webp" as const, label: "WebP" },
];

export function RightPanel() {
  const open = useAppStore((s) => s.rightPanelOpen);
  const toggle = useAppStore((s) => s.toggleRightPanel);
  const promptLibraryOpen = useAppStore((s) => s.promptLibraryOpen);
  const togglePromptLibrary = useAppStore((s) => s.togglePromptLibrary);
  const { t } = useI18n();
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.matchMedia("(max-width: 800px)").matches : false,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 800px)");
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const drawerOpen = isMobile ? open : true;

  const quality = useAppStore((s) => s.quality);
  const setQuality = useAppStore((s) => s.setQuality);
  const format = useAppStore((s) => s.format);
  const setFormat = useAppStore((s) => s.setFormat);
  const moderation = useAppStore((s) => s.moderation);
  const setModeration = useAppStore((s) => s.setModeration);
  const multimode = useAppStore((s) => s.multimode);
  const setMultimode = useAppStore((s) => s.setMultimode);
  const uiMode = useAppStore((s) => s.uiMode);
  const showMultimodeControls = uiMode === "classic";
  const QUALITY_ITEMS = [
    { value: "low" as const, label: t("quality.lowLabel"), sub: t("quality.lowSub") },
    { value: "medium" as const, label: t("quality.mediumLabel"), sub: t("quality.mediumSub") },
    { value: "high" as const, label: t("quality.highLabel"), sub: t("quality.highSub") },
  ];

  const MOD_ITEMS = [
    { value: "auto" as const, label: t("moderation.autoLabel"), sub: t("moderation.autoSub") },
    {
      value: "low" as const,
      label: t("moderation.lowLabel"),
      sub: t("moderation.lowSub"),
      color: "var(--amber)",
    },
  ];

  return (
    <>
      {isMobile && open ? (
        <div
          className="right-panel-backdrop"
          role="button"
          aria-label={t("panel.closeSettings")}
          onClick={toggle}
        />
      ) : null}
      <aside
        className={`right-panel${open ? "" : " collapsed"}${isMobile && drawerOpen ? " drawer-open" : ""}`}
        aria-label={t("panel.detailSettings")}
      >
        <button
          type="button"
          className="right-panel-toggle"
          aria-expanded={open}
          aria-controls="right-panel-body"
          onClick={toggle}
          title={open ? t("panel.toggleHide") : t("panel.toggleShow")}
        >
          {isMobile ? (open ? t("panel.close") : t("panel.open")) : open ? ">" : "<"}
        </button>
        <div
          id="right-panel-body"
          className="right-panel-body"
          hidden={!open}
        >
          <div className="right-panel-tabs" role="tablist" aria-label={t("panel.detailSettings")}>
            <button
              type="button"
              role="tab"
              aria-selected={!promptLibraryOpen}
              className={`right-panel-tabs__button${promptLibraryOpen ? "" : " active"}`}
              onClick={() => {
                if (promptLibraryOpen) togglePromptLibrary();
              }}
            >
              {t("panel.detailSettings")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={promptLibraryOpen}
              className={`right-panel-tabs__button${promptLibraryOpen ? " active" : ""}`}
              onClick={() => {
                if (!promptLibraryOpen) togglePromptLibrary();
              }}
            >
              {t("promptLibrary.title")}
            </button>
          </div>
          {promptLibraryOpen ? (
            <PromptLibraryPanel variant="embedded" />
          ) : (
            <div className="right-panel-settings" role="tabpanel">
              <OptionGroup<Quality>
                title={t("quality.title")}
                items={QUALITY_ITEMS}
                value={quality}
                onChange={setQuality}
              />
              <SizePicker />
              <OptionGroup<Format>
                title={t("format.title")}
                items={FORMAT_ITEMS}
                value={format}
                onChange={setFormat}
              />
              <OptionGroup<Moderation>
                title={t("moderation.title")}
                items={MOD_ITEMS}
                value={moderation}
                onChange={setModeration}
              />
              <p className="option-help">
                {t("moderation.explain")}
              </p>
              {showMultimodeControls && (
                <div className="option-group multimode-toggle">
                  <button
                    type="button"
                    className={`multimode-toggle__button${multimode ? " active" : ""}`}
                    aria-pressed={multimode}
                    title={t("multimode.tooltip")}
                    onClick={() => setMultimode(!multimode)}
                  >
                    <span>{t("multimode.label")}</span>
                    <span>{t("multimode.shortHint")}</span>
                  </button>
                </div>
              )}
              <CountPicker />
              <CostEstimate />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
