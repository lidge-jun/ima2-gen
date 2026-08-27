import type { NaiRequestOptions } from "../../lib/naiOptions.js";
import {
  NAI_NOISE_SCHEDULES,
  NAI_QUALITY_PRESET_IDS,
  NAI_SAMPLERS,
  NAI_UC_PRESET_IDS,
} from "../../lib/naiImageAdapter.js";
import { getProvider } from "../../lib/providers/registry.js";
import type { FlagDef, ParsedArgs } from "./args.js";
import { fail } from "./output.js";

export const NAI_CLI_FLAGS: Record<string, FlagDef> = {
  "nai-negative-prompt": { type: "string" },
  "nai-sampler": { type: "string" },
  "nai-noise-schedule": { type: "string" },
  "nai-steps": { type: "string" },
  "nai-scale": { type: "string" },
  "nai-cfg-rescale": { type: "string" },
  "nai-seed": { type: "string" },
  "nai-uc-preset": { type: "string" },
  "nai-quality-preset": { type: "string" },
  "nai-auto-smea": { type: "boolean" },
  "no-nai-auto-smea": { type: "boolean" },
  "nai-decrisper": { type: "boolean" },
  "no-nai-decrisper": { type: "boolean" },
  "nai-variety-plus": { type: "boolean" },
  "no-nai-variety-plus": { type: "boolean" },
  "nai-straight-alpha": { type: "boolean" },
  "no-nai-straight-alpha": { type: "boolean" },
};

export const NAI_CLI_HELP = `
  NovelAI options (nai lane only):
        --nai-negative-prompt <text>       Undesired content (max 10,000 chars)
        --nai-sampler <sampler>            ${NAI_SAMPLERS.filter((v) => v !== "ddim_v3").join("|")}
        --nai-noise-schedule <schedule>    ${NAI_NOISE_SCHEDULES.join("|")}
        --nai-steps <1..50>                Diffusion steps
        --nai-scale <1..10>                Prompt guidance
        --nai-cfg-rescale <0..1>           Guidance rescale
        --nai-seed <0..4294967295>         Reproducible seed
        --nai-uc-preset <preset>           ${NAI_UC_PRESET_IDS.join("|")}
        --nai-quality-preset <preset>      ${NAI_QUALITY_PRESET_IDS.join("|")} (V5 only)
        --nai-auto-smea / --no-nai-auto-smea
        --nai-decrisper / --no-nai-decrisper
        --nai-variety-plus / --no-nai-variety-plus
        --nai-straight-alpha / --no-nai-straight-alpha  V5 only
`;

type TargetClass = "nai" | "non-nai" | "unknown";
export type NaiCliPreflight = {
  hasOptions: boolean;
  payload: NaiRequestOptions;
  target: TargetClass;
};
type NaiCliFailure = { ok: false; code: string; message: string; flag?: string };
export type NaiCliResult = { ok: true; value: NaiCliPreflight } | NaiCliFailure;

export function unwrapNaiCliResult(result: NaiCliResult, jsonMode: boolean): NaiCliPreflight {
  if ("message" in result) {
    fail({ json: jsonMode, code: result.code, message: result.message,
      ...(result.flag ? { extra: { flag: result.flag } } : {}) });
  }
  return result.value;
}

const SELECTABLE_SAMPLERS = NAI_SAMPLERS.filter((value) => value !== "ddim_v3");
const NAI_MODEL_IDS = new Set(
  getProvider("nai").models.filter((model) => model.kind === "image").map((model) => model.id),
);
const V5_MODEL_IDS = new Set(["nai-diffusion-5-full", "nai-diffusion-5-curated"]);
const OPTION_KEYS = Object.keys(NAI_CLI_FLAGS);

function failure(code: string, message: string, flag?: string): NaiCliFailure {
  return { ok: false, code, message, ...(flag ? { flag } : {}) };
}

function isFailure(value: unknown): value is NaiCliFailure {
  return Boolean(value && typeof value === "object" && "ok" in value && value.ok === false);
}

function explicitModel(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  const slash = raw.indexOf("/");
  if (slash < 0) return NAI_MODEL_IDS.has(raw) ? raw : null;
  const lane = raw.slice(0, slash);
  const model = raw.slice(slash + 1);
  return lane === "nai" && NAI_MODEL_IDS.has(model) ? model : null;
}

function classifyTarget(args: ParsedArgs): TargetClass | "conflict" {
  const provider = typeof args.provider === "string" ? args.provider : undefined;
  const providerClass: TargetClass = !provider || provider === "auto"
    ? "unknown"
    : provider === "nai" ? "nai" : "non-nai";
  const rawModel = typeof args.model === "string" ? args.model : undefined;
  const modelClass: TargetClass = !rawModel
    ? "unknown"
    : explicitModel(rawModel) ? "nai" : "non-nai";
  if ((providerClass === "nai" && modelClass === "non-nai") ||
      (providerClass === "non-nai" && modelClass === "nai")) return "conflict";
  if (providerClass === "nai" || modelClass === "nai") return "nai";
  if (providerClass === "non-nai" || modelClass === "non-nai") return "non-nai";
  return "unknown";
}

function enumValue(args: ParsedArgs, key: string, allowed: readonly string[]): string | NaiCliFailure | undefined {
  const raw = args[key];
  if (raw === undefined) return undefined;
  if (typeof raw !== "string" || !allowed.includes(raw)) {
    return failure("NAI_FLAG_INVALID", `--${key} must be one of: ${allowed.join(", ")}`, `--${key}`);
  }
  return raw;
}

