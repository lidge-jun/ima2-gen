import { config as runtimeConfigDefault } from "../config.js";
import { AGENT_ALLOWED_TOOLS } from "./agentTypes.js";
import { AGENT_TOOL_MANIFEST } from "./agentToolManifest.js";
import { buildCatalog, catalogSummary } from "./contracts/catalog.js";
import { loadAllBundledSnapshots } from "./mcp/snapshotStore.js";
import { KEY_TO_ENV, WRITABLE_CONFIG_KEYS } from "./configKeys.js";
import { DEFAULT_IMAGE_QUALITY, VALID_IMAGE_QUALITIES } from "./oauthNormalize.js";
import { MAX_REF2V_REFERENCES, MAX_REFERENCE_AUDIOS, MAX_VIDEO_DURATION, MIN_VIDEO_DURATION } from "./imageModels.js";
import type { AppConfig } from "./runtimeContext.js";
import { deriveProviderIds } from "./providers/derive.js";

type CapabilitySource = "local" | "server";

const VALID_MODES = ["auto", "direct"] as const;
const VALID_PROVIDERS = ["auto", ...deriveProviderIds()] as const;
const AGENT_COMMANDS = [
  "skill",
  "capabilities",
  "defaults",
  "gen",
  "video",
  "edit",
  "multimode",
  "node generate",
  "inflight ls",
  "providers",
  "oauth status",
  "grok status",
  "prompt build",
];

function toArray<T>(value: Iterable<T> | T[] | undefined): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return [...value];
  return Array.from(value);
}

