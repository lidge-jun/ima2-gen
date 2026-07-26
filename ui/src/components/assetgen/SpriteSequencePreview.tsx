import { useEffect, useRef } from "react";
import { normalizeSpriteTransform, spriteTransformMatrix } from "../../lib/spriteTransform";
import type { SpriteFrameRect, SpriteFrameTransform } from "../../types/spriteAtlas";
import { useI18n } from "../../i18n";

type Props = {
  atlasUrl: string;
  frames: Array<{ frameIndex: number; rect: SpriteFrameRect }>;
  cell: { width: number; height: number };
  transforms: Record<string, Partial<SpriteFrameTransform>>;
  currentFrame: number;
  showGrid: boolean;
};

export function SpriteSequencePreview({ atlasUrl, frames, cell, transforms, currentFrame, showGrid }: Props) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      imageRef.current = image;
      canvasRef.current?.dispatchEvent(new Event("sprite-atlas-ready"));
    };
    image.onerror = () => { if (active) imageRef.current = null; };
    image.src = atlasUrl;
    return () => { active = false; image.onload = null; image.onerror = null; };
  }, [atlasUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const render = () => {
      const image = imageRef.current;
      const frame = frames[currentFrame];
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = cell.width;
      canvas.height = cell.height;
      ctx.clearRect(0, 0, cell.width, cell.height);
      ctx.imageSmoothingEnabled = false;
      if (showGrid) {
        ctx.strokeStyle = "rgba(127, 127, 127, .22)";
        ctx.strokeRect(.5, .5, cell.width - 1, cell.height - 1);
        ctx.beginPath();
        ctx.moveTo(cell.width / 2 + .5, 0); ctx.lineTo(cell.width / 2 + .5, cell.height);
        ctx.moveTo(0, cell.height / 2 + .5); ctx.lineTo(cell.width, cell.height / 2 + .5);
        ctx.stroke();
      }
      if (!image || !frame) return;
      const transform = normalizeSpriteTransform(transforms[String(frame.frameIndex)] ?? {});
      const { m00, m01, m10, m11 } = spriteTransformMatrix(transform);
      const cx = cell.width / 2 + transform.dx;
      const cy = cell.height / 2 + transform.dy;
      ctx.save();
      ctx.setTransform(m00, m10, m01, m11, cx, cy);
      ctx.drawImage(
        image,
        frame.rect.x, frame.rect.y, frame.rect.w, frame.rect.h,
        -frame.rect.w / 2, -frame.rect.h / 2, frame.rect.w, frame.rect.h,
      );
      ctx.restore();
    };
    render();
    canvas.addEventListener("sprite-atlas-ready", render);
    return () => canvas.removeEventListener("sprite-atlas-ready", render);
  }, [cell.height, cell.width, currentFrame, frames, showGrid, transforms]);

  return <canvas ref={canvasRef} className="sprite-curator__canvas" aria-label={t("common.spritePreview")} />;
}
