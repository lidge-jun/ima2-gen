import { readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { atomicWriteJson } from "./atomicWrite.js";
import { resolveSpriteRunDir } from "./spriteRunPath.js";
import type { SpriteCuration, SpriteFrameTransform } from "./spriteAtlasTypes.js";

const transformSchema = z.object({ rotate: z.number().optional(), scale: z.number().optional(), dx: z.number().optional(), dy: z.number().optional(), shx: z.number().optional(), shy: z.number().optional(), flipX: z.union([z.literal(0), z.literal(1)]).optional() }).passthrough();
const curationSchema = z.object({ version: z.literal(1), kind: z.literal("sprite-gen-curation"), pixel_perfect: z.boolean().optional(), states: z.record(z.string(), z.object({ selected: z.array(z.number().int()).optional(), deleted: z.array(z.number().int()).optional(), order: z.array(z.number().int()).optional(), transforms: z.record(z.string(), transformSchema).optional() }).passthrough()) }).passthrough();
const IDENTITY: SpriteFrameTransform = { rotate: 0, scale: 1, dx: 0, dy: 0, shx: 0, shy: 0, flipX: 0 };

export function normalizeSpriteTransform(input: unknown): SpriteFrameTransform {
  const parsed = transformSchema.parse(input ?? {});
  return { ...IDENTITY, ...parsed } as SpriteFrameTransform;
}

export function resolveSpriteStatePlan(curation: SpriteCuration | null, state: string, defaultCount: number) {
  const cfg = curation?.states[state];
  const valid = (value: number) => Number.isInteger(value) && value >= 0 && value < defaultCount;
  const deleted = new Set((cfg?.deleted ?? []).filter(valid));
  const selected = cfg?.selected?.length ? cfg.selected : Array.from({ length: defaultCount }, (_, index) => index);
  const ordered: number[] = [];
  for (const index of selected) if (valid(index) && !deleted.has(index) && !ordered.includes(index)) ordered.push(index);
  const transforms = new Map<number, SpriteFrameTransform>();
  for (const [key, value] of Object.entries(cfg?.transforms ?? {})) { const index = Number(key); if (valid(index)) transforms.set(index, normalizeSpriteTransform(value)); }
  return { ordered, transforms };
}

export async function readSpriteCuration(generatedDir: string, runId: string): Promise<SpriteCuration | null> {
  try { return curationSchema.parse(JSON.parse(await readFile(join(resolveSpriteRunDir(generatedDir, runId), "curation.json"), "utf8"))) as SpriteCuration; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}

export async function writeSpriteCuration(generatedDir: string, runId: string, input: SpriteCuration): Promise<void> {
  try { const value = curationSchema.parse(input); const dir = resolveSpriteRunDir(generatedDir, runId); await mkdir(dir, { recursive: true }); await atomicWriteJson(join(dir, "curation.json"), value); }
  catch (error) { throw error; }
}
