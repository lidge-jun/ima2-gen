import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";
import { exportImageToComfy } from "../lib/api";
import { isVideoItem, extractFirstFrame, extractMidFrame, extractLastFrame } from "../lib/videoMedia";
import { continueFromItem, continueFromItemAsUrl } from "../lib/continueFromItem";
import { ResultMetadataModal } from "./ResultMetadataModal";
import type { GenerateItem } from "../types";

interface ResultActionsProps {
  imageOverride?: GenerateItem | null;
  onAfterDeleteFocus?: () => void;
}

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

export function ResultActions({
  imageOverride = null,
  onAfterDeleteFocus,
}: ResultActionsProps) {
  const { t } = useI18n();
  const currentImage = useAppStore((s) => s.currentImage);
  const showToast = useAppStore((s) => s.showToast);
  const insertPromptToComposer = useAppStore((s) => s.insertPromptToComposer);
  const createRootNodeFromHistoryItem = useAppStore((s) => s.createRootNodeFromHistoryItem);
  const trashHistoryItem = useAppStore((s) => s.trashHistoryItem);
  const permanentlyDeleteHistoryItemByClick = useAppStore(
    (s) => s.permanentlyDeleteHistoryItemByClick,
  );
  const canvasOpen = useAppStore((s) => s.canvasOpen);
  const openCanvas = useAppStore((s) => s.openCanvas);
  const [comfyExporting, setComfyExporting] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);

  const actionImage = imageOverride ?? currentImage;
  if (!actionImage) return null;
  const isVideo = isVideoItem(actionImage);
  const videoSrc = isVideo ? (actionImage.url || actionImage.image) : "";
  const canExportToComfy = Boolean(actionImage.filename);
  const canAnimate = Boolean(actionImage.filename) && !isVideo;
  const isGrokProvider = actionImage.provider === "grok" || actionImage.provider === "grok-api";
  const providerUrlAlive = Boolean(
    isGrokProvider &&
    !isVideo &&
    actionImage.providerUrl &&
    actionImage.createdAt &&
    Date.now() - actionImage.createdAt < PROVIDER_URL_TTL_MS,
  );

  const animate = async () => {
    if (!actionImage.filename || animating) return;
    setAnimating(true);
    try {
      await useAppStore.getState().animateImage(actionImage.filename, actionImage.prompt ?? undefined);
      showToast(t("toast.animateDone"));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("toast.animateFailed");
      showToast(message, true);
    } finally {
      setAnimating(false);
    }
  };

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

  const copyPrompt = () => {
    if (!actionImage.prompt) return;
    void navigator.clipboard.writeText(actionImage.prompt);
    showToast(t("toast.promptCopied"));
  };

  const copyMetadataValue = (value: string) => {
    void navigator.clipboard.writeText(value);
    showToast(t("toast.metadataCopied"));
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
      <button type="button" className="action-btn" onClick={copyPrompt}>
        {t("result.copyPrompt")}
      </button>
      <button
        type="button"
        className="action-btn action-btn--primary"
        onClick={newFromHere}
        title={t("result.continueHereTitle")}
      >
        {t("result.continueHere")}
      </button>
      {providerUrlAlive && (
        <button
          type="button"
          className="action-btn"
          onClick={() => void newFromHereAsUrl()}
          title={t("result.continueAsUrlTitle")}
        >
          {t("result.continueAsUrl")}
        </button>
      )}
      {canAnimate && (
        <button
          type="button"
          className="action-btn"
          onClick={() => void animate()}
          disabled={animating}
          title={t("result.animateTitle")}
        >
          {animating ? t("result.animating") : t("result.animate")}
        </button>
      )}
      <button
        type="button"
        className="action-btn"
        onClick={generateAsFirstNode}
        title={t("result.firstNodeTitle")}
      >
        {t("result.firstNode")}
      </button>
      <button
        type="button"
        className="action-btn"
        onClick={() => setMetadataOpen(true)}
        title={t("result.infoTitle")}
      >
        {t("result.info")}
      </button>
      {!canvasOpen && (
        <button
          type="button"
          className="action-btn"
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
            type="button"
            className="action-btn action-btn--danger"
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
                  type="button"
                  className="result-actions__menu-item"
                  onClick={() => void sendToComfyUI()}
                  title={t("result.sendToComfyUITitle")}
                  disabled={comfyExporting}
                >
                  {t("result.sendToComfyUI")}
                </button>
              )}
              <button
                type="button"
                className="result-actions__menu-item result-actions__danger-item"
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
          onCopy={copyMetadataValue}
        />
      )}
    </div>
  );
}
