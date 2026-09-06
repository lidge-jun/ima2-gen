import { useEffect, useState, useSyncExternalStore } from "react";
import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";
import { exportImageToComfy } from "../lib/api";
import { toVideoHistoryItem } from "../lib/videoHistoryItem";
import { videoExtensionOwner } from "../lib/videoExtendStream";
import { isVideoItem, extractFirstFrame, extractMidFrame, extractLastFrame } from "../lib/videoMedia";
import { continueFromItem, continueFromItemAsUrl } from "../lib/continueFromItem";
import { ResultMetadataModal } from "./ResultMetadataModal";
import { UpscalePopover } from "./UpscalePopover";
import { buildUpscaleBody, type UpscaleParams } from "../lib/upscaleAction";
import { jsonFetch } from "../lib/api";
import { listMcpProviders } from "../lib/mcpProviders";
import type { GenerateItem } from "../types";
import { handleError } from "../lib/errorHandler";
import { resolveErrorSpec } from "../lib/errorCodes";

interface ResultActionsProps { imageOverride?: GenerateItem | null; onAfterDeleteFocus?: () => void }

const CANVAS_MODE_PROMPT_ID = "canvas-mode-context";
const CANVAS_MODE_PROMPT_NAME = "Canvas Mode";
const PROVIDER_URL_TTL_MS = 3_600_000;
const CANVAS_MODE_PROMPT_TEXT = [
  "Canvas Mode context:",
  "The user edited or annotated the reference image on a canvas.",
  "If the image is a blank white canvas or paper with user-drawn strokes, treat those strokes as source content and preserve/complete them.",
  "If the image is an existing picture with circles, arrows, sticky notes, handwritten marks, or memo notes over it, treat those marks as edit instructions. Apply the instruction, then remove the marks from the final image unless explicitly asked to keep them.",
  "Infer the intended edit from the canvas marks and memo text. Preserve unrelated image content.",
].join("\n");

