import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { BillingBar } from "./BillingBar";
import { OptionGroup } from "./OptionGroup";
import { SizePicker } from "./SizePicker";
import { CostEstimate } from "./CostEstimate";
import type { Count, Format, Moderation, Quality } from "../types";

const QUALITY_ITEMS = [
  { value: "low" as const, label: "Low", sub: "fast" },
  { value: "medium" as const, label: "Medium", sub: "balanced" },
  { value: "high" as const, label: "High", sub: "best" },
];

const FORMAT_ITEMS = [
  { value: "png" as const, label: "PNG" },
  { value: "jpeg" as const, label: "JPEG" },
  { value: "webp" as const, label: "WebP" },
];

const MOD_ITEMS = [
  { value: "auto" as const, label: "Auto", sub: "standard filter" },
  {
    value: "low" as const,
    label: "Low",
    sub: "relaxed filter",
    color: "var(--amber)",
  },
];

const COUNT_ITEMS: { value: string; label: string }[] = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "4", label: "4" },
];

export function RightPanel() {
  const open = useAppStore((s) => s.rightPanelOpen);
  const toggle = useAppStore((s) => s.toggleRightPanel);
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

  // On mobile the collapsed state = drawer closed; the toggle opens it.
  const drawerOpen = isMobile ? open : true;

  const quality = useAppStore((s) => s.quality);
  const setQuality = useAppStore((s) => s.setQuality);
  const format = useAppStore((s) => s.format);
  const setFormat = useAppStore((s) => s.setFormat);
  const moderation = useAppStore((s) => s.moderation);
  const setModeration = useAppStore((s) => s.setModeration);
  const count = useAppStore((s) => s.count);
  const setCount = useAppStore((s) => s.setCount);

  return (
    <>
      {isMobile && open ? (
        <div
          className="right-panel-backdrop"
          role="button"
          aria-label="Close settings"
          onClick={toggle}
        />
      ) : null}
      <aside
        className={`right-panel${open ? "" : " collapsed"}${isMobile && drawerOpen ? " drawer-open" : ""}`}
        aria-label="Detail settings"
      >
        <button
          type="button"
          className="right-panel-toggle"
          aria-expanded={open}
          aria-controls="right-panel-body"
          onClick={toggle}
          title={open ? "Hide details" : "Show details"}
        >
          {isMobile ? (open ? "✕" : "☰") : open ? "▶" : "◀"}
        </button>
        <div
          id="right-panel-body"
          className="right-panel-body"
          hidden={!open}
        >
          <BillingBar />
          <div className="section-title">Details</div>
          <OptionGroup<Quality>
            title="Quality"
            items={QUALITY_ITEMS}
            value={quality}
            onChange={setQuality}
          />
          <SizePicker />
          <OptionGroup<Format>
            title="Format"
            items={FORMAT_ITEMS}
            value={format}
            onChange={setFormat}
          />
          <OptionGroup<Moderation>
            title="Moderation"
            items={MOD_ITEMS}
            value={moderation}
            onChange={setModeration}
          />
          <p className="option-help">
            Auto uses the standard safety filter. Low relaxes it slightly and may allow more
            borderline prompts.
          </p>
          <OptionGroup<string>
            title="Count"
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
