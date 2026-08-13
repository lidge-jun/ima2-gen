import { mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { validateFrameLayout } from "./spriteAtlasManifest.js";
import { resolveSpriteRunDir } from "./spriteRunPath.js";
import type { SpriteGenManifest } from "./spriteAtlasTypes.js";

export type SpriteAtlasUnpackInput = { generatedDir: string; runId: string; manifest: SpriteGenManifest; atlasPath: string };
export type SpriteAtlasUnpackResult = { frameCount: number; framesDir: string };

export async function unpackSpriteAtlas(input: SpriteAtlasUnpackInput): Promise<SpriteAtlasUnpackResult> {
  const metadata = await sharp(input.atlasPath).metadata(); const errors = validateFrameLayout(input.manifest, { width: metadata.width ?? 0, height: metadata.height ?? 0 });
  if (errors.length) { const error = new Error(errors.join("; ")) as Error & { status: number; code: string }; error.status = 400; error.code = "SPRITE_LAYOUT_INVALID"; throw error; }
  const runDir = resolveSpriteRunDir(input.generatedDir, input.runId); const temp = join(runDir, `frames.${process.pid}.tmp`); let count = 0;
  try { for (const [state, rects] of Object.entries(input.manifest.frame_layout.rows)) { const dir = join(temp, state); await mkdir(dir, { recursive: true }); for (let index = 0; index < rects.length; index++) { const rect = rects[index]; if (!rect) continue; await sharp(input.atlasPath).extract({ left: rect.x, top: rect.y, width: rect.w, height: rect.h }).png().toFile(join(dir, `frame-${index}.png`)); count++; } } await rm(join(runDir, "frames"), { recursive: true, force: true }); await rename(temp, join(runDir, "frames")); return { frameCount: count, framesDir: join(runDir, "frames") }; }
  catch (error) { await rm(temp, { recursive: true, force: true }).catch(() => undefined); throw error; }
}
