import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n";
import { useModalFocus } from "../../hooks/useModalFocus";
import { useAppStore } from "../../store/useAppStore";
import { requestVectorize } from "../../lib/api-assets";
import type { GenerateItem } from "../../types";

const PRESETS = ["auto", "flat", "detailed", "mono"] as const;
type Preset = (typeof PRESETS)[number];

const DEFAULTS = { colorPrecision: 8, filterSpeckle: 4, cornerThreshold: 60 };

type TraceResult = { filePath: string; pathCount: number; bytes: number };

function makeDerivedItem(source: GenerateItem, filePath: string): GenerateItem {
  const url = `/generated/${encodeURIComponent(filePath)}`;
  return {
    ...source,
    image: url,
    url,
    filename: filePath,
    mediaType: "image",
    kind: "edit",
    requestId: `derived:${filePath}`,
    createdAt: Date.now(),
    providerUrl: null,
  };
}

function formatKb(bytes: number): string {
  return `${Math.round(bytes / 1024)}KB`;
}

export function VectorizePanel() {
  const { t } = useI18n();
  const item = useAppStore((s) => s.vectorizeTarget);
  const close = useAppStore((s) => s.setVectorizeTarget);
  const addDerivedItem = useAppStore((s) => s.addAssetGenDerivedItem);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const showToast = useAppStore((s) => s.showToast);
  const abortRef = useRef<AbortController | null>(null);
  // Written synchronously during render so the promise guards see the NEW target
  // even before the passive abort effect below has run.
  const targetRef = useRef<string | null>(item?.filename ?? null);
  targetRef.current = item?.filename ?? null;
  const closePanel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    close(null);
  }, [close]);
  const dialogRef = useModalFocus<HTMLDivElement>(!!item, closePanel);
  const [preset, setPreset] = useState<Preset>("auto");
  const [colorPrecision, setColorPrecision] = useState(DEFAULTS.colorPrecision);
  const [filterSpeckle, setFilterSpeckle] = useState(DEFAULTS.filterSpeckle);
  const [cornerThreshold, setCornerThreshold] = useState(DEFAULTS.cornerThreshold);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TraceResult | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
    setError(null);
    setResult(null);
  }, [item?.filename]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const onRun = useCallback(() => {
    if (!item?.filename || running) return;
    const filename = item.filename;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setError(null);
    // Only send a knob the user actually moved. Sending the defaults would count
    // as an override server-side and silently bypass the tuned preset - the same
    // asset traced 9430 paths through the panel versus 722 through the API.
    requestVectorize({
      source: filename,
      preset,
      ...(colorPrecision !== DEFAULTS.colorPrecision ? { colorPrecision } : {}),
      ...(filterSpeckle !== DEFAULTS.filterSpeckle ? { filterSpeckle } : {}),
      ...(cornerThreshold !== DEFAULTS.cornerThreshold ? { cornerThreshold } : {}),
      projectId: selectedProjectId,
      signal: controller.signal,
    })
      .then((res) => {
        if (abortRef.current !== controller || targetRef.current !== filename) return; // stale: newer trace, close, or target change
        if (!res.filePath) throw new Error(t("vectorize.saveError"));
        setResult({ filePath: res.filePath, pathCount: res.pathCount, bytes: res.bytes });
        addDerivedItem(makeDerivedItem(item, res.filePath));
        showToast(t("vectorize.saved"));
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (abortRef.current !== controller || targetRef.current !== filename) return; // stale failure must not paint the new run
        const message = err instanceof Error ? err.message : t("vectorize.saveError");
        setError(message);
        showToast(message, true);
      })
      .finally(() => {
        if (abortRef.current !== controller || targetRef.current !== filename) return; // a newer run or target owns `running`
        abortRef.current = null;
        setRunning(false);
      });
  }, [item, running, preset, colorPrecision, filterSpeckle, cornerThreshold, selectedProjectId, addDerivedItem, showToast, t]);

  if (!item) return null;
  const src = item.url || item.image;
  const resultUrl = result ? `/generated/${encodeURIComponent(result.filePath)}` : null;

  return (
    <div className="assetgen-popup-backdrop" onClick={closePanel}>
      <div
        ref={dialogRef}
        className="keying-panel vectorize-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t("vectorize.title")}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="keying-panel__head">
          <h2>{t("vectorize.title")}</h2>
          <span className="keying-panel__hint">{t("vectorize.hint")}</span>
        </header>
        <div className="keying-panel__compare" aria-busy={running}>
          <figure className="keying-panel__preview">
            <figcaption className="keying-panel__preview-label">{t("vectorize.original")}</figcaption>
            <div className="keying-panel__stage keying-panel__stage--original">
              <img src={src ?? ""} alt={t("vectorize.originalAlt")} />
            </div>
          </figure>
          <figure className="keying-panel__preview">
            <figcaption className="keying-panel__preview-label">{t("vectorize.result")}</figcaption>
            <div className="keying-panel__stage">
              {resultUrl ? (
                <img src={resultUrl} alt={t("vectorize.resultAlt")} />
              ) : (
                <span className="keying-panel__loading" role="status">
                  {running ? t("vectorize.running") : t("vectorize.idle")}
                </span>
              )}
            </div>
          </figure>
        </div>
        <div className="keying-panel__modes" role="group" aria-label={t("vectorize.preset")}>
          {PRESETS.map((value) => (
            <button
              key={value}
              type="button"
              className={preset === value ? "is-active" : ""}
              aria-pressed={preset === value}
              onClick={() => setPreset(value)}
            >
              {t(`vectorize.preset_${value}`)}
            </button>
          ))}
        </div>
        {result ? (
          <p className="vectorize-panel__stats" role="status">
            {t("vectorize.stats", { paths: String(result.pathCount), size: formatKb(result.bytes) })}
          </p>
        ) : null}
        <details className="keying-panel__advanced">
          <summary>{t("vectorize.advanced")}</summary>
          <div className="keying-panel__controls">
            <label>
              {t("vectorize.colorPrecision")} <output>{colorPrecision}</output>
              <input type="range" min={1} max={8} value={colorPrecision} onChange={(e) => setColorPrecision(Number(e.target.value))} />
            </label>
            <label>
              {t("vectorize.filterSpeckle")} <output>{filterSpeckle}</output>
              <input type="range" min={0} max={32} value={filterSpeckle} onChange={(e) => setFilterSpeckle(Number(e.target.value))} />
            </label>
            <label>
              {t("vectorize.cornerThreshold")} <output>{cornerThreshold}</output>
              <input type="range" min={0} max={180} value={cornerThreshold} onChange={(e) => setCornerThreshold(Number(e.target.value))} />
            </label>
            <button
              type="button"
              className="keying-panel__reset"
              onClick={() => {
                setColorPrecision(DEFAULTS.colorPrecision);
                setFilterSpeckle(DEFAULTS.filterSpeckle);
                setCornerThreshold(DEFAULTS.cornerThreshold);
              }}
            >
              {t("vectorize.reset")}
            </button>
          </div>
        </details>
        <footer className="keying-panel__actions">
          {error ? <span className="keying-panel__save-error" role="alert">{error}</span> : null}
          <button type="button" className="assetgen-generate" disabled={running || !item.filename} onClick={onRun}>
            {running ? t("vectorize.running") : t("vectorize.run")}
          </button>
          {resultUrl ? (
            <a className="assetgen-popup__close" href={resultUrl} download={result?.filePath}>
              {t("vectorize.download")}
            </a>
          ) : null}
          <button type="button" className="assetgen-popup__close" onClick={closePanel}>{t("project.close")}</button>
        </footer>
      </div>
    </div>
  );
}