export function buildIma2Capabilities({
  appConfig = runtimeConfigDefault,
  packageVersion,
  source,
  server = null,
}: {
  appConfig?: AppConfig;
  packageVersion: string;
  source: CapabilitySource;
  server?: string | null;
}) {
  return {
    ok: true,
    name: "ima2",
    source,
    server,
    version: packageVersion,
    commands: AGENT_COMMANDS,
    defaults: {
      oauth: {
        model: appConfig.imageModels.default,
        reasoningEffort: appConfig.imageModels.reasoningEffort,
      },
      api: {
        model: appConfig.apiProvider.defaultImageModel,
        reasoningEffort: appConfig.apiProvider.defaultReasoningEffort,
        size: appConfig.apiProvider.defaultSize,
        webSearchEnabled: appConfig.apiProvider.allowWebSearch,
      },
      grok: {
        model: appConfig.grokProvider.defaultImageModel,
        plannerModel: appConfig.grokProvider.plannerModel,
      },
    },
    valid: {
      imageModels: {
        supported: toArray(appConfig.imageModels.valid),
        unsupported: toArray(appConfig.imageModels.unsupported),
        grokSupported: ["grok-imagine-image-2.0", "grok-imagine-image", "grok-imagine-image-quality"],
        geminiSupported: ["nano-banana-2", "nano-banana-pro"],
        atlasCloudSupported: ["openai/gpt-image-2/text-to-image", "openai/gpt-image-2/edit"],
        minimaxSupported: ["image-01", "image-01-live"],
        naiSupported: ["nai-diffusion-5-full", "nai-diffusion-5-curated", "nai-diffusion-4-5-full", "nai-diffusion-4-5-curated"],
      },
      videoModels: {
        supported: ["grok-imagine-video", "grok-imagine-video-1.5"],
        aliases: { "grok-imagine-video-1.5-preview": "grok-imagine-video-1.5" },
        resolutions: ["480p", "720p", "1080p"],
        resolutionNotes: { "1080p": "grok-imagine-video-1.5 text-to-video canvas shim or image-to-video; reference-to-video unsupported" },
        aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "auto"],
        durationRange: [1, 15],
        maxReferences: 7,
        // Flat numbers above describe the widest case, which is not what any single
        // request is allowed to do. A client that reads only those draws controls the
        // server will reject. These per-mode entries come from the same constants the
        // request path enforces, so the advertisement cannot drift from the behavior.
        // Verified against api.x.ai on 2026-08-20:
        // devlog/_plan/260820_grok15_multi_reference_video/000_research.md
        modes: {
          "text-to-video": {
            maxReferences: 0,
            durationRange: [MIN_VIDEO_DURATION, MAX_VIDEO_DURATION],
            resolutions: ["480p", "720p", "1080p"],
            notes: "1080p on grok-imagine-video-1.5 goes through the white-canvas shim.",
          },
          "image-to-video": {
            maxReferences: 1,
            durationRange: [MIN_VIDEO_DURATION, MAX_VIDEO_DURATION],
            resolutions: ["480p", "720p", "1080p"],
            notes: "The source image becomes the first frame.",
          },
          "reference-to-video": {
            maxReferences: MAX_REF2V_REFERENCES,
            durationRange: [MIN_VIDEO_DURATION, MAX_VIDEO_DURATION],
            resolutions: ["480p", "720p"],
            notes: "References guide the subject without locking the first frame. 1080p is rejected upstream.",
          },
        },
        referenceAudio: {
          maxVoices: MAX_REFERENCE_AUDIOS,
          models: ["grok-imagine-video-1.5"],
          // Not the allowlist: xAI owns the roster and accepts custom voice ids too. An
          // unknown id comes back as a 400 naming every voice it will take.
          knownPresets: [
            "ara", "eve", "leo", "rex", "sal", "carina", "zagan", "helix", "orion",
            "luna", "iris", "altair", "zenith", "perseus", "helios", "lux", "kepler",
            "rigel", "cosmo", "celeste", "ursa", "sirius", "lumen", "castor", "naksh",
            "atlas",
          ],
          presetsAreAuthoritative: false,
        },
      },
      reasoningEfforts: toArray(appConfig.imageModels.validReasoningEfforts),
      quality: toArray(VALID_IMAGE_QUALITIES),
      moderation: toArray(appConfig.oauth.validModeration),
      modes: [...VALID_MODES],
      providers: [...VALID_PROVIDERS],
    },
    configKeys: {
      writable: toArray(WRITABLE_CONFIG_KEYS),
      envOverrides: { ...KEY_TO_ENV },
    },
    defaultsMeta: {
      quality: DEFAULT_IMAGE_QUALITY,
    },
    limits: {
      maxRefCount: appConfig.limits.maxRefCount,
      maxGeneratedImages: appConfig.limits.maxGeneratedImages,
      maxParallel: {
        value: appConfig.limits.maxParallel,
        enforced: true,
        note: "server-side inflight capacity guard uses this runtime limit",
      },
    },
    promptBuilder: {
      available: true,
      route: "/api/prompt-builder/chat",
      cliCommand: "ima2 prompt build",
      structuredOutput: ["intentSummary", "finalPrompt.ko", "finalPrompt.en", "notes"],
      uiOnly: false,
    },
    agentMode: {
      available: true,
      route: "/api/agent/sessions",
      allowedTools: [...AGENT_ALLOWED_TOOLS],
      toolManifest: [...AGENT_TOOL_MANIFEST],
      finalArtifact: "image",
      uiOnly: true,
      cliCommand: null,
    },
    // Additive contract-catalog summary (020 WP2 + 040 WP4 bundled snapshots).
    // Bundled snapshots are lazy-loaded once per process (module cache in the
    // snapshot store). Full machine contracts land with `ima2 tools` (070).
    contracts: catalogSummary(buildCatalog({ snapshots: loadAllBundledSnapshots(appConfig.storage.packageRoot) })),
    guidance: {
      highQuality: "Use --quality high for requests where output fidelity matters.",
      parallelGeneration: "Run multiple ima2 gen commands as separate queued jobs; no --parallel flag is required.",
      i2i: "Use --ref for reference generation, or ima2 edit <file> --prompt \"<text>\" for image edits.",
      defaults: "Use ima2 defaults set model/reasoning for persistent defaults; request flags remain per-call overrides.",
      promptBuilder: "Use ima2 prompt build --message \"...\" to refine prompt intent. Use ima2 gen / ima2 multimode to generate images. Workspace profile settings are UI-only.",
      video: "Use ima2 video \"<prompt>\" to generate video. Prompts must describe visual flow, motion, sound/no-music, dialogue/no-dialogue, and ending frame. Use ima2 video continue \"<prompt>\" --video <generated.mp4> for branch-local last-frame continuation; --topic is legacy best-effort series context.",
    },
  };
}
