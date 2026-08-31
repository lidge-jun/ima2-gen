import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n";
import { useModalFocus } from "../../hooks/useModalFocus";
import { useAppStore } from "../../store/useAppStore";
import { uploadDerivedAsset, requestVideoKeying } from "../../lib/api-assets";
import { subscribe } from "../../lib/eventChannel";
import type { GenerateItem } from "../../types";
import type { NormalizedPoint } from "../../types/canvas";
import {
  applyColorKey,
  sampleKeyColor,
  DEFAULT_COLOR_KEY_PARAMS,
  type RGB,
} from "../../lib/canvas/colorKey";
import { eraseSeedRegions } from "../../lib/canvas/wandErase";
import {
  applySoftUnmix,
  keyChannelSets,
  DEFAULT_SOFT_UNMIX_PARAMS,
} from "../../lib/canvas/softUnmix";

type LoadState = "loading" | "ready" | "error";
type PreviewClickMode = "erase" | "pick";

function makeDerivedItem(source: GenerateItem, filePath: string, mediaType: "image" | "video"): GenerateItem {
  const url = `/generated/${encodeURIComponent(filePath)}`;
  return {
    ...source,
    image: url,
    url,
    filename: filePath,
    mediaType,
    kind: "edit",
    requestId: `derived:${filePath}`,
    createdAt: Date.now(),
    providerUrl: null,
  };
}