function numberValue(
  args: ParsedArgs,
  key: string,
  min: number,
  max: number,
  integer = false,
): number | NaiCliFailure | undefined {
  const raw = args[key];
  if (raw === undefined) return undefined;
  const value = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : Number.NaN;
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    return failure("NAI_FLAG_INVALID", `--${key} must be ${integer ? "an integer " : ""}between ${min} and ${max}`, `--${key}`);
  }
  return value;
}

function booleanPair(
  args: ParsedArgs,
  positive: string,
  negative: string,
): boolean | NaiCliFailure | undefined {
  if (args[positive] && args[negative]) {
    return failure("NAI_FLAG_CONFLICT", `--${positive} and --${negative} are mutually exclusive`, `--${positive}`);
  }
  if (args[positive]) return true;
  if (args[negative]) return false;
  return undefined;
}

function assignValue<K extends keyof NaiRequestOptions>(
  payload: NaiRequestOptions,
  key: K,
  value: NaiRequestOptions[K] | NaiCliFailure | undefined,
): NaiCliFailure | null {
  if (isFailure(value)) return value;
  if (value !== undefined) payload[key] = value as NaiRequestOptions[K];
  return null;
}

function buildPayload(args: ParsedArgs): NaiRequestOptions | NaiCliFailure {
  const payload: NaiRequestOptions = {};
  const negative = args["nai-negative-prompt"];
  if (negative !== undefined) {
    if (typeof negative !== "string" || negative.length > 10_000) {
      return failure("NAI_FLAG_INVALID", "--nai-negative-prompt must be at most 10,000 characters", "--nai-negative-prompt");
    }
    payload.negativePrompt = negative;
  }
  const values: Array<[keyof NaiRequestOptions, NaiRequestOptions[keyof NaiRequestOptions] | NaiCliFailure | undefined]> = [
    ["sampler", enumValue(args, "nai-sampler", SELECTABLE_SAMPLERS)],
    ["noiseSchedule", enumValue(args, "nai-noise-schedule", NAI_NOISE_SCHEDULES)],
    ["steps", numberValue(args, "nai-steps", 1, 50, true)],
    ["scale", numberValue(args, "nai-scale", 1, 10)],
    ["cfgRescale", numberValue(args, "nai-cfg-rescale", 0, 1)],
    ["seed", numberValue(args, "nai-seed", 0, 2 ** 32 - 1, true)],
    ["ucPresetId", enumValue(args, "nai-uc-preset", NAI_UC_PRESET_IDS)],
    ["qualityPresetId", enumValue(args, "nai-quality-preset", NAI_QUALITY_PRESET_IDS)],
    ["autoSmea", booleanPair(args, "nai-auto-smea", "no-nai-auto-smea")],
    ["decrisper", booleanPair(args, "nai-decrisper", "no-nai-decrisper")],
    ["varietyPlus", booleanPair(args, "nai-variety-plus", "no-nai-variety-plus")],
    ["straightAlpha", booleanPair(args, "nai-straight-alpha", "no-nai-straight-alpha")],
  ];
  for (const [key, value] of values) {
    const error = assignValue(payload, key, value);
    if (error) return error;
  }
  return payload;
}

function needsV5(payload: NaiRequestOptions): boolean {
  return payload.straightAlpha === true || payload.qualityPresetId !== undefined;
}

export function parseNaiCliOptions(
  args: ParsedArgs,
  policy: "allow-unknown" | "require-explicit",
): NaiCliResult {
  const hasOptions = OPTION_KEYS.some((key) => args[key] !== undefined);
  if (!hasOptions) return { ok: true, value: { hasOptions: false, payload: {}, target: "unknown" } };
  const built = buildPayload(args);
  if (isFailure(built)) return built;
  const target = classifyTarget(args);
  if (target === "conflict") return failure("NAI_TARGET_CONFLICT", "NovelAI flags conflict with the explicit provider/model target");
  if (target === "non-nai") return failure("NAI_FLAG_TARGET_MISMATCH", "NovelAI flags require a NovelAI provider/model target");
  if (target === "unknown" && policy === "require-explicit") {
    return failure("NAI_EXPLICIT_TARGET_REQUIRED", "NovelAI flags require --provider nai or --model nai-diffusion-*");
  }
  const model = explicitModel(args.model);
  if (needsV5(built) && policy === "require-explicit" && !model) {
    return failure("NAI_V5_MODEL_REQUIRED", "V5-only NovelAI flags require an explicit V5 model");
  }
  if (needsV5(built) && model && !V5_MODEL_IDS.has(model)) {
    return failure("NAI_V5_MODEL_REQUIRED", "V5-only NovelAI flags are not supported by V4.5");
  }
  return { ok: true, value: { hasOptions, payload: built, target } };
}

export function finalizeNaiCliTarget(
  preflight: NaiCliPreflight,
  target: { lane: string; model: string },
): NaiCliResult {
  if (!preflight.hasOptions) return { ok: true, value: preflight };
  if (target.lane !== "nai" || !NAI_MODEL_IDS.has(target.model)) {
    return failure("NAI_FLAG_TARGET_MISMATCH", "NovelAI flags require a resolved NovelAI target");
  }
  if (needsV5(preflight.payload) && !V5_MODEL_IDS.has(target.model)) {
    return failure("NAI_V5_MODEL_REQUIRED", "V5-only NovelAI flags are not supported by V4.5");
  }
  return { ok: true, value: { ...preflight, target: "nai" } };
}
