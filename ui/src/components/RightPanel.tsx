import { useAppStore } from "../store/useAppStore";
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
  {
    value: "low" as const,
    label: "Low",
    sub: "less restrictive",
    color: "var(--amber)",
  },
  { value: "auto" as const, label: "Auto", sub: "standard" },
];

const COUNT_ITEMS: { value: string; label: string }[] = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "4", label: "4" },
];

export function RightPanel() {
  const open = useAppStore((s) => s.rightPanelOpen);
  const toggle = useAppStore((s) => s.toggleRightPanel);

  const quality = useAppStore((s) => s.quality);
  const setQuality = useAppStore((s) => s.setQuality);
  const format = useAppStore((s) => s.format);
  const setFormat = useAppStore((s) => s.setFormat);
  const moderation = useAppStore((s) => s.moderation);
  const setModeration = useAppStore((s) => s.setModeration);
  const count = useAppStore((s) => s.count);
  const setCount = useAppStore((s) => s.setCount);

  return (
    <aside
      className={`right-panel${open ? "" : " collapsed"}`}
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
        {open ? "▶" : "◀"}
      </button>
      <div
        id="right-panel-body"
        className="right-panel-body"
        hidden={!open}
      >
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
        <OptionGroup<string>
          title="Count"
          items={COUNT_ITEMS}
          value={String(count)}
          onChange={(v) => setCount(Number(v) as Count)}
        />
        <CostEstimate />
      </div>
    </aside>
  );
}
