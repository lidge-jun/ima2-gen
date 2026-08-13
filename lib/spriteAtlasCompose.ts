import { mkdir, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import sharp, { type OverlayOptions } from "sharp";
import { atomicWriteJson } from "./atomicWrite.js";
import { readSpriteCuration, resolveSpriteStatePlan } from "./spriteCurationStore.js";
import { parseSpriteGenManifest } from "./spriteAtlasManifest.js";
import { resolveSpriteRunDir } from "./spriteRunPath.js";
import type { SpriteAtlasReport, SpriteFrameRect, SpriteGenManifest } from "./spriteAtlasTypes.js";
import type { SpriteFrameTransform } from "./spriteAtlasTypes.js";

export type SpriteAtlasComposeInput = { generatedDir: string; runId: string; manifest?: SpriteGenManifest };

async function renderFrame(path: string, width: number, height: number, transform: SpriteFrameTransform): Promise<Buffer> {
  let image = sharp(path).ensureAlpha().affine(
    [[transform.flipX ? -transform.scale : transform.scale, transform.shx], [transform.shy, transform.scale]],
    { odx: transform.dx, ody: transform.dy, background: { r: 0, g: 0, b: 0, alpha: 0 }, interpolator: "nearest" },
  );
  if (transform.rotate) image = image.rotate(transform.rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
  return image.resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

export async function composeSpriteAtlas(input: SpriteAtlasComposeInput): Promise<{ manifest: SpriteGenManifest; report: SpriteAtlasReport }> {
  const runDir = resolveSpriteRunDir(input.generatedDir, input.runId);
  let tempOutput: string | null = null;
  try {
    const source = input.manifest ?? parseSpriteGenManifest(JSON.parse(await readFile(join(runDir, "manifest.json"), "utf8")));
    const curation = await readSpriteCuration(input.generatedDir, input.runId);
    const width = source.frame_layout.cellWidth;
    const height = source.frame_layout.cellHeight;
    const rows = Object.keys(source.frame_layout.rows);
    const plans = rows.map((state) => {
      const rowFrames = source.frame_layout.rows[state];
      return resolveSpriteStatePlan(curation, state, rowFrames ? rowFrames.length : 0);
    });
    const columns = Math.max(1, ...plans.map((plan) => plan.ordered.length));
    const composites: OverlayOptions[] = [];
    const layoutRows: Record<string, SpriteFrameRect[]> = {};
    for (let row = 0; row < rows.length; row++) {
      const state = rows[row];
      const plan = plans[row];
      if (state === undefined || plan === undefined) continue;
      layoutRows[state] = [];
      for (let column = 0; column < plan.ordered.length; column++) {
        const index = plan.ordered[column];
        if (index === undefined) continue;
        const plain = curation?.pixel_perfect === false;
        const framePath = join(runDir, "frames", state, `frame-${index}${plain ? ".plain" : ""}.png`);
        const buffer = await renderFrame(framePath, width, height, plan.transforms.get(index) ?? { rotate: 0, scale: 1, dx: 0, dy: 0, shx: 0, shy: 0, flipX: 0 });
        composites.push({ input: buffer, left: column * width, top: row * height }); layoutRows[state].push({ x: column * width, y: row * height, w: width, h: height });
      }
    }
    await mkdir(runDir, { recursive: true }); const output = join(runDir, source.sprite_sheet_alpha || "sprite-sheet-alpha.png"); tempOutput = `${output}.${process.pid}.tmp.png`;
    await sharp({ create: { width: columns * width, height: Math.max(1, rows.length) * height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(composites).png().toFile(tempOutput); await rename(tempOutput, output); tempOutput = null;
    const manifest = parseSpriteGenManifest({ ...source, curation_applied: Boolean(curation), animation: { ...source.animation, columns, rows: Object.fromEntries(rows.map((state, row) => {
      const animRow = source.animation.rows[state];
      const layout = layoutRows[state] ?? [];
      return [state, { ...(animRow ?? {}), row, frames: layout.length }];
    })) }, frame_layout: { ...source.frame_layout, sheetWidth: columns * width, sheetHeight: Math.max(1, rows.length) * height, rows: layoutRows } });
    const report = { states: Object.fromEntries(rows.map((state) => [state, { frames: (layoutRows[state] ?? []).length }])), width: columns * width, height: Math.max(1, rows.length) * height, createdAt: new Date().toISOString() };
    await atomicWriteJson(join(runDir, "manifest.json"), manifest); await atomicWriteJson(join(runDir, source.sprite_sheet_alpha_report || "sprite-sheet-alpha.report.json"), report);
    return { manifest, report };
  } catch (error) { if (tempOutput) await rm(tempOutput, { force: true }).catch(() => undefined); throw error; }
}
