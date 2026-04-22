export type Mode = "t2i" | "i2i";
export type Provider = "oauth" | "api";
export type Quality = "low" | "medium" | "high";
export type Format = "png" | "jpeg" | "webp";
export type Moderation = "low" | "auto";
export type Count = 1 | 2 | 4;

export type SizePreset =
  | "1024x1024"
  | "1536x1024"
  | "1024x1536"
  | "2048x2048"
  | "2048x1152"
  | "auto"
  | "3840x2160"
  | "2160x3840"
  | "custom";

export type GenerateItem = {
  image: string;
  filename?: string;
  prompt?: string;
  elapsed?: number;
  provider?: string;
  usage?: { total_tokens?: number } & Record<string, unknown>;
  thumb?: string;
};

export type GenerateSingleResponse = {
  image: string;
  elapsed: number;
  filename: string;
  usage?: GenerateItem["usage"];
  provider: string;
};

export type GenerateMultiResponse = {
  images: Array<{ image: string; filename: string }>;
  elapsed: number;
  count: number;
  usage?: GenerateItem["usage"];
  provider: string;
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
  image?: string;
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
};