export function ResultActions({ imageOverride = null, onAfterDeleteFocus }: ResultActionsProps) {
  const { t } = useI18n();
  const currentImage = useAppStore((s) => s.currentImage);
  const showToast = useAppStore((s) => s.showToast);
  const insertPromptToComposer = useAppStore((s) => s.insertPromptToComposer);
  const createRootNodeFromHistoryItem = useAppStore((s) => s.createRootNodeFromHistoryItem);
  const trashHistoryItem = useAppStore((s) => s.trashHistoryItem);
  const saveToAssetsAction = useAppStore((s) => s.saveToAssets);
  const permanentlyDeleteHistoryItemByClick = useAppStore((s) => s.permanentlyDeleteHistoryItemByClick);
  const canvasOpen = useAppStore((s) => s.canvasOpen);
  const openCanvas = useAppStore((s) => s.openCanvas);
  const [comfyExporting, setComfyExporting] = useState(false);
  const [animating, setAnimating] = useState(false);
  const extendUi = useSyncExternalStore(videoExtensionOwner.subscribe, videoExtensionOwner.getSnapshot);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [upscaleOpen, setUpscaleOpen] = useState(false);
  const [upscalePending, setUpscalePending] = useState(false);
  const [runwayConnected, setRunwayConnected] = useState(false);

  useEffect(() => {
    let alive = true;
    void listMcpProviders().then((providers) => {
      if (!alive) return;
      setRunwayConnected(providers.some((p) => p.id === "runway" && p.status.state === "connected"));
    }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const startUpscale = async (params: UpscaleParams) => {
    if (!actionImage?.filename || upscalePending) return;
    const body = buildUpscaleBody(actionImage.filename, params);
    if (!body) { showToast(t("result.upscaleInvalid"), true); return; }
    setUpscalePending(true);
    try {
      await jsonFetch("/api/mcp/media-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setUpscaleOpen(false);
      showToast(t("result.upscaleStarted"));
    } catch {
      showToast(t("result.upscaleFailed"), true);
    } finally {
      setUpscalePending(false);
    }
  };

  useEffect(() => videoExtensionOwner.releaseView, []);
  const actionImage = imageOverride ?? currentImage;
  const sourceFilename = actionImage?.filename ?? null;
  useEffect(() => {
    videoExtensionOwner.select(sourceFilename);
  }, [sourceFilename]);
  const extendState = extendUi.status === "pending" || extendUi.source === sourceFilename
    ? extendUi.status : "idle";
  if (!actionImage) return null;
  const isVideo = isVideoItem(actionImage);
  const videoSrc = isVideo ? (actionImage.url || actionImage.image) : "";
  const canExportToComfy = Boolean(actionImage.filename);
  const canAnimate = Boolean(actionImage.filename) && !isVideo;
  const canExtend = isVideo && Boolean(actionImage.filename);
  const isGrokProvider = actionImage.provider === "grok" || actionImage.provider === "grok-api";
  const providerUrlAlive = Boolean(
    isGrokProvider && !isVideo && actionImage.providerUrl && actionImage.createdAt &&
    Date.now() - actionImage.createdAt < PROVIDER_URL_TTL_MS,
  );

  const animate = async () => {
    if (!actionImage.filename || animating) return;
    setAnimating(true);
    try {
      const started = await useAppStore.getState().animateImage(actionImage.filename, actionImage.prompt ?? undefined);
      if (started) showToast(t("toast.animateDone"));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("toast.animateFailed");
      showToast(message, true);
    } finally {
      setAnimating(false);
    }
  };

  const extend = async () => {
    if (!actionImage.filename || extendState === "pending" || extendState === "tracking-expired") return;
    const requestId = `vext_${crypto.randomUUID()}`;
    try {
      const work = videoExtensionOwner.start({
        requestId,
        sourceVideoId: actionImage.filename,
        prompt: actionImage.prompt?.trim() || undefined,
        provider: actionImage.provider === "grok-api" ? "grok-api" : "grok",
        model: actionImage.model ?? undefined,
      });
      if (!work) return;
      const done = await work;
      useAppStore.getState().addHistoryItem(toVideoHistoryItem(done, actionImage));
      showToast(t("toast.animateDone"));
    } catch (error) {
      const canceled = error instanceof DOMException && error.name === "AbortError";
      const code = resolveErrorSpec(error).code;
      if (code === "JOB_TRACKING_TIMEOUT" || code === "LAN_TOKEN_REQUIRED") handleError(error, useAppStore.getState());
      else if (!canceled) {
        showToast(error instanceof Error ? error.message : t("toast.animateFailed"), true);
      }
    }
  };

  const cancelExtend = () => videoExtensionOwner.cancel();

  const download = () => {
    const a = document.createElement("a");
    a.href = actionImage.image;
    a.download = actionImage.filename || "generated.png";
    a.click();
  };

  const copyDataUrlToClipboard = async (dataUrl: string) => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    let pngBlob: Blob;
    if (blob.type === "image/png") {
      pngBlob = blob;
    } else {
      const img = new Image();
      img.crossOrigin = "anonymous";
      const url = URL.createObjectURL(blob);
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; img.src = url; });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      pngBlob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(), "image/png"));
    }
    await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
  };

  const copyImage = async () => {
    try {
      if (isVideo) {
        const frame = await extractLastFrame(videoSrc);
        await copyDataUrlToClipboard(frame);
      } else {
        await copyDataUrlToClipboard(actionImage.image);
      }
      showToast(t(isVideo ? "toast.frameCopied" : "toast.imageCopied"));
    } catch {
      showToast(t("toast.copyFailed"), true);
    }
  };

  const copyFirstFrame = async () => {
    try {
      const frame = await extractFirstFrame(videoSrc);
      await copyDataUrlToClipboard(frame);
      showToast(t("toast.frameCopied"));
    } catch {
      showToast(t("toast.copyFailed"), true);
    }
  };

  const copyMidFrame = async () => {
    try {
      const frame = await extractMidFrame(videoSrc);
      await copyDataUrlToClipboard(frame);
      showToast(t("toast.frameCopied"));
    } catch {
      showToast(t("toast.copyFailed"), true);
    }
  };

  const copyPrompt = async () => {
    if (!actionImage.prompt) return;
    try {
      await navigator.clipboard.writeText(actionImage.prompt);
      showToast(t("toast.promptCopied"));
    } catch {
      showToast(t("clipboard.writeFailed"), true);
    }
  };

  const copyMetadataValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast(t("toast.metadataCopied"));
    } catch {
      showToast(t("clipboard.writeFailed"), true);
    }
  };

  const newFromHere = async () => {
    let result = { ok: false, isVideo: false, hasPrompt: false };
    try {
      result = await continueFromItem(actionImage);
    } catch {
      // non-fatal — fall back to prompt-only fork
    }
    if (canvasOpen && imageOverride) {
      insertPromptToComposer({
        id: CANVAS_MODE_PROMPT_ID,
        name: CANVAS_MODE_PROMPT_NAME,
        text: CANVAS_MODE_PROMPT_TEXT,
      });
    }
    const promptEl = document.querySelector<HTMLTextAreaElement>(
      'textarea[name="prompt"], textarea#prompt, .sidebar textarea',
    );
    if (promptEl) {
      promptEl.focus();
      promptEl.setSelectionRange(promptEl.value.length, promptEl.value.length);
    }
    showToast(t(result.hasPrompt ? "toast.forkStarted" : "toast.forkStartedNoPrompt"));
  };

  const newFromHereAsUrl = async () => {
    if (
      isVideo ||
      !actionImage.providerUrl ||
      !actionImage.createdAt ||
      Date.now() - actionImage.createdAt >= PROVIDER_URL_TTL_MS
    ) {
      showToast(t("toast.continueAsUrlExpired"), true);
      return;
    }
    try {
      await continueFromItemAsUrl(actionImage);
    } catch {
      // non-fatal
    }
    const promptEl = document.querySelector<HTMLTextAreaElement>(
      'textarea[name="prompt"], textarea#prompt, .sidebar textarea',
    );
    if (promptEl) {
      promptEl.focus();
      promptEl.setSelectionRange(promptEl.value.length, promptEl.value.length);
    }
    showToast(t("toast.continueAsUrlStarted"));
  };

  const sendToComfyUI = async () => {
    if (!actionImage.filename || comfyExporting) return;
    setComfyExporting(true);
    try {
      const result = await exportImageToComfy({ filename: actionImage.filename });
      showToast(t("toast.comfyExported", { filename: result.uploadedFilename }));
    } catch (error) {
      const code = error instanceof Error ? (error as Error & { code?: string }).code : undefined;
      const key =
        code === "COMFY_URL_NOT_LOCAL"
          ? "toast.comfyExportInvalidUrl"
          : code === "COMFY_IMAGE_INVALID"
            ? "toast.comfyExportInvalidImage"
            : code === "COMFY_IMAGE_NOT_FOUND"
              ? "toast.comfyExportImageNotFound"
              : "toast.comfyExportFailed";
      showToast(t(key), true);
    } finally {
      setComfyExporting(false);
    }
  };

  const generateAsFirstNode = () => {
    createRootNodeFromHistoryItem(actionImage);
    showToast(t("toast.nodeRootCreated"));
  };

  const deleteToTrash = async () => {
    try {
      await trashHistoryItem(actionImage);
    } finally {
      onAfterDeleteFocus?.();
    }
  };

  const deletePermanently = async () => {
    try {
      await permanentlyDeleteHistoryItemByClick(actionImage);
    } finally {
      onAfterDeleteFocus?.();
    }
  };

  return (
    <div className="result-actions">
      <button type="button" className="action-btn" onClick={download}>
        {t("result.download")}
      </button>
      <button type="button" className={`action-btn${isVideo ? " action-btn--frame" : ""}`} onClick={copyImage}>
        {t(isVideo ? "result.copyLastFrame" : "result.copyImage")}
      </button>
      {isVideo && (
        <>
          <button type="button" className="action-btn action-btn--frame" onClick={copyFirstFrame}>
            {t("result.copyFirstFrame")}
          </button>
          <button type="button" className="action-btn action-btn--frame" onClick={copyMidFrame}>
            {t("result.copyMidFrame")}
          </button>
        </>
      )}
      <button type="button" className="action-btn" onClick={() => void copyPrompt()}>
        {t("result.copyPrompt")}
      </button>
      <button
        type="button" className="action-btn"
        onClick={() => {
          void (async () => {
            const ok = await saveToAssetsAction(actionImage);
            showToast(t(ok ? "chain.savedToAssets" : "chain.saveToAssetsFailed"), !ok);
          })();
        }}
        title={t("chain.saveToAssets")}
      >
        {t("chain.saveToAssets")}
      </button>
      <button
        type="button" className="action-btn action-btn--primary"
        onClick={newFromHere}
        title={t("result.continueHereTitle")}
      >
        {t("result.continueHere")}
      </button>
      {providerUrlAlive && (
        <button
          type="button" className="action-btn"
          onClick={() => void newFromHereAsUrl()}
          title={t("result.continueAsUrlTitle")}
        >
          {t("result.continueAsUrl")}
        </button>
      )}
      {canAnimate && (
        <button
          type="button" className="action-btn"
          onClick={() => void animate()}
          disabled={animating}
          title={t("result.animateTitle")}
        >
          {animating ? t("result.animating") : t("result.animate")}
        </button>
      )}
      {runwayConnected && actionImage.filename && (
        isVideo ? (
          <button
            type="button" className="action-btn"
            disabled={upscalePending}
            onClick={() => void startUpscale({})}
            title={t("result.upscaleTitle")}
          >
            {upscalePending ? t("inflight.streaming") : t("result.upscale")}
          </button>
        ) : (
          <>
            <button
              type="button" className="action-btn"
              disabled={upscalePending}
              onClick={() => setUpscaleOpen((open) => !open)}
              title={t("result.upscaleTitle")}
            >
              {t("result.upscale")}
            </button>
            {upscaleOpen ? (
              <UpscalePopover
                pending={upscalePending}
                onSubmit={(params) => void startUpscale(params)}
                onClose={() => setUpscaleOpen(false)}
              />
            ) : null}
          </>
        )
      )}
      {canExtend && (
        <>
          <button
            type="button" className="action-btn"
            onClick={extend}
            disabled={extendState === "pending" || extendState === "tracking-expired"}
            aria-busy={extendState === "pending"}
            title={t(extendState === "tracking-expired" ? "toast.jobTrackingTimeout" : "result.extendTitle")}
          >
            {extendState === "pending"
              ? t("inflight.streaming")
              : extendState === "error" ? t("gallery.retry") : t("result.extend") ?? "이어가기"}
          </button>
          {extendState === "pending" && (
            <button type="button" className="action-btn" onClick={cancelExtend}>{t("common.cancel")}</button>
          )}
        </>
      )}
      <button
        type="button" className="action-btn"
        onClick={generateAsFirstNode}
        title={t("result.firstNodeTitle")}
      >
        {t("result.firstNode")}
      </button>
      <button
        type="button" className="action-btn"
        onClick={() => setMetadataOpen(true)}
        title={t("result.infoTitle")}
      >
        {t("result.info")}
      </button>
      {!canvasOpen && (
        <button
          type="button" className="action-btn"
          onClick={openCanvas}
          title={t("canvas.open")}
          aria-label={t("canvas.openAria")}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 4h8v8M12 4l-8 8"/>
          </svg>
        </button>
      )}
      {actionImage.filename && (
        <>
          <button
            type="button" className="action-btn action-btn--danger"
            onClick={() => void deleteToTrash()}
            title={t("result.deleteTitle")}
          >
            {t("result.delete")}
          </button>
          <details className="result-actions__more">
            <summary className="action-btn">{t("result.more")}</summary>
            <div className="result-actions__menu">
              {canExportToComfy && (
                <button
                  type="button" className="result-actions__menu-item"
                  onClick={() => void sendToComfyUI()}
                  title={t("result.sendToComfyUITitle")}
                  disabled={comfyExporting}
                >
                  {t("result.sendToComfyUI")}
                </button>
              )}
              <button
                type="button" className="result-actions__menu-item result-actions__danger-item"
                onClick={() => void deletePermanently()}
              >
                {t("result.permanentDelete")}
              </button>
            </div>
          </details>
        </>
      )}
      {metadataOpen && (
        <ResultMetadataModal
          item={actionImage}
          onClose={() => setMetadataOpen(false)}
          onCopy={(value) => void copyMetadataValue(value)}
        />
      )}
    </div>
  );
}
