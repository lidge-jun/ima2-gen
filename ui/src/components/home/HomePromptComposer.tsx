import { getAllPresets } from "../../lib/presets";
import { useI18n } from "../../i18n";
import { useAppStore } from "../../store/useAppStore";
import { Chip, ChipRow } from "../controls";

const PROVIDER_LABELS: Record<string, string> = {
  oauth: "GPT OAuth",
  api: "GPT API",
  grok: "Grok OAuth",
  "grok-api": "Grok API",
  agy: "Antigravity",
  "gemini-api": "Gemini API",
  atlascloud: "Atlas Cloud",
};

export function HomePromptComposer() {
  const prompt = useAppStore((state) => state.prompt);
  const setPrompt = useAppStore((state) => state.setPrompt);
  const provider = useAppStore((state) => state.provider);
  const selectedPresetIds = useAppStore((state) => state.selectedPresetIds);
  const removePreset = useAppStore((state) => state.removePreset);
  const generate = useAppStore((state) => state.generate);
  const activeGenerations = useAppStore((state) => state.activeGenerations);
  const { t } = useI18n();
  const selectedIdSet = new Set(selectedPresetIds);
  const selectedPresets = getAllPresets().filter((preset) => selectedIdSet.has(preset.id));
  const isGenerating = activeGenerations > 0;

  return (
    <div className="home-prompt">
      {selectedPresets.length > 0 ? (
        <ChipRow className="home-prompt__chips" ariaLabel={t("home.selectedPresets")}>
          {selectedPresets.map((preset) => (
            <Chip
              key={preset.id}
              selected
              onRemove={() => removePreset(preset.id)}
              title={preset.category}
            >
              {preset.name}
            </Chip>
          ))}
        </ChipRow>
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
        <span className="home-prompt__provider">
          <span className="home-prompt__provider-dot" aria-hidden="true" />
          {PROVIDER_LABELS[provider] ?? provider}
        </span>
        <button
          type="button"
          className="home-prompt__generate"
          disabled={isGenerating || prompt.trim().length === 0}
          onClick={() => void generate()}
        >
          {isGenerating
            ? t("generate.buttonLoading", { n: activeGenerations })
            : t("generate.button")}
        </button>
      </div>
    </div>
  );
}
