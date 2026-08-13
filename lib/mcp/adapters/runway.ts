// Runway adapter (050 WP5) — mappings verified against the authenticated
// tools/list snapshot (tests/fixtures/mcp/runway-tools.sanitized.json).
import {
  collectResultText,
  extractHttpsUrls,
  type MediaJobRequest,
  type MediaProviderAdapter,
  type MediaTaskPoll,
  type ToolCallPlan,
} from "../providerAdapter.js";
import {
  isParameterValueAllowed,
  type McpModelEntry,
  type McpModelParameter,
  type McpPresetValue,
} from "../modelCapabilities.js";

const ratioCapabilities = (aspectRatios: string[], inputRoles: string[]) => ({
  source: "verified-contract" as const,
  aspectRatios,
  parameters: [] as McpModelParameter[],
  inputRoles,
});

const durationOptions = (options: number[], defaultValue: number): McpModelParameter => ({
  name: "duration", type: "number", description: "Output duration in seconds.",
  options, default: defaultValue,
});

const durationRange = (min: number, max: number, defaultValue: number): McpModelParameter => ({
  name: "duration", type: "number", description: "Output duration in seconds.",
  min, max, default: defaultValue,
});

const resolutionOptions = (options: string[]): McpModelParameter => ({
  name: "resolution", type: "string", description: "Output resolution override.", options,
});

const audioParameter = (): McpModelParameter => ({
  name: "generateAudio", type: "boolean", description: "Generate native audio.", default: true,
});

