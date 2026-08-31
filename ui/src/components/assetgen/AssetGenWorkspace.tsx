import { lazy, Suspense, useCallback, useState } from "react";
import { useI18n } from "../../i18n";
import { useAppStore } from "../../store/useAppStore";
import type { GenerateItem } from "../../types";
import { InFlightList } from "../InFlightList";
import { AssetMediaLightbox } from "./AssetMediaLightbox";
import { AssetGenProjectRail } from "./AssetGenProjectRail";
import { BackgroundPresetPicker } from "./BackgroundPresetPicker";
import { AssetGenModelPicker } from "./AssetGenModelPicker";
import { ProjectSelect } from "./ProjectSelect";
import { KeyingPanel } from "./KeyingPanel";
import { VectorizePanel } from "./VectorizePanel";
import { useTablistKeys } from "../../hooks/useTablistKeys";
import "../../styles/sprite-recipe.css";
const SpriteRecipeWorkspace = lazy(() => import("./SpriteRecipeWorkspace").then((module) => ({ default: module.SpriteRecipeWorkspace })));

export function AssetGenWorkspace() {
  const { t } = useI18n();
  const prompt = useAppStore((s) => s.assetGenPrompt);
  const setPrompt = useAppStore((s) => s.setAssetGenPrompt);
  const kind = useAppStore((s) => s.assetGenKind);
  const setKind = useAppStore((s) => s.setAssetGenKind);
  const provider = useAppStore((s) => s.assetGenProvider);
  const videoDuration = useAppStore((s) => s.assetGenVideoDuration);
  const setVideoDuration = useAppStore((s) => s.setAssetGenVideoDuration);
  const videoResolution = useAppStore((s) => s.assetGenVideoResolution);
  const setVideoResolution = useAppStore((s) => s.setAssetGenVideoResolution);
  const videoAspect = useAppStore((s) => s.assetGenVideoAspect);
  const setVideoAspect = useAppStore((s) => s.setAssetGenVideoAspect);
  const activeGens = useAppStore((s) => s.activeGenerations);
  const items = useAppStore((s) => s.assetGenItems);
  const generate = useAppStore((s) => s.generateAssetGen);
  const saveFailures = useAppStore((s) => s.assetGenSaveFailures);
  const retrySave = useAppStore((s) => s.retryAssetGenSave);
  const setKeyingTarget = useAppStore((s) => s.setKeyingTarget);
  const setVectorizeTarget = useAppStore((s) => s.setVectorizeTarget);
  const lastError = useAppStore((s) => s.assetGenLastError);
  const setLastError = useAppStore((s) => s.setAssetGenLastError);
  const setUIMode = useAppStore((s) => s.setUIMode);
  const workflow = useAppStore((s) => s.assetGenWorkflow);
  const setWorkflow = useAppStore((s) => s.setAssetGenWorkflow);
  const onWorkflowTabKeyDown = useTablistKeys<HTMLDivElement>();
  const [previewItem, setPreviewItem] = useState<GenerateItem | null>(null);
  const [railSelectedId, setRailSelectedId] = useState<string | null>(null);
  const [projectAssetCount, setProjectAssetCount] = useState(0);
  const closePreview = useCallback(() => { setPreviewItem(null); setRailSelectedId(null); }, []);
  const openRailPreview = useCallback((item: GenerateItem, assetId: string) => {
    setRailSelectedId(assetId);
    setPreviewItem(item);
  }, []);
  const focusPrompt = useCallback(() => {
    document.getElementById("assetgen-prompt")?.focus();
  }, []);

  const isGrok = provider === "grok" || provider === "grok-api";
  const videoAllowed = isGrok;
  const effectiveKind = kind === "video" && !videoAllowed ? "image" : kind;
  const canGenerate = prompt.trim().length > 0;

  const workflowTabs = (
    <div
      className="assetgen-workflow-tabs"
      role="tablist"
      aria-label={t("sprite.tabs.label")}
      onKeyDown={onWorkflowTabKeyDown}
    >
      <button
        type="button"
        role="tab"
        aria-selected={workflow === "generate"}
        tabIndex={workflow === "generate" ? 0 : -1}
        onClick={() => setWorkflow("generate")}
      >
        {t("sprite.tabs.generate")}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={workflow === "sprite"}
        tabIndex={workflow === "sprite" ? 0 : -1}
        onClick={() => setWorkflow("sprite")}
      >
        {t("sprite.tabs.sprite")}
      </button>
    </div>
  );
  if (workflow === "sprite") return <section className="assetgen-workspace" aria-labelledby="assetgen-title"><aside className="assetgen-form"><h1 id="assetgen-title">{t("sprite.title")}</h1><p className="assetgen-form__lede">{t("sprite.lede")}</p>{workflowTabs}</aside><main className="assetgen-results"><Suspense fallback={<p role="status">{t("sprite.loading")}</p>}><SpriteRecipeWorkspace /></Suspense></main></section>;

  return (
    <section className="assetgen-workspace" aria-labelledby="assetgen-title">
      <aside className="assetgen-form">
        <h1 id="assetgen-title">{t("assetGen.title")}</h1>
        <p className="assetgen-form__lede">{t("assetGen.lede")}</p>
        {workflowTabs}
        <ProjectSelect />
        <div className="assetgen-field">
          <label className="assetgen-field__label" htmlFor="assetgen-prompt">{t("assetGen.prompt")}</label>
          <textarea
            id="assetgen-prompt"
            value={prompt}
            rows={4}
            placeholder={t("assetGen.promptPlaceholder")}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>
        <BackgroundPresetPicker />
        <AssetGenModelPicker />
        <div className="assetgen-field">
          <span className="assetgen-field__label" id="assetgen-kind-label">{t("assetGen.kind")}</span>
          <div className="assetgen-bg-picker" role="group" aria-labelledby="assetgen-kind-label">
            <button
              type="button"
              className={effectiveKind === "image" ? "is-active" : ""}
              aria-pressed={effectiveKind === "image"}
              onClick={() => setKind("image")}
            >
              {t("assetGen.kindImage")}
            </button>
            <button
              type="button"
              className={effectiveKind === "video" ? "is-active" : ""}
              aria-pressed={effectiveKind === "video"}
              disabled={!videoAllowed}
              title={videoAllowed ? undefined : t("assetGen.videoGrokOnly")}
              onClick={() => setKind("video")}
            >
              {t("assetGen.kindVideo")}
            </button>
          </div>
          {!videoAllowed ? <p className="assetgen-field__hint">{t("assetGen.videoGrokOnly")}</p> : null}
        </div>
        {effectiveKind === "video" ? (
          <div className="assetgen-field">
            <span className="assetgen-field__label" id="assetgen-video-label">{t("assetGen.videoOptions")}</span>
            <div className="assetgen-bg-picker" role="group" aria-label={t("assetGen.videoDuration")}>
              {[3, 5, 8].map((d) => (
                <button key={d} type="button" className={videoDuration === d ? "is-active" : ""} aria-pressed={videoDuration === d} onClick={() => setVideoDuration(d)}>
                  {d}s
                </button>
              ))}
            </div>
            <div className="assetgen-bg-picker" role="group" aria-label={t("assetGen.videoResolution")}>
              {(["480p", "720p"] as const).map((r) => (
                <button key={r} type="button" className={videoResolution === r ? "is-active" : ""} aria-pressed={videoResolution === r} onClick={() => setVideoResolution(r)}>
                  {r}
                </button>
              ))}
            </div>
            <div className="assetgen-bg-picker" role="group" aria-label={t("assetGen.videoAspect")}>
              {(["1:1", "16:9", "9:16"] as const).map((a) => (
                <button key={a} type="button" className={videoAspect === a ? "is-active" : ""} aria-pressed={videoAspect === a} onClick={() => setVideoAspect(a)}>
                  {a}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <button
          type="button"
          className="assetgen-generate"
          disabled={!canGenerate}
          onClick={() => void generate()}
        >
          {activeGens > 0 ? t("assetGen.generating") : t("assetGen.generate")}
        </button>
        {!canGenerate ? (
          <p className="assetgen-generate__hint">{t("assetGen.generateHint")}</p>
        ) : null}
        <InFlightList />
      </aside>
      <main className="assetgen-results">
        <div className="assetgen-results__main">
          {lastError ? (
            <div className="assetgen-error" role="alert">
              <div className="assetgen-error__text">
                <strong>{t("assetGen.errorTitle")}</strong>
                <span>{lastError}</span>
                <span className="assetgen-error__hint">{t("assetGen.errorHint")}</span>
              </div>
              <button type="button" className="assetgen-error__dismiss" onClick={() => setLastError(null)}>
                {t("assetGen.errorDismiss")}
              </button>
            </div>
          ) : null}
          {items.length === 0 ? (
          <div className="assetgen-empty">
            {projectAssetCount > 0 ? (
              <>
                <h2>{t("assetGen.emptySessionTitle")}</h2>
                <p>{t("assetGen.emptySessionBody")}</p>
                <button type="button" className="assetgen-empty__cta" onClick={() => setUIMode("assets")}>
                  {t("assetGen.emptySessionCta")}
                </button>
              </>
            ) : (
              <>
                <h2>{t("assetGen.emptyTitle")}</h2>
                <p>{t("assetGen.emptyBody")}</p>
                <button type="button" className="assetgen-empty__cta" onClick={focusPrompt}>
                  {t("assetGen.emptyCta")}
                </button>
              </>
            )}
          </div>
          ) : (
          <>
          <p className="assetgen-saved-hint">
            {t("assetGen.savedHint")}{" "}
            <button type="button" className="assetgen-saved-hint__link" onClick={() => setUIMode("assets")}>
              {t("assetGen.savedLink")}
            </button>
          </p>
          <div className="assetgen-grid">
            {items.map((item) => {
              const isKeyed = item.kind === "edit";
              // A transparent generation already carries alpha, so it renders on
              // the checkerboard and is never offered to the keying flow.
              const isAlpha = item.backgroundPreset === "transparent";
              const isVideo = item.mediaType === "video";
              const fallback = t(isVideo ? "assetGen.videoFallback" : "assetGen.imageFallback");
              const mediaLabel = t(isVideo ? "assetGen.previewVideo" : "assetGen.previewImage", {
                prompt: item.prompt?.trim() || fallback,
              });
              return (
              <figure key={`${item.requestId}-${item.filename ?? item.createdAt}`} className={`assetgen-tile${isKeyed ? " is-keyed" : ""}${isAlpha ? " is-alpha" : ""}`}>
                {isKeyed ? <span className="assetgen-tile__badge">{t("keying.resultBadge")}</span> : null}
                <button
                  type="button"
                  className="assetgen-tile__media"
                  aria-label={mediaLabel}
                  onClick={() => setPreviewItem(item)}
                >
                  {isVideo ? (
                    <video
                      src={item.url || item.image}
                      poster={item.thumb || undefined}
                      muted
                      playsInline
                      preload="metadata"
                      aria-hidden="true"
                    />
                  ) : (
                    <img src={item.url || item.image} alt="" loading="lazy" />
                  )}
                  <span className="assetgen-tile__open-hint" aria-hidden="true">
                    {t(isVideo ? "assetGen.openHintVideo" : "assetGen.openHintImage")}
                  </span>
                </button>
                <figcaption title={item.prompt}>{item.prompt}</figcaption>
                {!isKeyed && !isAlpha ? (
                  <button type="button" className="assetgen-tile__key" onClick={() => setKeyingTarget(item)}>
                    {t("keying.open")}
                  </button>
                ) : null}
                {!isVideo ? (
                  <button type="button" className="assetgen-tile__key" onClick={() => setVectorizeTarget(item)}>
                    {t("vectorize.open")}
                  </button>
                ) : null}
                {!isKeyed && item.requestId && saveFailures.includes(item.requestId) ? (
                  <button
                    type="button"
                    className="assetgen-tile__retry"
                    onClick={() => void retrySave(item.requestId!)}
                  >
                    {t("project.saveRetry")}
                  </button>
                ) : null}
              </figure>
              );
            })}
          </div>
          </>
          )}
        </div>
        <AssetGenProjectRail selectedAssetId={railSelectedId} onPreview={openRailPreview} onAssetsLoaded={setProjectAssetCount} />
      </main>
      <KeyingPanel />
      <VectorizePanel />
      {previewItem ? <AssetMediaLightbox item={previewItem} onClose={closePreview} /> : null}
    </section>
  );
}