export function KeyingPanel() {
  const { t } = useI18n();
  const item = useAppStore((s) => s.keyingTarget);
  const close = useAppStore((s) => s.setKeyingTarget);
  const dialogRef = useModalFocus<HTMLDivElement>(!!item, () => close(null));
  const addDerivedItem = useAppStore((s) => s.addAssetGenDerivedItem);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const showToast = useAppStore((s) => s.showToast);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [keyingProgress, setKeyingProgress] = useState<number | null>(null);
  const [tolerance, setTolerance] = useState(DEFAULT_COLOR_KEY_PARAMS.tolerance);
  const [softness, setSoftness] = useState(DEFAULT_COLOR_KEY_PARAMS.softness);
  const [spill, setSpill] = useState(DEFAULT_COLOR_KEY_PARAMS.spill);
  const [keyColor, setKeyColor] = useState<RGB | null>(null);
  const [clickMode, setClickMode] = useState<PreviewClickMode>("erase");
  const [eraseSeeds, setEraseSeeds] = useState<NormalizedPoint[]>([]);
  const [unmixEnabled, setUnmixEnabled] = useState(true);
  const sourceRef = useRef<ImageData | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const keyingUnsubRef = useRef<null | (() => void)>(null);
  const targetFilenameRef = useRef<string | null>(null);

  const clearKeyingSubscription = useCallback(() => {
    keyingUnsubRef.current?.();
    keyingUnsubRef.current = null;
  }, []);

  const isVideo = item?.mediaType === "video";
  const src = item
    ? isVideo && item.filename
      ? `/api/video/frame?file=${encodeURIComponent(item.filename)}&position=0`
      : item.url || item.image
    : null;

  // Load the source image into an offscreen pixel buffer.
  useEffect(() => {
    if (!src) return;
    let active = true;
    setLoadState("loading");
    sourceRef.current = null;
    setKeyColor(null);
    setEraseSeeds([]);
    setClickMode("erase");
    const img = new Image();
    img.onload = () => {
      if (!active) return;
      try {
        const off = document.createElement("canvas");
        off.width = img.naturalWidth;
        off.height = img.naturalHeight;
        const ctx = off.getContext("2d");
        if (!ctx) throw new Error("no 2d context");
        ctx.drawImage(img, 0, 0);
        const pixels = ctx.getImageData(0, 0, off.width, off.height);
        sourceRef.current = pixels;
        setKeyColor(sampleKeyColor(pixels));
        setLoadState("ready");
      } catch {
        if (active) setLoadState("error");
      }
    };
    img.onerror = () => {
      if (active) setLoadState("error");
    };
    img.src = src;
    return () => {
      active = false;
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  useEffect(() => {
    targetFilenameRef.current = item?.filename ?? null;
    clearKeyingSubscription();
    setSaving(false);
    setKeyingProgress(null);
    setSaveError(null);
    return clearKeyingSubscription;
  }, [clearKeyingSubscription, item?.filename]);

  // Re-key on any parameter change (rAF-debounced).
  useEffect(() => {
    if (loadState !== "ready" || !keyColor) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const source = sourceRef.current;
      const canvas = canvasRef.current;
      if (!source || !canvas) return;
      try {
        const keyed = applyColorKey(
          { width: source.width, height: source.height, data: source.data },
          { keyColor, tolerance, softness, spill },
        );
        if (unmixEnabled && keyChannelSets(keyColor)) {
          applySoftUnmix(
            keyed,
            { width: source.width, height: source.height, data: source.data },
            { keyColor, ...DEFAULT_SOFT_UNMIX_PARAMS },
          );
        }
        if (eraseSeeds.length > 0) {
          eraseSeedRegions(
            keyed,
            { width: source.width, height: source.height, data: source.data },
            eraseSeeds,
            tolerance,
          );
        }
        canvas.width = keyed.width;
        canvas.height = keyed.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const frame = ctx.createImageData(keyed.width, keyed.height);
        frame.data.set(keyed.data);
        ctx.putImageData(frame, 0, 0);
      } catch {
        setLoadState("error");
      }
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [loadState, keyColor, tolerance, softness, spill, eraseSeeds, unmixEnabled]);

  // Preview click: erase mode flood-removes the clicked contiguous region;
  // pick mode re-picks the key color from the SOURCE pixel (eyedropper).
  const onPreviewClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const source = sourceRef.current;
    const canvas = canvasRef.current;
    if (!source || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    if (clickMode === "erase" && !isVideo) {
      setEraseSeeds((seeds) => [...seeds, { x: nx, y: ny }]);
      return;
    }
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * source.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * source.height);
    const i = (Math.max(0, Math.min(source.height - 1, y)) * source.width + Math.max(0, Math.min(source.width - 1, x))) * 4;
    setKeyColor({ r: source.data[i], g: source.data[i + 1], b: source.data[i + 2] });
  }, [clickMode, isVideo]);

  const onDownload = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(item?.filename || "asset").replace(/\.[a-z]+$/i, "")}-keyed.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, [item]);

  const onSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !item?.filename || saving) return;
    setSaving(true);
    setSaveError(null);
    if (isVideo) {
      requestVideoKeying({
        source: item.filename,
        keyParams: { tolerance, softness, keyColor: keyColor ?? undefined },
        projectId: selectedProjectId,
        name: `${(item.prompt || "asset").trim().slice(0, 60)} (keyed)`,
      })
        .then(({ requestId }) => {
          if (targetFilenameRef.current !== item.filename) return;
          setKeyingProgress(0);
          clearKeyingSubscription();
          const unsub = subscribe(requestId, null, (eventType, data) => {
            const payload = data && typeof data === "object" ? data : {};
            if (eventType === "keying-progress") {
              const rawMs = payload.outTimeMs;
              setKeyingProgress(typeof rawMs === "number" && Number.isFinite(rawMs) ? rawMs : 0);
            } else if (eventType === "keying-done") {
              clearKeyingSubscription();
              const filePath = payload.filePath;
              if (typeof filePath === "string" && filePath.trim()) {
                addDerivedItem(makeDerivedItem(item, filePath.trim(), "video"));
                setSaving(false);
                setKeyingProgress(null);
                showToast(t("keying.videoSaved"));
                close(null);
                return;
              }
              setSaving(false);
              setKeyingProgress(null);
              setSaveError(t("keying.saveError"));
            } else if (eventType === "keying-error") {
              clearKeyingSubscription();
              setSaving(false);
              setKeyingProgress(null);
              setSaveError(typeof payload.error === "string" && payload.error ? payload.error : t("keying.saveError"));
            }
          });
          keyingUnsubRef.current = unsub;
        })
        .catch((err: unknown) => {
          if (targetFilenameRef.current !== item.filename) return;
          setSaving(false);
          setSaveError(err instanceof Error ? err.message : t("keying.saveError"));
        });
      return;
    }
    canvas.toBlob((blob) => {
      if (targetFilenameRef.current !== item.filename) return;
      if (!blob) {
        setSaving(false);
        setSaveError(t("keying.saveError"));
        return;
      }
      uploadDerivedAsset(blob, {
        source: item.filename!,
        projectId: selectedProjectId,
        name: `${(item.prompt || "asset").trim().slice(0, 60)} (keyed)`,
        meta: { keyParams: { tolerance, softness, spill }, prompt: item.prompt },
      })
        .then(({ filePath }) => {
          if (targetFilenameRef.current !== item.filename) return;
          if (typeof filePath !== "string" || !filePath.trim()) throw new Error(t("keying.saveError"));
          addDerivedItem(makeDerivedItem(item, filePath.trim(), "image"));
          showToast(t("keying.saved"));
          close(null);
        })
        .catch((err: unknown) => {
          if (targetFilenameRef.current !== item.filename) return;
          setSaveError(err instanceof Error ? err.message : t("keying.saveError"));
        })
        .finally(() => {
          if (targetFilenameRef.current === item.filename) setSaving(false);
        });
    }, "image/png");
  }, [item, saving, isVideo, keyColor, selectedProjectId, tolerance, softness, spill, clearKeyingSubscription, addDerivedItem, showToast, close, t]);

  if (!item) return null;

  return (
    <div className="assetgen-popup-backdrop" onClick={() => close(null)}>
      <div ref={dialogRef} className="keying-panel" role="dialog" aria-modal="true" aria-label={t("keying.title")} onClick={(e) => e.stopPropagation()}>
        <header className="keying-panel__head">
          <h2>{t("keying.title")}</h2>
          {keyColor ? (
            <span className="keying-panel__key" title={t("keying.keyColor")}>
              {!isVideo ? (
                <span className="keying-panel__modes" role="group" aria-label={t("keying.clickMode")}>
                  <button
                    type="button"
                    className={clickMode === "erase" ? "is-active" : ""}
                    aria-pressed={clickMode === "erase"}
                    onClick={() => setClickMode("erase")}
                  >
                    {t("keying.modeErase")}
                  </button>
                  <button
                    type="button"
                    className={clickMode === "pick" ? "is-active" : ""}
                    aria-pressed={clickMode === "pick"}
                    onClick={() => setClickMode("pick")}
                  >
                    {t("keying.modePick")}
                  </button>
                </span>
              ) : null}
              {eraseSeeds.length > 0 ? (
                <button
                  type="button"
                  className="keying-panel__undo"
                  onClick={() => setEraseSeeds((seeds) => seeds.slice(0, -1))}
                >
                  {t("keying.undoClick", { count: String(eraseSeeds.length) })}
                </button>
              ) : null}
              <span className="assetgen-bg-picker__swatch" style={{ background: `rgb(${keyColor.r},${keyColor.g},${keyColor.b})` }} aria-hidden="true" />
              <span className="keying-panel__hint">
                {clickMode === "erase" && !isVideo ? t("keying.eraseHint") : t("keying.pickHint")}
              </span>
            </span>
          ) : null}
        </header>
        <div className="keying-panel__compare" aria-busy={loadState === "loading"}>
          {loadState === "error" ? (
            <div className="keying-panel__error" role="alert">
              <p>{t("keying.loadError")}</p>
              <button type="button" onClick={() => close(null)}>{t("project.close")}</button>
            </div>
          ) : (
            <>
              <figure className="keying-panel__preview">
                <figcaption className="keying-panel__preview-label">{t("keying.original")}</figcaption>
                <div className="keying-panel__stage keying-panel__stage--original">
                  <img src={src ?? ""} alt={t("keying.originalAlt")} />
                </div>
              </figure>
              <figure className="keying-panel__preview">
                <figcaption className="keying-panel__preview-label">{t("keying.removed")}</figcaption>
                <div className="keying-panel__stage">
                  <canvas ref={canvasRef} className="keying-panel__canvas" onClick={onPreviewClick} aria-label={t("keying.previewAlt")} />
                  {loadState === "loading" ? (
                    <span className="keying-panel__loading" role="status">{t("keying.previewLoading")}</span>
                  ) : null}
                </div>
              </figure>
            </>
          )}
        </div>
        <details className="keying-panel__advanced">
          <summary>{t("keying.advanced")}</summary>
        <div className="keying-panel__controls">
          <label>
            {t("keying.tolerance")} <output>{tolerance}</output>
            <input type="range" min={0} max={100} value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} />
          </label>
          <label>
            {t("keying.softness")} <output>{softness}</output>
            <input type="range" min={0} max={50} value={softness} onChange={(e) => setSoftness(Number(e.target.value))} />
          </label>
          <label>
            {t("keying.spill")} <output>{spill}</output>
            <input type="range" min={0} max={100} value={spill} onChange={(e) => setSpill(Number(e.target.value))} />
          </label>
          <label className="keying-panel__unmix">
            <input
              type="checkbox"
              checked={unmixEnabled}
              disabled={!keyColor || !keyChannelSets(keyColor)}
              onChange={(e) => setUnmixEnabled(e.target.checked)}
            />
            {t("keying.unmix")}
            <span className="keying-panel__hint">{t("keying.unmixHint")}</span>
          </label>
          <button
            type="button"
            className="keying-panel__reset"
            onClick={() => {
              setTolerance(DEFAULT_COLOR_KEY_PARAMS.tolerance);
              setSoftness(DEFAULT_COLOR_KEY_PARAMS.softness);
              setSpill(DEFAULT_COLOR_KEY_PARAMS.spill);
              setEraseSeeds([]);
              setUnmixEnabled(true);
              if (sourceRef.current) setKeyColor(sampleKeyColor(sourceRef.current));
            }}
          >
            {t("keying.reset")}
          </button>
        </div>
        </details>
        <footer className="keying-panel__actions">
          {saveError ? <span className="keying-panel__save-error" role="alert">{saveError}</span> : null}
          <button type="button" className="assetgen-generate" disabled={loadState !== "ready" || saving || !item.filename} onClick={onSave}>
            {saving
              ? keyingProgress !== null
                ? t("keying.videoKeying", { seconds: String(Math.round(keyingProgress / 1000)) })
                : t("keying.saving")
              : isVideo ? t("keying.videoSave") : t("keying.save")}
          </button>
          {!isVideo ? (
            <button type="button" className="assetgen-popup__close" disabled={loadState !== "ready"} onClick={onDownload}>
              {t("keying.download")}
            </button>
          ) : null}
          <button type="button" className="assetgen-popup__close" onClick={() => close(null)}>{t("project.close")}</button>
        </footer>
      </div>
    </div>
  );
}
