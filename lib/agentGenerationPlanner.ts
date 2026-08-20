import type {
  AgentGenerationPlan,
  AgentGenerationPlanSource,
  AgentGenerationSettings,
  AgentSourceImagePolicy,
  AgentSlashCommand,
  AgentVideoParams,
} from "./agentTypes.js";
import { config } from "../config.js";

const HARD_MAX_VARIANTS = Math.max(1, Math.trunc(Number(config.limits.maxGeneratedImages) || 24));
const AMBIGUOUS_MULTI_VARIANTS = 3;
const KOREAN_COUNT_WORDS: Array<[RegExp, number]> = [
  [/(?:스물네|스물\s*네|이십사)\s*(?:장|개|가지|컷|시안|버전)/u, 24],
  [/(?:열두|열\s*두|십이)\s*(?:장|개|가지|컷|시안|버전)/u, 12],
  [/(?:열|열\s*개)\s*(?:장|개|가지|컷|시안|버전)?/u, 10],
  [/(?:한|하나)\s*(?:장|개|가지|컷|시안|버전)/u, 1],
  [/(?:두|둘)\s*(?:장|개|가지|컷|시안|버전)/u, 2],
  [/(?:세|셋)\s*(?:장|개|가지|컷|시안|버전)/u, 3],
  [/(?:네|넷)\s*(?:장|개|가지|컷|시안|버전)/u, 4],
  [/(?:다섯)\s*(?:장|개|가지|컷|시안|버전)/u, 5],
  [/(?:여섯)\s*(?:장|개|가지|컷|시안|버전)/u, 6],
  [/(?:일곱)\s*(?:장|개|가지|컷|시안|버전)/u, 7],
  [/(?:여덟)\s*(?:장|개|가지|컷|시안|버전)/u, 8],
  [/(?:아홉)\s*(?:장|개|가지|컷|시안|버전)/u, 9],
];
const ENGLISH_COUNT_WORDS: Array<[RegExp, number]> = [
  [/\btwenty[-\s]?four\s*(?:image|variant|version|option|candidate|shot|render)?s?\b/iu, 24],
  [/\btwelve\s*(?:image|variant|version|option|candidate|shot|render)?s?\b/iu, 12],
  [/\bten\s*(?:image|variant|version|option|candidate|shot|render)?s?\b/iu, 10],
  [/\bone\s*(?:image|variant|version|option|candidate|shot|render)?s?\b/iu, 1],
  [/\btwo\s*(?:image|variant|version|option|candidate|shot|render)?s?\b/iu, 2],
  [/\bthree\s*(?:image|variant|version|option|candidate|shot|render)?s?\b/iu, 3],
  [/\bfour\s*(?:image|variant|version|option|candidate|shot|render)?s?\b/iu, 4],
  [/\bfive\s*(?:image|variant|version|option|candidate|shot|render)?s?\b/iu, 5],
  [/\bsix\s*(?:image|variant|version|option|candidate|shot|render)?s?\b/iu, 6],
  [/\bseven\s*(?:image|variant|version|option|candidate|shot|render)?s?\b/iu, 7],
  [/\beight\s*(?:image|variant|version|option|candidate|shot|render)?s?\b/iu, 8],
  [/\bnine\s*(?:image|variant|version|option|candidate|shot|render)?s?\b/iu, 9],
];
const NUMERIC_COUNT_PATTERN = /(?:^|\b)(\d{1,3})\s*(?:장|개|가지|컷|시안|버전|image|images|variant|variants|version|versions|option|options|candidate|candidates|shot|shots|render|renders)(?:\b|$)/iu;

type PlanningInput = {
  prompt: string;
  settings: AgentGenerationSettings;
  command?: AgentSlashCommand | null | undefined;
};

type VariantDecision = {
  count: number;
  requested: number;
  source: AgentGenerationPlanSource;
  reason: string;
};

