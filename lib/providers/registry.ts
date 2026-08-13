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
      { id: "grok-imagine-image", kind: "image", supports: EDIT },
      { id: "grok-imagine-image-quality", kind: "image", supports: EDIT },
      { id: "grok-imagine-video", kind: "video", supports: EDIT },
      { id: "grok-imagine-video-1.5", aliases: ["grok-imagine-video-1.5-preview"], kind: "video", supports: EDIT },
    ],
    referenceLimits: { image: 3, edit: 3, video: 7 },
    elementTaxonomy: "grok",
    limits: { timeoutMs: 120_000 },
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
      { id: "grok-imagine-image", kind: "image", supports: EDIT },
      { id: "grok-imagine-image-quality", kind: "image", supports: EDIT },
      { id: "grok-imagine-video", kind: "video", supports: EDIT },
      { id: "grok-imagine-video-1.5", aliases: ["grok-imagine-video-1.5-preview"], kind: "video", supports: EDIT },
    ],
    referenceLimits: { image: 3, edit: 3, video: 7 },
    elementTaxonomy: "grok",
    limits: { timeoutMs: 120_000 },
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
