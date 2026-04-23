import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { BillingBar } from "./BillingBar";
import { OptionGroup } from "./OptionGroup";
import { SizePicker } from "./SizePicker";
import { CostEstimate } from "./CostEstimate";
import type { Count, Format, Moderation, Quality } from "../types";
import { useI18n } from "../i18n";

const FORMAT_ITEMS = [
  { value: "png" as const, label: "PNG" },
  { value: "jpeg" as const, label: "JPEG" },
  { value: "webp" as const, label: "WebP" },
];

const COUNT_ITEMS: { value: string; label: string }[] = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "4", label: "4" },
];

export function RightPanel() {
  const open = useAppStore((s) => s.rightPanelOpen);
  const toggle = useAppStore((s) => s.toggleRightPanel);
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
  const count = useAppStore((s) => s.count);
  const setCount = useAppStore((s) => s.setCount);

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
          <BillingBar />
          <div className="section-title">{t("panel.detailSettings")}</div>
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
          <OptionGroup<string>
            title={t("count.title")}
            items={COUNT_ITEMS}
            value={String(count)}
            onChange={(v) => setCount(Number(v) as Count)}
          />
          <CostEstimate />
        </div>
      </aside>
    </>
  );
}