export function deriveAgentGenerationPlan({ prompt, settings, command = null }: PlanningInput): AgentGenerationPlan {
  if (command?.name === "question" || command?.name === "help") {
    return {
      mode: "question",
      prompts: [],
      requestedVariants: 0,
      plannedVariants: 0,
      plannedParallelism: 0,
      source: "question-command",
      reason: command.name === "help" ? "Slash help answered without image generation." : "Question command answered without image generation.",
      command: command.name,
      assistantText: null,
      sourceImagePolicy: null,
    };
  }

  if (isVideoIntent(prompt)) {
    return {
      mode: "video",
      prompts: [prompt],
      requestedVariants: 1,
      plannedVariants: 1,
      plannedParallelism: 1,
      source: "auto-request",
      reason: "Video generation detected from prompt keywords.",
      command: command?.name ?? null,
      assistantText: null,
      sourceImagePolicy: "auto",
    };
  }

  const variantDecision = decideVariantCount(prompt, settings, command);
  const plannedParallelism = resolvePlannedParallelism(settings, variantDecision.count, command);
  const prompts = buildGenerationPrompts(prompt, variantDecision.count);
  return {
    mode: prompts.length > 1 ? "fanout" : "single",
    prompts,
    requestedVariants: variantDecision.requested,
    plannedVariants: prompts.length,
    plannedParallelism,
    source: variantDecision.source,
    reason: variantDecision.reason,
    command: command?.name ?? null,
    assistantText: null,
    sourceImagePolicy: inferSourceImagePolicy(prompt, prompts.length > 1 ? "fanout" : "single"),
  };
}

export function normalizeAgentGenerationPlan(
  prompt: string,
  value: unknown,
  settings: AgentGenerationSettings,
): AgentGenerationPlan {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const prompts = cleanPromptArray(input.prompts);
  // errors/question modes legitimately carry no generation prompts — they
  // must be resolved before the empty-prompts fallback re-derives a regex plan.
  if (input.mode === "errors" || input.mode === "question") {
    return {
      mode: input.mode,
      prompts: [],
      requestedVariants: 0,
      plannedVariants: 0,
      plannedParallelism: 0,
      source: cleanPlanSource(input.source),
      reason: cleanReason(
        input.reason,
        input.mode === "errors" ? "User asked about recent generation failures." : "User asked a question answered without generation.",
      ),
      command: cleanCommandName(input.command),
      assistantText: typeof input.assistantText === "string" ? input.assistantText : null,
      videoParams: null,
      sourceImagePolicy: null,
    };
  }
  if (prompts.length === 0) return deriveAgentGenerationPlan({ prompt, settings, command: cleanCommand(input.command) });

  const plannedVariants = cleanCount(input.plannedVariants, prompts.length, 0, HARD_MAX_VARIANTS);
  const requestedParallelism = cleanCount(input.plannedParallelism, settings.parallelism, 1, HARD_MAX_VARIANTS);
  const plannedParallelism = resolvePlannedParallelism({ ...settings, parallelism: requestedParallelism }, plannedVariants, null);
  const mode: AgentGenerationPlan["mode"] = input.mode === "question"
    ? "question"
    : input.mode === "video"
      ? "video"
      : prompts.length > 1 ? "fanout" : "single";
  return {
    mode,
    prompts,
    requestedVariants: cleanCount(input.requestedVariants, plannedVariants, 0, HARD_MAX_VARIANTS),
    plannedVariants,
    plannedParallelism,
    source: cleanPlanSource(input.source),
    reason: cleanReason(input.reason, prompts.length > 1 ? "Stored fanout plan." : "Stored single-image plan."),
    command: cleanCommandName(input.command),
    assistantText: typeof input.assistantText === "string" ? input.assistantText : null,
    videoParams: mode === "video" ? cleanVideoParams(input.videoParams) : null,
    sourceImagePolicy: cleanSourceImagePolicy(input.sourceImagePolicy) ?? inferSourceImagePolicy(prompt, mode),
  };
}

