// ui/src/lib/naiOptions.ts — NovelAI generation options for the web UI.
//
// The persisted shape is SPARSE: only fields the user explicitly changed. An
// untouched field is absent from storage AND from the request, so the server
// keeps resolving it from config.naiProvider for the life of the install
// rather than being frozen at whatever this file was compiled with.
//
// Alphabets are duplicated from lib/naiImageAdapter.ts because the UI cannot
// import from lib/ (separate tsconfig, separate bundle).
// tests/nai-client-options-contract.test.ts asserts they stay equal.

/** The modern six. ddim_v3 is V3-era and no registered model accepts it. */
export const NAI_UI_SAMPLERS = [
  "k_euler_ancestral",
  "k_dpmpp_2s_ancestral",
  "k_dpmpp_2m_sde",
  "k_euler",
  "k_dpmpp_2m",
  "k_dpmpp_sde",
] as const;

export const NAI_UI_NOISE_SCHEDULES = ["native", "karras", "exponential", "polyexponential"] as const;
export const NAI_UI_UC_PRESETS = ["heavy", "light", "furryFocus", "humanFocus", "none"] as const;
export const NAI_UI_QUALITY_PRESETS = ["standard", "light", "none"] as const;

export type NaiOptions = {
  sampler: string;
  noiseSchedule: string;
  steps: number;
  scale: number;
  cfgRescale: number;
  ucPresetId: string;
  qualityPresetId: string;
  varietyPlus: boolean;
  straightAlpha: boolean;
  /** null means "let the server pick a seed". 0 is a real NovelAI seed. */
  seed: number | null;
};

/** Only the fields the user explicitly changed. */
export type NaiOptionOverrides = Partial<NaiOptions>;

/**
 * Shown before /api/capabilities answers. Never sent: an untouched field is
 * absent from the request and the adapter resolves it from config.
 */
export const COMPILED_FALLBACK: NaiOptions = {
  sampler: "k_euler_ancestral",
  noiseSchedule: "karras",
  steps: 23,
  scale: 5,
  cfgRescale: 0,
  ucPresetId: "heavy",
  qualityPresetId: "standard",
  varietyPlus: false,
  straightAlpha: false,
  seed: null,
};

export const NAI_STEPS_RANGE = { min: 1, max: 50 } as const;
export const NAI_SCALE_RANGE = { min: 1, max: 10 } as const;
export const NAI_CFG_RESCALE_RANGE = { min: 0, max: 1 } as const;
const MAX_SEED = 2 ** 32 - 1;

export function resolveNaiOptions(
  serverDefaults: NaiOptionOverrides | null,
  overrides: NaiOptionOverrides,
): NaiOptions {
  return { ...COMPILED_FALLBACK, ...(serverDefaults ?? {}), ...overrides };
}

export function isNaiV5Model(model: string): boolean {
  return model === "nai-diffusion-5-full" || model === "nai-diffusion-5-curated";
}

function enumOr(value: unknown, allowed: readonly string[]): string | undefined {
  return typeof value === "string" && allowed.includes(value) ? value : undefined;
}

function numberIn(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value < min || value > max ? undefined : value;
}

/**
 * Per-key validation. An invalid key is DROPPED rather than replaced, so that
 * field falls back to the server default instead of snapping to a compiled
 * constant — one corrupt entry cannot discard the other nine.
 */
export function coerceNaiOverrides(value: unknown): NaiOptionOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const out: NaiOptionOverrides = {};

  const sampler = enumOr(raw.sampler, NAI_UI_SAMPLERS);
  if (sampler !== undefined) out.sampler = sampler;

  const noiseSchedule = enumOr(raw.noiseSchedule, NAI_UI_NOISE_SCHEDULES);
  if (noiseSchedule !== undefined) out.noiseSchedule = noiseSchedule;

  const ucPresetId = enumOr(raw.ucPresetId, NAI_UI_UC_PRESETS);
  if (ucPresetId !== undefined) out.ucPresetId = ucPresetId;

  const qualityPresetId = enumOr(raw.qualityPresetId, NAI_UI_QUALITY_PRESETS);
  if (qualityPresetId !== undefined) out.qualityPresetId = qualityPresetId;

  const steps = numberIn(raw.steps, NAI_STEPS_RANGE.min, NAI_STEPS_RANGE.max);
  if (steps !== undefined) out.steps = steps;

  const scale = numberIn(raw.scale, NAI_SCALE_RANGE.min, NAI_SCALE_RANGE.max);
  if (scale !== undefined) out.scale = scale;

  const cfgRescale = numberIn(raw.cfgRescale, NAI_CFG_RESCALE_RANGE.min, NAI_CFG_RESCALE_RANGE.max);
  if (cfgRescale !== undefined) out.cfgRescale = cfgRescale;

  if (typeof raw.varietyPlus === "boolean") out.varietyPlus = raw.varietyPlus;
  if (typeof raw.straightAlpha === "boolean") out.straightAlpha = raw.straightAlpha;

  if (raw.seed === null) out.seed = null;
  else if (
    typeof raw.seed === "number" &&
    Number.isInteger(raw.seed) &&
    raw.seed >= 0 &&
    raw.seed <= MAX_SEED
  ) {
    out.seed = raw.seed;
  }

  return out;
}

