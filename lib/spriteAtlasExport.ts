import { rename } from "node:fs/promises";
import sharp from "sharp";

export type ContactSheetInput = { frames: string[]; outputPath: string; cellWidth: number; cellHeight: number; columns?: number };

export async function composeContactSheet(input: ContactSheetInput): Promise<void> {
  if (!input.frames.length) throw new Error("Contact sheet requires at least one frame");
  const columns = Math.max(1, input.columns ?? Math.ceil(Math.sqrt(input.frames.length))); const rows = Math.ceil(input.frames.length / columns);
  const overlays = await Promise.all(input.frames.map(async (path, index) => ({ input: await sharp(path).ensureAlpha().resize(input.cellWidth, input.cellHeight, { fit: "contain" }).png().toBuffer(), left: (index % columns) * input.cellWidth, top: Math.floor(index / columns) * input.cellHeight })));
  const temp = `${input.outputPath}.${process.pid}.tmp.png`; await sharp({ create: { width: columns * input.cellWidth, height: rows * input.cellHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(overlays).png().toFile(temp); await rename(temp, input.outputPath);
}
