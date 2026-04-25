import { useEffect } from "react";
import { useCardNewsStore } from "../../store/cardNewsStore";
import { useI18n } from "../../i18n";

export function CardNewsComposer() {
  const { t } = useI18n();
  const hydrate = useCardNewsStore((s) => s.hydrate);
  const topic = useCardNewsStore((s) => s.topic);
  const audience = useCardNewsStore((s) => s.audience);
  const goal = useCardNewsStore((s) => s.goal);
  const contentBrief = useCardNewsStore((s) => s.contentBrief);
  const outputSizePreset = useCardNewsStore((s) => s.outputSizePreset);
  const customW = useCardNewsStore((s) => s.customW);
  const customH = useCardNewsStore((s) => s.customH);
  const setBriefField = useCardNewsStore((s) => s.setBriefField);
  const setOutputSizePreset = useCardNewsStore((s) => s.setOutputSizePreset);
  const setCustomSize = useCardNewsStore((s) => s.setCustomSize);
  const draft = useCardNewsStore((s) => s.draft);
  const loading = useCardNewsStore((s) => s.loading);
  const generating = useCardNewsStore((s) => s.generating);
  const draftError = useCardNewsStore((s) => s.draftError);
  const generateSet = useCardNewsStore((s) => s.generateSet);
  const activePlan = useCardNewsStore((s) => s.activePlan);
  const cards = activePlan?.cards || [];
  const summary = {
    total: cards.length,
    done: cards.filter((card) => card.status === "generated").length,
  };

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <section className="card-news-composer" aria-label={t("cardNews.composer")}>
      <div className="card-news-composer__head">
        <div>
          <div className="section-title">{t("cardNews.composer")}</div>
          <p>{t("cardNews.composerHint")}</p>
        </div>
      </div>
      <label className="card-news-field">
        <span>{t("cardNews.topic")}</span>
        <input
          value={topic}
          placeholder={t("cardNews.topicPlaceholder")}
          onChange={(e) => setBriefField("topic", e.target.value)}
        />
      </label>
      <label className="card-news-field">
        <span>{t("cardNews.audience")}</span>
        <input
          value={audience}
          placeholder={t("cardNews.audiencePlaceholder")}
          onChange={(e) => setBriefField("audience", e.target.value)}
        />
      </label>
      <label className="card-news-field">
        <span>{t("cardNews.goal")}</span>
        <input
          value={goal}
          placeholder={t("cardNews.goalPlaceholder")}
          onChange={(e) => setBriefField("goal", e.target.value)}
        />
      </label>
      <label className="card-news-field">
        <span>{t("cardNews.brief")}</span>
        <textarea
          value={contentBrief}
          placeholder={t("cardNews.briefPlaceholder")}
          onChange={(e) => setBriefField("contentBrief", e.target.value)}
        />
      </label>
      <div className="card-news-field">
        <span>{t("cardNews.outputSize")}</span>
        <div className="card-news-size-row" role="group" aria-label={t("cardNews.outputSize")}>
          {(["1024x1024", "2048x2048", "custom"] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              className={`option-btn${outputSizePreset === preset ? " active" : ""}`}
              onClick={() => setOutputSizePreset(preset)}
            >
              {preset === "custom" ? t("cardNews.customSize") : preset === "1024x1024" ? "1024²" : "2048²"}
            </button>
          ))}
        </div>
        {outputSizePreset === "custom" ? (
          <div className="card-news-custom-size">
            <input
              className="custom-size-input"
              type="text"
              inputMode="numeric"
              value={customW}
              onChange={(e) => setCustomSize(Number.parseInt(e.target.value, 10) || customW, customH)}
              aria-label={t("size.width")}
            />
            <span>×</span>
            <input
              className="custom-size-input"
              type="text"
              inputMode="numeric"
              value={customH}
              onChange={(e) => setCustomSize(customW, Number.parseInt(e.target.value, 10) || customH)}
              aria-label={t("size.height")}
            />
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="generate-btn card-news-draft-btn"
        onClick={() => void draft()}
        disabled={loading || !topic.trim()}
      >
        {loading ? <span className="card-news-spinner" aria-hidden="true" /> : null}
        {loading ? t("cardNews.drafting") : t("cardNews.draft")}
      </button>
      {draftError ? <div className="card-news-error" role="alert">{draftError}</div> : null}
      {loading ? (
        <div className="card-news-inline-status" role="status">
          <span className="card-news-spinner" aria-hidden="true" />
          <span>{t("cardNews.drafting")}</span>
        </div>
      ) : null}
      <button
        type="button"
        className="composer__tool card-news-generate-btn"
        onClick={() => void generateSet()}
        disabled={!activePlan || generating || activePlan.cards.every((card) => card.locked)}
      >
        {generating ? <span className="card-news-spinner" aria-hidden="true" /> : null}
        {generating
          ? t("cardNews.progress.generating", { done: summary.done, total: summary.total })
          : t("cardNews.batchGenerate")}
      </button>
    </section>
  );
}
