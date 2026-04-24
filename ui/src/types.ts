export type UIMode = "classic" | "node";
export type SettingsSection = "account" | "generation" | "appearance" | "language" | "future";
export type ThemePreference = "system" | "dark" | "light";
export type ResolvedTheme = "dark" | "light";
export type Provider = "oauth" | "api";
export type Quality = "low" | "medium" | "high";
export type Format = "png" | "jpeg" | "webp";
export type Moderation = "low" | "auto";
export type ImageModel = "gpt-5.5" | "gpt-5.4" | "gpt-5.4-mini";
export type UnsupportedImageModel = "gpt-5.3-codex-spark";
export type Count = 1 | 2 | 4;

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
  | "3824x2160"
  | "2160x3824"
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
  moderation?: string;
  model?: string | null;
  usage?: { total_tokens?: number } & Record<string, unknown>;
  thumb?: string;
  createdAt?: number;
  sessionId?: string | null;
  nodeId?: string | null;
  clientNodeId?: string | null;
  requestId?: string | null;
  kind?: "classic" | "edit" | "generate" | null;
  refsCount?: number;
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