function inferSourceImagePolicy(prompt: string, mode: AgentGenerationPlan["mode"]): AgentSourceImagePolicy | null {
  if (mode === "question" || mode === "errors") return null;
  if (mode === "video") return "auto";
  const text = prompt.trim();
  if (/(?:i2i\s*말고|image-to-image\s*말고|새로운\s*방식|새로|별도|독립|from\s+scratch|new\s+image|fresh\s+image|without\s+(?:reference|refs?)|no\s+(?:reference|refs?))/iu.test(text)) {
    return "none";
  }
  if (/(?:이\s*이미지|현재\s*이미지|방금\s*(?:그거|그\s*이미지|이미지)|참조|레퍼런스|reference|refs?|i2i|image-to-image|수정|편집|바꿔|변형|유지(?:해서)?|그걸|그거)/iu.test(text)) {
    return "current";
  }
  return "none";
}

function decideVariantCount(
  prompt: string,
  settings: AgentGenerationSettings,
  command: AgentSlashCommand | null,
): VariantDecision {
  if (command?.name === "variants" || command?.name === "generate") {
    const count = clampCount(command.value ?? AMBIGUOUS_MULTI_VARIANTS, HARD_MAX_VARIANTS);
    return {
      count,
      requested: count,
      source: "slash-command",
      reason: `Slash command requested ${count} variant${count === 1 ? "" : "s"}.`,
    };
  }

  if (settings.generationStrategy === "manual") {
    const count = clampCount(settings.variants, HARD_MAX_VARIANTS);
    return {
      count,
      requested: count,
      source: "manual-settings",
      reason: `Manual settings requested ${count} variant${count === 1 ? "" : "s"}.`,
    };
  }

  const inferred = inferRequestedVariantCount(prompt);
  const capped = Math.min(inferred.count, clampCount(settings.maxAutoVariants, HARD_MAX_VARIANTS));
  return {
    count: capped,
    requested: inferred.count,
    source: inferred.count > 1 ? "auto-request" : "auto-default",
    reason: capped < inferred.count
      ? `User request implied ${inferred.count} variants; capped at ${capped}.`
      : inferred.reason,
  };
}

function inferRequestedVariantCount(prompt: string): { count: number; reason: string } {
  const text = prompt.trim();
  const numericMatch = NUMERIC_COUNT_PATTERN.exec(text);
  if (numericMatch) {
    const count = Math.max(1, Math.trunc(Number.parseInt(numericMatch[1] ?? "", 10) || 1));
    return { count, reason: `User request explicitly implies ${count} variant${count === 1 ? "" : "s"}.` };
  }
  for (const [pattern, count] of [...KOREAN_COUNT_WORDS, ...ENGLISH_COUNT_WORDS]) {
    if (pattern.test(text)) {
      return { count, reason: `User request explicitly implies ${count} variant${count === 1 ? "" : "s"}.` };
    }
  }
  if (/(?:여러|몇\s*가지|시안|후보|버전|다양하게|several|multiple|options|variants|versions|candidates|alternatives)/iu.test(text)) {
    return { count: AMBIGUOUS_MULTI_VARIANTS, reason: `User request asks for multiple options; planning ${AMBIGUOUS_MULTI_VARIANTS} variants.` };
  }
  if (/(?:비교|대안|a\/b|compare|comparison)/iu.test(text)) {
    return { count: 2, reason: "User request implies comparison; planning 2 variants." };
  }
  return { count: 1, reason: "Defaulting to one image because the request did not ask for multiple variants." };
}

function resolvePlannedParallelism(
  settings: AgentGenerationSettings,
  plannedVariants: number,
  command: AgentSlashCommand | null,
): number {
  if (plannedVariants <= 0) return 0;
  const requested = command?.name === "parallelism" && command.value ? command.value : settings.parallelism;
  const providerCap = settings.provider === "oauth" ? 2 : HARD_MAX_VARIANTS;
  const qualityCap = settings.quality === "high" ? 2 : HARD_MAX_VARIANTS;
  return Math.max(1, Math.min(plannedVariants, clampCount(requested, HARD_MAX_VARIANTS), providerCap, qualityCap));
}

