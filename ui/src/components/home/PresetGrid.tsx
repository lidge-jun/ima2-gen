import { useMemo, useState } from "react";
import type { PresetCategory } from "../../../../lib/presetCompiler";
import { getAllPresets, getPresetsByCategory } from "../../lib/presets";
import { useAppStore } from "../../store/useAppStore";
import { useI18n } from "../../i18n";
import { CheckIcon, Segmented, type SegmentedItem } from "../controls";

type CategoryFilter = PresetCategory | "all";

const CATEGORY_ITEMS: ReadonlyArray<SegmentedItem<CategoryFilter>> = [
  { value: "camera-motion", label: "Camera Motion" },
  { value: "style", label: "Style" },
  { value: "lighting", label: "Lighting" },
  { value: "all", label: "All" },
];

export function PresetGrid() {
  const [category, setCategory] = useState<CategoryFilter>("camera-motion");
  const [query, setQuery] = useState("");
  const selectedPresetIds = useAppStore((state) => state.selectedPresetIds);
  const togglePreset = useAppStore((state) => state.togglePreset);
  const { t } = useI18n();
  const selectedIds = useMemo(() => new Set(selectedPresetIds), [selectedPresetIds]);
  const presets = useMemo(
    () => {
      const base = category === "all" ? getAllPresets() : getPresetsByCategory(category);
      if (!query.trim()) return base;
      const q = query.trim().toLowerCase();
      return base.filter((p) => p.name.toLowerCase().includes(q) || p.id.includes(q));
    },
    [category, query],
  );

  return (
    <section className="home-preset-section" aria-labelledby="home-presets-title">
      <div className="home-preset-section__header">
        <div className="home-preset-section__title-row">
          <h2 id="home-presets-title">{t("home.presetsTitle")}</h2>
          <span className="home-preset-section__count" aria-live="polite">
            {t("home.selectedCount", { count: selectedPresetIds.length })}
          </span>
        </div>
        <div className="home-preset-section__controls">
          <input
            type="search"
            className="home-preset-search"
            value={query}
            placeholder={t("home.presetSearch")}
            aria-label={t("home.presetSearch")}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Segmented
            className="home-preset-section__tabs"
            items={CATEGORY_ITEMS}
            value={category}
            onChange={setCategory}
          />
        </div>
      </div>

      <div className="home-preset-grid">
        {presets.map((preset) => {
          const selected = selectedIds.has(preset.id);
          return (
            <button
              key={preset.id}
              type="button"
              className={`home-preset-card home-preset-card--${preset.category}${selected ? " is-selected" : ""}`}
              aria-pressed={selected}
              onClick={() => togglePreset(preset.id)}
            >
              <img className="home-preset-card__thumb" src={`/presets/thumbs/${preset.id}.png`} alt="" loading="lazy" />
              <span className="home-preset-card__meta">
                <span className="home-preset-card__name">{preset.name}</span>
                <span className="home-preset-card__category">{preset.category.replace("-", " ")}</span>
              </span>
              <span className="home-preset-card__check"><CheckIcon /></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