export const RUNWAY_MODEL_CATALOG: Record<"image" | "video", McpModelEntry[]> = {
  image: [
    { id: "nano-banana-pro", label: "Nano Banana Pro", capabilities: ratioCapabilities(["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"], ["text", "image_references"]) },
    { id: "gpt-image-2", label: "GPT Image 2", capabilities: ratioCapabilities(["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"], ["text", "image_references"]) },
    { id: "gen-4", label: "Gen-4 Image", capabilities: ratioCapabilities(["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], ["text", "image_references"]) },
  ],
  video: [
    { id: "seedance-2", label: "Seedance 2", capabilities: { ...ratioCapabilities(["16:9", "9:16", "1:1"], ["text", "start_image", "end_image", "image_references", "video_references"]), parameters: [durationRange(4, 15, 10), resolutionOptions(["480p", "720p", "1080p"]), audioParameter()] } },
    { id: "kling-o3-pro", label: "Kling O3 Pro", capabilities: { ...ratioCapabilities(["16:9", "9:16", "1:1"], ["text", "start_image", "end_image", "image_references", "video_references"]), parameters: [durationOptions([5, 10, 15], 10), audioParameter()] } },
    { id: "kling-3-pro", label: "Kling 3 Pro", capabilities: { ...ratioCapabilities(["16:9", "9:16", "1:1"], ["text", "start_image", "end_image"]), parameters: [durationOptions([5, 10, 15], 10), audioParameter()] } },
    { id: "gen-4.5", label: "Gen-4.5", capabilities: { ...ratioCapabilities(["16:9", "9:16", "1:1"], ["text", "start_image"]), parameters: [durationRange(2, 10, 10), audioParameter()] } },
    { id: "veo-3.1", label: "Veo 3.1", capabilities: { ...ratioCapabilities(["16:9", "9:16", "1:1"], ["text", "start_image", "end_image"]), parameters: [durationOptions([4, 6, 8], 8), resolutionOptions(["720p", "1080p"]), audioParameter()] } },
    { id: "gen-4-turbo", label: "Gen-4 Turbo", capabilities: { ...ratioCapabilities(["16:9", "9:16", "1:1"], ["start_image"]), parameters: [durationOptions([5, 10], 10)] } },
  ],
};

const IMAGE_MODELS = RUNWAY_MODEL_CATALOG.image.map((entry) => entry.id);
const VIDEO_MODELS = RUNWAY_MODEL_CATALOG.video.map((entry) => entry.id);
const DEFAULT_MODEL = { image: "nano-banana-pro", video: "seedance-2" } as const;
const DEFAULT_RATIONALE = "ima2 local studio: user-initiated generation via the ima2 pipeline.";
const TASK_ID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

function modelEntry(request: MediaJobRequest): McpModelEntry {
  const model = request.model ?? DEFAULT_MODEL[request.kind];
  const entry = RUNWAY_MODEL_CATALOG[request.kind].find((candidate) => candidate.id === model);
  if (!entry) throw new Error(`MCP_MODEL_UNSUPPORTED:${model}`);
  return entry;
}

function validatedParameters(request: MediaJobRequest, entry: McpModelEntry): Record<string, McpPresetValue> {
  const selected = { ...(request.parameters ?? {}) };
  for (const [name, value] of Object.entries(selected)) {
    const parameter = entry.capabilities.parameters.find((candidate) => candidate.name === name);
    if (!parameter) throw new Error(`MCP_PARAMETER_UNSUPPORTED:${entry.id}:${name}`);
    if (!isParameterValueAllowed(parameter, value)) {
      throw new Error(`MCP_PARAMETER_INVALID:${entry.id}:${name}`);
    }
  }
  // Cross-field combos are normalized to the nearest supported contract so a
  // default preset selection never self-rejects (sol review F3/F4). Individual
  // out-of-contract values above still reject before any tool call.
  if (entry.id === "veo-3.1" && selected.resolution === "1080p" && selected.duration !== undefined && selected.duration !== 8) {
    selected.duration = 8;
  }
  if (entry.id === "gen-4.5" && request.startFrameUrl && selected.generateAudio !== undefined) {
    delete selected.generateAudio;
  }
  return selected;
}

function validateRequest(request: MediaJobRequest): Record<string, McpPresetValue> {
  const entry = modelEntry(request);
  const roles = entry.capabilities.inputRoles;
  if (request.ratio && !entry.capabilities.aspectRatios.includes(request.ratio)) {
    throw new Error(`MCP_PARAMETER_INVALID:${entry.id}:ratio`);
  }
  if (request.endFrameUrl && !roles.includes("end_image")) {
    throw new Error(`MCP_INPUT_ROLE_UNSUPPORTED:${entry.id}:end_image`);
  }
  if (request.endFrameUrl && !request.startFrameUrl) {
    throw new Error(`MCP_END_FRAME_REQUIRES_START:${entry.id}`);
  }
  if (request.referenceVideoUrl && !roles.includes("video_references")) {
    throw new Error(`MCP_INPUT_ROLE_UNSUPPORTED:${entry.id}:video_references`);
  }
  if (request.startFrameUrl && !roles.includes("start_image")) {
    throw new Error(`MCP_INPUT_ROLE_UNSUPPORTED:${entry.id}:start_image`);
  }
  // Reference images ride the model's declared image_references input role;
  // the tool schema caps them to seedance-2 / kling-o3-pro for video.
  if (request.referenceImages && request.referenceImages.length > 0
    && !roles.includes("image_references")) {
    throw new Error(`MCP_INPUT_ROLE_UNSUPPORTED:${entry.id}:image_references`);
  }
  return validatedParameters(request, entry);
}

/** Tags follow the Runway @alias convention: word characters only, <=32. */
export const REFERENCE_TAG_PATTERN = /^[\p{L}\p{N}_-]{1,32}$/u;

function referenceImagesArg(request: MediaJobRequest): Record<string, unknown> {
  const entries = (request.referenceImages ?? [])
    .filter((ref) => /^https:\/\//i.test(ref.url))
    .slice(0, 3)
    .map((ref) => ({
      url: ref.url,
      ...(ref.tag && REFERENCE_TAG_PATTERN.test(ref.tag) ? { tag: ref.tag } : {}),
    }));
  return entries.length > 0 ? { referenceImages: entries } : {};
}

function buildGenerateCall(request: MediaJobRequest): ToolCallPlan {
  const rationale = request.rationale ?? DEFAULT_RATIONALE;
  const parameters = validateRequest(request);
  if (request.kind === "image") {
    return {
      toolName: "generate_image",
      args: {
        rationale,
        promptText: request.prompt,
        ...(request.model ? { model: request.model } : {}),
        ...(request.ratio ? { ratio: request.ratio } : {}),
        ...referenceImagesArg(request),
        count: 1,
      },
    };
  }
  return {
    toolName: "generate_video",
    args: {
      rationale,
      promptText: request.prompt,
      ...(request.model ? { model: request.model } : {}),
      ...(request.ratio ? { ratio: request.ratio } : {}),
      ...(parameters.duration !== undefined ? { duration: parameters.duration } : {}),
      ...(parameters.resolution !== undefined ? { resolution: parameters.resolution } : {}),
      ...(parameters.generateAudio !== undefined ? { generateAudio: parameters.generateAudio } : {}),
      ...(request.startFrameUrl ? { startFrame: { url: request.startFrameUrl } } : {}),
      ...(request.endFrameUrl ? { endFrame: { url: request.endFrameUrl } } : {}),
      ...referenceImagesArg(request),
      ...(request.referenceVideoUrl ? { referenceVideo: { url: request.referenceVideoUrl } } : {}),
    },
  };
}

function parseTaskId(result: Record<string, unknown>): string | null {
  const structured = result.structuredContent as Record<string, unknown> | undefined;
  for (const key of ["taskId", "id"]) {
    const value = structured?.[key];
    if (typeof value === "string" && value) return value;
  }
  const tasks = structured?.tasks;
  if (Array.isArray(tasks) && tasks[0] && typeof (tasks[0] as { id?: unknown }).id === "string") {
    return (tasks[0] as { id: string }).id;
  }
  const match = collectResultText(result).match(TASK_ID_PATTERN);
  return match ? match[0] : null;
}

function parsePoll(result: Record<string, unknown>): MediaTaskPoll {
  const text = collectResultText(result);
  const statusMatch = text.match(/\b(SUCCEEDED|FAILED|CANCELED|CANCELLED|RUNNING|PENDING|THROTTLED|QUEUED)\b/i);
  const rawStatus = (statusMatch?.[1] ?? "").toUpperCase();
  const status: MediaTaskPoll["status"] =
    rawStatus === "SUCCEEDED" ? "succeeded"
    : rawStatus === "FAILED" ? "failed"
    : rawStatus === "CANCELED" || rawStatus === "CANCELLED" ? "canceled"
    : rawStatus === "RUNNING" ? "running"
    : rawStatus === "PENDING" || rawStatus === "QUEUED" || rawStatus === "THROTTLED" ? "pending"
    : "unknown";
  const outputUrls = collectOutputUrls(result, text);
  const failureDetail = status === "failed" ? text.slice(0, 300) : undefined;
  return { status, outputUrls, ...(failureDetail ? { detail: failureDetail } : {}) };
}

/** Output URL priority (260718): structuredContent.url -> task.artifacts[].url
 *  from the JSON text block -> raw text regex. Merged through a Set because
 *  collectResultText already stringifies structuredContent into the text. */
function collectOutputUrls(result: Record<string, unknown>, text: string): string[] {
  const ordered: string[] = [];
  const push = (url: unknown) => {
    if (typeof url === "string" && /^https:\/\//i.test(url) && !ordered.includes(url)) ordered.push(url);
  };
  const structured = result.structuredContent as Record<string, unknown> | undefined;
  push(structured?.url);
  for (const artifact of artifactsFromText(text)) push(artifact);
  for (const url of extractHttpsUrls(text)) {
    if (/\.(png|jpe?g|webp|mp4|mov|webm)(\?|$)/i.test(url) || /\/datasets?\//i.test(url) || /cloudfront|runway/i.test(url)) push(url);
  }
  return ordered;
}

/** Artifacts carry the real media; previewUrls live under a different key and
 *  are never picked up here. Video artifacts win over image previews. */
function artifactsFromText(text: string): string[] {
  const start = text.indexOf('"task"');
  if (start === -1) return [];
  const brace = text.lastIndexOf("{", start);
  if (brace === -1) return [];
  const end = balancedJsonEnd(text, brace);
  if (end === -1) return [];
  let parsed: { task?: { artifacts?: Array<{ url?: unknown }> } };
  try { parsed = JSON.parse(text.slice(brace, end)); } catch { return []; }
  const urls = (parsed.task?.artifacts ?? [])
    .map((artifact) => artifact?.url)
    .filter((url): url is string => typeof url === "string");
  const videos = urls.filter((url) => /\.(mp4|mov|webm)(\?|$)/i.test(url));
  return videos.length > 0 ? videos : urls;
}

/** End index (exclusive) of the JSON object starting at `brace`, honoring
 *  string escapes — the pretty task block is followed by other content. */
function balancedJsonEnd(text: string, brace: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = brace; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === "\\" && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

export type RunwayMediaAction = "upscale-video" | "upscale-image" | "edit-video" | "edit-video-preview" | "edit-video-submit";

export interface EditVideoInputs {
  url: string;
  prompt?: string;
  keyframeTimestampSeconds?: number;
  keyframeImageUrl?: string;
  keyframeModel?: string;
  upscale?: UpscaleImageParams;
}

/** upscale_image optional parameters (054). scaleFactor > 2 requires flavor "sublime". */
export interface UpscaleImageParams {
  scaleFactor?: 2 | 4 | 8 | 16;
  flavor?: "sublime" | "photo" | "photo_denoiser";
  sharpen?: number;
  smartGrain?: number;
  ultraDetail?: number;
}

/** Native media-action plans (060 WP6). Inputs must be runway-hosted or public HTTPS URLs.
 *  wp5 052: edit-video-preview / edit-video-submit extend the inputs for the 2-step keyframe workflow. */
export function buildRunwayActionCall(action: RunwayMediaAction, inputs: EditVideoInputs & { url: string; prompt?: string }): ToolCallPlan {
  const rationale = DEFAULT_RATIONALE;
  switch (action) {
    case "upscale-video":
      return { toolName: "upscale_video", args: { rationale, video: { url: inputs.url } } };
    case "upscale-image": {
      const upscale = inputs.upscale ?? {};
      if (upscale.scaleFactor !== undefined && ![2, 4, 8, 16].includes(upscale.scaleFactor)) {
        throw new Error("MCP_REQUEST_INVALID:scaleFactor must be 2, 4, 8, or 16");
      }
      if (upscale.scaleFactor !== undefined && upscale.scaleFactor > 2
        && upscale.flavor !== undefined && upscale.flavor !== "sublime") {
        throw new Error("MCP_REQUEST_INVALID:scaleFactor above 2 requires flavor 'sublime'");
      }
      return { toolName: "upscale_image", args: {
        rationale, image: { url: inputs.url },
        ...(upscale.scaleFactor !== undefined ? { scaleFactor: upscale.scaleFactor } : {}),
        ...(upscale.flavor ? { flavor: upscale.flavor } : {}),
        ...(upscale.sharpen !== undefined ? { sharpen: upscale.sharpen } : {}),
        ...(upscale.smartGrain !== undefined ? { smartGrain: upscale.smartGrain } : {}),
        ...(upscale.ultraDetail !== undefined ? { ultraDetail: upscale.ultraDetail } : {}),
      } };
    }
    case "edit-video": {
      if (!inputs.prompt) throw new Error("MCP_ACTION_PROMPT_REQUIRED");
      return { toolName: "edit_video", args: { rationale, promptText: inputs.prompt, video: { url: inputs.url } } };
    }
    case "edit-video-preview": {
      if (!inputs.prompt) throw new Error("MCP_ACTION_PROMPT_REQUIRED");
      return { toolName: "edit_video", args: {
        rationale, promptText: inputs.prompt, video: { url: inputs.url },
        ...(inputs.keyframeTimestampSeconds !== undefined ? { keyframeTimestampSeconds: inputs.keyframeTimestampSeconds } : {}),
        ...(inputs.keyframeModel ? { keyframeModel: inputs.keyframeModel } : {}),
      } };
    }
    case "edit-video-submit": {
      if (!inputs.prompt) throw new Error("MCP_ACTION_PROMPT_REQUIRED");
      if (!inputs.keyframeImageUrl) throw new Error("MCP_ACTION_PREVIEW_REQUIRED");
      return { toolName: "edit_video", args: {
        rationale, promptText: inputs.prompt, video: { url: inputs.url },
        keyframeImage: { url: inputs.keyframeImageUrl },
        ...(inputs.keyframeTimestampSeconds !== undefined ? { keyframeTimestampSeconds: inputs.keyframeTimestampSeconds } : {}),
      } };
    }
  }
}

/** Multishot video plan (wp5 053). */
export function buildMultishotCall(input: {
  storyPrompt?: string | undefined;
  shots?: string[] | undefined;
  duration?: 5 | 10 | 15 | undefined;
  aspectRatio?: string | undefined;
  resolution?: "720p" | "1080p" | undefined;
  sound?: boolean | undefined;
  firstSceneImageUrl?: string | undefined;
}): ToolCallPlan {
  const mode = input.shots && input.shots.length > 0 ? "custom" : "auto";
  if (mode === "custom") {
    if (!input.shots || input.shots.length < 3 || input.shots.length > 5) {
      throw new Error("MCP_REQUEST_INVALID:multishot custom mode requires 3-5 shots");
    }
  } else {
    if (!input.storyPrompt) throw new Error("MCP_REQUEST_INVALID:multishot auto mode requires storyPrompt");
  }
  return {
    toolName: "generate_multishot_video",
    args: {
      rationale: DEFAULT_RATIONALE,
      mode,
      ...(mode === "auto" ? { storyPrompt: input.storyPrompt } : { shots: input.shots!.map((prompt) => ({ prompt })) }),
      ...(input.duration !== undefined ? { duration: input.duration } : {}),
      ...(input.aspectRatio ? { aspectRatio: input.aspectRatio } : {}),
      ...(input.resolution ? { resolution: input.resolution } : {}),
      ...(input.sound !== undefined ? { sound: input.sound } : {}),
      ...(input.firstSceneImageUrl ? { firstSceneImage: { url: input.firstSceneImageUrl } } : {}),
    },
  };
}

export const runwayAdapter: MediaProviderAdapter = {
  provider: "runway",
  models: { image: IMAGE_MODELS, video: VIDEO_MODELS },
  executable: true,
  buildGenerateCall,
  parseTaskId,
  buildPollCall: (taskId: string) => ({
    toolName: "get_task",
    args: { rationale: DEFAULT_RATIONALE, id: taskId },
  }),
  parsePoll,
};
