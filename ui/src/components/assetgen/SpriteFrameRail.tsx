import type { DragEvent, KeyboardEvent } from "react";
import type { SpriteFrameView } from "../../types/spriteAtlas";
import { useI18n } from "../../i18n";

type Props = {
  kind: "sequence" | "candidates";
  frames: SpriteFrameView[];
  activeFrameIndex: number | null;
  onActivate(frameIndex: number): void;
  onReorder(frameIndex: number, beforeFrameIndex: number | null): void;
  onMove(frameIndex: number, destination: "sequence" | "candidates"): void;
  onDelete(frameIndex: number): void;
};

export function SpriteFrameRail(props: Props) {
  const { t } = useI18n();
  const destination = props.kind === "sequence" ? "candidates" : "sequence";
  const drop = (event: DragEvent, beforeFrameIndex: number | null) => {
    event.preventDefault();
    const frameIndex = Number(event.dataTransfer.getData("application/x-sprite-frame"));
    const source = event.dataTransfer.getData("application/x-sprite-rail");
    if (!Number.isInteger(frameIndex)) return;
    if (source === props.kind) props.onReorder(frameIndex, beforeFrameIndex);
    else props.onMove(frameIndex, props.kind);
  };
  const keyDown = (event: KeyboardEvent, frame: SpriteFrameView, position: number) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const delta = event.key === "ArrowLeft" ? -1 : 1;
      const before = props.frames[position + delta + (delta > 0 ? 1 : 0)]?.index ?? null;
      props.onReorder(frame.index, before);
    }
  };
  return (
    <section className="sprite-rail" aria-label={t(`assetGen.${props.kind}`)}>
      <div className="sprite-rail__track" role="listbox" onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(e, null)}>
        {props.frames.map((frame, position) => (
          <div className="sprite-rail__item" key={frame.index}>
            <button
              type="button"
              className="sprite-rail__frame"
              role="option"
              aria-selected={props.activeFrameIndex === frame.index}
              aria-label={t("assetGen.frameAria", { n: frame.index + 1, rail: t(`assetGen.${props.kind}`) })}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("application/x-sprite-frame", String(frame.index));
                event.dataTransfer.setData("application/x-sprite-rail", props.kind);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.stopPropagation(); drop(e, frame.index); }}
              onKeyDown={(e) => keyDown(e, frame, position)}
              onClick={() => props.onActivate(frame.index)}
            >
              <span
                className="sprite-rail__thumb"
                style={{
                  backgroundImage: `url(${frame.atlasUrl})`,
                  backgroundSize: `${frame.sheetWidth}px ${frame.sheetHeight}px`,
                  backgroundPosition: `${-frame.rect.x}px ${-frame.rect.y}px`,
                  width: frame.rect.w,
                  height: frame.rect.h,
                }}
              />
              <span>{frame.index + 1}</span>
            </button>
            <span className="sprite-rail__actions">
              <button type="button" onClick={() => props.onMove(frame.index, destination)}>
                {destination === "sequence" ? t("assetGen.addFrame") : t("assetGen.removeFrame")}
              </button>
              <button type="button" aria-label={t("assetGen.deleteFrame", { n: frame.index + 1 })} onClick={() => props.onDelete(frame.index)}>×</button>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