function buildGenerationPrompts(prompt: string, count: number): string[] {
  if (count <= 1) return [prompt];
  return Array.from({ length: count }, (_, index) => [
    prompt,
    "",
    `Variant ${index + 1}/${count}: explore a distinct composition while preserving the request.`,
  ].join("\n"));
}

function cleanPromptArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, HARD_MAX_VARIANTS)
    .map((item) => item.trim());
}

function cleanPlanSource(value: unknown): AgentGenerationPlanSource {
  if (
    value === "auto-default" ||
    value === "auto-request" ||
    value === "manual-settings" ||
    value === "slash-command" ||
    value === "question-command" ||
    value === "llm-planner"
  ) return value;
  return "auto-default";
}

function cleanSourceImagePolicy(value: unknown): AgentSourceImagePolicy | null {
  if (value === "auto" || value === "none" || value === "current") return value;
  return null;
}

export function cleanVideoParams(value: unknown): AgentVideoParams | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const params: AgentVideoParams = {};
  const duration = typeof input.duration === "number" ? input.duration : Number(input.duration);
  if (Number.isFinite(duration)) params.duration = Math.max(1, Math.min(15, Math.round(duration)));
  if (input.resolution === "480p" || input.resolution === "720p" || input.resolution === "1080p") params.resolution = input.resolution;
  if (typeof input.aspectRatio === "string" && /^(auto|16:9|9:16|4:3|3:4|3:2|2:3|1:1)$/.test(input.aspectRatio)) {
    params.aspectRatio = input.aspectRatio;
  }
  if (input.mode === "text-to-video" || input.mode === "image-to-video" || input.mode === "reference-to-video") {
    params.mode = input.mode;
  }
  return Object.keys(params).length > 0 ? params : null;
}

function cleanCommandName(value: unknown): AgentGenerationPlan["command"] {
  if (
    value === "question" ||
    value === "help" ||
    value === "variants" ||
    value === "generate" ||
    value === "parallelism"
  ) return value;
  return null;
}

function cleanCommand(value: unknown): AgentSlashCommand | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const name = cleanCommandName(input.name);
  if (!name) return null;
  return {
    name,
    rawName: typeof input.rawName === "string" ? input.rawName : name,
    raw: typeof input.raw === "string" ? input.raw : "",
    prompt: typeof input.prompt === "string" ? input.prompt : "",
    ...(typeof input.value === "number" ? { value: input.value } : {}),
  };
}

function cleanReason(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 240) : fallback;
}

function cleanCount(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function clampCount(value: number, max: number): number {
  return Math.max(1, Math.min(max, Math.round(value)));
}

const VIDEO_INTENT_PATTERN = /(?:^|\s|[^\p{L}])(?:video|animate|animation)(?:\s|[^\p{L}]|$)|(?:동영상|비디오|영상|애니메이트|움직이|클립)/iu;

function isVideoIntent(prompt: string): boolean {
  return VIDEO_INTENT_PATTERN.test(prompt);
}

export interface VideoParamsFromPrompt {
  duration?: number | undefined;
  resolution?: "480p" | "720p" | "1080p" | undefined;
  aspectRatio?: string | undefined;
}

const DURATION_PATTERN = /(\d{1,2})\s*(?:s|sec|seconds?|초)/i;
const RESOLUTION_PATTERN = /(1080p|720p|480p)/i;
const ASPECT_PATTERN = /(16:9|9:16|4:3|3:4|3:2|2:3|1:1)/;

export function parseVideoParams(prompt: string): VideoParamsFromPrompt {
  const params: VideoParamsFromPrompt = {};
  const durMatch = DURATION_PATTERN.exec(prompt);
  if (durMatch) {
    const d = parseInt(durMatch[1] ?? "", 10);
    if (d >= 1 && d <= 15) params.duration = d;
  }
  const resMatch = RESOLUTION_PATTERN.exec(prompt);
  if (resMatch?.[1]) params.resolution = resMatch[1].toLowerCase() as "480p" | "720p" | "1080p";
  const aspMatch = ASPECT_PATTERN.exec(prompt);
  if (aspMatch) params.aspectRatio = aspMatch[1];
  return params;
}
