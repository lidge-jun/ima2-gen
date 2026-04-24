import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import type { SizePreset } from "../types";
import {
  SIZE_CATEGORIES,
  categoryForPreset,
  type SizeCategory,
} from "../lib/size";

function CategoryIcon({ kind }: { kind: "square" | "landscape" | "portrait" | "custom" }) {
  const common = {
    width: 12,
    height: 12,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (kind === "square") {
    return (
      <svg {...common}>
        <rect x="5" y="5" width="14" height="14" rx="1.5" />
      </svg>
    );
  }
  if (kind === "landscape") {
    return (
      <svg {...common}>
        <rect x="3" y="7" width="18" height="10" rx="1.5" />
      </svg>
    );
  }
  if (kind === "portrait") {
    return (
      <svg {...common}>
        <rect x="7" y="3" width="10" height="18" rx="1.5" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
    </svg>
  );
}

export function SizePicker() {
  const sizePreset = useAppStore((s) => s.sizePreset);
  const setSizePreset = useAppStore((s) => s.setSizePreset);
  const customW = useAppStore((s) => s.customW);
  const customH = useAppStore((s) => s.customH);
  const setCustomSize = useAppStore((s) => s.setCustomSize);

  const [active, setActive] = useState<SizeCategory>(() =>
    categoryForPreset(sizePreset),
  );

  // Keep active tab in sync if value changes from outside (e.g. example click).
  useEffect(() => {
    const next = categoryForPreset(sizePreset);
    setActive(next);
  }, [sizePreset]);

  const isCustom = sizePreset === "custom";
  const activeGroup = SIZE_CATEGORIES.find((c) => c.id === active) ?? SIZE_CATEGORIES[0];

  return (
    <div className="size-picker">
      <div className="section-title">크기</div>
      <div className="size-picker__tabs" role="tablist" aria-label="크기 카테고리">
        {SIZE_CATEGORIES.map((c) => {
          const selected = c.id === active;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`size-picker__tab${selected ? " active" : ""}`}
              onClick={() => setActive(c.id)}
              title={c.label}
            >
              <CategoryIcon kind={c.icon} />
              <span>{c.label}</span>
            </button>
          );
        })}
      </div>
      <div className="size-picker__options" role="tabpanel">
        {activeGroup.items.map((it) => {
          const selected = sizePreset === it.value;
          return (
            <button
              key={it.value}
              type="button"
              className={`size-picker__option${selected ? " active" : ""}`}
              onClick={() => setSizePreset(it.value as SizePreset)}
              title={`${it.label} (${it.sub})`}
            >
              <span className="size-picker__option-label">{it.label}</span>
              <span className="size-picker__option-sub">{it.sub}</span>
            </button>
          );
        })}
      </div>
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
              placeholder="가로"
              aria-label="가로 픽셀"
            />
            <span
              style={{
                color: "var(--text-dim)",
                alignSelf: "center",
                fontFamily: "var(--mono)",
                fontSize: 12,
              }}
            >
              ×
            </span>
            <input
              type="number"
              className="custom-size-input"
              min={1024}
              max={3824}
              step={16}
              value={customH}
              onChange={(e) => setCustomSize(customW, parseInt(e.target.value) || 1024)}
              placeholder="세로"
              aria-label="세로 픽셀"
            />
          </div>
          <div className="size-hint">
            한 변 1024–3824px, 16의 배수, 비율 최대 3:1
          </div>
        </>
      ) : null}
    </div>
  );
}
