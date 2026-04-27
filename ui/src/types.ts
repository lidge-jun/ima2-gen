export type UIMode = "classic" | "node" | "card-news";
export type SettingsSection = "account" | "generation" | "appearance" | "language" | "future";
export type ThemePreference = "system" | "dark" | "light";
export type ResolvedTheme = "dark" | "light";
export type ResolvedThemeMode = "dark" | "light";
export type ThemeFamily = "default" | "gpt" | "claude" | "gemini" | "grok";
export const THEME_FAMILIES = [
  "default",
  "gpt",
  "claude",
  "gemini",
  "grok",
] as const satisfies readonly ThemeFamily[];
export type Provider = "oauth" | "api";
export type Quality = "low" | "medium" | "high";
export type Format = "png" | "jpeg" | "webp";
export type Moderation = "low" | "auto";
export type ImageModel = "gpt-5.5" | "gpt-5.4" | "gpt-5.4-mini";
export type UnsupportedImageModel = "gpt-5.3-codex-spark";
export type Count = number;

export type SizePreset =
  | "1024x1024"
  | "1536x1024"
  | "1024x1536"
  | "1360x1024"
  | "1024x1360"
  | "1824x1024"
  | "1024x1824"
  | "2048x2048"
  | "2048x1152"
  | "1152x2048"
  | "3840x2160"
  | "2160x3840"
  | "auto"
  | "custom";

export type GenerateItem = {
  image: string;
  url?: string;
  filename?: string;
  prompt?: string;
  userPrompt?: string | null;
  revisedPrompt?: string | null;
  promptMode?: "auto" | "direct" | null;
  elapsed?: number;
  provider?: string;
  quality?: string;
  size?: string;
  format?: string;
  moderation?: string;
  model?: string | null;
  usage?: { total_tokens?: number } & Record<string, unknown>;
  thumb?: string;
  createdAt?: number;
  sessionId?: string | null;
  nodeId?: string | null;
  clientNodeId?: string | null;
  requestId?: string | null;
  kind?: "classic" | "edit" | "generate" | "card-news-card" | "card-news-set" | null;
  setId?: string | null;
  cardId?: string | null;
  cardOrder?: number | null;
  headline?: string | null;
  body?: string | null;
  cards?: Array<{
    url?: string;
    headline?: string;
    body?: string;
    cardOrder?: number;
    imageFilename?: string;
    status?: string;
  }>;
  refsCount?: number;
  isFavorite?: boolean;
  sequenceId?: string | null;
  sequenceIndex?: number | null;
  sequenceTotalRequested?: number | null;
  sequenceTotalReturned?: number | null;
  sequenceStatus?: "complete" | "partial" | "empty" | null;
};

export type MultimodeSequenceStatus = "pending" | "partial" | "complete" | "empty" | "error";

export type EmbeddedGenerationMetadata = {
  schema: "ima2.generation.v1";
  app: "ima2-gen";
  version?: string | null;
  createdAt?: number | null;
  kind?: string | null;
  prompt?: string | null;
  userPrompt?: string | null;
  revisedPrompt?: string | null;
  promptMode?: "auto" | "direct" | null;
  quality?: string | null;
  size?: string | null;
  format?: string | null;
  moderation?: string | null;
  model?: string | null;
  provider?: string | null;
  sessionId?: string | null;
  nodeId?: string | null;
  parentNodeId?: string | null;
  clientNodeId?: string | null;
  requestId?: string | null;
  refsCount?: number;
  webSearchCalls?: number;
};

export type GenerateSingleResponse = {
  image: string;
  elapsed: number;
  filename: string;
  usage?: GenerateItem["usage"];
  provider: string;
  quality?: string;
  size?: string;
  moderation?: string;
  model?: string | null;
  revisedPrompt?: string | null;
  promptMode?: "auto" | "direct";
};

export type GenerateMultiResponse = {
  images: Array<{ image: string; filename: string }>;
  elapsed: number;
  count: number;
  usage?: GenerateItem["usage"];
  provider: string;
  quality?: string;
  size?: string;
  moderation?: string;
  model?: string | null;
  revisedPrompt?: string | null;
  promptMode?: "auto" | "direct";
};

export type GenerateResponse = GenerateSingleResponse | GenerateMultiResponse;

export function isMultiResponse(r: GenerateResponse): r is GenerateMultiResponse {
  return Array.isArray((r as GenerateMultiResponse).images);
}

export type GenerateRequest = {
  prompt: string;
  quality: Quality;
  size: string;
  format: Format;
  moderation: Moderation;
  provider: Provider;
  n: number;
  model?: ImageModel;
  image?: string;
  references?: string[];
  requestId?: string;
  mode?: "auto" | "direct";
};

export type MultimodeGenerateRequest = Omit<GenerateRequest, "n"> & {
  maxImages: number;
};

export type MultimodeGenerateResponse = {
  ok: boolean;
  requestId: string;
  sequenceId: string;
  requested: number;
  returned: number;
  status: "complete" | "partial" | "empty";
  elapsed: string;
  images: GenerateItem[];
  usage?: GenerateItem["usage"];
  provider: string;
  quality?: string;
  size?: string;
  moderation?: string;
  model?: string | null;
  webSearchCalls?: number;
  promptMode?: "auto" | "direct";
  extraIgnored?: number;
};

export type OAuthStatus = {
  status: "ready" | "auth_required" | "offline" | "starting";
  models?: string[];
};

export type BillingResponse = {
  credits?: { total_granted?: number; total_used?: number };
  costs?: { data?: Array<{ results: Array<{ amount?: { value?: number } }> }> };
  oauth?: boolean;
  apiKeyValid?: boolean;
  apiKeySource?: "none" | "env" | "config";
};
