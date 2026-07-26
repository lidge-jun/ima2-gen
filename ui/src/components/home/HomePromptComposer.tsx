import { getAllPresets } from "../../lib/presets";
import type { TrayItem } from "../../lib/referenceTray";
import { useI18n } from "../../i18n";
import { useAppStore } from "../../store/useAppStore";
import type { Provider } from "../../types";
import { useProviderAvailability } from "../../hooks/useProviderAvailability";
import { Chip, ChipRow } from "../controls";
import { Select, type SelectItem } from "../controls/Select";

const PROVIDER_LABELS: Record<Provider, string> = {
  oauth: "GPT OAuth",
  api: "GPT API",
  grok: "Grok OAuth",
  "grok-api": "Grok API",
  agy: "Antigravity",
  "gemini-api": "Gemini API",
  atlascloud: "Atlas Cloud",
};

function homeReferenceThumbnail(item: TrayItem): string | undefined {
  if (item.kind === "attachment") return item.source.dataUrl;
  if (item.source.thumbnailUrl) return item.source.thumbnailUrl;
  const filename = item.source.referenceFilenames[0];
  if (!filename) return undefined;
  if (filename.startsWith("/generated/")) return filename;
  return `/generated/${filename.split("/").map(encodeURIComponent).join("/")}`;
}

export function HomePromptComposer() {
  const prompt = useAppStore((state) => state.prompt);
  const setPrompt = useAppStore((state) => state.setPrompt);
  const provider = useAppStore((state) => state.provider);
  const setProvider = useAppStore((state) => state.setProvider);
  const selectedPresetIds = useAppStore((state) => state.selectedPresetIds);
  const removePreset = useAppStore((state) => state.removePreset);
  const generate = useAppStore((state) => state.generate);
  const activeGenerations = useAppStore((state) => state.activeGenerations);
  const trayItems = useAppStore((state) => state.trayItems);
  const providerAvailability = useProviderAvailability();
  const { t } = useI18n();
  const selectedIdSet = new Set(selectedPresetIds);
  const selectedPresets = getAllPresets().filter((preset) => selectedIdSet.has(preset.id));
  const isGenerating = activeGenerations > 0;
  const providerItems = Object.entries(PROVIDER_LABELS).map(([value, label]) => {
    const providerValue = value as Provider;
    const availability = providerAvailability[providerValue];
    return {
      value: providerValue,
      label,
      sub: availability.ok ? t("readiness.ready") : availability.reason,
      disabled: !availability.ok,
    } satisfies SelectItem<Provider>;
  });

  return (
    <div className="home-prompt">
      {selectedPresets.length > 0 ? (
        <ChipRow className="home-prompt__chips" ariaLabel={t("home.selectedPresets")}>
          {selectedPresets.map((preset) => (
            <Chip
              key={preset.id}
              selected
              onRemove={() => removePreset(preset.id)}
              removeLabel={t("common.removeNamed", { name: preset.name })}
              title={preset.category}
            >
              {preset.name}
            </Chip>
          ))}
        </ChipRow>
      ) : null}

      {trayItems.length > 0 ? (
        <div
          className="home-prompt__reference-strip"
          role="group"
          aria-label={t("home.referenceTrayAria", { count: trayItems.length })}
        >
          <span className="home-prompt__reference-thumbs" aria-hidden="true">
            {trayItems.map((item) => {
              const thumbnail = homeReferenceThumbnail(item);
              return (
                <span key={item.tokenId} className="home-prompt__reference-thumb">
                  {thumbnail ? <img src={thumbnail} alt="" loading="lazy" decoding="async" /> : "@"}
                </span>
              );
            })}
          </span>
          <span className="home-prompt__reference-count">
            {t("home.referenceTrayCount", { count: trayItems.length })}
          </span>
        </div>
      ) : null}

      <label className="home-prompt__label" htmlFor="home-prompt-input">
        {t("prompt.label")}
      </label>
      <textarea
        id="home-prompt-input"
        className="home-prompt__textarea"
        rows={5}
        value={prompt}
        placeholder={t("prompt.placeholder")}
        onChange={(event) => setPrompt(event.target.value)}
      />

      <div className="home-prompt__footer">
        <Select
          className="home-prompt__provider"
          items={providerItems}
          value={provider}
          onChange={setProvider}
          ariaLabel={t("readiness.provider")}
        />
        <button
          type="button"
          className="home-prompt__generate"
          disabled={isGenerating || prompt.trim().length === 0}
          onClick={() => {
            void generate();
            // Switch to classic mode so the user sees inflight/results
            const setUIMode = useAppStore.getState().setUIMode;
            setUIMode("classic");
          }}
        >
          {isGenerating
            ? t("generate.buttonLoading", { n: activeGenerations })
            : t("generate.button")}
        </button>
      </div>
    </div>
  );
}
