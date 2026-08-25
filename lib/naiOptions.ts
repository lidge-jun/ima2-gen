// lib/naiOptions.ts — one normalizer for every request-driven NovelAI dispatch.
//
// /api/generate used to build these options inline while the multimode and node
// lanes forwarded none of them, so the same provider answered to three
// different contracts. Every request-driven caller now spreads readNaiOptions()
// instead (devlog/_plan/260825_novelai_negative_prompt_settings/010).
//
// lib/agentImageVideoGen.ts is deliberately NOT a caller: the Agent surface has
// no per-request option source, so it stays on adapter/config defaults.
import {
  NAI_SAMPLERS,
  NAI_NOISE_SCHEDULES,
  NAI_UC_PRESET_IDS,
  NAI_QUALITY_PRESET_IDS,
} from "./naiImageAdapter.js";

/**
 * ddim_v3 is a V3-era sampler and no registered model accepts it, so it is
 * absent here even though the adapter's constant still lists it.
 */
const SELECTABLE_SAMPLERS: readonly string[] = NAI_SAMPLERS.filter((s) => s !== "ddim_v3");

/** NovelAI's paid ceiling; the Opus free tier stops earlier at 28. */
const MAX_STEPS = 50;
const MAX_SCALE = 10;
const MAX_SEED = 2 ** 32 - 1;
const MAX_NEGATIVE_PROMPT_CHARS = 10_000;

export type NaiRequestOptions = {
  negativePrompt?: string;
  steps?: number;
  scale?: number;
  cfgRescale?: number;
  sampler?: string;
  noiseSchedule?: string;
  seed?: number;
  straightAlpha?: boolean;
  varietyPlus?: boolean;
  ucPresetId?: string;
  qualityPresetId?: string;
};

/** Out-of-alphabet values are dropped rather than rejected: a stale client
 *  should fall back to the configured default, not fail every generation. */
function pickEnum(value: unknown, allowed: readonly string[]): string | undefined {
  return typeof value === "string" && allowed.includes(value) ? value : undefined;
}

/** Clamped rather than dropped, so a slider edge is forgiving. */
function pickNumber(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(min, value));
}

function pickSeed(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (!Number.isInteger(value) || value < 0 || value > MAX_SEED) return undefined;
  return value;
}

function pickBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function pickNegativePrompt(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.length > MAX_NEGATIVE_PROMPT_CHARS
    ? value.slice(0, MAX_NEGATIVE_PROMPT_CHARS)
    : value;
}

/**
 * Reads the NovelAI tuning fields out of a request body.
 *
 * Only keys that validated appear in the result, so the caller can spread it
 * into the adapter options and let the adapter resolve everything else from
 * config. An absent key means "the operator's default applies", which is what
 * lets the web UI persist sparse overrides.
 */
export function readNaiOptions(body: unknown): NaiRequestOptions {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const raw = body as Record<string, unknown>;
  const out: NaiRequestOptions = {};

  const negativePrompt = pickNegativePrompt(raw.negativePrompt);
  if (negativePrompt !== undefined) out.negativePrompt = negativePrompt;

  const steps = pickNumber(raw.steps, 1, MAX_STEPS);
  if (steps !== undefined) out.steps = steps;

  const scale = pickNumber(raw.scale, 1, MAX_SCALE);
  if (scale !== undefined) out.scale = scale;

  const cfgRescale = pickNumber(raw.cfgRescale, 0, 1);
  if (cfgRescale !== undefined) out.cfgRescale = cfgRescale;

  const sampler = pickEnum(raw.sampler, SELECTABLE_SAMPLERS);
  if (sampler !== undefined) out.sampler = sampler;

  const noiseSchedule = pickEnum(raw.noiseSchedule, NAI_NOISE_SCHEDULES);
  if (noiseSchedule !== undefined) out.noiseSchedule = noiseSchedule;

  const seed = pickSeed(raw.seed);
  if (seed !== undefined) out.seed = seed;

  const straightAlpha = pickBoolean(raw.straightAlpha);
  if (straightAlpha !== undefined) out.straightAlpha = straightAlpha;

  const varietyPlus = pickBoolean(raw.varietyPlus);
  if (varietyPlus !== undefined) out.varietyPlus = varietyPlus;

  const ucPresetId = pickEnum(raw.ucPresetId, NAI_UC_PRESET_IDS);
  if (ucPresetId !== undefined) out.ucPresetId = ucPresetId;

  const qualityPresetId = pickEnum(raw.qualityPresetId, NAI_QUALITY_PRESET_IDS);
  if (qualityPresetId !== undefined) out.qualityPresetId = qualityPresetId;

  return out;
}

/**
 * History provenance for the undesired-content prompt.
 *
 * Gated on the lane as well as emptiness: without the provider check any
 * caller could write this field into another lane's metadata, where it would
 * describe a generation that never had a negative prompt.
 */
export function composerNegativePromptMeta(
  activeProvider: string | undefined,
  body: unknown,
): { composerNegativePrompt: string } | Record<string, never> {
  if (activeProvider !== "nai") return {};
  const raw = (body && typeof body === "object" ? (body as Record<string, unknown>).negativePrompt : undefined);
  const value = typeof raw === "string" ? raw.trim() : "";
  return value ? { composerNegativePrompt: value } : {};
}
