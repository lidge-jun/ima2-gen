import { z } from "zod";

export const spriteFrameRectSchema = z.object({ x: z.number().int(), y: z.number().int(), w: z.number().int(), h: z.number().int() }).passthrough();
export const spriteFrameLayoutSchema = z.object({
  sheetWidth: z.number().int(), sheetHeight: z.number().int(), cellWidth: z.number().int(), cellHeight: z.number().int(),
  rows: z.record(z.string(), z.array(spriteFrameRectSchema)),
}).passthrough();
export const spriteAnimationRowSchema = z.object({ row: z.number().int(), frames: z.number().int().nonnegative(), fps: z.number().positive(), loop: z.boolean() }).passthrough();
export const spriteGenManifestSchema = z.object({
  characterId: z.string(), engine: z.string(), game_input: z.string(), degraded_static_fallback: z.boolean(),
  curation_applied: z.boolean(), frame_variant: z.string(), sprite_sheet_alpha: z.string(),
  sprite_sheet_alpha_report: z.string(), base_image: z.string().nullable(), cell: z.record(z.string(), z.unknown()),
  chroma_key: z.record(z.string(), z.unknown()),
  animation: z.object({ cellWidth: z.number().int(), cellHeight: z.number().int(), columns: z.number().int().positive(), rows: z.record(z.string(), spriteAnimationRowSchema) }).passthrough(),
  frame_layout: spriteFrameLayoutSchema,
}).passthrough();

export type SpriteFrameRect = z.infer<typeof spriteFrameRectSchema>;
export type SpriteFrameLayout = z.infer<typeof spriteFrameLayoutSchema>;
export type SpriteAnimationRow = z.infer<typeof spriteAnimationRowSchema>;
export type SpriteGenManifest = z.infer<typeof spriteGenManifestSchema>;

export type SpriteFrameTransform = { rotate: number; scale: number; dx: number; dy: number; shx: number; shy: number; flipX: 0 | 1 };
export type SpriteCurationState = { selected?: number[]; deleted?: number[]; order?: number[]; transforms?: Record<string, Partial<SpriteFrameTransform>> };
export type SpriteCuration = { version: 1; kind: "sprite-gen-curation"; pixel_perfect?: boolean; states: Record<string, SpriteCurationState> };

export type SpriteAtlasReport = { states: Record<string, { frames: number }>; width: number; height: number; createdAt: string };
