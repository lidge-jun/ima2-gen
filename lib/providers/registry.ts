import type {
  CoreProviderManifest as CoreProviderManifestShape,
  CoreProviderManifestBase,
  KeyProviderId,
} from "./types.js";

const EDIT = { edit: true, mask: false, streaming: false } as const;
// OAuth/API image models edit, mask, and stream. Masks are real on the active
// path: routes/edit.ts excludes only grok/agy/grok-api/gemini-api/atlascloud/
// minimax from masking and then calls editViaResponses, whose options accept
// `mask` (lib/responsesImageAdapter.ts). The legacy editViaOAuth path in
// lib/oauthProxy/multimodeGenerators.ts rejects masks unconditionally, but no
// route reaches it, so it does not describe current behavior.
const RESPONSES = { edit: true, mask: true, streaming: true } as const;
const UNSUPPORTED = { edit: false, mask: false, streaming: false } as const;

export const REGISTRY = [
  {
    id: "oauth",
    vendor: "openai",
    credentials: [{
      kind: "oauth-proxy",
      // ./config.ts accepts the legacy OAUTH_PORT alias too.
      envVars: ["IMA2_OAUTH_PROXY_PORT", "OAUTH_PORT"],
      configKey: "oauth",
    }],
    models: [
      { id: "gpt-5.5", kind: "image", supports: RESPONSES },
      { id: "gpt-5.4", kind: "image", supports: RESPONSES },
      { id: "gpt-5.4-mini", kind: "image", supports: RESPONSES },
      { id: "gpt-5.6-sol", aliases: ["sol"], kind: "image", supports: RESPONSES },
      { id: "gpt-5.6-terra", aliases: ["terra"], kind: "image", supports: RESPONSES },
      { id: "gpt-5.6-luna", aliases: ["luna"], kind: "image", supports: RESPONSES },
      { id: "gpt-5.3-codex-spark", aliases: ["spark"], kind: "image", supports: UNSUPPORTED },
    ],
    referenceLimits: {},
    elementTaxonomy: "gpt",
    limits: { timeoutMs: 400_000 },
    errorPrefix: null,
  },
  {
    id: "api",
    vendor: "openai",
    credentials: [{
      kind: "api-key",
      keyVocabulary: "openai",
      envVars: ["OPENAI_API_KEY"],
      keyPrefix: "sk-",
      validateUrl: "https://api.openai.com/v1/models",
      configKey: "apiKey",
    }],
    models: [
      { id: "gpt-5.5", kind: "image", supports: RESPONSES },
      { id: "gpt-5.4", kind: "image", supports: RESPONSES },
      { id: "gpt-5.4-mini", kind: "image", supports: RESPONSES },
      { id: "gpt-5.6-sol", aliases: ["sol"], kind: "image", supports: RESPONSES },
      { id: "gpt-5.6-terra", aliases: ["terra"], kind: "image", supports: RESPONSES },
      { id: "gpt-5.6-luna", aliases: ["luna"], kind: "image", supports: RESPONSES },
    ],
    referenceLimits: {},
    elementTaxonomy: "gpt",
    limits: { timeoutMs: 400_000 },
    errorPrefix: null,
  },
  {
    id: "grok",
    vendor: "xai",
    credentials: [{ kind: "oauth-proxy", envVars: ["IMA2_GROK_PROXY_HOST", "IMA2_GROK_PROXY_PORT"], configKey: "grokProvider" }],
    models: [
      { id: "grok-imagine-image-2.0", kind: "image", supports: EDIT },
      { id: "grok-imagine-image", kind: "image", supports: EDIT },
      { id: "grok-imagine-image-quality", kind: "image", supports: EDIT },
      { id: "grok-imagine-video", kind: "video", supports: EDIT },
      { id: "grok-imagine-video-1.5", aliases: ["grok-imagine-video-1.5-preview"], kind: "video", supports: EDIT },
    ],
    referenceLimits: { image: 3, edit: 3, video: 7 },
    elementTaxonomy: "grok",
    limits: { timeoutMs: 300_000 },
    errorPrefix: "GROK_",
  },
  {
    id: "grok-api",
    vendor: "xai",
    credentials: [{
      kind: "api-key",
      keyVocabulary: "xai",
      envVars: ["XAI_API_KEY"],
      keyPrefix: "xai-",
      validateUrl: "https://api.x.ai/v1/models",
      configKey: "xaiApiKey",
    }],
    models: [
      { id: "grok-imagine-image-2.0", kind: "image", supports: EDIT },
      { id: "grok-imagine-image", kind: "image", supports: EDIT },
      { id: "grok-imagine-image-quality", kind: "image", supports: EDIT },
      { id: "grok-imagine-video", kind: "video", supports: EDIT },
      { id: "grok-imagine-video-1.5", aliases: ["grok-imagine-video-1.5-preview"], kind: "video", supports: EDIT },
    ],
    referenceLimits: { image: 3, edit: 3, video: 7 },
    elementTaxonomy: "grok",
    limits: { timeoutMs: 300_000 },
    errorPrefix: "GROK_",
  },
  {
    id: "agy",
    vendor: "google",
    credentials: [{ kind: "local-cli", envVars: ["IMA2_AGY_BIN"], optionalApiKeyEnv: "GEMINI_API_KEY" }],
    models: [
      { id: "nano-banana-2", kind: "image", supports: EDIT },
      { id: "nano-banana-pro", kind: "image", supports: EDIT },
    ],
    referenceLimits: { image: 3, edit: 3 },
    elementTaxonomy: "gpt",
    limits: { timeoutMs: 360_000 },
    errorPrefix: "AGY_",
  },
  {
    id: "gemini-api",
    vendor: "google",
    credentials: [
      {
        kind: "api-key",
        keyVocabulary: "gemini",
        envVars: ["GEMINI_API_KEY"],
        keyPrefix: "AI",
        validateUrl: "https://generativelanguage.googleapis.com/v1beta/models",
        configKey: "geminiApiKey",
      },
      { kind: "service-account", envVars: ["VERTEX_SERVICE_ACCOUNT_JSON"], configKey: "vertexServiceAccountJson" },
    ],
    models: [
      { id: "nano-banana-2", kind: "image", supports: EDIT },
      { id: "nano-banana-pro", kind: "image", supports: EDIT },
    ],
    referenceLimits: { image: 3, edit: 3 },
    elementTaxonomy: "gemini",
    limits: { timeoutMs: 120_000 },
    errorPrefix: "GEMINI_API_",
  },
  {
    id: "atlascloud",
    vendor: "atlascloud",
    credentials: [{
      kind: "api-key",
      keyVocabulary: "atlascloud",
      envVars: ["ATLASCLOUD_API_KEY"],
      keyPrefix: "apikey-",
      validateUrl: "https://api.atlascloud.ai/api/v1/models",
      configKey: "atlasCloudApiKey",
    }],
    models: [
      { id: "openai/gpt-image-2/text-to-image", kind: "image", supports: EDIT },
      { id: "openai/gpt-image-2/edit", kind: "image", supports: EDIT },
    ],
    referenceLimits: { image: 10, edit: 10 },
    elementTaxonomy: "gpt",
    limits: { timeoutMs: 180_000 },
    errorPrefix: "ATLASCLOUD_",
  },
  {
    id: "minimax",
    vendor: "minimax",
    credentials: [{
      kind: "api-key",
      keyVocabulary: "minimax",
      envVars: ["MINIMAX_API_KEY"],
      validateUrl: "https://api.minimax.io/v1/models",
      // routes/keys.ts resolves the global or CN host per workspace region.
      validateUrlIsFallback: true,
      configKey: "minimaxApiKey",
    }],
    models: [
      { id: "image-01", kind: "image", supports: EDIT },
      { id: "image-01-live", kind: "image", supports: EDIT },
    ],
    referenceLimits: { image: 1, edit: 1 },
    elementTaxonomy: "gpt",
    limits: { timeoutMs: 120_000, maxInputBytes: 50 * 1024 * 1024 },
    errorPrefix: "MINIMAX_",
  },
  {
    id: "nai",
    vendor: "novelai",
    credentials: [{
      kind: "api-key",
      keyVocabulary: "nai",
      envVars: ["NOVELAI_API_KEY"],
      // No keyPrefix by design: NovelAI accepts both a persistent API token and
      // a session JWT and publishes no prefix for either, so a format rule here
      // would reject valid tokens.
      // Account endpoints now live on the IMAGE host. api.novelai.net answers
      // every /user/* call with 400 "Please refresh NovelAI.net. If using a
      // third-party tool, update to the image URL." (verified live 2026-08-25);
      // validating there would reject every valid token. This host returns 200
      // for a good token and 401 for a bad one.
      validateUrl: "https://image.novelai.net/user/data",
      configKey: "naiApiKey",
    }],
    models: [
      // EDIT rather than UNSUPPORTED, deliberately. `supports` has no "generate"
      // bit, so an all-false triple means "listed but cannot produce images at
      // all" (that is what gpt-5.3-codex-spark is) and would push these models
      // into UNSUPPORTED_IMAGE_MODEL_IDS — wrong, since V5 generates fine.
      // Reference input is refused at the ROUTES (NAI_REF_UNSUPPORTED /
      // NAI_EDIT_UNSUPPORTED) and `referenceLimits` below declares no capacity,
      // so nothing here advertises an img2img path the adapter lacks.
      { id: "nai-diffusion-5-full", aliases: ["nai-v5-full"], kind: "image", supports: EDIT },
      { id: "nai-diffusion-5-curated", aliases: ["nai-v5-curated"], kind: "image", supports: EDIT },
      { id: "nai-diffusion-4-5-full", aliases: ["nai-v45-full"], kind: "image", supports: EDIT },
      { id: "nai-diffusion-4-5-curated", aliases: ["nai-v45-curated"], kind: "image", supports: EDIT },
    ],
    // Empty because the lane accepts no reference input at all; the routes
    // refuse it with NAI_REF_UNSUPPORTED rather than dropping it silently.
    referenceLimits: {},
    elementTaxonomy: "gpt",
    // Diffusion at V5 resolutions is slower than a hosted REST image call, so
    // this sits above MiniMax's 120s while staying well under Comfy's local-GPU
    // ceiling.
    limits: { timeoutMs: 180_000, maxInputBytes: 50 * 1024 * 1024 },
    errorPrefix: "NAI_",
  },
  {
    id: "comfy",
    vendor: "comfy",
    credentials: [{
      kind: "local-http",
      envVars: ["IMA2_COMFY_URL"],
      configKey: "comfy",
    }],
    // Empty BY CONSTRUCTION, not by omission. A comfy "model" is a workflow the
    // user registered at runtime, so no compile-time list can be correct — see
    // catalogAccess below. deriveModelsFrom() returns an empty Set for [] rather
    // than throwing (lib/providers/deriveCore.ts), so the derive layer already
    // tolerates this; the lane builder in routes/models.ts supplies the real list.
    models: [],
    catalogAccess: "runtime",
    // A defensive request-level cap, not a workflow property: how many
    // references a given graph accepts is decided by its LoadImage bindings.
    referenceLimits: { image: 4, edit: 4 },
    elementTaxonomy: null,
    // Local GPUs are slower than hosted APIs and the job may sit in ComfyUI's
    // own queue first. Grok video carries the same 30-minute ceiling for the
    // same reason (config.ts:353).
    limits: { timeoutMs: 1_800_000 },
    errorPrefix: "COMFY_",
  },
] as const satisfies readonly CoreProviderManifestBase[];

export type CoreProviderId = (typeof REGISTRY)[number]["id"];
export type CoreProviderManifest = CoreProviderManifestShape<CoreProviderId>;

function assertUniqueProviderIds(): void {
  const ids = REGISTRY.map((provider) => provider.id);
  if (new Set(ids).size !== ids.length) throw new Error("CORE_PROVIDER_ID_DUPLICATE");
}

assertUniqueProviderIds();

export function listProviders(): CoreProviderManifest[] {
  return REGISTRY.map((provider) => provider as CoreProviderManifest);
}

export function getProvider(id: CoreProviderId): CoreProviderManifest {
  const provider = REGISTRY.find((entry) => entry.id === id);
  if (!provider) throw new Error(`CORE_PROVIDER_UNKNOWN:${id}`);
  return provider as CoreProviderManifest;
}

export function byKeyVocabulary(id: KeyProviderId): CoreProviderManifest[] {
  return listProviders().filter((provider) => provider.credentials.some(
    (credential) => credential.kind === "api-key" && credential.keyVocabulary === id,
  ));
}
