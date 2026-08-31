import { useCallback, useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { useI18n } from "../../i18n";
import { isVideoUrl } from "../../lib/videoMedia";
import { ImageIcon, SlidersIcon } from "./AgentIcons";
import { AgentVideoPreview } from "./AgentImagePane";
import { AgentResultThumb } from "./AgentResultThumb";
import { AgentSafeImage } from "./AgentSafeImage";
import type { AgentImageHandle } from "./agentTypes";

type Props = {
  currentImage: AgentImageHandle | null;
  images: AgentImageHandle[];
  onImageSelect: (imageId: string) => void;
  onOpenPanel: () => void;
};

export function AgentStagePane({ currentImage, images, onImageSelect, onOpenPanel, toolsPanelOpen }: Props & { toolsPanelOpen?: boolean }) {
  const { t } = useI18n();
  const thumbRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const currentIndex = useMemo(
    () => images.findIndex((image) => image.id === currentImage?.id),
    [currentImage?.id, images],
  );

  useEffect(() => {
    if (!currentImage?.id) return;
    thumbRefs.current[currentImage.id]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [currentImage?.id]);

  const selectByIndex = useCallback((index: number) => {
    const image = images[index];
    if (image) onImageSelect(image.id);
  }, [images, onImageSelect]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (images.length === 0) return;
    const baseIndex = currentIndex >= 0 ? currentIndex : 0;
    let nextIndex: number | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = Math.max(0, baseIndex - 1);
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = Math.min(images.length - 1, baseIndex + 1);
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = images.length - 1;
    if (nextIndex === null || nextIndex === baseIndex) return;
    event.preventDefault();
    selectByIndex(nextIndex);
  }, [currentIndex, images.length, selectByIndex]);

  return (
    <section className="agent-stage" aria-label={t("agent.imagePane")}>
      <header className="agent-pane-header">
        <div className="agent-pane-header__title">
          <span>{t("agent.imagePane")}</span>
          <strong>{t("agent.currentImage")}</strong>
        </div>
        <button
          type="button"
          className="agent-stage__tools"
          onClick={onOpenPanel}
          aria-expanded={toolsPanelOpen === true}
          aria-controls="agent-tools-panel"
          aria-label={toolsPanelOpen ? t("agent.closeTools") : t("agent.openTools")}
          title={toolsPanelOpen ? t("agent.closeTools") : t("agent.openTools")}
        >
          <SlidersIcon size={16} />
        </button>
      </header>
      <div
        className="agent-stage__viewport"
        tabIndex={images.length > 1 ? 0 : undefined}
        onKeyDown={handleKeyDown}
        aria-label={images.length > 1 ? t("agent.variants") : undefined}
      >
        {currentImage ? (
          isVideoUrl(currentImage.url)
            ? <AgentVideoPreview key={currentImage.id} image={currentImage} />
            : <AgentSafeImage src={currentImage.url} alt={currentImage.prompt ?? t("agent.imageAlt")} fallbackClassName="agent-stage__empty" iconSize={34} />
        ) : (
          <div className="agent-stage__empty">
            <ImageIcon size={34} />
            <span>{t("agent.noImage")}</span>
            <small>{t("agent.stageEmptyHint")}</small>
          </div>
        )}
      </div>
      <div className="agent-stage__caption">
        <strong>{currentImage?.filename ?? "-"}</strong>
        <span>{currentImage?.prompt ?? currentImage?.revisedPrompt ?? ""}</span>
      </div>
      <div className="agent-stage__filmstrip" aria-label={t("agent.variants")} onKeyDown={handleKeyDown}>
        {images.map((image) => (
          <AgentResultThumb
            key={image.id}
            ref={(node) => { thumbRefs.current[image.id] = node; }}
            image={image}
            selected={image.id === currentImage?.id}
            onSelect={onImageSelect}
          />
        ))}
      </div>
    </section>
  );
}
